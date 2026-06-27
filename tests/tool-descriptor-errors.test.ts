import { describe, expect, it } from 'vitest'

import type { CanvasGraphSnapshot } from '../shared/graph'
import { createCanvasTools } from '../desktop/src/main/tools/canvas'
import { createToolRuntime } from '../desktop/src/main/tools/runtime'

const actor = { type: 'agent' as const, id: 'tool-descriptor-errors' }

function graphFixture(): CanvasGraphSnapshot {
  return {
    nodes: [
      { id: 'text-1', type: 'text', position: { x: 0, y: 0 }, data: { label: 'Prompt', content: 'storm castle' } },
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
        id: 'image-config-1',
        type: 'imageConfigV2',
        position: { x: 320, y: 240 },
        data: {
          label: 'Image config',
          promptOverride: 'storm castle',
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
          durationSeconds: 5,
          firstFrameAssetId: null,
          lastFrameAssetId: null,
          assetId: null,
          status: 'idle',
        },
      },
    ],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
  }
}

function permissionKinds(toolId: string): string[] {
  const tools = createCanvasTools({
    graphStore: { getGraph: graphFixture, setGraph: () => undefined },
    clock: () => 1,
  })
  return tools.find((tool) => tool.descriptor.id === toolId)?.descriptor.permissions.map((permission) => permission.kind).sort() ?? []
}

describe('Task 53 tool descriptors and structured errors', () => {
  it('declares permission descriptors for Agent discovery and permission policy', () => {
    expect(permissionKinds('canvas.queryGraph')).toEqual(['canvas.read'])
    expect(permissionKinds('canvas.validateGraph')).toEqual(['canvas.read'])
    expect(permissionKinds('canvas.createNode')).toEqual(['canvas.write'])
    expect(permissionKinds('canvas.connectNodes')).toEqual(['canvas.write'])
    expect(permissionKinds('canvas.deleteNode')).toEqual(['canvas.write', 'destructive'])
    expect(permissionKinds('canvas.deleteEdge')).toEqual(['canvas.write', 'destructive'])
    expect(permissionKinds('canvas.deleteSelection')).toEqual(['canvas.write', 'canvas.write', 'destructive'])
    expect(permissionKinds('canvas.runNode')).toEqual(['provider.spend'])
  })

  it('returns stable structured error codes for invalid edges', async () => {
    const graph = graphFixture()
    const runtime = createToolRuntime({
      idFactory: () => 'invoke-invalid-edge',
      clock: () => 1,
      tools: createCanvasTools({
        graphStore: { getGraph: () => graph, setGraph: () => undefined },
        clock: () => 1,
      }),
    })

    const result = await runtime.invoke({
      toolId: 'canvas.connectNodes',
      input: { source: 'video-1', target: 'text-1', edgeType: 'default' },
      actor,
      traceId: 'trace-invalid-edge',
    })

    expect(result.record.status).toBe('failed')
    expect(result.error).toEqual({
      errorClass: 'tool_runtime_failed',
      code: 'invalid_edge',
      message: 'Connection rejected by shared connection matrix.',
      retryable: false,
      details: { source: 'video-1', target: 'text-1' },
    })
  })

  it('returns stable structured error codes when runNode cannot enqueue a job', async () => {
    const graph = graphFixture()
    const runtime = createToolRuntime({
      idFactory: () => 'invoke-job-failure',
      clock: () => 1,
      tools: createCanvasTools({
        graphStore: { getGraph: () => graph, setGraph: () => undefined },
        queue: {
          enqueue() {
            throw new Error('sqlite busy')
          },
        },
        clock: () => 1,
      }),
    })

    const result = await runtime.invoke({
      toolId: 'canvas.runNode',
      input: { nodeId: 'image-config-1' },
      actor,
      traceId: 'trace-job-failure',
    })

    expect(result.record.status).toBe('failed')
    expect(result.error).toEqual({
      errorClass: 'tool_runtime_failed',
      code: 'job_enqueue_failed',
      message: 'Failed to enqueue canvas job.',
      retryable: true,
      details: { nodeId: 'image-config-1', cause: 'sqlite busy' },
    })
  })
})
