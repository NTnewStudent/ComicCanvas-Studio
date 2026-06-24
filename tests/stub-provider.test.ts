import { describe, expect, it } from 'vitest'

import type { GatewayRequest } from '../shared/gateway'
import { createGatewayRegistry } from '../desktop/src/main/providers/registry'
import { createStubProvider } from '../desktop/src/main/providers/stub.provider'

function createImageRequest(overrides: Partial<GatewayRequest> = {}): GatewayRequest {
  return {
    channel: 'image',
    modelKey: 'stub-image',
    prompt: 'red spaceship over a moon',
    references: [],
    parameters: { orientation: 'landscape' },
    idempotencyKey: 'idem-1',
    ...overrides
  }
}

describe('M1 stub gateway provider', () => {
  it('returns deterministic normalized image bytes and metadata', async () => {
    const provider = createStubProvider()
    const request = createImageRequest()

    const first = await provider.invoke(request)
    const second = await provider.invoke(request)

    expect(first.kind).toBe('assetBytes')
    expect(second.kind).toBe('assetBytes')

    if (first.kind !== 'assetBytes' || second.kind !== 'assetBytes') {
      throw new Error('expected assetBytes')
    }

    expect(first.mediaType).toBe('image')
    expect(first.bytes).toEqual(second.bytes)
    expect(first.metadata).toEqual({
      mediaType: 'image',
      width: 1024,
      height: 768,
      orientation: 'landscape',
      mimeType: 'image/png',
      hash: 'stub-108a7ba0fbea4c8d'
    })
  })

  it('normalizes text and video channels without provider-specific fields', async () => {
    const provider = createStubProvider()
    const text = await provider.invoke(createImageRequest({ channel: 'text', modelKey: 'stub-text' }))
    const video = await provider.invoke(createImageRequest({ channel: 'video', modelKey: 'stub-video', parameters: { orientation: 'portrait' } }))

    expect(text).toEqual({
      kind: 'text',
      text: 'Stub response for red spaceship over a moon',
      usage: { inputTokens: 5, outputTokens: 8, providerCostUnits: 0 }
    })

    expect(video.kind).toBe('assetBytes')
    if (video.kind !== 'assetBytes') {
      throw new Error('expected assetBytes')
    }
    expect(video.mediaType).toBe('video')
    expect(video.metadata).toMatchObject({
      mediaType: 'video',
      width: 720,
      height: 1280,
      orientation: 'portrait',
      mimeType: 'video/mp4'
    })
    expect(Object.keys(video).sort()).toEqual(['bytes', 'kind', 'mediaType', 'metadata'])
  })

  it('registry rejects unsupported capabilities before provider invocation', async () => {
    const registry = createGatewayRegistry()
    registry.set('stub-main', createStubProvider())

    await expect(
      registry.invoke('stub-main', createImageRequest({ channel: 'image', modelKey: 'stub-text' }))
    ).rejects.toMatchObject({
      errorClass: 'capability_unsupported',
      retryable: false
    })
    await expect(registry.invoke('missing', createImageRequest())).rejects.toMatchObject({
      errorClass: 'gateway_not_found',
      retryable: false
    })
  })
})
