import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import type { JobCreateInput } from '../shared/jobs'
import { migrateDatabaseAtPath, openDatabaseAtPath } from '../desktop/src/main/db/migrate'
import { createJobRepository, type JobRepository } from '../desktop/src/main/db/repositories/job.repo'
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
            throw {
              errorClass: 'agent_max_turns_exceeded',
              message: 'Agent loop exceeded max turns.',
              retryable: false,
              details: { turnsUsed: 3 }
            }
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

  it('requeues abandoned processing jobs during startup recovery', () =>
    withRuntimeFixture(({ jobs }) => {
      jobs.create({
        id: 'job-stale-1',
        type: 'canvas.generateImage',
        status: 'processing',
        payload: { prompt: 'abandoned' },
        progress: 25,
        attempts: 1,
        retryable: true,
        createdAt: 1_782_400_000_005,
        updatedAt: 1_782_400_000_005
      })

      const report = recoverProcessingJobs({ jobs, clock: () => 1_782_400_000_006 })

      expect(report).toEqual({ inspected: 1, requeued: ['job-stale-1'], failed: [] })
      expect(jobs.getById('job-stale-1')?.status).toBe('pending')
      expect(jobs.getById('job-stale-1')?.progress).toBe(0)
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
