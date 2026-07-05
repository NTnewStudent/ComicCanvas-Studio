import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

import type { CanvasGraphSnapshot } from '../shared/graph'
import { createCanvasTools } from '../desktop/src/main/tools/canvas'
import { createToolRuntime } from '../desktop/src/main/tools/runtime'

const actor = { type: 'agent' as const, id: 'tool-equivalence-test' }

function graphFixture(): CanvasGraphSnapshot {
  return {
    nodes: [
      { id: 'text-1', type: 'text', position: { x: 0, y: 0 }, data: { label: 'Prompt', content: 'neon city' } },
      {
        id: 'image-1',
        type: 'image',
        position: { x: 320, y: 0 },
        data: {
          label: 'Key image',
          promptOverride: '',
          modelId: 'stub-image',
          orientation: 'landscape',
          assetId: 'asset-image-1',
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
    edges: [
      { id: 'edge-text-image', source: 'text-1', target: 'image-1', data: { edgeType: 'promptOrder', createdAt: 1 } },
      { id: 'edge-image-video', source: 'image-1', target: 'video-1', data: { edgeType: 'imageRole', imageRole: 'first_frame', createdAt: 2 } },
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
  }
}

describe('Tool/UI durable action equivalence inventory', () => {
  it('registers Agent-callable tools for migrated durable canvas graph actions', () => {
    const tools = createCanvasTools({
      graphStore: { getGraph: graphFixture, setGraph: () => undefined },
      idFactory: (prefix) => `${prefix}-generated`,
      clock: () => 1_783_000_000_000,
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
  })

  it('validates, duplicates, moves, updates edges, extracts selections, and deletes selections through ToolRuntime', async () => {
    let graph = graphFixture()
    const tools = createCanvasTools({
      graphStore: {
        getGraph: () => graph,
        setGraph(nextGraph) {
          graph = nextGraph
        },
      },
      idFactory: (() => {
        const ids = ['node-copy', 'edge-copy', 'node-created', 'edge-created']
        return (prefix: 'node' | 'edge' | 'plan') => ids.shift() ?? `${prefix}-fallback`
      })(),
      clock: () => 1_783_000_000_100,
    })
    const runtime = createToolRuntime({ idFactory: () => 'invoke-tool-ui', clock: () => 1_783_000_000_200, tools })

    const validation = await runtime.invoke({
      toolId: 'canvas.validateGraph',
      input: { mode: 'strict' },
      actor,
      traceId: 'trace-validate',
    })
    expect(validation.output).toMatchObject({ mode: 'strict', valid: true, issues: [] })

    const duplicate = await runtime.invoke({
      toolId: 'canvas.duplicateNode',
      input: { nodeId: 'image-1', offset: { x: 40, y: 60 } },
      actor,
      traceId: 'trace-duplicate',
    })
    expect(duplicate.output).toEqual({ nodeId: 'node-copy' })
    expect(graph.nodes.find((node) => node.id === 'node-copy')).toMatchObject({
      type: 'image',
      position: { x: 360, y: 60 },
      data: { label: 'Key image Copy' },
    })

    const moved = await runtime.invoke({
      toolId: 'canvas.setNodePosition',
      input: { nodeId: 'node-copy', position: { x: 480, y: 120 } },
      actor,
      traceId: 'trace-position',
    })
    expect(moved.output).toEqual({ nodeId: 'node-copy', position: { x: 480, y: 120 } })

    const edge = await runtime.invoke({
      toolId: 'canvas.updateEdge',
      input: { edgeId: 'edge-image-video', data: { imageRole: 'last_frame' } },
      actor,
      traceId: 'trace-edge',
    })
    expect(edge.output).toEqual({ edgeId: 'edge-image-video' })
    expect(graph.edges.find((candidate) => candidate.id === 'edge-image-video')?.data).toMatchObject({ imageRole: 'last_frame' })

    const fragment = await runtime.invoke({
      toolId: 'canvas.extractSelection',
      input: { nodeIds: ['image-1', 'video-1'] },
      actor,
      traceId: 'trace-extract',
    })
    expect(fragment.output).toMatchObject({
      nodes: expect.arrayContaining([expect.objectContaining({ id: 'image-1' }), expect.objectContaining({ id: 'video-1' })]),
      edges: [expect.objectContaining({ id: 'edge-image-video' })],
    })

    const deleted = await runtime.invoke({
      toolId: 'canvas.deleteSelection',
      input: { nodeIds: ['node-copy'], edgeIds: ['edge-text-image'] },
      actor,
      traceId: 'trace-delete-selection',
    })
    expect(deleted.output).toEqual({ deletedNodeIds: ['node-copy'], deletedEdgeIds: ['edge-text-image'] })
    expect(graph.nodes.map((node) => node.id)).not.toContain('node-copy')
    expect(graph.edges.map((candidate) => candidate.id)).not.toContain('edge-text-image')
  })

  it('documents migrated non-canvas durable actions as service-backed or transient UI-only', () => {
    const contract = readFileSync('docs/api-contracts/tools-plugins.md', 'utf8')

    expect(contract).toContain('| graph.validate | `canvas.validateGraph` | ToolRuntime |')
    expect(contract).toContain('| workflow.project-template | `canvas.listWorkflows`, `canvas.importWorkflow`, `canvas.copyWorkflowTemplate` | IPC/service-backed |')
    expect(contract).toContain('| media.image-edit | `ImageEditIntent` through asset/node update services | Service-backed |')
    expect(contract).toContain('| viewport.fit-view | none | Transient UI-only |')
    expect(contract).toContain('MJ 节点/组件相关操作不包含在 Phase A 的 Tool/UI 等价关系范围内')
  })
})
