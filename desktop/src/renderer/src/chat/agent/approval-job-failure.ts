/**
 * Helpers for treating approval-required Agent job failures as paused runs.
 * @see docs/api-contracts/agents.md
 */

import type { IpcEventMap } from '../../../../../../shared/ipc'
import type { ToolPermission } from '../../../../../../shared/tools'
import type { AgentPermissionRequest } from './AgentPermissionModal'

type JobFailedError = IpcEventMap['job.failed']['error']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toolPermissions(value: unknown): ToolPermission[] | undefined {
  if (!Array.isArray(value)) {
    return undefined
  }

  const permissions = value.filter((entry): entry is ToolPermission => {
    return isRecord(entry) && typeof entry.kind === 'string' && typeof entry.reason === 'string'
  })
  return permissions.length > 0 ? permissions : undefined
}

/**
 * Detects the JobWorker terminal event used to pause an Agent run for approval.
 * @param error - Error payload from `job.failed`.
 * @returns True when the failed job is actually waiting for user approval.
 */
export function isApprovalRequiredJobFailure(error: JobFailedError): boolean {
  return error.errorClass === 'agent_tool_approval_required'
}

/**
 * Restores a renderer permission request from a job failure when the explicit
 * `agent.permissionRequired` event was missed or reordered.
 * @param runId - Current pending Agent run ID.
 * @param error - Error payload from `job.failed`.
 * @returns Permission request for the modal, or null when details are absent.
 */
export function approvalRequestFromJobFailure(runId: string | null, error: JobFailedError): AgentPermissionRequest | null {
  if (!runId || !isApprovalRequiredJobFailure(error) || !isRecord(error.details)) {
    return null
  }

  const pendingApproval = error.details.pendingApproval
  if (!isRecord(pendingApproval)) {
    return null
  }

  if (
    typeof pendingApproval.callId !== 'string'
    || typeof pendingApproval.toolId !== 'string'
  ) {
    return null
  }

  const requiredPermissions = toolPermissions(pendingApproval.requiredPermissions)

  return {
    runId,
    callId: pendingApproval.callId,
    toolId: pendingApproval.toolId,
    reason: typeof pendingApproval.reason === 'string'
      ? pendingApproval.reason
      : error.message,
    ...(requiredPermissions ? { requiredPermissions } : {})
  }
}
