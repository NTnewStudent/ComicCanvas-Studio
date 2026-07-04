/**
 * Deterministic local gateway provider for M1 smoke paths and tests.
 * @see docs/api-contracts/gateway-providers.md
 */

import { createHash } from 'node:crypto'

import type { GatewayCapability, GatewayRequest, GatewayResult } from '../../../../shared/gateway'

export interface GatewayProviderProgressEvent {
  progress: number
  message?: string
}

/** Called with each incremental text token while the model streams. */
export type GatewayDeltaCallback = (delta: string) => void

export interface GatewayProviderContext {
  isCanceled?: () => boolean
  onProgress?: (event: GatewayProviderProgressEvent) => Promise<void> | void
  /** Optional: invoked with each token delta as the model streams. */
  onDelta?: GatewayDeltaCallback
}

export interface GatewayProvider {
  readonly id: string
  readonly capabilities: GatewayCapability[]
  readonly modelKeys: Record<'text' | 'image' | 'video', string>
  invoke(request: GatewayRequest, context?: GatewayProviderContext): Promise<GatewayResult> | GatewayResult
}

export interface StubProviderOptions {
  /** Provider ID exposed to the registry. */
  id?: string
  /** Optional channel model map overriding local defaults. */
  modelKeys?: Partial<Record<'text' | 'image' | 'video', string>>
}

const pngHeader = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
const mp4Header = Uint8Array.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70])

function countTokens(text: string): number {
  return text.trim().split(/\s+/u).filter(Boolean).length
}

function deterministicBytes(seed: string, header: Uint8Array, size: number): Uint8Array {
  const output = new Uint8Array(size)
  output.set(header)

  let offset = header.length
  let round = 0

  while (offset < output.length) {
    const digest = createHash('sha256').update(`${seed}:${round}`).digest()
    output.set(digest.subarray(0, Math.min(digest.length, output.length - offset)), offset)
    offset += digest.length
    round += 1
  }

  return output
}

function deterministicHash(seed: string): string {
  return `stub-${createHash('sha256').update(seed).digest('hex').slice(0, 16)}`
}

function orientationSize(orientation: unknown): { width: number; height: number; orientation: 'landscape' | 'portrait' | 'square' } {
  if (orientation === 'portrait') {
    return { width: 720, height: 1280, orientation: 'portrait' }
  }

  if (orientation === 'square') {
    return { width: 1024, height: 1024, orientation: 'square' }
  }

  return { width: 1024, height: 768, orientation: 'landscape' }
}

/**
 * Creates a deterministic provider for local text, image, and video stubs.
 * @param options - Optional provider ID and model map overrides.
 * @returns Stub gateway provider.
 * @throws Error when deterministic byte generation fails unexpectedly.
 * @see docs/api-contracts/gateway-providers.md
 */
export function createStubProvider(options: StubProviderOptions = {}): GatewayProvider {
  return {
    id: options.id ?? 'stub',
    capabilities: ['text', 'image', 'video'],
    modelKeys: {
      text: options.modelKeys?.text ?? 'stub-text',
      image: options.modelKeys?.image ?? 'stub-image',
      video: options.modelKeys?.video ?? 'stub-video'
    },
    invoke(request) {
      const seed = `${request.channel}:${request.modelKey}:${request.prompt}:${request.idempotencyKey}:${JSON.stringify(request.parameters)}`

      if (request.channel === 'text') {
        return {
          kind: 'text',
          text: `Stub response for ${request.prompt}`,
          usage: {
            inputTokens: countTokens(request.prompt),
            outputTokens: countTokens(`Stub response for ${request.prompt}`),
            providerCostUnits: 0
          }
        }
      }

      const size = orientationSize(request.parameters.orientation)

      if (request.channel === 'video') {
        return {
          kind: 'assetBytes',
          mediaType: 'video',
          bytes: deterministicBytes(seed, mp4Header, 512),
          metadata: {
            mediaType: 'video',
            ...size,
            durationMs: 3000,
            mimeType: 'video/mp4',
            hash: deterministicHash(seed)
          }
        }
      }

      return {
        kind: 'assetBytes',
        mediaType: 'image',
        bytes: deterministicBytes(seed, pngHeader, 256),
        metadata: {
          mediaType: 'image',
          ...size,
          mimeType: 'image/png',
          hash: deterministicHash(seed)
        }
      }
    }
  }
}
