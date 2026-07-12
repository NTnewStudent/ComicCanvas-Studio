/** System-built-in Creative Media gateway provider. */

import { createHash } from 'node:crypto'

import type { CreativeMediaProfile, GatewayCapability, GatewayMediaMetadata, GatewayModelRoute, GatewayRequest, GatewayResult } from '../../../../shared/gateway'
import { isCreativeMediaRoute } from '../../../../shared/gateway'
import { createOpenAICompatibleProvider } from './openai-compatible.provider'
import { GatewayProviderError } from './registry'
import { pollWithBackoff, type PollingStrategyOptions } from './polling-strategy'
import type { GatewayProvider, GatewayProviderContext } from './stub.provider'

export interface CreativeMediaProviderOptions {
  id: string
  baseUrl: string
  apiKey: string
  routes: GatewayModelRoute[]
  fetchImpl?: typeof fetch
  polling?: Partial<PollingStrategyOptions>
}

function providerError(errorClass: GatewayProviderError['errorClass'], message: string, retryable: boolean): GatewayProviderError {
  return new GatewayProviderError({ errorClass, message, retryable })
}

function endpoint(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/u, '')}/${path.replace(/^\/+/u, '')}`
}

function routeFor(routes: GatewayModelRoute[], request: GatewayRequest): GatewayModelRoute {
  const route = routes.find((candidate) => candidate.channel === request.channel && candidate.modelKey === request.modelKey)
  if (!route) {
    throw providerError('capability_unsupported', `Creative Media gateway does not support ${request.channel}:${request.modelKey}`, false)
  }
  return route
}

function imageReferences(request: GatewayRequest): string[] {
  return request.references
    .filter((reference) => reference.mediaType === 'image' && (reference.role === undefined || reference.role === 'reference' || reference.role === 'style'))
    .map((reference) => reference.url.trim())
    .filter((url) => url.length > 0)
}

function stringParameter(parameters: Record<string, unknown>, key: string): string | undefined {
  const value = parameters[key]
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

function nanoPayload(request: GatewayRequest): Record<string, unknown> {
  const size = stringParameter(request.parameters, 'size') ?? '1024x1024'
  const quality = stringParameter(request.parameters, 'quality')
  const references = imageReferences(request)
  return {
    model: request.modelKey,
    prompt: request.prompt,
    n: 1,
    response_format: 'b64_json',
    size,
    ...(quality ? { quality } : {}),
    ...(references.length > 0 ? { images: references } : {})
  }
}

function seedreamPayload(request: GatewayRequest): Record<string, unknown> {
  const size = stringParameter(request.parameters, 'resolution') ?? stringParameter(request.parameters, 'size') ?? '2K'
  const references = imageReferences(request)
  return {
    model: request.modelKey,
    prompt: request.prompt,
    size,
    response_format: 'url',
    watermark: false,
    stream: false,
    ...(references.length > 0 ? { images: references } : {})
  }
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text()
  try {
    return text.length === 0 ? {} : JSON.parse(text) as unknown
  } catch {
    throw providerError('provider_payload_invalid', 'Provider returned invalid JSON', false)
  }
}

function redactedMessage(body: unknown, fallback: string, apiKey: string): string {
  const record = typeof body === 'object' && body !== null ? body as Record<string, unknown> : {}
  const error = typeof record.error === 'object' && record.error !== null ? record.error as Record<string, unknown> : record
  const message = typeof error.message === 'string' ? error.message : fallback
  return apiKey.length === 0 ? message : message.split(apiKey).join('[redacted]')
}

function imageMetadata(bytes: Uint8Array, mimeType: string): GatewayMediaMetadata {
  return { mediaType: 'image', mimeType, sizeBytes: bytes.byteLength, hash: createHash('sha256').update(bytes).digest('hex') }
}

async function normalizeImage(body: unknown, fetchImpl: typeof fetch): Promise<GatewayResult> {
  const record = typeof body === 'object' && body !== null ? body as { data?: unknown } : {}
  const first = Array.isArray(record.data) ? record.data[0] : undefined
  if (typeof first !== 'object' || first === null) throw providerError('provider_payload_invalid', 'Provider image response was empty', false)
  const item = first as { b64_json?: unknown; url?: unknown }
  if (typeof item.b64_json === 'string') {
    const bytes = Uint8Array.from(Buffer.from(item.b64_json, 'base64'))
    return { kind: 'assetBytes', mediaType: 'image', bytes, metadata: imageMetadata(bytes, 'image/png') }
  }
  if (typeof item.url === 'string') {
    const response = await fetchImpl(item.url)
    if (!response.ok) throw providerError('provider_request_failed', 'Provider image URL fetch failed', true)
    const bytes = new Uint8Array(await response.arrayBuffer())
    return { kind: 'assetBytes', mediaType: 'image', bytes, metadata: imageMetadata(bytes, response.headers.get('content-type') ?? 'image/png') }
  }
  throw providerError('provider_payload_invalid', 'Provider image response did not include bytes or URL', false)
}

async function invokeImage(options: CreativeMediaProviderOptions, request: GatewayRequest, profile: Extract<CreativeMediaProfile, 'nano_banana' | 'seedream'>): Promise<GatewayResult> {
  const fetchImpl = options.fetchImpl ?? fetch
  const response = await fetchImpl(endpoint(options.baseUrl, '/images/generations'), {
    method: 'POST',
    headers: { Authorization: `Bearer ${options.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(profile === 'nano_banana' ? nanoPayload(request) : seedreamPayload(request))
  })
  const body = await readJson(response)
  if (!response.ok) throw providerError('provider_request_failed', redactedMessage(body, `Provider request failed with ${response.status}`, options.apiKey), true)
  return normalizeImage(body, fetchImpl)
}

function numberParameter(parameters: Record<string, unknown>, key: string): number | undefined {
  const value = parameters[key]
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function seedancePayload(request: GatewayRequest): Record<string, unknown> {
  const content = request.references
    .filter((reference) => reference.url.trim().length > 0 && (reference.mediaType === 'image' || reference.mediaType === 'video'))
    .map((reference) => reference.mediaType === 'video'
      ? { type: 'video_url', video_url: { url: reference.url }, role: 'reference_video' }
      : { type: 'image_url', image_url: { url: reference.url }, role: 'reference_image' })
  return {
    model: request.modelKey,
    prompt: request.prompt,
    metadata: {
      ...(numberParameter(request.parameters, 'duration') !== undefined ? { duration: numberParameter(request.parameters, 'duration') } : {}),
      ...(stringParameter(request.parameters, 'ratio') ? { ratio: stringParameter(request.parameters, 'ratio') } : {}),
      ...(stringParameter(request.parameters, 'resolution') ? { resolution: stringParameter(request.parameters, 'resolution') } : {}),
      content
    }
  }
}

function klingPayload(request: GatewayRequest): { path: string; body: Record<string, unknown> } {
  const image = imageReferences(request)[0]
  return {
    path: image ? '/videos/image2video' : '/videos/text2video',
    body: {
      model: request.modelKey,
      model_name: request.modelKey,
      prompt: request.prompt,
      ...(image ? { image } : {}),
      ...(stringParameter(request.parameters, 'last_frame') ? { image_tail: stringParameter(request.parameters, 'last_frame') } : {}),
      duration: String(numberParameter(request.parameters, 'duration') ?? 5),
      aspect_ratio: stringParameter(request.parameters, 'ratio') ?? '1:1'
    }
  }
}

function taskId(body: unknown): string | undefined {
  const record = typeof body === 'object' && body !== null ? body as Record<string, unknown> : {}
  const data = typeof record.data === 'object' && record.data !== null ? record.data as Record<string, unknown> : {}
  for (const value of [record.task_id, record.id, data.task_id, data.id]) if (typeof value === 'string' && value.length > 0) return value
  return undefined
}

function taskStatus(body: unknown): string {
  const record = typeof body === 'object' && body !== null ? body as Record<string, unknown> : {}
  const data = typeof record.data === 'object' && record.data !== null ? record.data as Record<string, unknown> : {}
  const status = record.status ?? record.state ?? data.status ?? data.task_status
  return typeof status === 'string' ? status.toLowerCase() : ''
}

function taskUrl(body: unknown): string | undefined {
  const record = typeof body === 'object' && body !== null ? body as Record<string, unknown> : {}
  const data = typeof record.data === 'object' && record.data !== null ? record.data as Record<string, unknown> : {}
  const result = typeof record.result === 'object' && record.result !== null ? record.result as Record<string, unknown> : {}
  const taskResult = typeof data.task_result === 'object' && data.task_result !== null ? data.task_result as Record<string, unknown> : {}
  const videos = Array.isArray(taskResult.videos) ? taskResult.videos : []
  const firstVideo = typeof videos[0] === 'object' && videos[0] !== null ? videos[0] as Record<string, unknown> : {}
  for (const value of [record.url, record.video_url, data.url, data.result_url, result.video_url, firstVideo.url]) if (typeof value === 'string' && value.length > 0) return value
  return undefined
}

async function invokeKling(options: CreativeMediaProviderOptions, request: GatewayRequest, context?: GatewayProviderContext): Promise<GatewayResult> {
  const fetchImpl = options.fetchImpl ?? fetch
  const payload = klingPayload(request)
  const submit = await fetchImpl(endpoint(options.baseUrl, payload.path), { method: 'POST', headers: { Authorization: `Bearer ${options.apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload.body) })
  const accepted = await readJson(submit)
  if (!submit.ok) throw providerError('provider_request_failed', redactedMessage(accepted, `Provider request failed with ${submit.status}`, options.apiKey), true)
  const id = taskId(accepted)
  if (!id) throw providerError('provider_payload_invalid', 'Kling submit response did not include a task ID', false)
  const completed = await pollWithBackoff(async () => {
    const response = await fetchImpl(endpoint(options.baseUrl, `${payload.path}/${encodeURIComponent(id)}`), { headers: { Authorization: `Bearer ${options.apiKey}` } })
    const body = await readJson(response)
    const status = taskStatus(body)
    if (['succeed', 'succeeded', 'success', 'completed'].includes(status)) {
      const url = taskUrl(body)
      if (!url) throw providerError('provider_payload_invalid', 'Kling completed response did not include a video URL', false)
      return { state: 'completed' as const, result: url }
    }
    if (!response.ok || ['failed', 'error', 'canceled', 'cancelled'].includes(status)) return { state: 'failed' as const, message: 'Kling task failed', retryable: !response.ok }
    const record = typeof body === 'object' && body !== null ? body as Record<string, unknown> : {}
    const data = typeof record.data === 'object' && record.data !== null ? record.data as Record<string, unknown> : {}
    return { state: 'pending' as const, ...(typeof record.progress === 'number' ? { progress: record.progress } : {}), ...(typeof data.task_status_msg === 'string' ? { message: data.task_status_msg } : {}) }
  }, { initialDelayMs: options.polling?.initialDelayMs ?? 1000, maxDelayMs: options.polling?.maxDelayMs ?? 10_000, timeoutMs: options.polling?.timeoutMs ?? 600_000, ...(options.polling?.clock ? { clock: options.polling.clock } : {}), ...(options.polling?.sleep ? { sleep: options.polling.sleep } : {}) }, context)
  const media = await fetchImpl(completed)
  if (!media.ok) throw providerError('provider_request_failed', 'Kling video URL fetch failed', true)
  const bytes = new Uint8Array(await media.arrayBuffer())
  return { kind: 'assetBytes', mediaType: 'video', bytes, metadata: { mediaType: 'video', mimeType: media.headers.get('content-type') ?? 'video/mp4', sizeBytes: bytes.byteLength, hash: createHash('sha256').update(bytes).digest('hex') } }
}

async function invokeSeedance(options: CreativeMediaProviderOptions, request: GatewayRequest, context?: GatewayProviderContext): Promise<GatewayResult> {
  const fetchImpl = options.fetchImpl ?? fetch
  const submit = await fetchImpl(endpoint(options.baseUrl, '/video/generations'), { method: 'POST', headers: { Authorization: `Bearer ${options.apiKey}`, 'Content-Type': 'application/json' }, body: JSON.stringify(seedancePayload(request)) })
  const accepted = await readJson(submit)
  if (!submit.ok) throw providerError('provider_request_failed', redactedMessage(accepted, `Provider request failed with ${submit.status}`, options.apiKey), true)
  const id = taskId(accepted)
  if (!id) throw providerError('provider_payload_invalid', 'Seedance submit response did not include a task ID', false)
  const completed = await pollWithBackoff(async () => {
    const response = await fetchImpl(endpoint(options.baseUrl, `/video/generations/${encodeURIComponent(id)}`), { headers: { Authorization: `Bearer ${options.apiKey}` } })
    const body = await readJson(response)
    if (!response.ok) return { state: 'failed' as const, message: redactedMessage(body, `Provider task failed with ${response.status}`, options.apiKey), retryable: true }
    const status = taskStatus(body)
    if (['completed', 'succeeded', 'success'].includes(status)) {
      const url = taskUrl(body)
      if (!url) throw providerError('provider_payload_invalid', 'Seedance completed response did not include a video URL', false)
      return { state: 'completed' as const, result: url }
    }
    if (['failed', 'error', 'canceled', 'cancelled'].includes(status)) return { state: 'failed' as const, message: 'Seedance task failed', retryable: false }
    const record = typeof body === 'object' && body !== null ? body as Record<string, unknown> : {}
    return { state: 'pending' as const, ...(typeof record.progress === 'number' ? { progress: record.progress } : {}), ...(typeof record.message === 'string' ? { message: record.message } : {}) }
  }, { initialDelayMs: options.polling?.initialDelayMs ?? 1000, maxDelayMs: options.polling?.maxDelayMs ?? 10_000, timeoutMs: options.polling?.timeoutMs ?? 600_000, ...(options.polling?.clock ? { clock: options.polling.clock } : {}), ...(options.polling?.sleep ? { sleep: options.polling.sleep } : {}) }, context)
  const media = await fetchImpl(completed)
  if (!media.ok) throw providerError('provider_request_failed', 'Seedance video URL fetch failed', true)
  const bytes = new Uint8Array(await media.arrayBuffer())
  return { kind: 'assetBytes', mediaType: 'video', bytes, metadata: { mediaType: 'video', mimeType: media.headers.get('content-type') ?? 'video/mp4', sizeBytes: bytes.byteLength, hash: createHash('sha256').update(bytes).digest('hex') } }
}

function profileCapabilities(routes: GatewayModelRoute[]): GatewayCapability[] {
  return [...new Set(routes.map((route) => route.channel))]
}

/** Creates the built-in provider for text and image Creative Media routes. */
export function createCreativeMediaProvider(options: CreativeMediaProviderOptions): GatewayProvider {
  const routes = options.routes.filter(isCreativeMediaRoute)
  const firstModel = (channel: GatewayRequest['channel']): string => routes.find((route) => route.channel === channel)?.modelKey ?? ''

  return {
    id: options.id,
    capabilities: profileCapabilities(routes),
    modelKeys: { text: firstModel('text'), image: firstModel('image'), video: firstModel('video') },
    supportsModel(channel, modelKey) {
      return routes.some((route) => route.channel === channel && route.modelKey === modelKey)
    },
    async invoke(request, context) {
      const route = routeFor(routes, request)
      if (route.profile === 'openai_chat') {
        const provider = createOpenAICompatibleProvider({
          id: options.id,
          baseUrl: options.baseUrl,
          apiKey: options.apiKey,
          modelKeys: { text: route.modelKey },
          ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {})
        })
        const parameters: Record<string, unknown> = {}
        for (const key of ['temperature', 'max_tokens']) if (request.parameters[key] !== undefined) parameters[key] = request.parameters[key]
        return provider.invoke({ ...request, parameters }, context)
      }
      if (route.profile === 'nano_banana' || route.profile === 'seedream') return invokeImage(options, request, route.profile)
      if (route.profile === 'seedance') return invokeSeedance(options, request, context)
      if (route.profile === 'kling') return invokeKling(options, request, context)
      throw providerError('capability_unsupported', `Creative Media profile ${route.profile} is not available yet`, false)
    }
  }
}
