/**
 * OpenAI-compatible gateway provider adapter.
 * @see docs/api-contracts/gateway-providers.md
 */

import { createHash } from 'node:crypto'

import type { GatewayCapability, GatewayMediaMetadata, GatewayRequest, GatewayResult, GatewayUsage } from '../../../../shared/gateway'
import { GatewayProviderError } from './registry'
import type { GatewayProvider, GatewayDeltaCallback } from './stub.provider'

export interface OpenAICompatibleProviderOptions {
  /** Provider ID used by the registry. */
  id: string
  /** OpenAI-compatible API base URL, such as `https://api.openai.com/v1`. */
  baseUrl: string
  /** API key resolved from the key vault. */
  apiKey: string
  /** Channel-to-model mapping served by this provider. */
  modelKeys: Partial<Record<'text' | 'image' | 'video', string>>
  /** Optional fetch implementation for tests. */
  fetchImpl?: typeof fetch
}

interface OpenAIImageItem {
  b64_json?: unknown
  url?: unknown
}

interface OpenAIImageResponse {
  data?: unknown
}

interface OpenAIChatResponse {
  choices?: unknown
  usage?: unknown
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/u, '')
}

function redact(value: string, secret: string): string {
  return secret ? value.split(secret).join('[redacted]') : value
}

function providerError(errorClass: GatewayProviderError['errorClass'], message: string, retryable: boolean): GatewayProviderError {
  return new GatewayProviderError({ errorClass, message, retryable })
}

function assertSupported(options: OpenAICompatibleProviderOptions, request: GatewayRequest): void {
  if (request.channel === 'video' || options.modelKeys[request.channel] !== request.modelKey) {
    throw providerError('capability_unsupported', `OpenAI-compatible provider does not support ${request.channel}:${request.modelKey}`, false)
  }
}

function capabilitiesFor(modelKeys: OpenAICompatibleProviderOptions['modelKeys']): GatewayCapability[] {
  return (['text', 'image'] as const).filter((channel) => modelKeys[channel] !== undefined)
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text()

  if (text.length === 0) {
    return {}
  }

  try {
    return JSON.parse(text) as unknown
  } catch {
    throw providerError('provider_payload_invalid', 'Provider returned invalid JSON', false)
  }
}

function errorMessageFromBody(body: unknown, fallback: string, apiKey: string): string {
  if (typeof body === 'object' && body !== null && 'error' in body) {
    const error = (body as { error?: unknown }).error

    if (typeof error === 'object' && error !== null && 'message' in error && typeof (error as { message?: unknown }).message === 'string') {
      return redact((error as { message: string }).message, apiKey)
    }
  }

  return redact(fallback, apiKey)
}

async function fetchJson(fetchImpl: typeof fetch, apiKey: string, url: string, body: Record<string, unknown>): Promise<unknown> {
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  })
  const json = await readJson(response)

  if (!response.ok) {
    throw providerError('provider_request_failed', errorMessageFromBody(json, `Provider request failed with ${response.status}`, apiKey), true)
  }

  return json
}

function imageItems(body: unknown): OpenAIImageItem[] {
  const response = body as OpenAIImageResponse

  if (!Array.isArray(response.data)) {
    throw providerError('provider_payload_invalid', 'Provider image response did not contain data', false)
  }

  return response.data as OpenAIImageItem[]
}

function imageMetadata(bytes: Uint8Array, mimeType: string): GatewayMediaMetadata {
  return {
    mediaType: 'image',
    mimeType,
    sizeBytes: bytes.byteLength,
    hash: createHash('sha256').update(bytes).digest('hex')
  }
}

function imagePayload(request: GatewayRequest): Record<string, unknown> {
  // Extract reference image URLs for APIs that support image conditioning/editing
  const referenceUrls = request.references
    .filter((ref) => (ref.role === 'reference' || ref.role === 'style') && ref.url.length > 0)
    .map((ref) => ref.url)

  return {
    model: request.modelKey,
    prompt: request.prompt,
    n: 1,
    response_format: 'b64_json',
    ...(referenceUrls.length > 0 ? { image_urls: referenceUrls } : {}),
    ...request.parameters
  }
}

async function invokeImage(options: OpenAICompatibleProviderOptions, fetchImpl: typeof fetch, request: GatewayRequest): Promise<GatewayResult> {
  const body = await fetchJson(fetchImpl, options.apiKey, `${trimTrailingSlash(options.baseUrl)}/images/generations`, imagePayload(request))
  const item = imageItems(body)[0]

  if (!item) {
    throw providerError('provider_payload_invalid', 'Provider image response was empty', false)
  }

  if (typeof item.b64_json === 'string') {
    const bytes = Uint8Array.from(Buffer.from(item.b64_json, 'base64'))

    return {
      kind: 'assetBytes',
      mediaType: 'image',
      bytes,
      metadata: imageMetadata(bytes, 'image/png')
    }
  }

  if (typeof item.url === 'string') {
    const response = await fetchImpl(item.url)

    if (!response.ok) {
      throw providerError('provider_request_failed', 'Provider image URL fetch failed', true)
    }

    const bytes = new Uint8Array(await response.arrayBuffer())
    const mimeType = response.headers.get('content-type') ?? 'image/png'

    return {
      kind: 'assetBytes',
      mediaType: 'image',
      bytes,
      metadata: imageMetadata(bytes, mimeType)
    }
  }

  throw providerError('provider_payload_invalid', 'Provider image response did not include bytes or URL', false)
}

function chatPayload(request: GatewayRequest): Record<string, unknown> {
  return {
    model: request.modelKey,
    messages: [{ role: 'user', content: request.prompt }],
    ...request.parameters
  }
}

function parseUsage(usage: unknown): GatewayUsage | undefined {
  if (typeof usage !== 'object' || usage === null) {
    return undefined
  }

  const record = usage as Record<string, unknown>
  const parsed: GatewayUsage = {}

  if (typeof record.prompt_tokens === 'number') {
    parsed.inputTokens = record.prompt_tokens
  }

  if (typeof record.completion_tokens === 'number') {
    parsed.outputTokens = record.completion_tokens
  }

  return Object.keys(parsed).length > 0 ? parsed : undefined
}

function chatText(body: unknown): { text: string; usage?: GatewayUsage } {
  const response = body as OpenAIChatResponse

  if (!Array.isArray(response.choices)) {
    throw providerError('provider_payload_invalid', 'Provider chat response did not contain choices', false)
  }

  const first = response.choices[0] as { message?: { content?: unknown } } | undefined
  const content = first?.message?.content

  if (typeof content !== 'string') {
    throw providerError('provider_payload_invalid', 'Provider chat response did not include text', false)
  }

  const usage = parseUsage(response.usage)
  return usage ? { text: content, usage } : { text: content }
}

async function invokeText(options: OpenAICompatibleProviderOptions, fetchImpl: typeof fetch, request: GatewayRequest): Promise<GatewayResult> {
  const body = await fetchJson(fetchImpl, options.apiKey, `${trimTrailingSlash(options.baseUrl)}/chat/completions`, chatPayload(request))
  const result = chatText(body)

  return {
    kind: 'text',
    ...result
  }
}

/**
 * Streams a chat completion via SSE, invoking onDelta for each token and
 * returning the assembled full text with usage once the stream ends.
 */
async function invokeTextStreaming(
  options: OpenAICompatibleProviderOptions,
  fetchImpl: typeof fetch,
  request: GatewayRequest,
  onDelta: GatewayDeltaCallback
): Promise<GatewayResult> {
  const payload = { ...chatPayload(request), stream: true, stream_options: { include_usage: true } }
  const response = await fetchImpl(`${trimTrailingSlash(options.baseUrl)}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      'Content-Type': 'application/json',
      Accept: 'text/event-stream'
    },
    body: JSON.stringify(payload)
  })

  if (!response.ok) {
    const errorBody = await readJson(response)
    throw providerError('provider_request_failed', errorMessageFromBody(errorBody, `Provider request failed with ${response.status}`, options.apiKey), true)
  }

  if (!response.body) {
    throw providerError('provider_payload_invalid', 'Provider returned no body for streaming request', false)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buf = ''
  let fullText = ''
  let usage: GatewayUsage | undefined

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })

      let newlineIdx: number
      while ((newlineIdx = buf.indexOf('\n')) !== -1) {
        const line = buf.slice(0, newlineIdx).trim()
        buf = buf.slice(newlineIdx + 1)

        if (!line.startsWith('data:')) continue
        const data = line.slice(5).trim()
        if (data === '[DONE]') break

        try {
          const chunk = JSON.parse(data) as {
            choices?: Array<{ delta?: { content?: string } }>
            usage?: unknown
          }
          // Accumulate usage from the final chunk (stream_options.include_usage).
          if (chunk.usage) {
            usage = parseUsage(chunk.usage) ?? usage
          }
          const delta = chunk.choices?.[0]?.delta?.content
          if (typeof delta === 'string' && delta.length > 0) {
            fullText += delta
            onDelta(delta)
          }
        } catch {
          // Skip unparseable SSE lines (comments, keepalives).
        }
      }
    }
  } finally {
    reader.releaseLock()
  }

  if (fullText.length === 0) {
    throw providerError('provider_payload_invalid', 'Provider streaming response produced no text', false)
  }

  return { kind: 'text', text: fullText, ...(usage ? { usage } : {}) }
}

/**
 * Creates an OpenAI-compatible provider for text/chat and image generation.
 * @param options - Provider configuration and optional fetch dependency.
 * @returns Gateway provider implementation.
 * @throws Error never intentionally during construction; invocation errors use GatewayProviderError.
 * @see docs/api-contracts/gateway-providers.md
 */
export function createOpenAICompatibleProvider(options: OpenAICompatibleProviderOptions): GatewayProvider {
  const fetchImpl = options.fetchImpl ?? fetch

  return {
    id: options.id,
    capabilities: capabilitiesFor(options.modelKeys),
    modelKeys: {
      text: options.modelKeys.text ?? '',
      image: options.modelKeys.image ?? '',
      video: options.modelKeys.video ?? ''
    },
    async invoke(request, context) {
      assertSupported(options, request)

      if (request.channel === 'text') {
        if (context?.onDelta) {
          return invokeTextStreaming(options, fetchImpl, request, context.onDelta)
        }
        return invokeText(options, fetchImpl, request)
      }

      return invokeImage(options, fetchImpl, request)
    }
  }
}
