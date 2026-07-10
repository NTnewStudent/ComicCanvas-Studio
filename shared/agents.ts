/**
 * Agent runtime, registry, and sub-agent contracts.
 * @see docs/api-contracts/agents.md
 */

import type { ToolPermissionKind } from './tools'
import type { CanvasPlan } from './plan'
import type { AgentRunProjection, AgentRunSnapshot, PermissionGrantScope } from './agent-run-events'

export type AgentSource = 'builtin' | 'user'

export type AgentEffort = 'low' | 'medium' | 'high'

export type AgentRunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'aborted' | 'max_turns_exceeded' | 'approval_required'

export interface AgentGatewayPolicy {
  gatewayId?: string
  modelId?: string
  allowedChannels: Array<'text' | 'image' | 'video'>
}

export interface AgentContextPolicy {
  includeCanvasGraph: boolean
  includeSelectedAssets: boolean
  includeRecentMessages: boolean
  includeKnowledge: boolean
  maxContextTokens: number
}

export interface AgentPermissionPolicy {
  allowedPermissionKinds: ToolPermissionKind[]
  requireAskForDestructive: boolean
}

export type AgentTriggerKind = 'manual' | 'mention' | 'canvasChat' | 'workflowEvent'

export interface AgentTriggerPolicy {
  allowedTriggers: AgentTriggerKind[]
  defaultTrigger: AgentTriggerKind
  autoRun: boolean
}

export interface AgentDefinition {
  id: string
  source: AgentSource
  name: string
  description: string
  instructions: string
  allowedTools: string[] | '*'
  allowedSkills: string[] | '*'
  gatewayPolicy: AgentGatewayPolicy
  contextPolicy: AgentContextPolicy
  permissionPolicy: AgentPermissionPolicy
  triggerPolicy: AgentTriggerPolicy
  maxTurns: number
  effort: AgentEffort
  enabled: boolean
}

export interface AgentRunRequest {
  agentId: string
  message: string
  contextPolicyOverride?: Partial<AgentContextPolicy>
}

export interface AgentRunTicket {
  runId: string
  jobId: string
  status: 'pending'
}

export interface AgentAnswerResponse {
  type: 'answer'
  summary: string
  text: string
  dropped: string[]
}

export interface AgentClarificationResponse {
  type: 'clarification'
  summary: string
  question: string
  missing: string[]
  dropped: string[]
}

export interface AgentCanvasPlanResponse {
  type: 'canvasPlan'
  plan: CanvasPlan
}

export type AgentResponse = AgentAnswerResponse | AgentClarificationResponse | AgentCanvasPlanResponse
export type AgentNonCanvasResponse = AgentAnswerResponse | AgentClarificationResponse

export interface AgentToolApprovalInput {
  runId: string
  callId: string
  approvedBy: string
  scope?: PermissionGrantScope
}

export interface AgentToolDenialInput {
  runId: string
  callId: string
  deniedBy: string
}

export interface AgentToolDenialResult {
  runId: string
  status: 'aborted'
  errorClass: 'agent_tool_denied'
}

export interface AgentToolDenialError {
  errorClass: string
  message: string
  retryable: boolean
}

export type AgentToolDenialResponse = AgentToolDenialResult | AgentToolDenialError

export interface AgentRunViewResponse {
  runId: string
  status: AgentRunStatus
  trace?: Record<string, unknown>
  snapshot?: AgentRunSnapshot
  projection?: AgentRunProjection
}

export interface SubAgentSpec {
  task: string
  systemPrompt: string
  allowedTools: string[]
  allowedSkills?: string[]
  modelId?: string
  maxTurns: number
  effort?: AgentEffort
}

export interface SpawnSubAgentInput {
  spec: SubAgentSpec
  depth?: number
}

export interface SubAgentRunTrace {
  runId: string
  parentRunId: string
  parentTraceId: string
  depth: number
  startedAt: number
  completedAt: number
  requestedTools: string[]
  effectiveTools: string[]
  requestedSkills: string[]
  effectiveSkills: string[]
  droppedTools: string[]
  droppedSkills: string[]
  status: Exclude<AgentRunStatus, 'pending' | 'running'>
  error?: string
}

export interface SpawnSubAgentResult {
  output: string
  status: Exclude<AgentRunStatus, 'pending' | 'running'>
  turnsUsed: number
  droppedTools: string[]
  droppedSkills: string[]
  trace: SubAgentRunTrace
  error?: string
}

/** Maximum spawn depth for child agents. Root agent depth is 0. */
export const MAX_SPAWN_DEPTH = 2 as const
