import { describe, expect, it } from 'vitest'

import { composeFinalPrompt } from '../shared/composed-prompt'
import type { GraphSnapshot } from '../shared/composed-prompt'

describe('composeFinalPrompt', () => {
  it('orders upstream text by edge creation time and preserves asset references', () => {
    const graph: GraphSnapshot = {
      nodes: [
        { id: 'text-late', type: 'text', data: { label: 'Late', content: 'second beat' } },
        { id: 'text-early', type: 'text', data: { label: 'Early', content: 'first beat' } },
        {
          id: 'image-reference',
          type: 'image',
          data: {
            label: 'Reference',
            promptOverride: '',
            modelId: 'stub-image',
            orientation: 'landscape',
            assetId: 'asset-image-1',
            status: 'done'
          }
        },
        {
          id: 'target',
          type: 'video',
          data: {
            label: 'Target',
            promptOverride: 'final motion cue',
            modelId: 'stub-video',
            orientation: 'landscape',
            durationSeconds: 5,
            firstFrameAssetId: null,
            lastFrameAssetId: null,
            assetId: null,
            status: 'idle'
          }
        }
      ],
      edges: [
        { id: 'late', source: 'text-late', target: 'target', data: { edgeType: 'promptOrder', createdAt: 20 } },
        { id: 'early', source: 'text-early', target: 'target', data: { edgeType: 'promptOrder', createdAt: 10 } },
        { id: 'image', source: 'image-reference', target: 'target', data: { edgeType: 'imageRole', createdAt: 15 } }
      ]
    }

    const result = composeFinalPrompt(graph, 'target')

    expect(result.composedPrompt).toContain('first beat\nsecond beat\nfinal motion cue')
    expect(result.referenceImages).toEqual([{ nodeId: 'image-reference', assetId: 'asset-image-1' }])
    expect(result.referenceVideos).toEqual([])
  })

  it('includes migrated semantic context nodes and mjImage references in deterministic order', () => {
    const graph: GraphSnapshot = {
      nodes: [
        { id: 'text-1', type: 'text', data: { label: 'Beat', content: 'walks into the station' } },
        {
          id: 'character-1',
          type: 'character',
          data: {
            label: 'Detective Lin',
            description: 'middle-aged detective in a graphite coat',
            assetId: 'asset-character-1',
            tags: ['lead', 'noir']
          }
        },
        {
          id: 'scene-1',
          type: 'scene',
          data: {
            label: 'Rain station',
            description: 'wet metro platform with cyan signal lights',
            assetId: 'asset-scene-1',
            category: 'interior'
          }
        },
        {
          id: 'mj-1',
          type: 'mjImage',
          data: {
            label: 'MJ board',
            prompt: 'noir key art, four panel options',
            modelId: 'stub-mj',
            ratio: '16:9',
            urls: [],
            selectedIndex: 0,
            assetId: 'asset-mj-1',
            status: 'done'
          }
        },
        {
          id: 'target',
          type: 'image',
          data: {
            label: 'Target image',
            promptOverride: 'final composition',
            modelId: 'stub-image',
            orientation: 'landscape',
            assetId: null,
            status: 'idle'
          }
        }
      ],
      edges: [
        { id: 'scene', source: 'scene-1', target: 'target', data: { edgeType: 'default', createdAt: 10 } },
        { id: 'character', source: 'character-1', target: 'target', data: { edgeType: 'default', createdAt: 20 } },
        { id: 'text', source: 'text-1', target: 'target', data: { edgeType: 'promptOrder', createdAt: 30 } },
        { id: 'mj', source: 'mj-1', target: 'target', data: { edgeType: 'imageRole', createdAt: 40, imageRole: 'reference' } }
      ]
    }

    const result = composeFinalPrompt(graph, 'target')

    expect(result.composedPrompt).toBe([
      '参考图像：',
      'Scene Rain station: wet metro platform with cyan signal lights',
      'Character Detective Lin: middle-aged detective in a graphite coat',
      'walks into the station',
      'MJ Image MJ board: noir key art, four panel options',
      'final composition'
    ].join('\n'))
    expect(result.referenceImages).toEqual([
      { nodeId: 'scene-1', assetId: 'asset-scene-1' },
      { nodeId: 'character-1', assetId: 'asset-character-1' },
      { nodeId: 'mj-1', assetId: 'asset-mj-1' }
    ])
    expect(result.referenceVideos).toEqual([])
  })
})
