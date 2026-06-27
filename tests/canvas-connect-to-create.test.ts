import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'

import { connectCreatedCanvasNode } from '../desktop/src/renderer/src/canvas/lib/canvas-connect-to-create'
import { createCanvasStore } from '../desktop/src/renderer/src/canvas/store/canvas.store'

function createStore(): ReturnType<typeof createCanvasStore> {
  return createCanvasStore({
    idFactory: (() => {
      let index = 0
      return () => `node-${++index}`
    })(),
    edgeIdFactory: (source, target) => `edge-${source}-${target}`,
    clock: () => 1_782_700_000_000,
  })
}

describe('REQ-092 connect-to-create edge validation', () => {
  it('connects a newly-created compatible node through the shared edge helper', () => {
    const store = createStore()
    const notify = vi.fn()
    const text = store.getState().addNode('text', { x: 0, y: 0 })
    const image = store.getState().addNode('image', { x: 280, y: 0 })

    const result = connectCreatedCanvasNode({
      store,
      sourceNodeId: text,
      createdNodeId: image,
      notify,
    })

    expect(result).toEqual({ ok: true, edgeId: `edge-${text}-${image}` })
    expect(store.getState().edges).toHaveLength(1)
    expect(store.getState().edges[0]).toMatchObject({
      id: `edge-${text}-${image}`,
      source: text,
      target: image,
      data: { edgeType: 'promptOrder' },
    })
    expect(notify).not.toHaveBeenCalled()
  })

  it('rejects invalid connect-to-create pairs without leaving an edge', () => {
    const store = createStore()
    const notify = vi.fn()
    const video = store.getState().addNode('video', { x: 0, y: 0 })
    const image = store.getState().addNode('image', { x: 280, y: 0 })

    const result = connectCreatedCanvasNode({
      store,
      sourceNodeId: video,
      createdNodeId: image,
      notify,
    })

    expect(result).toEqual({ ok: false, reason: 'connection_not_allowed' })
    expect(store.getState().edges).toHaveLength(0)
    expect(notify).toHaveBeenCalledWith({
      reason: 'connection_not_allowed',
      message: '视频节点不能连接到图片节点',
      at: 1_782_700_000_000,
    })
  })

  it('wires node context-menu create-and-connect actions into CanvasPage', () => {
    const source = readFileSync('desktop/src/renderer/src/canvas/CanvasPage.tsx', 'utf8')

    expect(source).toContain("from './lib/canvas-connect-to-create'")
    expect(source).toContain('handleCreateConnectedNodeAtContextMenu')
    expect(source).toContain('connectCreatedCanvasNode({')
    expect(source).toContain("sourceNodeId: contextMenu.nodeId")
    expect(source).toContain("createdNodeId")
  })
})
