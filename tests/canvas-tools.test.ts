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
      'canvas.connectToCreate',
      'canvas.createNode',
      'canvas.deleteEdge',
      'canvas.deleteNode',
      'canvas.deleteSelection',
      'canvas.duplicateNode',
      'canvas.duplicateSelection',
      'canvas.extractSelection',
      'canvas.layoutSelection',
      'canvas.proposePlan',
      'canvas.queryGraph',
      'canvas.renameNode',
      'canvas.runNode',
      'canvas.setNodePosition',
      'canvas.updateEdge',
      'canvas.updateNodeData',
      'canvas.validateGraph',
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
      code: 'invalid_edge',
      message: 'Connection rejected by shared connection matrix.',
      retryable: false,
      details: { source: 'node-new', target: 'text-1' }
    })
  })

  it('updates node data, deletes nodes with attached edges, and enqueues runNode jobs only', async () => {
    let graph: CanvasGraphSnapshot = {
      ...cloneGraph(),
      nodes: [
        ...cloneGraph().nodes,
        {
          id: 'image-config-1',
          type: 'imageConfigV2',
          position: { x: 640, y: 0 },
          data: {
            label: 'Image config',
            promptOverride: '',
            modelId: 'stub-image',
            orientation: 'landscape',
            assetId: null,
            status: 'idle',
          },
        },
      ],
      edges: [{ id: 'edge-1', source: 'text-1', target: 'image-config-1', data: { edgeType: 'promptOrder', createdAt: 1 } }]
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
      input: { nodeId: 'image-config-1', data: { promptOverride: 'gold spaceship above moon', status: 'pending' } },
      actor,
      traceId: 'trace-update'
    })
    expect(update.output).toMatchObject({ nodeId: 'image-config-1' })
    expect(graph.nodes.find((node) => node.id === 'image-config-1')?.data).toMatchObject({
      promptOverride: 'gold spaceship above moon',
      status: 'pending'
    })

    const ticket = await runtime.invoke({ toolId: 'canvas.runNode', input: { nodeId: 'image-config-1' }, actor, traceId: 'trace-run' })
    expect(ticket.output).toEqual({ jobId: 'job-image-1', status: 'pending', createdAt: 1_782_810_000_300 })
    expect(enqueued).toEqual([
      {
        type: 'canvas.generateImage',
        targetId: 'image-config-1',
        payload: { nodeId: 'image-config-1' },
        requestedBy: actor
      }
    ])

    const deleted = await runtime.invoke({ toolId: 'canvas.deleteNode', input: { nodeId: 'text-1' }, actor, traceId: 'trace-delete' })
    expect(deleted.output).toEqual({ nodeId: 'text-1', deletedEdgeIds: ['edge-1'] })
    expect(graph.nodes.map((node) => node.id)).toEqual(['image-1', 'image-config-1'])
    expect(graph.edges).toEqual([])
  })

  it('rejects runNode when the shared node definition marks runtime unavailable', async () => {
    const graph: CanvasGraphSnapshot = {
      nodes: [
        {
          id: 'mj-1',
          type: 'mjImage',
          position: { x: 0, y: 0 },
          data: {
            label: 'MJ legacy',
            prompt: 'legacy prompt',
            modelId: 'stub-mj',
            ratio: '16:9',
            urls: [],
            selectedIndex: 0,
            assetId: null,
            status: 'idle'
          }
        }
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 }
    }
    const enqueued: unknown[] = []
    const tools = createCanvasTools({
      graphStore: { getGraph: () => graph, setGraph: () => undefined },
      queue: {
        enqueue(input) {
          enqueued.push(input)
          return { jobId: 'job-unexpected', status: 'pending', createdAt: 1 }
        }
      },
      clock: () => 1
    })
    const runtime = createToolRuntime({ idFactory: () => 'invoke-mj-run', clock: () => 2, tools })

    const result = await runtime.invoke({ toolId: 'canvas.runNode', input: { nodeId: 'mj-1' }, actor, traceId: 'trace-mj-run' })

    expect(result.record.status).toBe('failed')
    expect(result.error).toEqual({
      errorClass: 'tool_runtime_failed',
      message: 'Runtime unavailable for mjImage: MJ node/component is out of scope for local Phase A.',
      retryable: false
    })
    expect(enqueued).toEqual([])
  })

  it('enqueues text polish jobs through the shared node definition runtime', async () => {
    const graph = cloneGraph()
    const enqueued: unknown[] = []
    const tools = createCanvasTools({
      graphStore: { getGraph: () => graph, setGraph: () => undefined },
      queue: {
        enqueue(input) {
          enqueued.push(input)
          return { jobId: 'job-text-polish', status: 'pending', createdAt: 1 }
        }
      },
      clock: () => 1
    })
    const runtime = createToolRuntime({ idFactory: () => 'invoke-text-run', clock: () => 2, tools })

    const result = await runtime.invoke({ toolId: 'canvas.runNode', input: { nodeId: 'text-1' }, actor, traceId: 'trace-text-run' })

    expect(result.output).toEqual({ jobId: 'job-text-polish', status: 'pending', createdAt: 1 })
    expect(enqueued).toEqual([
      {
        type: 'canvas.polishText',
        targetId: 'text-1',
        payload: { nodeId: 'text-1' },
        requestedBy: actor
      }
    ])
  })
})
