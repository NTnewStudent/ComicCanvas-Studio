import { describe, expect, it } from 'vitest'

import {
  connectCanvasNodes,
  defaultCanvasNodeData,
  deleteCanvasNode,
  duplicateCanvasNode,
} from '../shared/canvas-actions'
import type { CanvasGraphSnapshot } from '../shared/graph'
import { createCanvasTools } from '../desktop/src/main/tools/canvas'
import { createToolRuntime } from '../desktop/src/main/tools/runtime'
import { createCanvasStore } from '../desktop/src/renderer/src/canvas/store/canvas.store'

const actor = { type: 'agent' as const, id: 'canvas-action-semantics' }

function graphFixture(): CanvasGraphSnapshot {
  return {
    nodes: [
      { id: 'text-1', type: 'text', position: { x: 0, y: 0 }, data: { label: 'Prompt', content: 'rain' } },
      {
        id: 'image-1',
        type: 'image',
        position: { x: 320, y: 0 },
        data: {
          label: 'Image',
          promptOverride: '',
          modelId: 'stub-image',
          orientation: 'landscape',
          assetId: null,
          status: 'idle',
        },
      },
      {
        id: 'video-1',
        type: 'video',
        position: { x: 640, y: 0 },
        data: {
          label: 'Video',
          promptOverride: '',
          modelId: 'stub-video',
          orientation: 'landscape',
          durationSeconds: 3,
          firstFrameAssetId: null,
          lastFrameAssetId: null,
          assetId: null,
          status: 'idle',
        },
      },
    ],
    edges: [{ id: 'edge-text-image', source: 'text-1', target: 'image-1', data: { edgeType: 'promptOrder', createdAt: 1 } }],
    viewport: { x: 0, y: 0, zoom: 1 },
  }
}

describe('Task 54 shared canvas action semantics', () => {
  it('provides shared default data for renderer addNode and Agent createNode flows', async () => {
    const store = createCanvasStore({
      idFactory: () => 'node-store',
      edgeIdFactory: (source, target) => `edge-${source}-${target}`,
      clock: () => 10,
    })
    const storeNodeId = store.getState().addNode('videoCompose', { x: 10, y: 20 })

    let graph: CanvasGraphSnapshot = { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } }
    const runtime = createToolRuntime({
      idFactory: () => 'invoke-create',
      clock: () => 10,
      tools: createCanvasTools({
        graphStore: {
          getGraph: () => graph,
          setGraph(nextGraph) {
            graph = nextGraph
          },
        },
        idFactory: () => 'node-tool',
        clock: () => 10,
      }),
    })

    await runtime.invoke({
      toolId: 'canvas.createNode',
      input: { type: 'videoCompose', position: { x: 10, y: 20 } },
      actor,
      traceId: 'trace-create-defaults',
    })

    expect(store.getState().nodes.find((node) => node.id === storeNodeId)?.data).toEqual(defaultCanvasNodeData('videoCompose', 1))
    expect(graph.nodes.find((node) => node.id === 'node-tool')?.data).toEqual(defaultCanvasNodeData('videoCompose', 1))
  })

  it('uses identical connect, duplicate, and delete semantics for UI store and ToolRuntime', async () => {
    let toolGraph = graphFixture()
    const runtime = createToolRuntime({
      idFactory: () => 'invoke-action',
      clock: () => 100,
      tools: createCanvasTools({
        graphStore: {
          getGraph: () => toolGraph,
          setGraph(nextGraph) {
            toolGraph = nextGraph
          },
        },
        idFactory: (() => {
          const ids = ['edge-image-video', 'node-image-copy']
          return (prefix: 'node' | 'edge' | 'plan') => ids.shift() ?? `${prefix}-fallback`
        })(),
        clock: () => 100,
      }),
    })

    await runtime.invoke({
      toolId: 'canvas.connectNodes',
      input: { source: 'image-1', target: 'video-1', edgeType: 'imageRole', imageRole: 'first_frame' },
      actor,
      traceId: 'trace-connect',
    })
    await runtime.invoke({
      toolId: 'canvas.duplicateNode',
      input: { nodeId: 'image-1', offset: { x: 40, y: 40 } },
      actor,
      traceId: 'trace-duplicate',
    })
    await runtime.invoke({
      toolId: 'canvas.deleteNode',
      input: { nodeId: 'text-1' },
      actor,
      traceId: 'trace-delete',
    })

    let sharedGraph = graphFixture()
    const connected = connectCanvasNodes(sharedGraph, {
      edgeId: 'edge-image-video',
      source: 'image-1',
      target: 'video-1',
      edgeType: 'imageRole',
      imageRole: 'first_frame',
      createdAt: 100,
    })
    expect(connected.ok).toBe(true)
    if (!connected.ok) throw new Error('expected shared connection to succeed')
    sharedGraph = connected.graph
    sharedGraph = duplicateCanvasNode(sharedGraph, {
      nodeId: 'image-1',
      newNodeId: 'node-image-copy',
      offset: { x: 40, y: 40 },
    }).graph
    sharedGraph = deleteCanvasNode(sharedGraph, { nodeId: 'text-1' }).graph

    expect(toolGraph).toEqual(sharedGraph)
  })
})
