import { describe, expect, it } from 'vitest'

import { compileWorkflowNodeRuntimeSnapshot } from '../shared/workflow-graph-compiler'
import type { CanvasGraphSnapshot } from '../shared/graph'
import type { StylePresetView } from '../shared/styles'

const styles: StylePresetView[] = [
  {
    id: 'style-project',
    code: 'project',
    name: 'Project',
    description: null,
    promptBefore: 'PROJECT BEFORE',
    promptAfter: 'PROJECT AFTER',
    legacyPromptPreset: null,
    negativePrompt: 'project negative',
    coverAssetId: null,
    coverUrl: null,
    tags: [],
    enabled: true,
    sortOrder: 1,
    createdAt: 1,
    updatedAt: 1,
  },
  {
    id: 'style-node',
    code: 'node',
    name: 'Node',
    description: null,
    promptBefore: 'NODE BEFORE',
    promptAfter: 'NODE AFTER',
    legacyPromptPreset: null,
    negativePrompt: 'node negative',
    coverAssetId: null,
    coverUrl: null,
    tags: [],
    enabled: true,
    sortOrder: 2,
    createdAt: 1,
    updatedAt: 1,
  },
]

describe('Task 43 workflow graph compiler', () => {
  it('creates a deterministic image runtime snapshot with prompt, image order, image roles, and style', () => {
    const graph: CanvasGraphSnapshot = {
      nodes: [
        { id: 'text-b', type: 'text', position: { x: 0, y: 0 }, data: { label: 'B', content: 'second prompt' } },
        { id: 'text-a', type: 'text', position: { x: 0, y: 100 }, data: { label: 'A', content: 'first prompt' } },
        {
          id: 'character-1',
          type: 'character',
          position: { x: 0, y: 200 },
          data: { label: 'Mika', description: 'blue coat pilot', assetId: 'asset-character' },
        },
        {
          id: 'image-ref-1',
          type: 'image',
          position: { x: 0, y: 300 },
          data: {
            label: 'Reference 1',
            promptOverride: '',
            modelId: 'stub-image',
            orientation: 'landscape',
            assetId: 'asset-image-1',
            status: 'done',
          },
        },
        {
          id: 'image-ref-2',
          type: 'image',
          position: { x: 0, y: 400 },
          data: {
            label: 'Reference 2',
            promptOverride: '',
            modelId: 'stub-image',
            orientation: 'landscape',
            assetId: 'asset-image-2',
            status: 'done',
          },
        },
        {
          id: 'target',
          type: 'imageConfigV2',
          position: { x: 360, y: 0 },
          data: {
            label: 'Target',
            promptOverride: 'final target prompt',
            modelId: 'stub-image',
            orientation: 'portrait',
            ratio: '9:16',
            stylePresetId: 'style-node',
            assetId: null,
            status: 'idle',
          },
        },
      ],
      edges: [
        { id: 'text-b-edge', source: 'text-b', target: 'target', data: { edgeType: 'promptOrder', promptOrder: 2, createdAt: 1 } },
        { id: 'text-a-edge', source: 'text-a', target: 'target', data: { edgeType: 'promptOrder', promptOrder: 1, createdAt: 2 } },
        { id: 'character-edge', source: 'character-1', target: 'target', data: { edgeType: 'reference', createdAt: 3 } },
        { id: 'image-2-edge', source: 'image-ref-2', target: 'target', data: { edgeType: 'imageOrder', imageOrder: 2, createdAt: 4 } },
        { id: 'image-1-edge', source: 'image-ref-1', target: 'target', data: { edgeType: 'imageRole', imageRole: 'first_frame', imageOrder: 1, createdAt: 5 } },
      ],
      viewport: { x: 0, y: 0, zoom: 1 },
    }

    const snapshot = compileWorkflowNodeRuntimeSnapshot({
      graph,
      nodeId: 'target',
      styles,
      projectDefaultStylePresetId: 'style-project',
    })

    expect(snapshot).toMatchObject({
      nodeId: 'target',
      nodeType: 'imageConfigV2',
      runAction: 'imageRun',
      modelKey: 'stub-image',
      stylePresetId: 'style-node',
      prompt: 'NODE BEFORE\n参考图像：\nfirst prompt\nsecond prompt\nCharacter Mika: blue coat pilot\nfinal target prompt\nNODE AFTER',
      negativePrompt: 'node negative',
      parameters: { orientation: 'portrait', ratio: '9:16', negativePrompt: 'node negative' },
    })
    expect(snapshot.promptParts.map((part) => part.nodeId)).toEqual(['text-a', 'text-b', 'character-1', 'target'])
    expect(snapshot.references).toEqual([
      {
        nodeId: 'character-1',
        nodeType: 'character',
        assetId: 'asset-character',
        mediaType: 'image',
        role: 'reference',
        order: 1,
        edgeId: 'character-edge',
      },
      {
        nodeId: 'image-ref-1',
        nodeType: 'image',
        assetId: 'asset-image-1',
        mediaType: 'image',
        role: 'first_frame',
        order: 1,
        edgeId: 'image-1-edge',
      },
      {
        nodeId: 'image-ref-2',
        nodeType: 'image',
        assetId: 'asset-image-2',
        mediaType: 'image',
        role: 'reference',
        order: 2,
        edgeId: 'image-2-edge',
      },
    ])
  })

  it('uses project default style when the target node has no override', () => {
    const graph: CanvasGraphSnapshot = {
      nodes: [
        { id: 'text-1', type: 'text', position: { x: 0, y: 0 }, data: { label: 'Prompt', content: 'city rain' } },
        {
          id: 'target',
          type: 'videoConfigV2',
          position: { x: 240, y: 0 },
          data: {
            label: 'Video',
            promptOverride: 'slow dolly shot',
            modelId: 'stub-video',
            orientation: 'landscape',
            durationSeconds: 5,
            firstFrameAssetId: null,
            lastFrameAssetId: null,
            assetId: null,
            status: 'idle',
            resolution: '1080p',
          },
        },
      ],
      edges: [
        { id: 'text-edge', source: 'text-1', target: 'target', data: { edgeType: 'promptOrder', createdAt: 1 } },
      ],
      viewport: { x: 0, y: 0, zoom: 1 },
    }

    const snapshot = compileWorkflowNodeRuntimeSnapshot({
      graph,
      nodeId: 'target',
      styles,
      projectDefaultStylePresetId: 'style-project',
    })

    expect(snapshot.prompt).toBe('PROJECT BEFORE\ncity rain\nslow dolly shot\nPROJECT AFTER')
    expect(snapshot.parameters).toMatchObject({
      orientation: 'landscape',
      durationSeconds: 5,
      resolution: '1080p',
      negativePrompt: 'project negative',
    })
    expect(snapshot.runAction).toBe('videoRun')
  })
})
