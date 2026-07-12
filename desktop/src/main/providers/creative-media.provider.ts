/** System-built-in Creative Media gateway provider. */

import { createHash } from 'node:crypto'

import type { CreativeMediaProfile, GatewayCapability, GatewayMediaMetadata, GatewayModelRoute, GatewayRequest, GatewayResult } from '../../../../shared/gateway'
import { isCreativeMediaRoute } from '../../../../shared/gateway'
import { createOpenAICompatibleProvider } from './openai-compatible.provider'
import { GatewayProviderError } from './registry'
import type { GatewayProvider, GatewayProviderContext } from './stub.provider'

export interface CreativeMediaProviderOptions {
  id: string
  baseUrl: string
  apiKey: string
  routes: GatewayModelRoute[]
  fetchImpl?: typeof fetch
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
      throw providerError('capability_unsupported', `Creative Media profile ${route.profile} is not available yet`, false)
    }
  }
}
