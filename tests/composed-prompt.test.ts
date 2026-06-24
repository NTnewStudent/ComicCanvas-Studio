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
})
