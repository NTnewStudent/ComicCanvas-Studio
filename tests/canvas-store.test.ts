import { beforeEach, describe, expect, it } from 'vitest'

import { createCanvasStore, type CanvasStoreState } from '../desktop/src/renderer/src/canvas/store/canvas.store'
import type { NodeType } from '../shared/nodes'

function createStore(): ReturnType<typeof createCanvasStore> {
  return createCanvasStore({
    idFactory: (() => {
      let index = 0
      return () => `node-${++index}`
    })(),
    edgeIdFactory: (source, target) => `edge-${source}-${target}`,
    clock: () => 1_782_700_000_000
  })
}

function expectFirst<T>(items: T[]): T {
  const item = items[0]
  if (item === undefined) {
    throw new Error('expected at least one item')
  }

  return item
}

describe('M2 canvas store', () => {
  let store: ReturnType<typeof createCanvasStore>

  beforeEach(() => {
    store = createStore()
  })

  it('adds a node and deletes it, then undo restores the previous state', () => {
    const id = store.getState().addNode('text', { x: 100, y: 120 })

    expect(store.getState().nodes).toHaveLength(1)
    expect(expectFirst(store.getState().nodes)).toMatchObject({
      id,
      type: 'text',
      position: { x: 100, y: 120 },
      data: { label: 'Text 1', content: '' }
    })

    store.getState().deleteNode(id)
    expect(store.getState().nodes).toHaveLength(0)

    store.getState().undo()
    expect(store.getState().nodes.map((node) => node.id)).toEqual([id])
    expect(store.getState().future).toHaveLength(1)
  })

  it('redo reapplies a deletion after undo', () => {
    const id = store.getState().addNode('text', { x: 0, y: 0 })
    store.getState().deleteNode(id)
    store.getState().undo()

    store.getState().redo()

    expect(store.getState().nodes).toHaveLength(0)
    expect(store.getState().past).toHaveLength(2)
  })

  it('connects valid nodes, rejects invalid and duplicate edges, and records a reason', () => {
    const text = store.getState().addNode('text', { x: 0, y: 0 })
    const image = store.getState().addNode('image', { x: 300, y: 0 })
    const video = store.getState().addNode('video', { x: 600, y: 0 })

    expect(store.getState().addEdge(text, image)).toEqual({ ok: true, edgeId: `edge-${text}-${image}` })
    expect(store.getState().edges).toHaveLength(1)
    expect(expectFirst(store.getState().edges).data).toEqual({ edgeType: 'promptOrder', createdAt: 1_782_700_000_000 })

    expect(store.getState().addEdge(text, image)).toEqual({ ok: false, reason: 'duplicate_edge' })
    expect(store.getState().addEdge(video, image)).toEqual({ ok: false, reason: 'connection_not_allowed' })
    expect(store.getState().lastConnectError).toEqual({ reason: 'connection_not_allowed', at: 1_782_700_000_000 })
  })

  it('creates migrated hjwall nodes with type-specific default data instead of video fallbacks', () => {
    const expectedDefaults: ReadonlyArray<readonly [NodeType, Record<string, unknown>]> = [
      ['character', { label: 'Character 1', description: '', assetId: null, tags: [] }],
      ['scene', { label: 'Scene 1', description: '', assetId: null, category: '' }],
      ['audio', { label: 'Audio 1', assetId: null, durationSeconds: 0, status: 'idle' }],
      ['videoCompose', { label: 'Video Compose 1', inputOrder: [], transitionName: null, modelId: 'stub-compose', assetId: null, status: 'idle' }],
      ['superResolution', { label: 'Super Resolution 1', scene: 'aigc', resolution: '1080p', fps: 30, assetId: null, status: 'idle' }],
      ['muxAudioVideo', { label: 'Mux Audio Video 1', modelId: 'stub-mux', assetId: null, status: 'idle' }],
      ['mjImage', { label: 'MJ Image 1', prompt: '', modelId: 'stub-mj', ratio: '16:9', urls: [], selectedIndex: 0, assetId: null, status: 'idle' }]
    ]

    for (const [type, expectedData] of expectedDefaults) {
      const id = store.getState().addNode(type, { x: 0, y: 0 })
      const node = store.getState().nodes.find((candidate) => candidate.id === id)

      expect(node?.data).toMatchObject(expectedData)
      expect(node?.data).not.toHaveProperty('promptOverride')
      expect(node?.data).not.toHaveProperty('durationSeconds', 3)
      expect(node?.data).not.toHaveProperty('firstFrameAssetId')
      expect(node?.data).not.toHaveProperty('lastFrameAssetId')
    }
  })

  it('updates node data and viewport without mutating previous snapshots', () => {
    const id = store.getState().addNode('image', { x: 50, y: 70 })
    const before = structuredClone(store.getState().nodes)

    store.getState().updateNodeData(id, { promptOverride: 'moon base' })
    store.getState().setViewport({ x: 10, y: 20, zoom: 0.75 })

    expect((expectFirst(store.getState().nodes).data as { promptOverride: string }).promptOverride).toBe('moon base')
    expect(store.getState().viewport).toEqual({ x: 10, y: 20, zoom: 0.75 })
    expect(expectFirst(before).data).toMatchObject({ promptOverride: '', status: 'idle' })
  })

  it('can apply a full state snapshot in one history entry', () => {
    const snapshot: Pick<CanvasStoreState, 'nodes' | 'edges' | 'viewport'> = {
      nodes: [
        { id: 'plan-text', type: 'text', position: { x: 0, y: 0 }, data: { label: 'Text 1', content: 'hello' } },
        {
          id: 'plan-image',
          type: 'image',
          position: { x: 260, y: 0 },
          data: {
            label: 'Image 1',
            promptOverride: '',
            modelId: 'stub-image',
            orientation: 'landscape',
            assetId: null,
            status: 'idle'
          }
        }
      ],
      edges: [
        {
          id: 'plan-edge',
          source: 'plan-text',
          target: 'plan-image',
          data: { edgeType: 'promptOrder', createdAt: 1_782_700_000_000 }
        }
      ],
      viewport: { x: 0, y: 0, zoom: 1 }
    }

    store.getState().applyChange(snapshot)

    expect(store.getState().nodes).toHaveLength(2)
    expect(store.getState().edges).toHaveLength(1)
    expect(store.getState().past).toHaveLength(1)

    store.getState().undo()
    expect(store.getState().nodes).toHaveLength(0)
    expect(store.getState().edges).toHaveLength(0)
  })
})
