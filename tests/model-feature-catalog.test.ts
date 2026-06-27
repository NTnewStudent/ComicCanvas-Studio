import { describe, expect, it } from 'vitest'

import type { GatewayConfigView } from '../shared/gateway'
import {
  buildModelCatalog,
  filterWorkflowNodeDefinitions,
  getAddableNodeDefinitions,
  getConnectCreateNodeDefinitions,
  getRunnableNodeDefinitions,
} from '../shared/workflow-node-definitions'

const gateways: GatewayConfigView[] = [
  {
    id: 'gw-main',
    name: 'Main Gateway',
    type: 'stub',
    baseUrl: 'local://stub',
    capabilities: ['text', 'image', 'video'],
    modelMap: { text: 'stub-text', image: 'stub-image', video: 'stub-video' },
    enabled: true,
    keyRef: 'local-stub',
  },
  {
    id: 'gw-vision',
    name: 'Vision Gateway',
    type: 'openai_compat',
    baseUrl: 'https://example.test',
    capabilities: ['image', 'image.edit'],
    modelMap: { image: 'image-pro' },
    enabled: true,
    keyRef: 'vault:vision',
  },
  {
    id: 'gw-disabled',
    name: 'Disabled Gateway',
    type: 'stub',
    baseUrl: 'local://disabled',
    capabilities: ['video'],
    modelMap: { video: 'disabled-video' },
    enabled: false,
    keyRef: 'disabled',
  },
]

describe('Task 51 model and feature catalog', () => {
  it('builds text/image/video/tool model lists and capability flags from enabled gateways', () => {
    const catalog = buildModelCatalog(gateways)

    expect(catalog.models.text.map((model) => model.id)).toEqual(['stub-text'])
    expect(catalog.models.image.map((model) => model.id)).toEqual(['stub-image', 'image-pro'])
    expect(catalog.models.video.map((model) => model.id)).toEqual(['stub-video'])
    expect(catalog.models.tool.map((model) => model.id)).toEqual(['videoComposeRun', 'muxAudioVideoRun', 'superResolutionRun'])
    expect(catalog.availableModelIds).toEqual(['stub-text', 'stub-image', 'image-pro', 'stub-video'])
    expect(catalog.capabilityFlags).toMatchObject({
      text: true,
      image: true,
      video: true,
      imageEdit: true,
      videoFirstFrame: false,
      videoLastFrame: false,
      tools: true,
    })
    expect(JSON.stringify(catalog)).not.toContain('keyRef')
    expect(JSON.stringify(catalog)).not.toContain('vault:vision')
    expect(JSON.stringify(catalog)).not.toContain('disabled-video')
  })

  it('filters disabled node definitions for add, connect-create, and run surfaces', () => {
    const featureFlags = {
      disabledNodeTypes: ['videoConfigV2', 'superResolution', 'mjImage'],
    } as const

    expect(getAddableNodeDefinitions({ featureFlags }).map((definition) => definition.type)).not.toEqual(
      expect.arrayContaining(['videoConfigV2', 'superResolution', 'mjImage'])
    )
    expect(getConnectCreateNodeDefinitions('video', { featureFlags }).map((definition) => definition.type)).not.toEqual(
      expect.arrayContaining(['videoConfigV2', 'superResolution', 'mjImage'])
    )
    expect(getRunnableNodeDefinitions({ featureFlags }).map((definition) => definition.type)).not.toEqual(
      expect.arrayContaining(['videoConfigV2', 'superResolution', 'mjImage'])
    )

    const filtered = filterWorkflowNodeDefinitions({ featureFlags })
    const videoConfig = filtered.find((definition) => definition.type === 'videoConfigV2')
    expect(videoConfig).toMatchObject({
      addable: false,
      connectCreate: false,
      runnable: false,
      unavailableReason: 'Disabled by feature flag.',
    })
  })
})
