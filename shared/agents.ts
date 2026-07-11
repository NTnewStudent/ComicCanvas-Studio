/**
 * Agent runtime, registry, and sub-agent contracts.
 * @see docs/api-contracts/agents.md
 */

import type { ToolPermission, ToolPermissionKind } from './tools'
import type { CanvasPlan } from './plan'
import type { CanvasGraphSnapshot } from './graph'
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

/** Canonical built-in role IDs accepted by first-MVP child spawning. */
export const CANONICAL_AGENT_ROLE_IDS = [
  'general-assistant',
  'pm-agent',
  'canvas-planner',
  'canvas-operator',
  'asset-media-agent',
  'workflow-runner',
  'tooling-agent',
  'qa-verifier'
] as const

/** Stable identifier for a canonical built-in Agent role. */
export type CanonicalAgentRoleId = (typeof CANONICAL_AGENT_ROLE_IDS)[number]

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

export interface SpawnSubAgentInput {
  roleId: string
  task: string
}

export interface ChildCanvasPlanArtifactDraft {
  kind: 'canvasPlan'
  title: string
  summary: string
  payload: CanvasPlan
}

export interface ChildDraftGraphArtifactDraft {
  kind: 'draftGraph'
  title: string
  summary: string
  payload: {
    graph: CanvasGraphSnapshot
    lineage: { parentRunId: string; childRunId: string; traceId: string }
    warnings: string[]
  }
}

/** Sanitized child output awaiting durable artifact ownership by the child run. */
export type ChildAgentArtifactDraft = ChildCanvasPlanArtifactDraft | ChildDraftGraphArtifactDraft

/** Stable IPC response returned when an Agent boundary request is malformed. */
export interface AgentIpcValidationError {
  errorClass: 'agent_invalid_request'
  message: string
  retryable: false
}

/** Stable IPC response returned when the local Agent runtime dependency is absent. */
export interface AgentRuntimeUnavailableError {
  errorClass: 'agent_runtime_unavailable'
  message: string
  retryable: false
}

export interface SpawnSubAgentError {
  errorClass: 'agent_role_not_spawnable' | 'agent_depth_exceeded' | 'agent_child_run_failed'
  message: string
  retryable: false
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
  errorClass?: SpawnSubAgentError['errorClass']
}

export interface SpawnSubAgentResult {
  roleId: string
  output: string
  status: Exclude<AgentRunStatus, 'pending' | 'running'>
  turnsUsed: number
  effectiveTools: string[]
  droppedTools: string[]
  droppedSkills: string[]
  artifactIds: string[]
  trace: SubAgentRunTrace
  error?: SpawnSubAgentError
  pausedState?: unknown
  pendingApproval?: {
    callId: string
    toolId: string
    input: unknown
    reason: string
    requiredPermissions: ToolPermission[]
  }
}

/** Maximum spawn depth for child agents. Root agent depth is 0. */
export const MAX_SPAWN_DEPTH = 2 as const
