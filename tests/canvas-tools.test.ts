import { describe, expect, it } from 'vitest'

import type { CanvasGraphSnapshot } from '../shared/graph'
import { createCanvasTools } from '../desktop/src/main/tools/canvas'
import { createToolRuntime } from '../desktop/src/main/tools/runtime'

const actor = { type: 'agent' as const, id: 'orchestrator' }

const initialGraph: CanvasGraphSnapshot = {
  nodes: [
    { id: 'text-1', type: 'text', position: { x: 0, y: 0 }, data: { label: 'Prompt', content: 'gold spaceship' } },
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
        status: 'idle'
      }
    }
  ],
  edges: [],
  viewport: { x: 0, y: 0, zoom: 1 }
}

function cloneGraph(): CanvasGraphSnapshot {
  return structuredClone(initialGraph)
}

describe('M4 built-in canvas tools', () => {
  it('registers the expected canvas tool descriptors', () => {
    const tools = createCanvasTools({
      graphStore: { getGraph: cloneGraph, setGraph: () => undefined },
      idFactory: (prefix) => `${prefix}-1`,
      clock: () => 1_782_810_000_000
    })

    expect(tools.map((tool) => tool.descriptor.id).sort()).toEqual([
      'canvas.connectNodes',
      'canvas.createNode',
      'canvas.deleteNode',
      'canvas.proposePlan',
      'canvas.queryGraph',
      'canvas.runNode',
      'canvas.updateNodeData'
    ])
    expect(tools.find((tool) => tool.descriptor.id === 'canvas.queryGraph')?.descriptor.concurrency).toBe('readonly')
    expect(tools.find((tool) => tool.descriptor.id === 'canvas.createNode')?.descriptor.permissions).toContainEqual({
      kind: 'canvas.write',
      reason: 'Creates or mutates canvas graph nodes.'
    })
  })

  it('queries and mutates the graph through ToolRuntime with shared connection validation', async () => {
    let graph = cloneGraph()
    const tools = createCanvasTools({
      graphStore: {
        getGraph: () => graph,
        setGraph(nextGraph) {
          graph = nextGraph
        }
      },
      idFactory: (prefix) => `${prefix}-new`,
      clock: () => 1_782_810_000_100
    })
    const runtime = createToolRuntime({
      idFactory: (() => {
        let next = 0
        return () => `invoke-${(next += 1)}`
      })(),
      clock: () => 1_782_810_000_200,
      tools
    })

    const query = await runtime.invoke({ toolId: 'canvas.queryGraph', input: {}, actor, traceId: 'trace-query' })
    expect(query.output).toEqual(initialGraph)

    const create = await runtime.invoke({
      toolId: 'canvas.createNode',
      input: {
        type: 'video',
        position: { x: 640, y: 0 },
        data: {
          label: 'Video',
          promptOverride: '',
          modelId: 'stub-video',
          orientation: 'landscape',
          durationSeconds: 5,
          firstFrameAssetId: null,
          lastFrameAssetId: null,
          assetId: null,
          status: 'idle'
        }
      },
      actor,
      traceId: 'trace-create'
    })
    expect(create.output).toMatchObject({ nodeId: 'node-new' })
    expect(graph.nodes).toHaveLength(3)

    const connect = await runtime.invoke({
      toolId: 'canvas.connectNodes',
      input: { source: 'image-1', target: 'node-new', edgeType: 'imageRole', imageRole: 'first_frame' },
      actor,
      traceId: 'trace-connect'
    })
    expect(connect.output).toMatchObject({ edgeId: 'edge-new' })
    expect(graph.edges).toEqual([
      {
        id: 'edge-new',
        source: 'image-1',
        target: 'node-new',
        data: { edgeType: 'imageRole', imageRole: 'first_frame', createdAt: 1_782_810_000_100 }
      }
    ])

    const rejected = await runtime.invoke({
      toolId: 'canvas.connectNodes',
      input: { source: 'node-new', target: 'text-1', edgeType: 'default' },
      actor,
      traceId: 'trace-reject'
    })
    expect(rejected.record.status).toBe('failed')
    expect(rejected.error).toEqual({
      errorClass: 'tool_runtime_failed',
      message: 'Connection rejected by shared connection matrix.',
      retryable: false
    })
  })

  it('updates node data, deletes nodes with attached edges, and enqueues runNode jobs only', async () => {
    let graph: CanvasGraphSnapshot = {
      ...cloneGraph(),
      edges: [{ id: 'edge-1', source: 'text-1', target: 'image-1', data: { edgeType: 'promptOrder', createdAt: 1 } }]
    }
    const enqueued: unknown[] = []
    const tools = createCanvasTools({
      graphStore: {
        getGraph: () => graph,
        setGraph(nextGraph) {
          graph = nextGraph
        }
      },
      queue: {
        enqueue(input) {
          enqueued.push(input)
          return { jobId: 'job-image-1', status: 'pending', createdAt: 1_782_810_000_300 }
        }
      },
      idFactory: (prefix) => `${prefix}-1`,
      clock: () => 1_782_810_000_300
    })
    const runtime = createToolRuntime({ idFactory: () => 'invoke-run', clock: () => 1_782_810_000_400, tools })

    const update = await runtime.invoke({
      toolId: 'canvas.updateNodeData',
      input: { nodeId: 'image-1', data: { promptOverride: 'gold spaceship above moon', status: 'pending' } },
      actor,
      traceId: 'trace-update'
    })
    expect(update.output).toMatchObject({ nodeId: 'image-1' })
    expect(graph.nodes.find((node) => node.id === 'image-1')?.data).toMatchObject({
      promptOverride: 'gold spaceship above moon',
      status: 'pending'
    })

    const ticket = await runtime.invoke({ toolId: 'canvas.runNode', input: { nodeId: 'image-1' }, actor, traceId: 'trace-run' })
    expect(ticket.output).toEqual({ jobId: 'job-image-1', status: 'pending', createdAt: 1_782_810_000_300 })
    expect(enqueued).toEqual([
      {
        type: 'canvas.generateImage',
        targetId: 'image-1',
        payload: { nodeId: 'image-1' },
        requestedBy: actor
      }
    ])

    const deleted = await runtime.invoke({ toolId: 'canvas.deleteNode', input: { nodeId: 'text-1' }, actor, traceId: 'trace-delete' })
    expect(deleted.output).toEqual({ nodeId: 'text-1', deletedEdgeIds: ['edge-1'] })
    expect(graph.nodes.map((node) => node.id)).toEqual(['image-1'])
    expect(graph.edges).toEqual([])
  })
})
