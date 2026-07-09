/**
 * Durable Agent Run Spine contracts shared by Electron main and renderer.
 * @see docs/api-contracts/agents.md
 */

import type { AgentResponse, AgentRunStatus, AgentTriggerKind } from './agents'
import type { ChatTurn } from './chat-blocks'
import type { CanvasPlan } from './plan'
import type { ToolPermission, ToolPermissionKind } from './tools'

export const AGENT_RUN_EVENT_TYPES = [
  'run.created',
  'run.started',
  'intent.analyzed',
  'context.built',
  'progress',
  'model.delta',
  'tool.started',
  'tool.completed',
  'permission.requested',
  'permission.resolved',
  'artifact.created',
  'plan.ready',
  'response.ready',
  'run.completed',
  'run.failed',
] as const

export type AgentRunEventType = (typeof AGENT_RUN_EVENT_TYPES)[number]

export const AGENT_ARTIFACT_KINDS = [
  'answer',
  'clarification',
  'canvasPlan',
  'canvasPatchDraft',
  'draftGraph',
  'assetReference',
  'searchSummary',
  'memorySuggestion',
  'diagnosticReport',
  'runExport',
] as const

export type AgentArtifactKind = (typeof AGENT_ARTIFACT_KINDS)[number]
export type PermissionGrantScope = 'once' | 'run' | 'session'

export interface AgentRunCreatedPayload {
  threadId: string
  workflowId: string
  agentId: string
  trigger: AgentTriggerKind
  messageId: string
  jobId?: string
  policyProfileId: string
  gatewayId?: string
  modelId?: string
}

export type AgentRunEventPayload =
  | AgentRunCreatedPayload
  | { status: AgentRunStatus; jobId?: string }
  | { message: string; progress: number }
  | { delta: string }
  | { callId: string; toolId: string; inputSummary?: string }
  | { callId: string; toolId: string; invocationId?: string; status: 'completed' | 'failed' | 'denied'; summary: string }
  | { callId: string; toolId: string; reason: string; requiredPermissions: ToolPermission[]; inputSummary?: string }
  | { callId: string; approvedByLabel: string; scope: PermissionGrantScope }
  | { artifactId: string; kind: AgentArtifactKind; title: string; summary: string }
  | { messageId: string; planId: string }
  | { messageId: string; response: AgentResponse }
  | { errorClass: string; message: string; retryable: boolean; checkpoint?: string }
  | Record<string, unknown>

export interface AgentRunEventRecord {
  id: string
  runId: string
  sequence: number
  type: AgentRunEventType
  payload: AgentRunEventPayload
  createdAt: number
}

export interface AgentArtifactRecord {
  id: string
  runId: string
  kind: AgentArtifactKind
  title: string
  summary: string
  payload: AgentResponse | CanvasPlan | Record<string, unknown>
  createdAt: number
}

export interface LocalPermissionGrant {
  id: string
  toolId: string
  permissionKinds: ToolPermissionKind[]
  workflowId: string
  scope: PermissionGrantScope
  runId?: string
  expiresAt?: number
  approvedByLabel: string
  createdAt: number
  revokedAt?: number
}

export interface ChildAgentTaskRecord {
  id: string
  parentRunId: string
  roleId: string
  inputSummary: string
  effectiveTools: string[]
  status: AgentRunStatus
  outputSummary?: string
  artifactIds: string[]
  errorClass?: string
  createdAt: number
  updatedAt: number
}

export interface AgentRunRecordSnapshot {
  id: string
  threadId: string
  workflowId: string
  agentId: string
  status: AgentRunStatus
  trigger: AgentTriggerKind
  messageId: string
  jobId?: string
  contextPackId?: string
  policyProfileId: string
  gatewayId?: string
  modelId?: string
  pausedState?: Record<string, unknown>
  usage?: Record<string, unknown>
  trace: Record<string, unknown>
  errorClass?: string
  createdAt: number
  updatedAt: number
}

export interface AgentRunSnapshot {
  run: AgentRunRecordSnapshot
  events: AgentRunEventRecord[]
  artifacts: AgentArtifactRecord[]
  permissionGrants: LocalPermissionGrant[]
  childTasks: ChildAgentTaskRecord[]
}

export interface AgentTaskTreeRow {
  id: string
  parentRunId: string
  roleId: string
  status: AgentRunStatus
  summary: string
  artifactIds: string[]
  errorClass?: string
}

export interface RunInspectorModel {
  runId: string
  status: AgentRunStatus
  agentId: string
  workflowId: string
  trigger: AgentTriggerKind
  modelLabel: string
  latestEventType?: AgentRunEventType
  tools: Array<{ callId: string; toolId: string; status: string; summary?: string }>
  permissions: Array<{ callId: string; toolId: string; reason: string; resolved: boolean }>
  artifacts: Array<{ id: string; kind: AgentArtifactKind; title: string; summary: string }>
  childTasks: AgentTaskTreeRow[]
  error?: { errorClass: string; message: string; retryable: boolean }
}

export interface AgentRunProjection {
  chatTurn: ChatTurn
  taskTree: AgentTaskTreeRow[]
  inspector: RunInspectorModel
  artifacts: AgentArtifactRecord[]
}
