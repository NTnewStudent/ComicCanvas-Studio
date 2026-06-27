import { describe, expect, it, vi } from 'vitest'

import {
  createCanvasEdge,
  type CanvasEdgeCreationRequest,
} from '../desktop/src/renderer/src/canvas/lib/canvas-edge-creation'
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

function createTextToImageRequest(source: string, target: string, reason: CanvasEdgeCreationRequest['reason']): CanvasEdgeCreationRequest {
  return { source, target, reason }
}

describe('REQ-092 canvas edge creation helper', () => {
  it('creates direct edges through the shared connection validator and notifies duplicate failures', () => {
    const store = createStore()
    const notify = vi.fn()
    const text = store.getState().addNode('text', { x: 0, y: 0 })
    const image = store.getState().addNode('image', { x: 260, y: 0 })

    expect(createCanvasEdge({
      store,
      notify,
      request: createTextToImageRequest(text, image, 'direct'),
    })).toEqual({ ok: true, edgeId: `edge-${text}-${image}` })
    expect(store.getState().edges).toHaveLength(1)

    expect(createCanvasEdge({
      store,
      notify,
      request: createTextToImageRequest(text, image, 'context-menu'),
    })).toEqual({ ok: false, reason: 'duplicate_edge' })
    expect(notify).toHaveBeenLastCalledWith({
      reason: 'duplicate_edge',
      message: '这两个节点已经连接过了',
      at: 1_782_700_000_000,
    })
  })

  it('marks mention-created edges and still rejects invalid mention pairs', () => {
    const store = createStore()
    const notify = vi.fn()
    const text = store.getState().addNode('text', { x: 0, y: 0 })
    const image = store.getState().addNode('image', { x: 260, y: 0 })
    const video = store.getState().addNode('video', { x: 520, y: 0 })

    expect(createCanvasEdge({
      store,
      notify,
      request: {
        source: text,
        target: image,
        reason: 'mention',
        markCreatedByMention: true,
      },
    })).toEqual({ ok: true, edgeId: `edge-${text}-${image}` })
    expect(store.getState().edges[0]?.data).toMatchObject({
      edgeType: 'promptOrder',
      createdByMention: true,
    })

    expect(createCanvasEdge({
      store,
      notify,
      request: {
        source: video,
        target: image,
        reason: 'mention',
        markCreatedByMention: true,
      },
    })).toEqual({ ok: false, reason: 'connection_not_allowed' })
    expect(store.getState().edges).toHaveLength(1)
    expect(notify).toHaveBeenLastCalledWith({
      reason: 'connection_not_allowed',
      message: '视频节点不能连接到图片节点',
      at: 1_782_700_000_000,
    })
  })
})
