import { describe, expect, it } from 'vitest'

import type { GatewayRequest } from '../shared/gateway'
import { createOpenAICompatibleProvider } from '../desktop/src/main/providers/openai-compatible.provider'
import { GatewayProviderError } from '../desktop/src/main/providers/registry'

function createImageRequest(overrides: Partial<GatewayRequest> = {}): GatewayRequest {
  return {
    channel: 'image',
    modelKey: 'gpt-image-1',
    prompt: 'red spaceship over a moon',
    references: [],
    parameters: { size: '1024x1024' },
    idempotencyKey: 'idem-image-1',
    ...overrides
  }
}

function createJsonResponse(body: unknown, ok = true, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
    statusText: ok ? 'OK' : 'Provider Error'
  })
}

interface FetchCall {
  input: Parameters<typeof fetch>[0]
  init: Parameters<typeof fetch>[1]
}

function createFetchMock(handler?: (input: Parameters<typeof fetch>[0], init: Parameters<typeof fetch>[1]) => Promise<Response>): typeof fetch & { calls: FetchCall[] } {
  const calls: FetchCall[] = []
  const fetchMock = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    calls.push({ input, init })

    if (handler) {
      return handler(input, init)
    }

    return createJsonResponse({ data: [{ b64_json: Buffer.from('image-bytes').toString('base64') }] })
  }) as typeof fetch & { calls: FetchCall[] }

  fetchMock.calls = calls
  return fetchMock
}

function inputUrl(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === 'string') {
    return input
  }

  if (input instanceof URL) {
    return input.href
  }

  return input.url
}

function requestBody(call: FetchCall | undefined): string {
  const body = call?.init?.body

  if (typeof body === 'string') {
    return body
  }

  throw new Error('expected string request body')
}

describe('M3 OpenAI-compatible provider', () => {
  it('normalizes OpenAI image base64 responses to asset bytes without provider fields', async () => {
    const fetchMock = createFetchMock()
    const provider = createOpenAICompatibleProvider({
      id: 'openai-main',
      baseUrl: 'https://api.example.test/v1',
      apiKey: 'sk-secret-value',
      modelKeys: { image: 'gpt-image-1' },
      fetchImpl: fetchMock
    })

    const result = await provider.invoke(createImageRequest())

    expect(fetchMock.calls).toHaveLength(1)
    expect(fetchMock.calls[0]?.input).toBe('https://api.example.test/v1/images/generations')
    expect(JSON.parse(requestBody(fetchMock.calls[0]))).toEqual({
      model: 'gpt-image-1',
      prompt: 'red spaceship over a moon',
      n: 1,
      response_format: 'b64_json',
      size: '1024x1024'
    })
    expect(fetchMock.calls[0]?.init?.headers).toMatchObject({
      Authorization: 'Bearer sk-secret-value',
      'Content-Type': 'application/json'
    })
    expect(result.kind).toBe('assetBytes')
    if (result.kind !== 'assetBytes') {
      throw new Error('expected assetBytes')
    }
    expect(result.mediaType).toBe('image')
    expect(Buffer.from(result.bytes).toString('utf8')).toBe('image-bytes')
    expect(result.metadata).toMatchObject({
      mediaType: 'image',
      mimeType: 'image/png',
      sizeBytes: 11
    })
    expect(Object.keys(result).sort()).toEqual(['bytes', 'kind', 'mediaType', 'metadata'])
  })

  it('fetches OpenAI image URL responses before returning normalized bytes', async () => {
    const fetchMock = createFetchMock((input) => {
      if (inputUrl(input) === 'https://cdn.example.test/generated.png') {
        return Promise.resolve(new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'image/png' } }))
      }

      return Promise.resolve(createJsonResponse({ data: [{ url: 'https://cdn.example.test/generated.png' }] }))
    })
    const provider = createOpenAICompatibleProvider({
      id: 'openai-main',
      baseUrl: 'https://api.example.test/v1/',
      apiKey: 'sk-secret-value',
      modelKeys: { image: 'gpt-image-1' },
      fetchImpl: fetchMock
    })

    const result = await provider.invoke(createImageRequest({ parameters: {} }))

    expect(fetchMock.calls).toHaveLength(2)
    expect(fetchMock.calls[1]?.input).toBe('https://cdn.example.test/generated.png')
    expect(result.kind).toBe('assetBytes')
    if (result.kind !== 'assetBytes') {
      throw new Error('expected assetBytes')
    }
    expect(Array.from(result.bytes)).toEqual([1, 2, 3])
    expect(JSON.stringify(result)).not.toContain('https://cdn.example.test')
  })

  it('normalizes chat completion text and redacts keys from provider errors', async () => {
    const fetchMock = createFetchMock((input) => {
      if (inputUrl(input).endsWith('/chat/completions')) {
        return Promise.resolve(createJsonResponse({ choices: [{ message: { content: 'hello from model' } }], usage: { prompt_tokens: 4, completion_tokens: 3 } }))
      }

      return Promise.resolve(createJsonResponse({ error: { message: 'bad key sk-secret-value' } }, false, 401))
    })
    const provider = createOpenAICompatibleProvider({
      id: 'openai-main',
      baseUrl: 'https://api.example.test/v1',
      apiKey: 'sk-secret-value',
      modelKeys: { text: 'gpt-4.1-mini', image: 'gpt-image-1' },
      fetchImpl: fetchMock
    })

    await expect(provider.invoke(createImageRequest())).rejects.toMatchObject({
      errorClass: 'provider_request_failed',
      retryable: true
    })
    await expect(provider.invoke(createImageRequest())).rejects.not.toThrow('sk-secret-value')

    const text = await provider.invoke(createImageRequest({ channel: 'text', modelKey: 'gpt-4.1-mini' }))
    expect(text).toEqual({
      kind: 'text',
      text: 'hello from model',
      usage: {
        inputTokens: 4,
        outputTokens: 3
      }
    })
  })

  it('preserves native tool request and response wire fields', async () => {
    const fetchMock = createFetchMock((input) => {
      if (!inputUrl(input).endsWith('/chat/completions')) {
        throw new Error('expected_chat_completions_request')
      }

      return Promise.resolve(createJsonResponse({
        choices: [{
          message: {
            content: null,
            tool_calls: [
              {
                id: 'provider-call-1',
                type: 'function',
                function: { name: 'tool_canvas_d_queryGraph', arguments: '{"page":1}' }
              },
              {
                id: 'provider-call-2',
                type: 'function',
                function: { name: 'tool_canvas_d_queryGraph', arguments: '{"page":2}' }
              }
            ]
          }
        }]
      }))
    })
    const provider = createOpenAICompatibleProvider({
      id: 'openai-main',
      baseUrl: 'https://api.example.test/v1',
      apiKey: 'sk-secret-value',
      modelKeys: { text: 'gpt-4.1-mini' },
      fetchImpl: fetchMock
    })
    const result = await provider.invoke(createImageRequest({
      channel: 'text',
      modelKey: 'gpt-4.1-mini',
      prompt: '',
      messages: [
        { role: 'system', content: 'Use tools.' },
        { role: 'user', content: 'Read two pages.' },
        {
          role: 'assistant',
          content: null,
          tool_calls: [{
            id: 'previous-call',
            type: 'function',
            function: { name: 'tool_canvas_d_queryGraph', arguments: '{"page":0}' }
          }]
        },
        {
          role: 'tool',
          tool_call_id: 'previous-call',
          name: 'tool_canvas_d_queryGraph',
          content: '{"page":0}'
        }
      ],
      tools: [{
        type: 'function',
        function: {
          name: 'tool_canvas_d_queryGraph',
          description: 'Reads the graph.',
          parameters: {
            type: 'object',
            properties: { page: { type: 'number' } },
            required: ['page'],
            additionalProperties: false
          }
        }
      }],
      toolChoice: 'auto'
    }))

    expect(JSON.parse(requestBody(fetchMock.calls[0]))).toEqual({
      model: 'gpt-4.1-mini',
      messages: [
        { role: 'system', content: 'Use tools.' },
        { role: 'user', content: 'Read two pages.' },
        {
          role: 'assistant',
          content: null,
          tool_calls: [{
            id: 'previous-call',
            type: 'function',
            function: { name: 'tool_canvas_d_queryGraph', arguments: '{"page":0}' }
          }]
        },
        {
          role: 'tool',
          tool_call_id: 'previous-call',
          name: 'tool_canvas_d_queryGraph',
          content: '{"page":0}'
        }
      ],
      tools: [{
        type: 'function',
        function: {
          name: 'tool_canvas_d_queryGraph',
          description: 'Reads the graph.',
          parameters: {
            type: 'object',
            properties: { page: { type: 'number' } },
            required: ['page'],
            additionalProperties: false
          }
        }
      }],
      tool_choice: 'auto',
      size: '1024x1024'
    })
    expect(result).toEqual({
      kind: 'text',
      text: '',
      toolCalls: [
        {
          id: 'provider-call-1',
          type: 'function',
          function: { name: 'tool_canvas_d_queryGraph', arguments: '{"page":1}' }
        },
        {
          id: 'provider-call-2',
          type: 'function',
          function: { name: 'tool_canvas_d_queryGraph', arguments: '{"page":2}' }
        }
      ]
    })
  })

  it('rejects unsupported video requests before remote submission', async () => {
    const fetchMock = createFetchMock()
    const provider = createOpenAICompatibleProvider({
      id: 'openai-main',
      baseUrl: 'https://api.example.test/v1',
      apiKey: 'sk-secret-value',
      modelKeys: { image: 'gpt-image-1' },
      fetchImpl: fetchMock
    })

    await expect(provider.invoke(createImageRequest({ channel: 'video', modelKey: 'video-model' }))).rejects.toBeInstanceOf(GatewayProviderError)
    await expect(provider.invoke(createImageRequest({ channel: 'video', modelKey: 'video-model' }))).rejects.toMatchObject({
      errorClass: 'capability_unsupported',
      retryable: false
    })
    expect(fetchMock.calls).toHaveLength(0)
  })
})
