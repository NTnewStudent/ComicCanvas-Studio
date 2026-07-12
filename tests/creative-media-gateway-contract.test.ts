import { describe, expect, it } from 'vitest'

import type { GatewayConfigView } from '../shared/gateway'
import { buildModelCatalog } from '../shared/workflow-node-definitions'

describe('Creative Media gateway contract', () => {
  it('exposes every enabled creative-media route in the model catalog', () => {
    const gateway = {
      id: 'creative-media',
      name: 'Creative Media Gateway',
      type: 'creative_media',
      baseUrl: 'https://media.example.test/v1',
      capabilities: ['text', 'image', 'video'],
      modelMap: { text: 'chat-legacy', image: 'image-legacy', video: 'video-legacy' },
      modelRoutes: [
        { channel: 'text', modelKey: 'chat-1', profile: 'openai_chat' },
        { channel: 'image', modelKey: 'nano-banana-2', profile: 'nano_banana' },
        { channel: 'image', modelKey: 'seedream-5', profile: 'seedream' },
        { channel: 'video', modelKey: 'seedance-2', profile: 'seedance' },
        { channel: 'video', modelKey: 'kling-v2', profile: 'kling' }
      ],
      enabled: true,
      keyRef: 'vault:creative-media'
    } as unknown as GatewayConfigView

    const catalog = buildModelCatalog([gateway])

    expect(catalog.models.text.map((model) => model.id)).toEqual(['chat-1'])
    expect(catalog.models.image.map((model) => model.id)).toEqual(['nano-banana-2', 'seedream-5'])
    expect(catalog.models.video.map((model) => model.id)).toEqual(['seedance-2', 'kling-v2'])
  })
})
