import { describe, expect, it, vi } from 'vitest'

import { createToolRuntime } from '../desktop/src/main/tools/runtime'
import { createWebSearchTools } from '../desktop/src/main/tools/web-search'

const actor = { type: 'agent' as const, id: 'general-purpose' }

function textResponse(body: string, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(body)
  } as Response
}

describe('web.search tool', () => {
  it('lists a builtin readonly network search descriptor', () => {
    const [tool] = createWebSearchTools({ fetch: vi.fn() as unknown as typeof fetch })

    expect(tool?.descriptor).toMatchObject({
      id: 'web.search',
      name: 'Search Web',
      category: 'web',
      owner: { kind: 'builtin', id: 'core' },
      permissions: [{ kind: 'network', reason: 'Queries the public web for current information.' }],
      concurrency: 'readonly',
      enabled: true
    })
  })

  it('requires explicit approval before making a network search request', async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
    const runtime = createToolRuntime({
      tools: createWebSearchTools({ fetch: fetchMock as unknown as typeof fetch })
    })

    const result = await runtime.invoke({
      toolId: 'web.search',
      input: { query: 'OpenAI latest news' },
      actor,
      traceId: 'trace-web-search-approval'
    })

    expect(fetchMock).not.toHaveBeenCalled()
    expect(result.record.status).toBe('denied')
    expect(result.error).toMatchObject({
      errorClass: 'tool_permission_denied',
      message: 'Web search sends a query to the public internet and requires approval.',
      retryable: false
    })
  })

  it('searches through the injected fetch and returns compact source results', async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValue(textResponse(`
        <ol id="b_results">
          <li class="b_algo">
            <h2><a href="https://www.bing.com/ck/a?u=a1aHR0cHM6Ly9vcGVuYWkuY29tL25ld3M">OpenAI <strong>News</strong></a></h2>
            <div class="b_caption"><p>Official OpenAI news page.</p></div>
          </li>
          <li class="b_algo">
            <h2><a href="https://platform.openai.com/docs">OpenAI Docs</a></h2>
            <div class="b_caption"><p>Official documentation.</p></div>
          </li>
        </ol>
      `))
    const runtime = createToolRuntime({
      idFactory: () => 'invoke-web-search',
      clock: () => 1_783_382_400_000,
      tools: createWebSearchTools({
        fetch: fetchMock as unknown as typeof fetch,
        clock: () => 1_783_382_400_000
      })
    })

    const result = await runtime.invoke({
      toolId: 'web.search',
      input: { query: 'OpenAI latest news', limit: 2 },
      actor,
      traceId: 'trace-web-search',
      approvedInvocation: {
        toolId: 'web.search',
        input: { query: 'OpenAI latest news', limit: 2 },
        approvedBy: { type: 'user', id: 'user-local' }
      }
    })

    expect(result.error).toBeUndefined()
    const [calledUrl, calledInit] = fetchMock.mock.calls[0] ?? []
    expect(calledUrl).toBe('https://www.bing.com/search?q=OpenAI%20latest%20news')
    expect(calledInit).toMatchObject({ headers: { Accept: 'text/html,text/plain' } })
    expect(result.output).toEqual({
      query: 'OpenAI latest news',
      searchedAt: '2026-07-07T00:00:00.000Z',
      results: [
        { title: 'OpenAI News', url: 'https://openai.com/news', snippet: 'Official OpenAI news page.' },
        { title: 'OpenAI Docs', url: 'https://platform.openai.com/docs', snippet: 'Official documentation.' }
      ],
      truncated: false
    })
  })

  it('returns a structured tool error when the search endpoint fails', async () => {
    const fetchMock = vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>()
      .mockResolvedValue(textResponse('', 503))
    const runtime = createToolRuntime({
      tools: createWebSearchTools({
        fetch: fetchMock as unknown as typeof fetch
      })
    })

    const result = await runtime.invoke({
      toolId: 'web.search',
      input: { query: 'OpenAI latest news' },
      actor,
      traceId: 'trace-web-search-fail',
      approvedInvocation: {
        toolId: 'web.search',
        input: { query: 'OpenAI latest news' },
        approvedBy: { type: 'user', id: 'user-local' }
      }
    })

    expect(result.error).toMatchObject({
      errorClass: 'tool_runtime_failed',
      code: 'web_search_failed',
      retryable: true
    })
  })
})
