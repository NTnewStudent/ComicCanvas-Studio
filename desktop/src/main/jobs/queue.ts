/**
 * Durable queue entrypoint for slow local jobs.
 * @see docs/api-contracts/jobs.md
 */

import { randomUUID } from 'node:crypto'

import type { JobCreateInput, JobTicket } from '../../../../shared/jobs'
import type { JobRepository } from '../db/repositories/job.repo'

export interface JobQueueOptions {
  jobs: JobRepository
  idFactory?: () => string
  clock?: () => number
}

export interface JobQueue {
  enqueue(input: JobCreateInput): JobTicket
}

/**
 * Creates a queue facade that persists jobs before returning tickets.
 * @param options - Repository, ID, and clock dependencies.
 * @returns Job queue API.
 * @throws Error when persistence fails or a duplicate job ID is generated.
 * @see docs/api-contracts/jobs.md
 */
export function createJobQueue(options: JobQueueOptions): JobQueue {
  const idFactory = options.idFactory ?? randomUUID
  const clock = options.clock ?? Date.now

  return {
    enqueue(input) {
      const createdAt = clock()
      const jobId = idFactory()
      const record = {
        id: jobId,
        type: input.type,
        status: 'pending' as const,
        payload: input.payload,
        progress: 0,
        attempts: 0,
        retryable: false,
        createdAt,
        updatedAt: createdAt
      }

      options.jobs.create({
        ...record,
        ...(input.targetId ? { targetId: input.targetId } : {})
      })

      return { jobId, status: 'pending', createdAt }
    }
  }
}
