import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import type { CanvasPlan } from '../shared/plan'
import { createOrchestratorRuntime } from '../desktop/src/main/agent/orchestrator'
import { createCanvasPlanEventBus } from '../desktop/src/main/agent/plan-events'
import { createAssetPipeline } from '../desktop/src/main/assets/pipeline'
import { migrateDatabaseAtPath, openDatabaseAtPath } from '../desktop/src/main/db/migrate'
import { createAssetRepository } from '../desktop/src/main/db/repositories/asset.repo'
import { createChatMessageRepository } from '../desktop/src/main/db/repositories/chat-message.repo'
import { createJobRepository } from '../desktop/src/main/db/repositories/job.repo'
import { createJobEventBus } from '../desktop/src/main/jobs/events'
import { createJobQueue } from '../desktop/src/main/jobs/queue'
import { createJobWorker } from '../desktop/src/main/jobs/worker'
import { createGatewayRegistry } from '../desktop/src/main/providers/registry'
import { createStubProvider } from '../desktop/src/main/providers/stub.provider'
import { runImageNodeSmokePath } from '../desktop/src/main/smoke/m1-smoke'
import { createCanvasStore } from '../desktop/src/renderer/src/canvas/store/canvas.store'
import { createCanvasPlanExecutionController } from '../desktop/src/renderer/src/canvas/lib/canvas-plan-execution'

const modelPlan: CanvasPlan = {
  kind: 'plan',
  summary: 'Create one image node for a spaceship scene.',
  nodes: [
    {
      ref: 'prompt-1',
      type: 'text',
      title: 'Prompt',
      data: {
        content: '宇宙飞船穿过金色星云'
      }
    },
    {
      ref: 'image-1',
      type: 'imageConfigV2',
      title: 'Spaceship image',
      data: {
        promptOverride: '宇宙飞船穿过金色星云',
        modelId: 'stub-image',
        orientation: 'landscape',
        onRun: 'window.evil()'
      }
    }
  ],
  edges: [{ source: 'prompt-1', target: 'image-1', edgeType: 'promptOrder' }],
  runSteps: [{ ref: 'image-1', action: 'imageRun' }],
  question: null,
  dropped: []
}

describe('M4 agent orchestration smoke path', () => {
  it('runs natural language to sanitized Plan, applyPlan, runNode, stub asset, and done node without sync asset return or polling', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-agent-smoke-'))
    const dbPath = join(tempDir, 'agent-smoke.sqlite')
    const assetRoot = join(tempDir, 'assets')
    migrateDatabaseAtPath(dbPath)
    const db = openDatabaseAtPath(dbPath)

    try {
      const jobs = createJobRepository(db)
      const assets = createAssetRepository(db)
      const jobEvents = createJobEventBus()
      const planEvents = createCanvasPlanEventBus()
      const queue = createJobQueue({
        jobs,
        idFactory: (() => {
          let index = 0
          return () => (index++ === 0 ? 'job-agent-1' : 'job-image-1')
        })(),
        clock: () => 1_783_200_000_000
      })
      const runtime = createOrchestratorRuntime({
        queue,
        events: jobEvents,
        chatMessages: createChatMessageRepository(db),
        planEvents,
        workflowId: 'workflow-1',
        clock: () => 1_783_200_000_010,
        idFactory: (prefix) => `${prefix}-1`,
        planIdFactory: () => 'plan-1',
        planner: {
          proposePlan() {
            return modelPlan
          }
        }
      })
      const gateways = createGatewayRegistry()
      gateways.set('stub-main', createStubProvider())
      const pipeline = createAssetPipeline({
        assetRoot,
        assets,
        idFactory: () => 'asset-image-1',
        clock: () => 1_783_200_000_020
      })
      const worker = createJobWorker({
        jobs,
        events: jobEvents,
        leaseOwner: 'smoke-worker',
        clock: () => 1_783_200_000_030,
        handlers: {
          'agent.run': runtime.createJobHandler(),
          'canvas.generateImage': async (job) =>
            runImageNodeSmokePath({
              job,
              gateways,
              assets: pipeline,
              gatewayId: 'stub-main'
            })
        }
      })
      const store = createCanvasStore()
      const runNode = vi.fn((nodeId: string) =>
        queue.enqueue({
          type: 'canvas.generateImage',
          targetId: nodeId,
          payload: {
            prompt: '宇宙飞船穿过金色星云',
            modelKey: 'stub-image',
            parameters: { orientation: 'landscape' }
          },
          requestedBy: { type: 'agent', id: 'orchestrator' }
        })
      )
      const controller = createCanvasPlanExecutionController({
        store,
        runNode
      })

      const ticket = runtime.chatSend({ message: '生成一个图片节点，内容是：宇宙飞船', agentId: 'orchestrator', requestedBy: 'user-1' })
      expect(ticket).toEqual({ jobId: 'job-agent-1', messageId: 'message-1', status: 'pending' })
      expect(JSON.stringify(ticket)).not.toMatch(/asset|bytes|cc-asset|[A-Za-z]:\\\\/u)
      expect(runtime.getPlan('message-1')).toBeNull()

      expect(await worker.runNext()).toBe('job-agent-1')

      const plan = runtime.getPlan('message-1')
      expect(plan?.dropped).toEqual(expect.arrayContaining([expect.stringContaining('executable_string')]))
      expect(planEvents.getPlanReadyEvents()).toEqual([{ messageId: 'message-1', planId: 'plan-1' }])

      const applyResult = controller.applyPlan(plan as CanvasPlan, { autoExecute: true })

      expect(applyResult.runSteps).toEqual([{ ref: 'image-1', nodeId: 'plan-node-image-1', action: 'imageRun' }])
      expect(runNode).toHaveBeenCalledWith('plan-node-image-1')
      expect(store.getState().nodes.find((node) => node.id === 'plan-node-image-1')).toMatchObject({
        type: 'imageConfigV2',
        data: { status: 'pending', assetId: null }
      })

      expect(await worker.runNext()).toBe('job-image-1')
      const terminal = jobEvents.getTerminalEvents().find((event) => event.jobId === 'job-image-1')
      expect(terminal).toMatchObject({
        channel: 'job.completed',
        result: { kind: 'asset', assetId: 'asset-image-1' }
      })

      if (terminal?.channel === 'job.completed') {
        controller.notifyJobCompleted(terminal)
      }

      expect(store.getState().nodes.find((node) => node.id === 'plan-node-image-1')).toMatchObject({
        type: 'imageConfigV2',
        data: { status: 'done', assetId: 'asset-image-1' }
      })
      expect(controller.currentRunner?.active).toBe(false)
      expect(assets.getById('asset-image-1')).toMatchObject({
        id: 'asset-image-1',
        safeUrl: 'cc-asset://asset/asset-image-1',
        status: 'ready'
      })
      expect(JSON.stringify(ticket)).not.toContain('asset-image-1')
    } finally {
      db.close()
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('wires the renderer App and preload bridge to the Plan execution controller', () => {
    const canvasPageSource = readFileSync('desktop/src/renderer/src/canvas/CanvasPage.tsx', 'utf8')
    const preloadSource = readFileSync('desktop/src/preload/index.ts', 'utf8')

    expect(canvasPageSource).toContain('createCanvasPlanExecutionController')
    expect(canvasPageSource).toContain('runCanvasNode({ workflowId: currentWorkflowId, nodeId })')
    expect(canvasPageSource).toContain('notifyJobCompleted')
    expect(canvasPageSource).toContain('notifyJobFailed')
    expect(canvasPageSource).toContain('autoExecute')
    expect(preloadSource).toContain('runCanvasNode')
    expect(preloadSource).toContain("invokeMain('canvas.runNode'")
  })

  it('writes completed migrated report job metadata back to the running node in real time', async () => {
    const store = createCanvasStore({
      idFactory: () => 'plan-node-compose-1',
      edgeIdFactory: (source, target) => `edge-${source}-${target}`,
      clock: () => 1_783_500_000_000,
    })
    const plan: CanvasPlan = {
      kind: 'plan',
      summary: 'Compose two generated clips.',
      nodes: [
        {
          ref: 'compose-1',
          type: 'videoCompose',
          title: 'Compose',
          data: {
            label: 'Compose',
            inputOrder: [],
            transitionName: 'crossfade',
            modelId: 'compose-local',
            assetId: null,
            status: 'idle',
          },
        },
      ],
      edges: [],
      runSteps: [{ ref: 'compose-1', action: 'videoRun' }],
      question: null,
      dropped: [],
    }
    const controller = createCanvasPlanExecutionController({
      store,
      runNode: () => ({ jobId: 'job-compose-1', status: 'pending', createdAt: 1 }),
      applyOptions: {
        idFactory: (ref) => `plan-node-${ref}`,
        edgeIdFactory: (edge) => `edge-${edge.source}-${edge.target}`,
        clock: () => 1_783_500_000_001,
      },
    })

    controller.applyPlan(plan, { autoExecute: true })
    controller.notifyJobCompleted({
      channel: 'job.completed',
      jobId: 'job-compose-1',
      result: {
        kind: 'report',
        summary: 'composed',
        data: { assetId: 'asset-compose-1', url: 'cc-asset://asset/asset-compose-1' },
      },
      emittedAt: 1_783_500_000_002,
    })

    expect(store.getState().nodes.find((node) => node.id === 'plan-node-compose-1')).toMatchObject({
      type: 'videoCompose',
      data: {
        status: 'done',
        assetId: 'asset-compose-1',
        url: 'cc-asset://asset/asset-compose-1',
      },
    })
    expect(controller.currentRunner?.active).toBe(false)
  })
})
