import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import type { JobCreateInput } from '../shared/jobs'
import { createAgentRunSpine } from '../desktop/src/main/agent/run-spine'
import { migrateDatabaseAtPath, openDatabaseAtPath } from '../desktop/src/main/db/migrate'
import { createAgentArtifactRepository } from '../desktop/src/main/db/repositories/agent-artifact.repo'
import { createAgentPermissionGrantRepository } from '../desktop/src/main/db/repositories/agent-permission-grant.repo'
import { createAgentRunEventRepository } from '../desktop/src/main/db/repositories/agent-run-event.repo'
import { createAgentRunRepository } from '../desktop/src/main/db/repositories/agent-run.repo'
import { createChildAgentTaskRepository } from '../desktop/src/main/db/repositories/child-agent-task.repo'
import { createJobRepository, type JobRepository } from '../desktop/src/main/db/repositories/job.repo'
import { registerJobHandlers } from '../desktop/src/main/ipc/job.handler'
import { createJobEventBus } from '../desktop/src/main/jobs/events'
import { createJobQueue } from '../desktop/src/main/jobs/queue'
import { recoverProcessingJobs } from '../desktop/src/main/jobs/recovery'
import { createJobWorker } from '../desktop/src/main/jobs/worker'

interface RuntimeFixture {
  db: ReturnType<typeof openDatabaseAtPath>
  jobs: JobRepository
}

async function withRuntimeFixture<T>(run: (fixture: RuntimeFixture) => Promise<T> | T): Promise<T> {
  const tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-jobs-'))
  const dbPath = join(tempDir, 'jobs.sqlite')
  migrateDatabaseAtPath(dbPath)
  const db = openDatabaseAtPath(dbPath)

  try {
    return await run({ db, jobs: createJobRepository(db) })
  } finally {
    db.close()
    rmSync(tempDir, { recursive: true, force: true })
  }
}

function createImageJobInput(): JobCreateInput {
  return {
    type: 'canvas.generateImage',
    targetId: 'image-node-1',
    payload: { prompt: 'red spaceship' },
    requestedBy: { type: 'user', id: 'user-1' }
  }
}

describe('M1 JobRuntime skeleton', () => {
  it('enqueues a durable pending job and returns only a ticket', () =>
    withRuntimeFixture(({ jobs }) => {
      const queue = createJobQueue({
        jobs,
        idFactory: () => 'job-enqueue-1',
        clock: () => 1_782_400_000_000
      })

      const ticket = queue.enqueue(createImageJobInput())
      const stored = jobs.getById(ticket.jobId)

      expect(Object.keys(ticket).sort()).toEqual(['createdAt', 'jobId', 'status'])
      expect(ticket).toEqual({ jobId: 'job-enqueue-1', status: 'pending', createdAt: 1_782_400_000_000 })
      expect(stored?.status).toBe('pending')
      expect(stored?.type).toBe('canvas.generateImage')
      expect(stored?.targetId).toBe('image-node-1')
      expect(stored?.payload).toEqual({ prompt: 'red spaceship' })
      expect(stored?.progress).toBe(0)
    }))

  it('moves a pending job through processing to completed and emits one completed event', async () =>
    withRuntimeFixture(async ({ jobs }) => {
      const events = createJobEventBus()
      const completedReferences: Array<{ jobId: string; assetId: string }> = []
      const queue = createJobQueue({
        jobs,
        idFactory: () => 'job-complete-1',
        clock: () => 1_782_400_000_001
      })
      queue.enqueue(createImageJobInput())

      const worker = createJobWorker({
        jobs,
        events,
        leaseOwner: 'worker-1',
        clock: () => 1_782_400_000_002,
        handlers: {
          'canvas.generateImage': (job) => {
            expect(jobs.getById(job.id)?.status).toBe('processing')
            return { kind: 'asset', assetId: 'asset-1', metadata: { orientation: 'landscape' } }
          }
        },
        onCompletedAsset: (job, assetId) => {
          completedReferences.push({ jobId: job.id, assetId })
        }
      })

      expect(await worker.runNext()).toBe('job-complete-1')
      expect(jobs.getById('job-complete-1')?.status).toBe('completed')
      expect(jobs.getById('job-complete-1')?.result).toEqual({
        kind: 'asset',
        assetId: 'asset-1',
        metadata: { orientation: 'landscape' }
      })
      expect(events.getTerminalEvents()).toEqual([
        {
          channel: 'job.completed',
          jobId: 'job-complete-1',
          result: { kind: 'asset', assetId: 'asset-1', metadata: { orientation: 'landscape' } },
          emittedAt: 1_782_400_000_002
        }
      ])
      expect(completedReferences).toEqual([{ jobId: 'job-complete-1', assetId: 'asset-1' }])

      expect(await worker.runNext()).toBeNull()
      expect(events.getTerminalEvents()).toHaveLength(1)
    }))

  it('emits completed asset hooks for report results with asset metadata', async () =>
    withRuntimeFixture(async ({ jobs }) => {
      const events = createJobEventBus()
      const completedReferences: Array<{ jobId: string; assetId: string }> = []
      const queue = createJobQueue({
        jobs,
        idFactory: () => 'job-report-asset-1',
        clock: () => 1_782_400_000_003
      })
      queue.enqueue(createImageJobInput())

      const worker = createJobWorker({
        jobs,
        events,
        leaseOwner: 'worker-report',
        clock: () => 1_782_400_000_004,
        handlers: {
          'canvas.generateImage': () => ({
            kind: 'report',
            summary: 'asset in report',
            data: { assetId: 'asset-report-1', url: 'cc-asset://asset/asset-report-1' }
          })
        },
        onCompletedAsset: (job, assetId) => {
          completedReferences.push({ jobId: job.id, assetId })
        }
      })

      expect(await worker.runNext()).toBe('job-report-asset-1')
      expect(completedReferences).toEqual([{ jobId: 'job-report-asset-1', assetId: 'asset-report-1' }])
    }))

  it('moves a pending job through processing to failed and emits one failed event', async () =>
    withRuntimeFixture(async ({ jobs }) => {
      const events = createJobEventBus()
      const queue = createJobQueue({
        jobs,
        idFactory: () => 'job-fail-1',
        clock: () => 1_782_400_000_003
      })
      queue.enqueue(createImageJobInput())

      const worker = createJobWorker({
        jobs,
        events,
        leaseOwner: 'worker-1',
        clock: () => 1_782_400_000_004,
        handlers: {
          'canvas.generateImage': () => {
            // Simulates the provider boundary throwing during worker-owned execution.
            throw new Error('provider failed')
          }
        }
      })

      expect(await worker.runNext()).toBe('job-fail-1')
      expect(jobs.getById('job-fail-1')?.status).toBe('failed')
      expect(jobs.getById('job-fail-1')?.error).toEqual({
        errorClass: 'job_worker_error',
        message: 'provider failed',
        retryable: false
      })
      expect(events.getTerminalEvents()).toEqual([
        {
          channel: 'job.failed',
          jobId: 'job-fail-1',
          error: { errorClass: 'job_worker_error', message: 'provider failed', retryable: false },
          emittedAt: 1_782_400_000_004
        }
      ])

      expect(await worker.runNext()).toBeNull()
      expect(events.getTerminalEvents()).toHaveLength(1)
    }))

  it('preserves structured handler error classes for agent/runtime failures', async () =>
    withRuntimeFixture(async ({ jobs }) => {
      const events = createJobEventBus()
      const queue = createJobQueue({
        jobs,
        idFactory: () => 'job-agent-structured-error',
        clock: () => 1_782_400_000_014
      })
      queue.enqueue({
        type: 'agent.run',
        targetId: 'message-structured-error',
        payload: { message: 'never finish' },
        requestedBy: { type: 'user', id: 'user-1' }
      })

      const worker = createJobWorker({
        jobs,
        events,
        leaseOwner: 'worker-agent-structured-error',
        clock: () => 1_782_400_000_015,
        handlers: {
          'agent.run': () => {
            throw Object.assign(new Error('Agent loop exceeded max turns.'), {
              errorClass: 'agent_max_turns_exceeded',
              retryable: false,
              details: { turnsUsed: 3 }
            })
          }
        }
      })

      expect(await worker.runNext()).toBe('job-agent-structured-error')
      expect(jobs.getById('job-agent-structured-error')?.error).toEqual({
        errorClass: 'agent_max_turns_exceeded',
        message: 'Agent loop exceeded max turns.',
        retryable: false
      })
      expect(events.getTerminalEvents()).toEqual([
        {
          channel: 'job.failed',
          jobId: 'job-agent-structured-error',
          error: {
            errorClass: 'agent_max_turns_exceeded',
            message: 'Agent loop exceeded max turns.',
            retryable: false,
            details: { turnsUsed: 3 }
          },
          emittedAt: 1_782_400_000_015
        }
      ])
    }))

  it('requeues only side-effect-free processing jobs during startup recovery', () =>
    withRuntimeFixture(({ jobs }) => {
      jobs.create({
        id: 'job-stale-polish',
        type: 'canvas.polishText',
        status: 'processing',
        payload: { content: 'abandoned' },
        progress: 25,
        attempts: 1,
        retryable: true,
        createdAt: 1_782_400_000_005,
        updatedAt: 1_782_400_000_005
      })
      jobs.create({
        id: 'job-stale-image',
        type: 'canvas.generateImage',
        status: 'processing',
        payload: { prompt: 'may already have reached a provider' },
        progress: 25,
        attempts: 1,
        retryable: true,
        createdAt: 1_782_400_000_006,
        updatedAt: 1_782_400_000_006
      })

      const report = recoverProcessingJobs({ jobs, clock: () => 1_782_400_000_007 })

      expect(report).toEqual({
        inspected: 2,
        requeued: ['job-stale-polish'],
        failed: ['job-stale-image']
      })
      expect(jobs.getById('job-stale-polish')?.status).toBe('pending')
      expect(jobs.getById('job-stale-polish')?.progress).toBe(0)
      expect(jobs.getById('job-stale-image')).toMatchObject({
        status: 'failed',
        error: {
          errorClass: 'job_interrupted_recovery',
          retryable: false
        }
      })
    }))

  it('recovers agent jobs from durable run checkpoints without replaying started work', () =>
    withRuntimeFixture(({ db, jobs }) => {
      const agentRuns = createAgentRunRepository(db)
      let spineId = 0
      const runSpine = createAgentRunSpine({
        runs: agentRuns,
        events: createAgentRunEventRepository(db),
        artifacts: createAgentArtifactRepository(db),
        grants: createAgentPermissionGrantRepository(db),
        childTasks: createChildAgentTaskRepository(db),
        transaction: (operation) => db.transaction(operation)(),
        idFactory: (prefix) => `${prefix}-recovery-${++spineId}`,
        clock: (() => {
          let now = 1_782_400_100_000
          return () => now++
        })()
      })

      function createRun(runId: string, jobId: string): void {
        runSpine.createRun({
          runId,
          threadId: 'default',
          workflowId: 'default',
          messageId: `message-${runId}`,
          jobId,
          agentId: 'general-purpose',
          trigger: 'manual',
          policyProfileId: 'local-default'
        })
      }

      function createAgentJob(input: {
        id: string
        runId: string
        status: 'pending' | 'processing'
        approval?: boolean
        createdAt: number
      }): void {
        jobs.create({
          id: input.id,
          type: 'agent.run',
          status: input.status,
          targetId: `message-${input.runId}`,
          payload: {
            runId: input.runId,
            messageId: `message-${input.runId}`,
            message: 'recover me',
            agentId: 'general-purpose',
            trigger: 'manual',
            ...(input.approval ? { resumeKind: 'approval' } : {})
          },
          progress: input.status === 'processing' ? 25 : 0,
          attempts: input.status === 'processing' ? 1 : 0,
          retryable: false,
          createdAt: input.createdAt,
          updatedAt: input.createdAt
        })
      }

      createAgentJob({ id: 'job-agent-created', runId: 'run-agent-created', status: 'processing', createdAt: 1_782_400_100_001 })
      createRun('run-agent-created', 'job-agent-created')

      createAgentJob({ id: 'job-agent-started', runId: 'run-agent-started', status: 'processing', createdAt: 1_782_400_100_002 })
      createRun('run-agent-started', 'job-agent-started')
      runSpine.updateRun({
        runId: 'run-agent-started',
        status: 'running',
        lastCheckpoint: 'context.built'
      })
      runSpine.appendEvent('run-agent-started', 'run.started', {
        status: 'running',
        jobId: 'job-agent-started'
      })

      createAgentJob({ id: 'job-agent-orphan', runId: 'run-agent-orphan', status: 'pending', createdAt: 1_782_400_100_003 })

      createAgentJob({ id: 'job-agent-terminal', runId: 'run-agent-terminal', status: 'processing', createdAt: 1_782_400_100_004 })
      createRun('run-agent-terminal', 'job-agent-terminal')
      runSpine.updateRun({
        runId: 'run-agent-terminal',
        status: 'completed',
        trace: { planId: 'plan-agent-terminal' },
        lastCheckpoint: 'run.completed'
      })
      runSpine.appendEvent('run-agent-terminal', 'run.completed', { status: 'completed' })

      createAgentJob({
        id: 'job-approval-queued',
        runId: 'run-approval-queued',
        status: 'processing',
        approval: true,
        createdAt: 1_782_400_100_005
      })
      createRun('run-approval-queued', 'job-approval-queued')
      runSpine.updateRun({
        runId: 'run-approval-queued',
        status: 'pending',
        pausedState: { transition: 'approval_required' },
        trace: { pendingApproval: { callId: 'call-queued', toolId: 'canvas.createNode' } },
        lastCheckpoint: 'permission.resolved'
      })

      createAgentJob({
        id: 'job-approval-started',
        runId: 'run-approval-started',
        status: 'processing',
        approval: true,
        createdAt: 1_782_400_100_006
      })
      createRun('run-approval-started', 'job-approval-started')
      runSpine.updateRun({
        runId: 'run-approval-started',
        status: 'running',
        pausedState: { transition: 'approval_required' },
        trace: { pendingApproval: { callId: 'call-started', toolId: 'canvas.createNode' } },
        lastCheckpoint: 'approval.execution_started'
      })

      const report = recoverProcessingJobs({
        jobs,
        agentRuns,
        runSpine,
        transaction: (operation) => db.transaction(operation)(),
        clock: () => 1_782_400_100_100
      })

      expect(report.inspected).toBe(6)
      expect(report.requeued).toEqual(expect.arrayContaining([
        'job-agent-created',
        'job-approval-queued'
      ]))
      expect(report.requeued).toHaveLength(2)
      expect(report.failed).toEqual(expect.arrayContaining([
        'job-agent-started',
        'job-agent-orphan',
        'job-approval-started'
      ]))
      expect(report.failed).toHaveLength(3)

      expect(jobs.getById('job-agent-created')?.status).toBe('pending')
      expect(jobs.getById('job-approval-queued')?.status).toBe('pending')
      expect(agentRuns.getById('run-approval-queued')).toMatchObject({
        status: 'pending',
        lastCheckpoint: 'permission.resolved',
        pausedState: { transition: 'approval_required' }
      })

      expect(jobs.getById('job-agent-started')).toMatchObject({
        status: 'failed',
        error: { errorClass: 'agent_interrupted_recovery', retryable: false }
      })
      expect(runSpine.getSnapshot('run-agent-started')?.run).toMatchObject({
        status: 'failed',
        errorClass: 'agent_interrupted_recovery',
        lastCheckpoint: 'run.failed'
      })
      expect(runSpine.getSnapshot('run-agent-started')?.events.filter((event) => event.type === 'run.failed')).toHaveLength(1)

      expect(jobs.getById('job-agent-orphan')).toMatchObject({
        status: 'failed',
        error: { errorClass: 'agent_orphaned_job', retryable: false }
      })
      expect(jobs.getById('job-agent-terminal')).toMatchObject({
        status: 'completed',
        result: {
          kind: 'agentRun',
          runId: 'run-agent-terminal',
          planId: 'plan-agent-terminal'
        }
      })

      expect(jobs.getById('job-approval-started')).toMatchObject({
        status: 'failed',
        error: { errorClass: 'agent_interrupted_recovery', retryable: false }
      })
      expect(runSpine.getSnapshot('run-approval-started')?.run).toMatchObject({
        status: 'failed',
        errorClass: 'agent_interrupted_recovery',
        lastCheckpoint: 'run.failed'
      })
      expect(runSpine.getSnapshot('run-approval-started')?.run.pausedState).toBeUndefined()
    }))

  it('uses the durable Agent Run Spine when job.recover is invoked through IPC', () =>
    withRuntimeFixture(({ db, jobs }) => {
      const agentRuns = createAgentRunRepository(db)
      const runSpine = createAgentRunSpine({
        runs: agentRuns,
        events: createAgentRunEventRepository(db),
        artifacts: createAgentArtifactRepository(db),
        grants: createAgentPermissionGrantRepository(db),
        childTasks: createChildAgentTaskRepository(db),
        transaction: (operation) => db.transaction(operation)(),
        idFactory: (prefix) => `${prefix}-ipc-recovery`,
        clock: () => 1_782_400_200_000
      })
      runSpine.createRun({
        runId: 'run-ipc-recovery',
        threadId: 'default',
        workflowId: 'default',
        messageId: 'message-ipc-recovery',
        jobId: 'job-ipc-recovery',
        agentId: 'general-purpose',
        trigger: 'manual',
        policyProfileId: 'local-default'
      })
      jobs.create({
        id: 'job-ipc-recovery',
        type: 'agent.run',
        status: 'processing',
        targetId: 'message-ipc-recovery',
        payload: {
          runId: 'run-ipc-recovery',
          messageId: 'message-ipc-recovery',
          message: 'recover through IPC',
          agentId: 'general-purpose',
          trigger: 'manual'
        },
        progress: 25,
        attempts: 1,
        retryable: false,
        createdAt: 1_782_400_200_000,
        updatedAt: 1_782_400_200_000
      })

      const handlers = new Map<string, (_event: unknown, request: unknown) => unknown>()
      registerJobHandlers({
        handle(channel, handler) {
          handlers.set(channel, handler)
        }
      }, {
        jobs,
        agentRuns,
        runSpine,
        transaction: (operation) => db.transaction(operation)(),
        clock: () => 1_782_400_200_001
      })

      expect(handlers.get('job.recover')?.({}, {})).toEqual({
        inspected: 1,
        requeued: ['job-ipc-recovery'],
        failed: []
      })
      expect(jobs.getById('job-ipc-recovery')?.status).toBe('pending')
    }))

  it('lists durable jobs by status, type, target, and bounded newest-first limit', () =>
    withRuntimeFixture(({ jobs }) => {
      jobs.create({
        id: 'job-list-old',
        type: 'canvas.generateImage',
        status: 'pending',
        targetId: 'image-node-1',
        payload: { prompt: 'old' },
        progress: 0,
        attempts: 0,
        retryable: false,
        createdAt: 1_782_400_000_010,
        updatedAt: 1_782_400_000_010
      })
      jobs.create({
        id: 'job-list-video',
        type: 'canvas.generateVideo',
        status: 'pending',
        targetId: 'video-node-1',
        payload: { prompt: 'video' },
        progress: 0,
        attempts: 0,
        retryable: false,
        createdAt: 1_782_400_000_011,
        updatedAt: 1_782_400_000_011
      })
      jobs.create({
        id: 'job-list-done',
        type: 'canvas.generateImage',
        status: 'completed',
        targetId: 'image-node-1',
        payload: { prompt: 'done' },
        progress: 100,
        attempts: 1,
        retryable: false,
        createdAt: 1_782_400_000_012,
        updatedAt: 1_782_400_000_012
      })
      jobs.create({
        id: 'job-list-new',
        type: 'canvas.generateImage',
        status: 'pending',
        targetId: 'image-node-1',
        payload: { prompt: 'new' },
        progress: 0,
        attempts: 0,
        retryable: false,
        createdAt: 1_782_400_000_013,
        updatedAt: 1_782_400_000_013
      })

      expect(jobs.list({ status: 'pending' }).map((job) => job.id)).toEqual([
        'job-list-new',
        'job-list-video',
        'job-list-old'
      ])
      expect(jobs.list({ type: 'canvas.generateImage', targetId: 'image-node-1' }).map((job) => job.id)).toEqual([
        'job-list-new',
        'job-list-done',
        'job-list-old'
      ])
      expect(jobs.list({ status: 'pending', type: 'canvas.generateImage', targetId: 'image-node-1', limit: 1 }).map((job) => job.id)).toEqual([
        'job-list-new'
      ])
      expect(jobs.list({ limit: 0 })).toHaveLength(0)
    }))
})
