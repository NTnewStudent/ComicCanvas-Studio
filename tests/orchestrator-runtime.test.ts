import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import type { CanvasPlan } from '../shared/plan'
import { migrateDatabaseAtPath, openDatabaseAtPath } from '../desktop/src/main/db/migrate'
import { createJobRepository } from '../desktop/src/main/db/repositories/job.repo'
import { createJobEventBus } from '../desktop/src/main/jobs/events'
import { createJobQueue } from '../desktop/src/main/jobs/queue'
import { createJobWorker } from '../desktop/src/main/jobs/worker'
import { createOrchestratorRuntime, runOrchestrator } from '../desktop/src/main/agent/orchestrator'

const samplePlan: CanvasPlan = {
  kind: 'plan',
  summary: 'Create one image node for a spaceship scene.',
  nodes: [
    {
      ref: 'image-1',
      type: 'image',
      title: '宇宙飞船',
      data: {
        promptOverride: '宇宙飞船穿过金色星云',
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

function createDeferredPlan(): { promise: Promise<CanvasPlan>; resolve: (plan: CanvasPlan) => void } {
  let resolvePlan: ((plan: CanvasPlan) => void) | undefined
  const promise = new Promise<CanvasPlan>((resolve) => {
    resolvePlan = resolve
  })

  return {
    promise,
    resolve(plan) {
      resolvePlan?.(plan)
    }
  }
}

describe('M4 orchestrator AsyncGenerator runtime', () => {
  it('runs as an AsyncGenerator and returns a CanvasPlan after streaming progress', async () => {
    const stream = runOrchestrator({
      runId: 'run-1',
      messageId: 'message-1',
      message: '生成宇宙飞船图片节点',
      agentId: 'orchestrator',
      planIdFactory: () => 'plan-1',
      planner: {
        async *proposePlan() {
          await Promise.resolve()
          yield { type: 'progress', message: 'Analyzing request', progress: 20 }
          yield { type: 'progress', message: 'Drafting CanvasPlan', progress: 80 }
          return samplePlan
        }
      }
    })
    const events: unknown[] = []
    let next = await stream.next()

    while (!next.done) {
      events.push(next.value)
      next = await stream.next()
    }

    expect(events).toEqual([
      { type: 'progress', runId: 'run-1', message: 'Starting orchestration', progress: 5 },
      { type: 'progress', runId: 'run-1', message: 'Analyzing request', progress: 20 },
      { type: 'progress', runId: 'run-1', message: 'Drafting CanvasPlan', progress: 80 },
      { type: 'plan', runId: 'run-1', messageId: 'message-1', planId: 'plan-1', plan: samplePlan }
    ])
    expect(next.value).toEqual({
      runId: 'run-1',
      messageId: 'message-1',
      planId: 'plan-1',
      plan: samplePlan
    })
  })

  it('returns a pending chat ticket before model work and stores the plan after the agent job completes', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-orchestrator-'))
    const dbPath = join(tempDir, 'orchestrator.sqlite')
    migrateDatabaseAtPath(dbPath)
    const db = openDatabaseAtPath(dbPath)

    try {
      const jobs = createJobRepository(db)
      const events = createJobEventBus()
      const queue = createJobQueue({
        jobs,
        idFactory: () => 'job-agent-1',
        clock: () => 1_782_700_000_000
      })
      const deferred = createDeferredPlan()
      let plannerStarted = false
      const runtime = createOrchestratorRuntime({
        queue,
        events,
        idFactory: (prefix) => `${prefix}-1`,
        planIdFactory: () => 'plan-async-1',
        planner: {
          async proposePlan() {
            plannerStarted = true
            return deferred.promise
          }
        }
      })
      const worker = createJobWorker({
        jobs,
        events,
        leaseOwner: 'agent-worker',
        clock: () => 1_782_700_000_010,
        handlers: {
          'agent.run': runtime.createJobHandler()
        }
      })

      const ticket = runtime.chatSend({ message: '生成宇宙飞船图片节点', agentId: 'orchestrator', requestedBy: 'user-1' })

      expect(ticket).toEqual({ jobId: 'job-agent-1', messageId: 'message-1', status: 'pending' })
      expect(plannerStarted).toBe(false)
      expect(runtime.getPlan('message-1')).toBeNull()

      const running = worker.runNext()
      await new Promise((resolve) => setTimeout(resolve, 0))
      expect(plannerStarted).toBe(true)

      deferred.resolve(samplePlan)
      expect(await running).toBe('job-agent-1')

      expect(runtime.getPlan('message-1')).toEqual(samplePlan)
      expect(jobs.getById('job-agent-1')?.result).toEqual({ kind: 'agentRun', runId: 'run-1', planId: 'plan-async-1' })
      expect(events.getTerminalEvents()).toEqual([
        {
          channel: 'job.completed',
          jobId: 'job-agent-1',
          result: { kind: 'agentRun', runId: 'run-1', planId: 'plan-async-1' },
          emittedAt: 1_782_700_000_010
        }
      ])
    } finally {
      db.close()
      rmSync(tempDir, { recursive: true, force: true })
    }
  })
})
