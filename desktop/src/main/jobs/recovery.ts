/**
 * Startup recovery for abandoned processing jobs.
 * @see docs/api-contracts/jobs.md
 */

import type { JobRecoveryReport } from '../../../../shared/jobs'
import type { JobRepository } from '../db/repositories/job.repo'

export interface JobRecoveryOptions {
  jobs: JobRepository
  clock?: () => number
}

/**
 * Requeues abandoned processing jobs before workers accept new work.
 * @param options - Repository and clock dependencies.
 * @returns Recovery report with inspected and requeued IDs.
 * @throws Error when recovery persistence fails.
 * @see docs/api-contracts/jobs.md
 */
export function recoverProcessingJobs(options: JobRecoveryOptions): JobRecoveryReport {
  const requeued = options.jobs.requeueProcessing((options.clock ?? Date.now)())

  return {
    inspected: requeued.length,
    requeued,
    failed: []
  }
}
