/**
 * Durable Agent Run Spine contracts shared by Electron main and renderer.
 * @see docs/api-contracts/agents.md
 */

import type { AgentNonCanvasResponse, AgentRunStatus, AgentTriggerKind } from './agents'
import type { ChatTurn } from './chat-blocks'
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
  'child.started',
  'child.completed',
  'child.failed',
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
export type PermissionDecision = 'approved' | 'denied'

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

/** Strong payload contract for every durable Agent Run event discriminator. */
export interface AgentRunEventPayloadMap {
  'run.created': AgentRunCreatedPayload
  'run.started': {
    status: 'running'
    jobId?: string
    resumedFromApproval?: boolean
  }
  'intent.analyzed': {
    kind: 'smallTalk' | 'generalChat' | 'searchSummary' | 'requirementPlanning' | 'canvasOperation' | 'clarify'
    summary: string
    requirements: string[]
    missing: string[]
    localCapabilities: string[]
    recommendedAgentId: 'general-purpose' | 'canvas-orchestrator' | 'canvas-operator'
    executionMode: 'clarify' | 'plan' | 'direct'
    complexity: 'low' | 'medium' | 'high'
  }
  'context.built': {
    contextPackId: string
    tokenEstimate: number
    messagesIncluded: number
    sourceCount: number
    redactionCount: number
  }
  progress: {
    message: string
    progress: number
  }
  'model.delta': {
    delta: string
  }
  'tool.started': {
    callId: string
    toolId: string
    inputSummary?: string
  }
  'tool.completed': {
    callId: string
    toolId: string
    invocationId?: string
    status: 'completed' | 'failed' | 'denied'
    summary: string
  }
  'child.started': {
    childTaskId: string
    roleId: string
    inputSummary: string
    effectiveTools: string[]
  }
  'child.completed': {
    childTaskId: string
    roleId: string
    outputSummary: string
    artifactIds: string[]
  }
  'child.failed': {
    childTaskId: string
    roleId: string
    errorClass: string
    outputSummary?: string
    artifactIds: string[]
  }
  'permission.requested': {
    callId: string
    toolId: string
    reason: string
    requiredPermissions: ToolPermission[]
    inputSummary?: string
  }
  'permission.resolved': {
      callId: string
      decision: PermissionDecision
      approvedByLabel?: string
      deniedByLabel?: string
      scope?: PermissionGrantScope
      requestedScope?: PermissionGrantScope
      phase?: 'queued' | 'executing'
    }
  'artifact.created': {
    artifactId: string
    kind: AgentArtifactKind
    title: string
    summary: string
  }
  'plan.ready': {
    messageId: string
    planId: string
  }
  'response.ready': {
    messageId: string
    response: AgentNonCanvasResponse
  }
  'run.completed': {
    status: 'completed'
  }
  'run.failed': {
    errorClass: string
    message: string
    retryable: boolean
    checkpoint?: string
  }
}

/** Payload selected by one durable Agent Run event discriminator. */
export type AgentRunEventPayload<Type extends AgentRunEventType = AgentRunEventType> =
  AgentRunEventPayloadMap[Type]

/** Appends one event while preserving the discriminator-to-payload relationship. */
export type AgentRunEventAppend = <Type extends AgentRunEventType>(
  runId: string,
  type: Type,
  payload: AgentRunEventPayloadMap[NoInfer<Type>]
) => AgentRunEventRecord<Type>

/** Durable event record with a discriminator-correlated payload. */
export type AgentRunEventRecord<Type extends AgentRunEventType = AgentRunEventType> = {
  [EventType in Type]: {
    id: string
    runId: string
    sequence: number
    type: EventType
    payload: AgentRunEventPayloadMap[EventType]
    createdAt: number
  }
}[Type]

export interface AgentArtifactRecord {
  id: string
  runId: string
  kind: AgentArtifactKind
  title: string
  summary: string
  payload: unknown
  createdAt: number
}

/** Shared metadata present on every renderer-facing artifact view. */
export interface AgentArtifactViewBase {
  id: string
  runId: string
  kind: AgentArtifactKind
  title: string
  summary: string
  createdAt: number
}

/** Read-only answer artifact normalized from an unknown JSON payload. */
export interface AgentAnswerArtifactView extends AgentArtifactViewBase {
  viewType: 'answer'
  text: string
  dropped: string[]
}

/** Read-only clarification artifact normalized from an unknown JSON payload. */
export interface AgentClarificationArtifactView extends AgentArtifactViewBase {
  viewType: 'clarification'
  question: string
  missing: string[]
  dropped: string[]
}

/** CanvasPlan node summary safe for renderer display. */
export interface AgentCanvasPlanNodeView {
  ref: string
  type: string
  title: string
}

/** CanvasPlan edge summary safe for renderer display. */
export interface AgentCanvasPlanEdgeView {
  source: string
  target: string
  edgeType: string
}

/** CanvasPlan run-step summary safe for renderer display. */
export interface AgentCanvasPlanRunStepView {
  ref: string
  action: string
}

/** Read-only CanvasPlan artifact with normalized nodes, edges, and run steps. */
export interface AgentCanvasPlanArtifactView extends AgentArtifactViewBase {
  viewType: 'canvasPlan'
  planKind: 'plan' | 'clarify'
  planSummary: string
  question?: string | undefined
  nodes: AgentCanvasPlanNodeView[]
  edges: AgentCanvasPlanEdgeView[]
  runSteps: AgentCanvasPlanRunStepView[]
  dropped: string[]
}

/** Draft graph node metadata safe for renderer display. */
export interface AgentDraftGraphNodeView {
  id: string
  type: string
  label?: string | undefined
  position: { x: number; y: number }
}

/** Draft graph edge metadata safe for renderer display. */
export interface AgentDraftGraphEdgeView {
  id: string
  source: string
  target: string
  edgeType?: string | undefined
}

/** Child-run lineage retained on an isolated graph proposal. */
export interface AgentDraftGraphLineageView {
  parentRunId: string
  childRunId: string
  traceId: string
}

/** Read-only isolated graph proposal; node and edge payload data is intentionally omitted. */
export interface AgentDraftGraphArtifactView extends AgentArtifactViewBase {
  viewType: 'draftGraph'
  nodes: AgentDraftGraphNodeView[]
  edges: AgentDraftGraphEdgeView[]
  lineage: AgentDraftGraphLineageView
  warnings: string[]
  dropped: string[]
}

/** Supported operation labels in a canvas patch draft preview. */
export type AgentCanvasPatchAction = 'add' | 'update' | 'remove'

/** Read-only node change inside a canvas patch draft. */
export interface AgentCanvasPatchNodeChangeView {
  action: AgentCanvasPatchAction
  ref: string
  type?: string | undefined
  title?: string | undefined
}

/** Read-only edge change inside a canvas patch draft. */
export interface AgentCanvasPatchEdgeChangeView {
  action: AgentCanvasPatchAction
  source: string
  target: string
  edgeType?: string | undefined
}

/** Read-only canvas patch artifact with normalized change summaries. */
export interface AgentCanvasPatchDraftArtifactView extends AgentArtifactViewBase {
  viewType: 'canvasPatchDraft'
  patchSummary: string
  nodeChanges: AgentCanvasPatchNodeChangeView[]
  edgeChanges: AgentCanvasPatchEdgeChangeView[]
  warnings: string[]
}

/** Search source metadata safe for citation display. */
export interface AgentSearchSourceView {
  title: string
  url?: string | undefined
  citation?: string | undefined
  snippet?: string | undefined
}

/** Read-only search summary artifact with optional evidence references. */
export interface AgentSearchSummaryArtifactView extends AgentArtifactViewBase {
  viewType: 'searchSummary'
  query?: string | undefined
  searchSummary: string
  sources: AgentSearchSourceView[]
  citations: string[]
}

/** Local-only memory scopes supported by a suggestion preview. */
export type AgentMemorySuggestionScope = 'user' | 'workflow' | 'agentRole'

/** Read-only memory suggestion that is explicitly not persisted yet. */
export interface AgentMemorySuggestionArtifactView extends AgentArtifactViewBase {
  viewType: 'memorySuggestion'
  scope: AgentMemorySuggestionScope
  content: string
  rationale?: string | undefined
  confirmationState: 'pending'
}

/** Severity labels supported by structured diagnostics. */
export type AgentDiagnosticSeverity = 'info' | 'warning' | 'error'

/** One normalized diagnostic item safe for renderer display. */
export interface AgentDiagnosticEntryView {
  code: string
  severity: AgentDiagnosticSeverity
  message: string
  path?: string | undefined
  detailsPreview?: string | undefined
}

/** Read-only structured diagnostic report artifact. */
export interface AgentDiagnosticArtifactView extends AgentArtifactViewBase {
  viewType: 'diagnostics'
  severity: AgentDiagnosticSeverity
  diagnostics: AgentDiagnosticEntryView[]
}

/** Diagnostic-friendly fallback for unsupported or malformed artifact payloads. */
export interface AgentArtifactFallbackView extends AgentArtifactViewBase {
  viewType: 'fallback'
  reason: string
  payloadPreview: string
}

/** Renderer-facing typed artifact views produced only by the shared projector. */
export type AgentArtifactViewModel =
  | AgentAnswerArtifactView
  | AgentClarificationArtifactView
  | AgentCanvasPlanArtifactView
  | AgentDraftGraphArtifactView
  | AgentCanvasPatchDraftArtifactView
  | AgentSearchSummaryArtifactView
  | AgentMemorySuggestionArtifactView
  | AgentDiagnosticArtifactView
  | AgentArtifactFallbackView

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
  lastCheckpoint?: string
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
  permissions: Array<{
    callId: string
    toolId: string
    reason: string
    resolved: boolean
    decision?: PermissionDecision
  }>
  artifacts: Array<{ id: string; kind: AgentArtifactKind; title: string; summary: string }>
  childTasks: AgentTaskTreeRow[]
  error?: { errorClass: string; message: string; retryable: boolean }
}

export interface AgentRunProjection {
  chatTurn: ChatTurn
  taskTree: AgentTaskTreeRow[]
  inspector: RunInspectorModel
  artifacts: AgentArtifactViewModel[]
}
