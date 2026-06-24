/**
 * Agent runtime, registry, and sub-agent contracts.
 * @see docs/api-contracts/agents.md
 */

import type { ToolPermissionKind } from './tools'

export type AgentSource = 'builtin' | 'user'

export type AgentEffort = 'low' | 'medium' | 'high'

export type AgentRunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'aborted' | 'max_turns_exceeded'

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
