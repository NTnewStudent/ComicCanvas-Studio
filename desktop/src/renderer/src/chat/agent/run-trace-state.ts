/**
 * Extracts durable Agent run state from `agent.getRun` traces for UI recovery.
 * @see docs/api-contracts/agents.md
 */

import type { AgentResponse } from '../../../../../../shared/agents'

export interface TraceApprovalRequest {
  callId: string
  toolId: string
  reason: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Reads a persisted non-canvas Agent response from a run trace.
 * @param trace - Trace returned from `agent.getRun`.
 * @returns Answer or clarification response, or null when no terminal response is present.
 */
export function agentResponseFromTrace(trace: Record<string, unknown> | null | undefined): AgentResponse | null {
  if (!trace || !isRecord(trace.response)) {
    return null
  }

  const response = trace.response
  if (response.type === 'answer' && typeof response.text === 'string') {
    return response as unknown as AgentResponse
  }

  if (response.type === 'clarification' && typeof response.question === 'string') {
    return response as unknown as AgentResponse
  }

  return null
}

/**
 * Reads a pending approval request from a run trace.
 * @param trace - Trace returned from `agent.getRun`.
 * @returns Approval metadata, or null when the run is not approval-blocked.
 */
export function approvalRequestFromTrace(trace: Record<string, unknown> | null | undefined): TraceApprovalRequest | null {
  if (!trace || !isRecord(trace.pendingApproval)) {
    return null
  }

  const approval = trace.pendingApproval
  if (
    typeof approval.callId !== 'string'
    || typeof approval.toolId !== 'string'
    || typeof approval.reason !== 'string'
  ) {
    return null
  }

  return {
    callId: approval.callId,
    toolId: approval.toolId,
    reason: approval.reason
  }
}

/**
 * Reads a stable error class from a run trace.
 * @param trace - Trace returned from `agent.getRun`.
 * @returns Error class, or null when the trace has no failure.
 */
export function errorClassFromTrace(trace: Record<string, unknown> | null | undefined): string | null {
  return trace && typeof trace.errorClass === 'string' ? trace.errorClass : null
}
