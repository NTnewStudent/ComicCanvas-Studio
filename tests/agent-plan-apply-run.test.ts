import { describe, expect, it, vi } from 'vitest'

import { applyAgentPlanOnReady } from '../desktop/src/renderer/src/chat/agent/apply-agent-plan-on-ready'
import { createCanvasPlanExecutionController } from '../desktop/src/renderer/src/canvas/lib/canvas-plan-execution'
import { createCanvasStore } from '../desktop/src/renderer/src/canvas/store/canvas.store'
import {
  AGENT_PLAN_AUTO_APPLY_ENABLED,
  isAgentPlanAutoApplyEnabled,
  resolveAgentPlanAutoApplyOptions,
} from '../shared/agent-plan-apply'
import type { CanvasPlan } from '../shared/plan'

const executablePlan: CanvasPlan = {
  kind: 'plan',
  summary: 'Text to image to video.',
  nodes: [
    { ref: 'text-a', type: 'text', title: 'Prompt', data: { content: 'spaceship' } },
    { ref: 'image-a', type: 'imageConfigV2', title: 'Image', data: { modelId: 'stub-image', orientation: 'landscape' } },
    { ref: 'video-a', type: 'videoConfigV2', title: 'Video', data: { modelId: 'stub-video', orientation: 'landscape', durationSeconds: 5 } },
  ],
  edges: [
    { source: 'text-a', target: 'image-a', edgeType: 'promptOrder' },
    { source: 'image-a', target: 'video-a', edgeType: 'imageRole', imageRole: 'first_frame' },
  ],
  runSteps: [
    { ref: 'image-a', action: 'imageRun' },
    { ref: 'video-a', action: 'videoRun' },
  ],
  question: null,
  dropped: [],
}

describe('Task 60 agent plan apply/run', () => {
  it('enables the shared automation gate', () => {
    expect(AGENT_PLAN_AUTO_APPLY_ENABLED).toBe(true)
    expect(isAgentPlanAutoApplyEnabled()).toBe(true)
  })

  it('resolves auto-apply only for executable plans with auto-run requested', () => {
    expect(resolveAgentPlanAutoApplyOptions({ planKind: 'clarify', uiAutoExecute: true })).toBeNull()
    expect(resolveAgentPlanAutoApplyOptions({ planKind: 'plan', uiAutoExecute: false })).toBeNull()
    expect(resolveAgentPlanAutoApplyOptions({ planKind: 'plan', uiAutoExecute: true })).toEqual({ autoExecute: true })
    expect(resolveAgentPlanAutoApplyOptions({ planKind: 'plan', uiAutoExecute: false, agentAutoRun: true })).toEqual({
      autoExecute: true,
    })
  })

  it('invokes renderer applyPlan when automation is requested', () => {
    const applyPlan = vi.fn()
    const applied = applyAgentPlanOnReady({
      plan: executablePlan,
      uiAutoExecute: true,
      applyPlan,
    })

    expect(applied).toBe(true)
    expect(applyPlan).toHaveBeenCalledWith(executablePlan, { autoExecute: true })
  })

  it('runs image and video plan steps serially through the execution controller', () => {
    const store = createCanvasStore({
      edgeIdFactory: (source, target) => `edge-${source}-${target}`,
      clock: () => 1_783_800_000_000,
    })
    const launched: string[] = []
    const runNode = vi.fn((nodeId: string) => {
      launched.push(nodeId)
      return { jobId: `job-${nodeId}`, status: 'pending' as const, createdAt: 1_783_800_000_000 }
    })
    const controller = createCanvasPlanExecutionController({
      store,
      runNode,
      applyOptions: { idFactory: (ref) => `plan-node-${ref}` },
    })

    controller.applyPlan(executablePlan, { autoExecute: true })

    expect(launched).toEqual(['plan-node-image-a'])

    controller.notifyJobCompleted({
      channel: 'job.completed',
      jobId: 'job-plan-node-image-a',
      result: { kind: 'asset', assetId: 'asset-image-1' },
      emittedAt: 1_783_800_000_001,
    })

    expect(launched).toEqual(['plan-node-image-a', 'plan-node-video-a'])
    expect(store.getState().nodes.find((node) => node.id === 'plan-node-image-a')).toMatchObject({
      data: { status: 'done', assetId: 'asset-image-1' },
    })

    controller.notifyJobCompleted({
      channel: 'job.completed',
      jobId: 'job-plan-node-video-a',
      result: { kind: 'asset', assetId: 'asset-video-1' },
      emittedAt: 1_783_800_000_002,
    })

    expect(controller.currentRunner?.active).toBe(false)
    expect(store.getState().nodes.find((node) => node.id === 'plan-node-video-a')).toMatchObject({
      data: { status: 'done', assetId: 'asset-video-1' },
    })
  })

  it('short-circuits remaining run steps after a failed video step', () => {
    const store = createCanvasStore({
      edgeIdFactory: (source, target) => `edge-${source}-${target}`,
      clock: () => 1_783_800_000_111,
    })
    const runNode = vi.fn((nodeId: string) => ({ jobId: `job-${nodeId}`, status: 'pending' as const, createdAt: 1_783_800_000_111 }))
    const controller = createCanvasPlanExecutionController({
      store,
      runNode,
      applyOptions: { idFactory: (ref) => `plan-node-${ref}` },
    })

    controller.applyPlan(executablePlan, { autoExecute: true })
    controller.notifyJobCompleted({
      channel: 'job.completed',
      jobId: 'job-plan-node-image-a',
      result: { kind: 'asset', assetId: 'asset-image-1' },
      emittedAt: 1_783_800_000_112,
    })
    controller.notifyJobFailed({
      channel: 'job.failed',
      jobId: 'job-plan-node-video-a',
      error: { errorClass: 'provider_timeout', message: 'video timeout', retryable: true },
      emittedAt: 1_783_800_000_113,
    })

    expect(runNode).toHaveBeenCalledTimes(2)
    expect(controller.currentRunner?.active).toBe(false)
    expect(store.getState().nodes.find((node) => node.id === 'plan-node-video-a')).toMatchObject({
      data: { status: 'error', error: 'video timeout' },
    })
  })
})
