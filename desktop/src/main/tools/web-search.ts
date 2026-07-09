/**
 * Built-in controlled web search tool for Agent current-information summaries.
 * @see docs/api-contracts/tools-plugins.md
 */

import { Buffer } from 'node:buffer'

import { z } from 'zod'

import type { ToolDescriptor, ToolPermission } from '../../../../shared/tools'
import { defineTool, ToolExecutionError, type ToolDefinition } from './runtime'

export interface WebSearchToolsOptions {
  fetch?: typeof fetch
  endpoint?: string
  timeoutMs?: number
  clock?: () => number
}

const networkPermission: ToolPermission = { kind: 'network', reason: 'Queries the public web for current information.' }
const DEFAULT_ENDPOINT = 'https://www.bing.com/search?q='
const DEFAULT_TIMEOUT_MS = 15_000

const searchInputSchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().positive().max(5).optional()
})

const searchResultSchema = z.object({
  title: z.string(),
  url: z.string(),
  snippet: z.string()
})

const searchOutputSchema = z.object({
  query: z.string(),
  searchedAt: z.string(),
  results: z.array(searchResultSchema),
  truncated: z.boolean()
})

function descriptor(): ToolDescriptor {
  return {
    id: 'web.search',
    name: 'Search Web',
    description: 'Searches the public web for current information and returns compact source results.',
    category: 'web',
    owner: { kind: 'builtin', id: 'core' },
    inputSchemaRef: 'web.search.input',
    outputSchemaRef: 'web.search.output',
    permissions: [networkPermission],
    concurrency: 'readonly',
    enabled: true
  }
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/gu, '&')
    .replace(/&quot;/gu, '"')
    .replace(/&#39;|&apos;/gu, "'")
    .replace(/&lt;/gu, '<')
    .replace(/&gt;/gu, '>')
    .replace(/&#(\d+);/gu, (_match, code: string) => String.fromCharCode(Number(code)))
}

function stripHtml(value: string): string {
  return decodeHtmlEntities(value.replace(/<[^>]*>/gu, ' ')).replace(/\s+/gu, ' ').trim()
}

function normalizeBase64(value: string): string {
  const normalized = value.replace(/-/gu, '+').replace(/_/gu, '/')
  const padding = (4 - (normalized.length % 4)) % 4
  return `${normalized}${'='.repeat(padding)}`
}

function decodeBingRedirect(rawUrl: string): string {
  const decoded = decodeHtmlEntities(rawUrl)

  try {
    const url = new URL(decoded)
    const encodedTarget = url.hostname.endsWith('bing.com') && url.pathname === '/ck/a' ? url.searchParams.get('u') : null

    if (encodedTarget?.startsWith('a1')) {
      return Buffer.from(normalizeBase64(encodedTarget.slice(2)), 'base64').toString('utf8')
    }
  } catch {
    // Malformed result links are ignored by returning the original decoded URL.
  }

  return decoded
}

function parseMarkdownResults(markdown: string, limit: number): {
  results: Array<{ title: string; url: string; snippet: string }>
  truncated: boolean
} {
  const matches = Array.from(markdown.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)\s*\n?([^\n[]*)/gu))
  const results = matches
    .slice(0, limit)
    .map((match) => ({
      title: (match[1] ?? '').trim(),
      url: (match[2] ?? '').trim(),
      snippet: (match[3] ?? '').trim()
    }))
    .filter((result) => result.title.length > 0 && result.url.length > 0)

  return { results, truncated: matches.length > results.length }
}

function parseBingHtmlResults(html: string, limit: number): {
  results: Array<{ title: string; url: string; snippet: string }>
  truncated: boolean
} {
  const matches = Array.from(html.matchAll(/<li[^>]*class=["'][^"']*\bb_algo\b[^"']*["'][\s\S]*?<\/li>/giu))
  const results = matches
    .slice(0, limit)
    .map((match) => {
      const item = match[0]
      const link = item.match(/<h2[^>]*>[\s\S]*?<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>[\s\S]*?<\/h2>/iu)
      const snippet = item.match(/<p[^>]*>([\s\S]*?)<\/p>/iu)

      return {
        title: stripHtml(link?.[2] ?? ''),
        url: link?.[1] ? decodeBingRedirect(link[1]) : '',
        snippet: stripHtml(snippet?.[1] ?? '')
      }
    })
    .filter((result) => result.title.length > 0 && result.url.length > 0)

  return { results, truncated: matches.length > results.length }
}

function parseSearchResults(body: string, limit: number): {
  results: Array<{ title: string; url: string; snippet: string }>
  truncated: boolean
} {
  const markdown = parseMarkdownResults(body, limit)
  return markdown.results.length > 0 ? markdown : parseBingHtmlResults(body, limit)
}

function buildSearchUrl(endpoint: string, query: string): string {
  const encodedQuery = encodeURIComponent(query)
  return endpoint.includes('{query}') ? endpoint.replaceAll('{query}', encodedQuery) : `${endpoint}${encodedQuery}`
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

/**
 * Creates the controlled web search tool for Agent runs.
 * @param options - Optional fetch, endpoint, and clock overrides for tests.
 * @returns Tool definition list containing web.search.
 * @throws Error never intentionally during construction; invocation returns safe tool errors.
 */
export function createWebSearchTools(options: WebSearchToolsOptions = {}): ToolDefinition<unknown, unknown>[] {
  const fetchImpl = options.fetch ?? fetch
  const endpoint = options.endpoint ?? DEFAULT_ENDPOINT
  const timeoutMs = Math.max(1, options.timeoutMs ?? DEFAULT_TIMEOUT_MS)
  const clock = options.clock ?? Date.now

  return [
    defineTool({
      descriptor: descriptor(),
      inputSchema: searchInputSchema,
      outputSchema: searchOutputSchema,
      renderToolUseMessage: (input) => `Search web: ${input.query}`,
      checkPermissions() {
        return {
          decision: 'ask',
          decisionReason: 'Web search sends a query to the public internet and requires approval.',
          requiredPermissions: [networkPermission]
        }
      },
      async call(input) {
        const limit = input.limit ?? 5
        const url = buildSearchUrl(endpoint, input.query)
        const controller = new AbortController()
        const timeout = setTimeout(() => {
          controller.abort()
        }, timeoutMs)

        let response: Response
        try {
          response = await fetchImpl(url, {
            signal: controller.signal,
            headers: {
              Accept: 'text/html,text/plain',
              'User-Agent': 'ComicCanvasStudio/1.0 (+https://localhost)'
            }
          })
        } catch (error) {
          if (controller.signal.aborted || isAbortError(error)) {
            throw new ToolExecutionError({
              code: 'web_search_timeout',
              message: `Web search request timed out after ${timeoutMs}ms.`,
              retryable: true,
              details: { timeoutMs }
            })
          }

          throw error
        } finally {
          clearTimeout(timeout)
        }

        if (!response.ok) {
          // Search endpoint failures are retryable network errors and should not leak raw response bodies.
          throw new ToolExecutionError({
            code: 'web_search_failed',
            message: `Web search request failed with status ${response.status}.`,
            retryable: true,
            details: { status: response.status }
          })
        }

        const body = await response.text()
        const parsed = parseSearchResults(body, limit)

        return {
          query: input.query,
          searchedAt: new Date(clock()).toISOString(),
          results: parsed.results,
          truncated: parsed.truncated
        }
      }
    })
  ]
}
