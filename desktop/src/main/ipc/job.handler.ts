/**
 * Job IPC handler skeleton.
 * @see docs/api-contracts/jobs.md
 */

import type { JobRecord, JobRecoveryReport, JobTicket } from '../../../../shared/jobs'
import type { AgentRunSpine } from '../agent/run-spine'
import type { AgentRunRepository } from '../db/repositories/agent-run.repo'
import type { JobQueue } from '../jobs/queue'
import type { JobRepository } from '../db/repositories/job.repo'
import { recoverProcessingJobs } from '../jobs/recovery'
import type { IpcRegistrar } from './types'

export interface JobHandlerDependencies {
  jobs?: JobRepository
  queue?: JobQueue
  agentRuns?: AgentRunRepository
  runSpine?: AgentRunSpine
  transaction?: <T>(operation: () => T) => T
  clock?: () => number
}

function createPendingTicket(jobId: string): JobTicket {
  return {
    jobId,
    status: 'pending',
    createdAt: 1
  }
}

/**
 * Registers job invoke handlers.
 * @param ipcMain - Electron-compatible IPC registrar.
 * @returns void.
 * @throws Error when the registrar rejects handler registration.
 * @see docs/api-contracts/jobs.md
 */
export function registerJobHandlers(ipcMain: IpcRegistrar, dependencies: JobHandlerDependencies = {}): void {
  const clock = dependencies.clock ?? Date.now

  ipcMain.handle('job.enqueue', (_event, request) => {
    if (dependencies.queue && typeof request === 'object' && request !== null) {
      return dependencies.queue.enqueue(request as Parameters<JobQueue['enqueue']>[0])
    }

    const targetId = typeof request === 'object' && request !== null && 'targetId' in request ? String(request.targetId) : 'job'

    return createPendingTicket(`job-${targetId}`)
  })
  ipcMain.handle('job.get', (_event, request): JobRecord => {
    const jobId = typeof request === 'object' && request !== null && 'jobId' in request ? String(request.jobId) : 'job-unknown'

    if (dependencies.jobs) {
      const job = dependencies.jobs.getById(jobId)

      if (!job) {
        throw new Error('job_not_found')
      }

      return job
    }

    return {
      id: jobId,
      type: 'canvas.generateImage',
      status: 'pending',
      progress: 0,
      createdAt: 1,
      updatedAt: 1
    }
  })
  ipcMain.handle('job.list', (_event, request) => {
    if (dependencies.jobs) {
      return dependencies.jobs.list(typeof request === 'object' && request !== null ? request : {})
    }

    return []
  })
  ipcMain.handle('job.recover', (): JobRecoveryReport => {
    if (dependencies.jobs) {
      return recoverProcessingJobs({
        jobs: dependencies.jobs,
        ...(dependencies.agentRuns ? { agentRuns: dependencies.agentRuns } : {}),
        ...(dependencies.runSpine ? { runSpine: dependencies.runSpine } : {}),
        ...(dependencies.transaction ? { transaction: dependencies.transaction } : {}),
        clock
      })
    }

    // Recovery inspects stale pending/processing jobs and requeues or marks them failed.
    // The skeleton runtime has no persistent stale detection; return an empty report.
    return { inspected: 0, requeued: [], failed: [] }
  })
}
