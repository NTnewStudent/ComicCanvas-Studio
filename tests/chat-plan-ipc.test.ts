import { mkdtempSync, rmSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import type { CanvasPlan } from '../shared/plan'
import { createOrchestratorRuntime } from '../desktop/src/main/agent/orchestrator'
import { createCanvasPlanEventBus } from '../desktop/src/main/agent/plan-events'
import { migrateDatabaseAtPath, openDatabaseAtPath } from '../desktop/src/main/db/migrate'
import { createChatMessageRepository } from '../desktop/src/main/db/repositories/chat-message.repo'
import { createJobRepository } from '../desktop/src/main/db/repositories/job.repo'
import { createIpcCanvasPlanEventBus } from '../desktop/src/main/ipc/canvas-plan-fanout'
import { createJobEventBus } from '../desktop/src/main/jobs/events'
import { createJobQueue } from '../desktop/src/main/jobs/queue'
import { createJobWorker } from '../desktop/src/main/jobs/worker'

const samplePlan: CanvasPlan = {
  kind: 'plan',
  summary: 'Create one image node for a spaceship scene.',
  nodes: [
    {
      ref: 'image-1',
      type: 'image',
      title: 'Spaceship image',
      data: {
        promptOverride: 'gold spaceship above the moon',
        modelId: 'stub-image',
        orientation: 'landscape'
      }
    }
  ],
  edges: [],
  runSteps: [{ ref: 'image-1', action: 'imageRun' }],
  question: null,
  dropped: []
}

function createWindow(destroyed = false) {
  return {
    isDestroyed: () => destroyed,
    webContents: {
      send: vi.fn()
    }
  }
}

describe('M4 chat plan IPC', () => {
  it('persists chat messages, stores sanitized plans after completion, and emits planReady', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-chat-plan-'))
    const dbPath = join(tempDir, 'chat-plan.sqlite')
    migrateDatabaseAtPath(dbPath)
    const db = openDatabaseAtPath(dbPath)

    try {
      const now = 1_783_000_000_000
      const jobs = createJobRepository(db)
      const chatMessages = createChatMessageRepository(db)
      const jobEvents = createJobEventBus()
      const planEvents = createCanvasPlanEventBus()
      const queue = createJobQueue({
        jobs,
        idFactory: () => 'job-agent-1',
        clock: () => now
      })
      const runtime = createOrchestratorRuntime({
        queue,
        events: jobEvents,
        chatMessages,
        planEvents,
        clock: () => now + 10,
        workflowId: 'workflow-1',
        idFactory: (prefix) => `${prefix}-1`,
        planIdFactory: () => 'plan-1',
        planner: {
          proposePlan() {
            return samplePlan
          }
        }
      })
      const worker = createJobWorker({
        jobs,
        events: jobEvents,
        leaseOwner: 'agent-worker',
        clock: () => now + 20,
        handlers: {
          'agent.run': runtime.createJobHandler()
        }
      })

      const ticket = runtime.chatSend({ message: 'Generate a spaceship image node', agentId: 'orchestrator', requestedBy: 'user-1' })

      expect(ticket).toEqual({ runId: 'run-1', jobId: 'job-agent-1', messageId: 'message-1', status: 'pending' })
      expect(ticket).not.toHaveProperty('plan')
      expect(chatMessages.getById('message-1')).toMatchObject({
        id: 'message-1',
        workflowId: 'workflow-1',
        agentRunId: 'run-1',
        role: 'user',
        content: 'Generate a spaceship image node',
        createdAt: now + 10
      })
      expect(runtime.getPlan('message-1')).toBeNull()

      expect(await worker.runNext()).toBe('job-agent-1')

      const storedMessage = chatMessages.getById('message-1')
      expect(storedMessage?.applyStatus).toBe('draft')
      expect(storedMessage?.planJson ? JSON.parse(storedMessage.planJson) : null).toEqual(samplePlan)
      expect(runtime.getPlan('message-1')).toEqual(samplePlan)
      expect(planEvents.getPlanReadyEvents()).toEqual([{ messageId: 'message-1', planId: 'plan-1' }])
    } finally {
      db.close()
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('emits responseReady without storing a CanvasPlan for ordinary Agent answers', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-chat-response-'))
    const dbPath = join(tempDir, 'chat-response.sqlite')
    migrateDatabaseAtPath(dbPath)
    const db = openDatabaseAtPath(dbPath)

    try {
      const now = 1_783_000_000_000
      const jobs = createJobRepository(db)
      const chatMessages = createChatMessageRepository(db)
      const jobEvents = createJobEventBus()
      const planEvents = createCanvasPlanEventBus()
      const queue = createJobQueue({
        jobs,
        idFactory: () => 'job-agent-answer',
        clock: () => now
      })
      const runtime = createOrchestratorRuntime({
        queue,
        events: jobEvents,
        chatMessages,
        planEvents,
        clock: () => now + 10,
        workflowId: 'workflow-1',
        idFactory: (prefix) => `${prefix}-answer`,
        planIdFactory: () => 'plan-should-not-exist',
        planner: {
          proposePlan() {
            return {
              type: 'answer',
              summary: '用户提出了普通问题，应由通用 Agent 直接回答。',
              text: '今天是星期二。',
              dropped: []
            }
          }
        }
      })
      const worker = createJobWorker({
        jobs,
        events: jobEvents,
        leaseOwner: 'agent-worker',
        clock: () => now + 20,
        handlers: {
          'agent.run': runtime.createJobHandler()
        }
      })

      const ticket = runtime.chatSend({ message: '今天星期几', agentId: 'general-purpose', requestedBy: 'user-1' })

      expect(ticket).toEqual({ runId: 'run-answer', jobId: 'job-agent-answer', messageId: 'message-answer', status: 'pending' })
      expect(await worker.runNext()).toBe('job-agent-answer')

      expect(runtime.getPlan('message-answer')).toBeNull()
      expect(chatMessages.getById('message-answer')?.planJson).toBeNull()
      expect(chatMessages.getById('message-answer-assistant')).toMatchObject({
        id: 'message-answer-assistant',
        agentRunId: 'run-answer',
        role: 'assistant',
        content: '今天是星期二。'
      })
      expect(planEvents.getPlanReadyEvents()).toEqual([])
      expect(planEvents.getResponseReadyEvents()).toEqual([
        {
          runId: 'run-answer',
          messageId: 'message-answer',
          response: {
            type: 'answer',
            summary: '用户提出了普通问题，应由通用 Agent 直接回答。',
            text: '今天是星期二。',
            dropped: []
          }
        }
      ])
    } finally {
      db.close()
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('fans canvas.planReady events out to live renderer windows', () => {
    const live = createWindow()
    const closed = createWindow(true)
    const events = createIpcCanvasPlanEventBus(() => [live, closed])
    const planReady = { messageId: 'message-1', planId: 'plan-1' }

    events.emitPlanReady(planReady)

    expect(live.webContents.send).toHaveBeenCalledWith('canvas.planReady', planReady)
    expect(closed.webContents.send).not.toHaveBeenCalled()
    expect(events.getPlanReadyEvents()).toEqual([planReady])
    expect(() => events.emitPlanReady(planReady)).toThrow('canvas_plan_ready_duplicate')
  })

  it('fans agent.responseReady events out to live renderer windows', () => {
    const live = createWindow()
    const closed = createWindow(true)
    const events = createIpcCanvasPlanEventBus(() => [live, closed])
    const responseReady = {
      runId: 'run-1',
      messageId: 'message-1',
      response: {
        type: 'answer' as const,
        summary: '普通问答',
        text: '今天是星期二。',
        dropped: []
      }
    }

    events.emitResponseReady(responseReady)

    expect(live.webContents.send).toHaveBeenCalledWith('agent.responseReady', responseReady)
    expect(closed.webContents.send).not.toHaveBeenCalled()
    expect(events.getResponseReadyEvents()).toEqual([responseReady])
    expect(() => events.emitResponseReady(responseReady)).toThrow('agent_response_ready_duplicate')
  })

  it('exposes a renderer-safe planReady subscription through preload', () => {
    const preload = readFileSync('desktop/src/preload/index.ts', 'utf8')

    expect(preload).toContain('onCanvasPlanReady')
    expect(preload).toContain("subscribeMain('canvas.planReady'")
    expect(preload).toContain('onAgentResponseReady')
    expect(preload).toContain("subscribeMain('agent.responseReady'")
  })
})
