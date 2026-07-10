/**
 * Startup recovery for abandoned processing jobs.
 * @see docs/api-contracts/jobs.md
 */

import type { AgentResponse } from '../../../../shared/agents'
import type { JobError, JobRecoveryReport, JobResult } from '../../../../shared/jobs'
import type { AgentRunRecord, AgentRunRepository } from '../db/repositories/agent-run.repo'
import type { PersistedJobRecord, JobRepository } from '../db/repositories/job.repo'
import type { AgentRunSpine } from '../agent/run-spine'

export interface JobRecoveryOptions {
  jobs: JobRepository
  agentRuns?: AgentRunRepository
  runSpine?: AgentRunSpine
  transaction?: <T>(operation: () => T) => T
  clock?: () => number
}

function isAgentResponse(value: unknown): value is AgentResponse {
  return typeof value === 'object'
    && value !== null
    && 'type' in value
    && (
      value.type === 'answer'
      || value.type === 'clarification'
      || value.type === 'canvasPlan'
    )
}

function completedAgentResult(run: AgentRunRecord): JobResult {
  const result: Extract<JobResult, { kind: 'agentRun' }> = {
    kind: 'agentRun',
    runId: run.id
  }
  if (typeof run.trace.planId === 'string') {
    result.planId = run.trace.planId
  }
  if (isAgentResponse(run.trace.response)) {
    result.response = run.trace.response
  }
  return result
}

function terminalAgentError(run: AgentRunRecord): JobError {
  const errorClass = run.errorClass
    ?? (typeof run.trace.errorClass === 'string' ? run.trace.errorClass : 'agent_run_failed')
  return {
    errorClass,
    message: errorClass === 'agent_tool_denied'
      ? 'Tool call was denied by the user.'
      : 'Agent run reached a terminal failure before its job state was persisted.',
    retryable: false
  }
}

function agentRunId(job: PersistedJobRecord): string | null {
  return typeof job.payload.runId === 'string' && job.payload.runId.length > 0
    ? job.payload.runId
    : null
}

function isApprovalJob(job: PersistedJobRecord): boolean {
  return job.payload.resumeKind === 'approval'
}

function canReplayInitialRun(run: AgentRunRecord): boolean {
  return run.status === 'pending'
    && (
      run.lastCheckpoint === undefined
      || run.lastCheckpoint === 'run.created'
      || run.lastCheckpoint === 'intent.analyzed'
    )
}

function canReplayApprovalRun(run: AgentRunRecord): boolean {
  return run.status === 'pending'
    && run.lastCheckpoint === 'permission.resolved'
    && run.pausedState !== undefined
}

/**
 * Reconciles abandoned jobs against durable Agent checkpoints before workers accept new work.
 * @param options - Repository and clock dependencies.
 * @returns Recovery report with inspected and requeued IDs.
 * @throws Error when recovery persistence fails.
 * @see docs/api-contracts/jobs.md
 */
export function recoverProcessingJobs(options: JobRecoveryOptions): JobRecoveryReport {
  const recoveredAt = (options.clock ?? Date.now)()
  const transaction = options.transaction ?? (<T>(operation: () => T) => operation())
  const requeued: string[] = []
  const failed: string[] = []
  let inspected = 0

  for (const job of options.jobs.listUnfinished()) {
    if (job.status === 'pending' && job.type !== 'agent.run') {
      continue
    }
    inspected += 1

    if (job.type !== 'agent.run') {
      if (job.type === 'canvas.polishText' && job.status === 'processing') {
        options.jobs.requeue(job.id, recoveredAt)
        requeued.push(job.id)
        continue
      }

      const error: JobError = {
        errorClass: 'job_interrupted_recovery',
        message: 'Job execution was interrupted and was not replayed to avoid duplicate side effects.',
        retryable: false
      }
      options.jobs.recoverFail(job.id, error, recoveredAt)
      failed.push(job.id)
      continue
    }

    const runId = agentRunId(job)
    const run = runId ? options.agentRuns?.getById(runId) : null
    if (!run) {
      options.jobs.recoverFail(job.id, {
        errorClass: 'agent_orphaned_job',
        message: 'Agent job has no matching durable run and cannot be resumed.',
        retryable: false
      }, recoveredAt)
      failed.push(job.id)
      continue
    }

    if (run.status === 'completed') {
      options.jobs.recoverComplete(job.id, completedAgentResult(run), recoveredAt)
      continue
    }

    if (
      run.status === 'failed'
      || run.status === 'aborted'
      || run.status === 'max_turns_exceeded'
    ) {
      options.jobs.recoverFail(job.id, terminalAgentError(run), recoveredAt)
      failed.push(job.id)
      continue
    }

    if (run.status === 'approval_required') {
      options.jobs.recoverFail(job.id, {
        errorClass: 'agent_tool_approval_required',
        message: 'Tool requires user approval before execution.',
        retryable: false
      }, recoveredAt)
      failed.push(job.id)
      continue
    }

    const replayable = isApprovalJob(job)
      ? canReplayApprovalRun(run)
      : canReplayInitialRun(run)
    if (replayable) {
      if (job.status === 'processing') {
        options.jobs.requeue(job.id, recoveredAt)
        requeued.push(job.id)
      }
      continue
    }

    const recoveryError: JobError = {
      errorClass: 'agent_interrupted_recovery',
      message: 'Agent execution was interrupted after work began and was not replayed.',
      retryable: false
    }
    transaction(() => {
      options.jobs.recoverFail(job.id, recoveryError, recoveredAt)
      const existingFailure = options.runSpine
        ?.getSnapshot(run.id)
        ?.events.some((event) => event.type === 'run.failed') ?? false

      if (options.runSpine) {
        options.runSpine.updateRun({
          runId: run.id,
          status: 'failed',
          pausedState: null,
          trace: {
            pendingApproval: null,
            recoveryCheckpoint: run.lastCheckpoint ?? null
          },
          errorClass: recoveryError.errorClass,
          lastCheckpoint: 'run.failed'
        })
        if (!existingFailure) {
          options.runSpine.appendEvent(run.id, 'run.failed', {
            errorClass: recoveryError.errorClass,
            message: recoveryError.message,
            retryable: false,
            checkpoint: run.lastCheckpoint ?? 'unknown'
          })
        }
      } else if (options.agentRuns) {
        options.agentRuns.upsert({
          ...run,
          status: 'failed',
          trace: {
            ...run.trace,
            pendingApproval: null,
            recoveryCheckpoint: run.lastCheckpoint ?? null
          },
          pausedState: null,
          errorClass: recoveryError.errorClass,
          lastCheckpoint: 'run.failed',
          updatedAt: recoveredAt
        })
      }
    })
    failed.push(job.id)
  }

  return {
    inspected,
    requeued,
    failed
  }
}
