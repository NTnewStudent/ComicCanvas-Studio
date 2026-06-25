/**
 * Async media task gateway provider adapter.
 * @see docs/api-contracts/gateway-providers.md
 */

import { createHash } from 'node:crypto'

import type { GatewayCapability, GatewayMediaMetadata, GatewayRequest, GatewayResult } from '../../../../shared/gateway'
import type { Orientation } from '../../../../shared/nodes'
import { pollWithBackoff, type PollingState, type PollingStrategyOptions } from './polling-strategy'
import { GatewayProviderError } from './registry'
import type { GatewayProvider, GatewayProviderContext } from './stub.provider'

export interface AsyncMediaProviderOptions {
  /** Provider ID used by the registry. */
  id: string
  /** Async media API base URL. */
  baseUrl: string
  /** API key resolved from the key vault. */
  apiKey: string
  /** Channel-to-model mapping served by this provider. */
  modelKeys: Partial<Record<'text' | 'image' | 'video', string>>
  /** Optional fetch implementation for tests. */
  fetchImpl?: typeof fetch
  /** Submit endpoint path. Defaults to `/tasks`. */
  submitPath?: string
  /** Status endpoint path factory. Defaults to `/tasks/{remoteTaskId}`. */
  statusPath?: (remoteTaskId: string, attempt: number) => string
  /** Polling strategy configuration. */
  polling?: Partial<PollingStrategyOptions>
}

interface SubmitResult {
  remoteTaskId: string
  pollAfterMs?: number
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/u, '')
}

function trimLeadingSlash(value: string): string {
  return value.replace(/^\/+/u, '')
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null
}

function stringField(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key]

    if (typeof value === 'string' && value.length > 0) {
      return value
    }
  }

  return undefined
}

function numberField(record: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record[key]

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value
    }
  }

  return undefined
}

function redact(value: string, secret: string): string {
  return secret ? value.split(secret).join('[redacted]') : value
}

function providerError(errorClass: GatewayProviderError['errorClass'], message: string, retryable: boolean): GatewayProviderError {
  return new GatewayProviderError({ errorClass, message, retryable })
}

function assertNotCanceled(context?: GatewayProviderContext): void {
  if (context?.isCanceled?.() === true) {
    // Worker cancellation must stop provider network work before it submits or fetches more bytes.
    throw providerError('provider_canceled', 'Provider request was canceled by the worker', false)
  }
}

function endpoint(baseUrl: string, path: string): string {
  if (/^https?:\/\//iu.test(path)) {
    return path
  }

  return `${trimTrailingSlash(baseUrl)}/${trimLeadingSlash(path)}`
}

function capabilitiesFor(modelKeys: AsyncMediaProviderOptions['modelKeys']): GatewayCapability[] {
  return (['image', 'video'] as const).filter((channel) => modelKeys[channel] !== undefined)
}

function assertSupported(options: AsyncMediaProviderOptions, request: GatewayRequest): void {
  if ((request.channel !== 'image' && request.channel !== 'video') || options.modelKeys[request.channel] !== request.modelKey) {
    // Async media providers only serve configured image/video task models.
    throw providerError('capability_unsupported', `Async media provider does not support ${request.channel}:${request.modelKey}`, false)
  }
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text()

  if (text.length === 0) {
    return {}
  }

  try {
    return JSON.parse(text) as unknown
  } catch {
    // Malformed provider JSON cannot be normalized safely.
    throw providerError('provider_payload_invalid', 'Provider returned invalid JSON', false)
  }
}

function errorMessageFromBody(body: unknown, fallback: string, apiKey: string): string {
  const record = asRecord(body)
  const error = asRecord(record?.error)

  if (error) {
    const message = stringField(error, ['message'])
    if (message) {
      return redact(message, apiKey)
    }
  }

  const message = record ? stringField(record, ['message', 'error_message']) : undefined
  return redact(message ?? fallback, apiKey)
}

async function fetchJson(fetchImpl: typeof fetch, apiKey: string, url: string, init: RequestInit): Promise<unknown> {
  const response = await fetchImpl(url, init)
  const json = await readJson(response)

  if (!response.ok) {
    // Non-2xx provider responses are remote request failures, not payload normalization failures.
    throw providerError('provider_request_failed', errorMessageFromBody(json, `Provider request failed with ${response.status}`, apiKey), true)
  }

  return json
}

function submitPayload(request: GatewayRequest): Record<string, unknown> {
  // references[].url contains cloud URLs (S3) resolved by the canvas handler at enqueue time
  return {
    channel: request.channel,
    model: request.modelKey,
    prompt: request.prompt,
    references: request.references,
    parameters: request.parameters,
    idempotency_key: request.idempotencyKey
  }
}

async function submitTask(options: AsyncMediaProviderOptions, fetchImpl: typeof fetch, request: GatewayRequest): Promise<SubmitResult> {
  const body = await fetchJson(fetchImpl, options.apiKey, endpoint(options.baseUrl, options.submitPath ?? '/tasks'), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(submitPayload(request))
  })
  const record = asRecord(body)

  if (!record) {
    // The submit endpoint must return an object containing a remote task ID.
    throw providerError('provider_payload_invalid', 'Provider submit response was not an object', false)
  }

  const remoteTaskId = stringField(record, ['task_id', 'remote_task_id', 'id'])

  if (!remoteTaskId) {
    // Without a remote task ID the worker cannot poll the async provider.
    throw providerError('provider_payload_invalid', 'Provider submit response did not include a task ID', false)
  }

  const pollAfterMs = numberField(record, ['poll_after_ms', 'pollAfterMs'])
  return pollAfterMs === undefined ? { remoteTaskId } : { remoteTaskId, pollAfterMs }
}

async function pollTaskStatus(
  options: AsyncMediaProviderOptions,
  fetchImpl: typeof fetch,
  remoteTaskId: string,
  attempt: number
): Promise<PollingState<unknown>> {
  const statusPath = options.statusPath?.(remoteTaskId, attempt) ?? `/tasks/${encodeURIComponent(remoteTaskId)}`
  const body = await fetchJson(fetchImpl, options.apiKey, endpoint(options.baseUrl, statusPath), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${options.apiKey}`
    }
  })
  const record = asRecord(body)

  if (!record) {
    // The status endpoint must return a status object for normalization.
    throw providerError('provider_payload_invalid', 'Provider status response was not an object', false)
  }

  const status = stringField(record, ['status', 'state'])

  if (!status) {
    // A status field is required to distinguish pending, completed, and failed task states.
    throw providerError('provider_payload_invalid', 'Provider status response did not include a state', false)
  }

  const normalized = status.toLowerCase()

  if (['completed', 'complete', 'succeeded', 'success', 'done'].includes(normalized)) {
    return { state: 'completed', result: body }
  }

  if (['failed', 'failure', 'error'].includes(normalized)) {
    return {
      state: 'failed',
      message: errorMessageFromBody(body, 'Provider task failed', options.apiKey),
      retryable: record.retryable === undefined ? true : record.retryable === true
    }
  }

  if (['pending', 'queued', 'running', 'processing', 'in_progress', 'submitted'].includes(normalized)) {
    const progress = numberField(record, ['progress', 'percent'])
    const message = stringField(record, ['message', 'status_message'])
    return {
      state: 'pending',
      ...(progress === undefined ? {} : { progress }),
      ...(message === undefined ? {} : { message })
    }
  }

  // Unknown provider states are unsafe to interpret as terminal success.
  throw providerError('provider_payload_invalid', `Provider status ${status} is not supported`, false)
}

function outputRecord(payload: unknown): Record<string, unknown> {
  const record = asRecord(payload)

  if (!record) {
    // Completed media payloads must be objects so output URLs or bytes can be found.
    throw providerError('provider_payload_invalid', 'Provider completed response was not an object', false)
  }

  const output = asRecord(record.output)
  if (output) {
    return output
  }

  const result = asRecord(record.result)
  if (result) {
    return result
  }

  const data = asRecord(record.data)
  if (data) {
    return data
  }

  return record
}

function orientationFromSize(width: number | undefined, height: number | undefined): Orientation | undefined {
  if (width === undefined || height === undefined) {
    return undefined
  }

  if (width === height) {
    return 'square'
  }

  return width > height ? 'landscape' : 'portrait'
}

function defaultMimeType(channel: GatewayRequest['channel']): string {
  return channel === 'video' ? 'video/mp4' : 'image/png'
}

function mediaMetadata(bytes: Uint8Array, output: Record<string, unknown>, request: GatewayRequest, mimeType: string): GatewayMediaMetadata {
  const width = numberField(output, ['width'])
  const height = numberField(output, ['height'])
  const durationMs = numberField(output, ['duration_ms', 'durationMs'])
  const orientation = orientationFromSize(width, height)
  const metadata: GatewayMediaMetadata = {
    mediaType: request.channel === 'video' ? 'video' : 'image',
    mimeType,
    sizeBytes: bytes.byteLength,
    hash: createHash('sha256').update(bytes).digest('hex')
  }

  if (width !== undefined) {
    metadata.width = width
  }

  if (height !== undefined) {
    metadata.height = height
  }

  if (durationMs !== undefined) {
    metadata.durationMs = durationMs
  }

  if (orientation !== undefined) {
    metadata.orientation = orientation
  }

  return metadata
}

async function normalizeMediaResult(
  payload: unknown,
  request: GatewayRequest,
  options: AsyncMediaProviderOptions,
  fetchImpl: typeof fetch,
  context?: GatewayProviderContext
): Promise<GatewayResult> {
  const output = outputRecord(payload)
  const mimeType = stringField(output, ['mime_type', 'mimeType', 'content_type']) ?? defaultMimeType(request.channel)
  const base64 = stringField(output, ['b64_json', 'base64', 'bytes_base64'])

  if (base64) {
    const bytes = Uint8Array.from(Buffer.from(base64, 'base64'))
    return {
      kind: 'assetBytes',
      mediaType: request.channel === 'video' ? 'video' : 'image',
      bytes,
      metadata: mediaMetadata(bytes, output, request, mimeType)
    }
  }

  const mediaUrl = stringField(output, ['url', 'asset_url', 'media_url', 'video_url', 'image_url'])

  if (!mediaUrl) {
    // Completed task payloads must include bytes or a temporary media URL that the provider fetches before returning.
    throw providerError('provider_payload_invalid', 'Provider completed response did not include media bytes or URL', false)
  }

  assertNotCanceled(context)

  const response = await fetchImpl(mediaUrl)

  if (!response.ok) {
    // Temporary media URL fetch failures are retryable provider request failures.
    throw providerError('provider_request_failed', 'Provider media URL fetch failed', true)
  }

  const bytes = new Uint8Array(await response.arrayBuffer())
  const responseMimeType = response.headers.get('content-type') ?? mimeType

  return {
    kind: 'assetBytes',
    mediaType: request.channel === 'video' ? 'video' : 'image',
    bytes,
    metadata: mediaMetadata(bytes, output, request, responseMimeType)
  }
}

function defaultPollingOptions(pollAfterMs: number | undefined, options?: Partial<PollingStrategyOptions>): PollingStrategyOptions {
  return {
    initialDelayMs: options?.initialDelayMs ?? pollAfterMs ?? 1_000,
    maxDelayMs: options?.maxDelayMs ?? 10_000,
    timeoutMs: options?.timeoutMs ?? 10 * 60_000,
    ...(options?.clock ? { clock: options.clock } : {}),
    ...(options?.sleep ? { sleep: options.sleep } : {})
  }
}

/**
 * Creates a provider for common async image/video task protocols.
 * @param options - Provider configuration, optional endpoint mapping, and polling dependencies.
 * @returns Gateway provider implementation.
 * @throws Error never intentionally during construction; invocation errors use GatewayProviderError.
 * @see docs/api-contracts/gateway-providers.md
 */
export function createAsyncMediaProvider(options: AsyncMediaProviderOptions): GatewayProvider {
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
      assertNotCanceled(context)

      const submit = await submitTask(options, fetchImpl, request)
      const completedPayload = await pollWithBackoff(
        (attempt) => pollTaskStatus(options, fetchImpl, submit.remoteTaskId, attempt),
        defaultPollingOptions(submit.pollAfterMs, options.polling),
        context
      )

      return normalizeMediaResult(completedPayload, request, options, fetchImpl, context)
    }
  }
}
