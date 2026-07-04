import { describe, expect, it, vi } from 'vitest'

import { createCanvasPlanExecutionController } from '../desktop/src/renderer/src/canvas/lib/canvas-plan-execution'
import { createCanvasStore } from '../desktop/src/renderer/src/canvas/store/canvas.store'
import type { CanvasPlan } from '../shared/plan'

const imageToVideoPlan: CanvasPlan = {
  kind: 'plan',
  summary: 'Generate image then video.',
  nodes: [
    { ref: 'image-a', type: 'imageConfigV2', title: 'Image', data: { modelId: 'stub-image', orientation: 'landscape' } },
    { ref: 'video-a', type: 'videoConfigV2', title: 'Video', data: { modelId: 'stub-video', orientation: 'landscape', durationSeconds: 5 } }
  ],
  edges: [{ source: 'image-a', target: 'video-a', edgeType: 'imageRole', imageRole: 'first_frame' }],
  runSteps: [
    { ref: 'image-a', action: 'imageRun' },
    { ref: 'video-a', action: 'videoRun' }
  ],
  question: null,
  dropped: []
}

describe('canvas-plan-execution controller', () => {
  it('maps videoRun failures to canvas.generateVideo node patches', () => {
    const store = createCanvasStore({
      edgeIdFactory: (source, target) => `edge-${source}-${target}`,
      clock: () => 1_783_700_000_000
    })
    const tickets = [
      { jobId: 'job-image-1', nodeId: 'plan-node-image-a', status: 'pending' as const, createdAt: 1_783_700_000_000 },
      { jobId: 'job-video-1', nodeId: 'plan-node-video-a', status: 'pending' as const, createdAt: 1_783_700_000_001 }
    ]
    const runNode = vi.fn((nodeId: string) => {
      const ticket = tickets.find((entry) => entry.nodeId === nodeId)
      if (!ticket) {
        throw new Error(`unexpected node ${nodeId}`)
      }
      return ticket
    })
    const controller = createCanvasPlanExecutionController({
      store,
      runNode,
      applyOptions: { idFactory: (ref) => `plan-node-${ref}` }
    })

    controller.applyPlan(imageToVideoPlan, { autoExecute: true })

    controller.notifyJobCompleted({
      channel: 'job.completed',
      jobId: 'job-image-1',
      result: { kind: 'asset', assetId: 'asset-image-1' },
      emittedAt: 1_783_700_000_002
    })

    controller.notifyJobFailed({
      channel: 'job.failed',
      jobId: 'job-video-1',
      error: { errorClass: 'provider_timeout', message: 'video provider timeout', retryable: true },
      emittedAt: 1_783_700_000_003
    })

    expect(store.getState().nodes.find((node) => node.id === 'plan-node-video-a')).toMatchObject({
      data: { status: 'error', error: 'video provider timeout' }
    })
    expect(controller.currentRunner?.active).toBe(false)
  })
})
