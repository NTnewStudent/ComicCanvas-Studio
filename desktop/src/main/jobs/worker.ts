/**
 * Minimal durable worker loop for M1 local job execution.
 * @see docs/api-contracts/jobs.md
 */

import type { JobError, JobResult, JobType } from '../../../../shared/jobs'
import type { PersistedJobRecord, JobRepository } from '../db/repositories/job.repo'
import type { JobEventBus } from './events'

export type JobHandler = (job: PersistedJobRecord) => Promise<JobResult> | JobResult

export type JobHandlerMap = Partial<Record<JobType, JobHandler>>

export interface JobWorkerOptions {
  jobs: JobRepository
  events: JobEventBus
  handlers: JobHandlerMap
  leaseOwner: string
  clock?: () => number
  onCompletedAsset?: (job: PersistedJobRecord, assetId: string, emittedAt: number) => void
}

function completedAssetId(result: JobResult): string | null {
  if (result.kind === 'asset') return result.assetId
  if (result.kind === 'report' && typeof result.data?.assetId === 'string') return result.data.assetId
  return null
}

export interface JobWorker {
  runNext(): Promise<string | null>
}

function isStructuredJobError(error: unknown): error is { errorClass: string; message: string; retryable: boolean; details?: Record<string, unknown> } {
  return typeof error === 'object'
    && error !== null
    && 'errorClass' in error
    && typeof (error as { errorClass?: unknown }).errorClass === 'string'
    && 'message' in error
    && typeof (error as { message?: unknown }).message === 'string'
    && 'retryable' in error
    && typeof (error as { retryable?: unknown }).retryable === 'boolean'
}

function normalizeJobError(error: unknown): JobError {
  if (isStructuredJobError(error)) {
    return {
      errorClass: error.errorClass,
      message: error.message,
      retryable: error.retryable,
      ...(error.details ? { details: error.details } : {})
    }
  }

  const message = error instanceof Error ? error.message : 'Job handler failed'
  return { errorClass: 'job_worker_error', message, retryable: false }
}

/**
 * Creates a single-lease worker that processes one pending job at a time.
 * @param options - Repository, event bus, handler, lease, and clock dependencies.
 * @returns Job worker API.
 * @throws Error when repository transition persistence fails.
 * @see docs/api-contracts/jobs.md
 */
export function createJobWorker(options: JobWorkerOptions): JobWorker {
  const clock = options.clock ?? Date.now

  return {
    async runNext() {
      const claimedAt = clock()
      const job = options.jobs.claimNextPending({ leaseOwner: options.leaseOwner, claimedAt })

      if (!job) {
        return null
      }

      const emittedAt = clock()
      const handler = options.handlers[job.type]

      try {
        if (!handler) {
          throw new Error(`No handler registered for job type ${job.type}`)
        }

        const result = await handler(job)
        options.jobs.complete(job.id, result, emittedAt)
        const assetId = completedAssetId(result)
        if (assetId) {
          options.onCompletedAsset?.(job, assetId, emittedAt)
        }
        options.events.emitTerminal({ channel: 'job.completed', jobId: job.id, result, emittedAt })
      } catch (error: unknown) {
        // Worker handlers are untrusted provider/tool boundaries, so failures become persisted job errors.
        const jobError = normalizeJobError(error)
        options.jobs.fail(job.id, jobError, emittedAt)
        options.events.emitTerminal({ channel: 'job.failed', jobId: job.id, error: jobError, emittedAt })
      }

      return job.id
    }
  }
}
