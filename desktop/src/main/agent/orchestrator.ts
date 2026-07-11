/**
 * AsyncGenerator orchestrator runtime for natural-language CanvasPlan creation.
 * @see docs/api-contracts/agents.md
 * @see docs/api-contracts/canvas-plan.md
 */

import type { AgentRunSnapshot, PermissionGrantScope } from '../../../../shared/agent-run-events'
import { projectAgentRunSnapshot } from '../../../../shared/agent-run-projector'
import {
  CANONICAL_AGENT_ROLE_IDS,
  type CanonicalAgentRoleId,
  type AgentDefinition,
  type AgentResponse,
  type AgentRunRequest,
  type AgentRunStatus,
  type AgentRunTicket,
  type AgentRunViewResponse,
  type AgentToolApprovalInput,
  type AgentToolDenialInput,
  type AgentToolDenialResponse,
  type AgentTriggerKind
} from '../../../../shared/agents'
import type { JobResult } from '../../../../shared/jobs'
import type { CanvasPlan } from '../../../../shared/plan'
import type { CanvasGraphSnapshot } from '../../../../shared/graph'
import type { ToolDescriptor, ToolPermission, ToolPermissionKind } from '../../../../shared/tools'
import type { AgentRunRecord, AgentRunRepository } from '../db/repositories/agent-run.repo'
import type { PersistedJobRecord } from '../db/repositories/job.repo'
import type { ChatMessageRepository } from '../db/repositories/chat-message.repo'
import type { JobEventBus } from '../jobs/events'
import type { JobQueue } from '../jobs/queue'
import {
  AgentLoopTerminalError,
  createAgentContextLoop,
  type AgentContextLoopState,
  type AgentLoopMessage,
  type AgentToolApprovalRequest,
  type AgentToolCall
} from './context-loop'
import type { AgentRegistry } from './registry'
import type { CanvasPlanEventBus } from './plan-events'
import { sanitizePlan } from './sanitize-plan'
import { analyzeAgentIntent, formatIntentProgress, type AgentIntentAnalysis } from './intent-analysis'
import { buildAgentContext } from '../knowledge/context-builder'
import type { KnowledgeStore } from '../knowledge/store'
import { buildSkillContext } from '../knowledge/skill-context'
import type { SkillRegistry } from '../skills/registry'
import { applyAgentEvent, createAssistantTurn } from '../../../../shared/chat-blocks'
import type { ChatTurn } from '../../../../shared/chat-blocks'
import type { AgentRunSpine } from './run-spine'

const DEFAULT_CHAT_AGENT_ID = 'general-purpose'
const CANVAS_ORCHESTRATOR_AGENT_ID = 'canvas-orchestrator'

/** Selects a nonempty, persistence-safe summary for a reconciled approval child. */
export function approvalChildOutputSummary(child: Pick<AgentRunSnapshot, 'artifacts' | 'events'>, existingSummary: string): string {
  const artifactSummary = child.artifacts.at(-1)?.summary.trim()
  if (artifactSummary) return artifactSummary

  for (let index = child.events.length - 1; index >= 0; index -= 1) {
    const event = child.events[index]
    if (event?.type !== 'response.ready') continue
    const response = event.payload.response
    const candidates = response.type === 'answer'
      ? [response.summary, response.text]
      : [response.summary, response.question]
    const summary = candidates.find((candidate) => candidate.trim().length > 0)?.trim()
    if (summary) return summary
  }

  return existingSummary.trim().length > 0 ? existingSummary : ''
}

export interface OrchestratorProgressDraft {
  type: 'progress'
  message: string
  progress: number
}

export type OrchestratorPlannerDraft =
  | OrchestratorProgressDraft
  | {
      type: 'toolStarted'
      callId: string
      toolId: string
      inputSummary: string
    }
  | {
      type: 'toolCompleted'
      callId: string
      toolId: string
      invocationId: string
      status: 'completed' | 'failed' | 'denied'
      summary: string
    }
  | {
      type: 'permissionRequired'
      callId: string
      toolId: string
      reason: string
      requiredPermissions: ToolPermission[]
    }

export interface OrchestratorPlanner {
  proposePlan(input: OrchestratorPlannerInput): AsyncGenerator<OrchestratorPlannerDraft, AgentResponse | CanvasPlan> | Promise<AgentResponse | CanvasPlan> | AgentResponse | CanvasPlan
  resumeApprovedTool?(input: OrchestratorApprovalPlannerInput): AsyncGenerator<OrchestratorPlannerDraft, AgentResponse | CanvasPlan> | Promise<AgentResponse | CanvasPlan> | AgentResponse | CanvasPlan
}

export interface OrchestratorPlannerInput {
  runId: string
  messageId: string
  message: string
  agentId: string
  agent?: AgentDefinition
  trigger?: AgentTriggerKind
  loop?: AgentContextLoopState
  /** Optional streaming delta callback forwarded to the gateway for live token delivery. */
  onDelta?: (delta: string) => void
}

export interface OrchestratorApprovalPlannerInput extends OrchestratorPlannerInput {
  agent: AgentDefinition
  trigger: AgentTriggerKind
  loop: AgentContextLoopState
  approval: AgentToolApprovalRequest
  approvedBy: string
  approvalScope: PermissionGrantScope
}

export type OrchestratorEvent =
  | { type: 'progress'; runId: string; message: string; progress: number }
  | { type: 'plan'; runId: string; messageId: string; planId: string; plan: CanvasPlan }
  | { type: 'response'; runId: string; messageId: string; response: AgentResponse }
  | { type: 'toolStarted'; runId: string; messageId: string; callId: string; toolId: string; inputSummary: string }
  | {
      type: 'toolCompleted'
      runId: string
      messageId: string
      callId: string
      toolId: string
      invocationId: string
      status: 'completed' | 'failed' | 'denied'
      summary: string
    }
  | {
      type: 'permissionRequired'
      runId: string
      messageId: string
      callId: string
      toolId: string
      reason: string
      requiredPermissions: ToolPermission[]
    }

export interface OrchestratorRunResult {
  runId: string
  messageId: string
  response: AgentResponse
  planId?: string
  plan?: CanvasPlan
}

export interface OrchestratorRunOptions extends OrchestratorPlannerInput {
  planner: OrchestratorPlanner
  planIdFactory: () => string
}

export interface OrchestratorChatInput {
  message: string
  agentId?: string
  trigger?: AgentTriggerKind
  requestedBy: string
}

export interface OrchestratorChatTicket {
  runId: string
  jobId: string
  messageId: string
  status: 'pending'
}

export interface OrchestratorRuntimeOptions {
  queue: JobQueue
  events: JobEventBus
  planner: OrchestratorPlanner
  transaction?: <T>(operation: () => T) => T
  registry?: AgentRegistry
  listTools?: () => ToolDescriptor[]
  agentRuns?: AgentRunRepository
  runSpine?: AgentRunSpine
  chatMessages?: ChatMessageRepository
  planEvents?: CanvasPlanEventBus
  getCanvasGraph?: (workflowId?: string) => CanvasGraphSnapshot
  getSelectedNodeIds?: () => string[]
  idFactory?: (prefix: 'message' | 'run') => string
  planIdFactory?: () => string
  /** Ephemeral application-session boundary used to prevent session grants surviving a restart. */
  appSessionId?: string
  workflowId?: string
  clock?: () => number
  skillRegistry?: SkillRegistry
  knowledgeStore?: KnowledgeStore
}

export interface OrchestratorRuntime {
  chatSend(input: OrchestratorChatInput): OrchestratorChatTicket
  agentRun(input: AgentRunRequest): AgentRunTicket
  approveTool(input: AgentToolApprovalInput): AgentRunTicket | { errorClass: string; message: string; retryable: false }
  denyTool(input: AgentToolDenialInput): AgentToolDenialResponse
  getRun(runId: string): AgentRunViewResponse | null
  getPlan(messageId: string): CanvasPlan | null
  createJobHandler(): (job: PersistedJobRecord) => Promise<JobResult>
}

interface ApprovalResumePayload {
  kind: 'approval'
  runId: string
  messageId: string
  message: string
  agentId: string
  trigger: AgentTriggerKind
  approval: AgentToolApprovalRequest
  approvedBy: string
  approvalScope: PermissionGrantScope
  approvalSessionId?: string
}

interface StoredRun {
  runId: string
  messageId: string
  planId?: string
  status: AgentRunStatus
  agentId?: string
  jobId?: string
  trigger?: AgentTriggerKind
  errorClass?: string
  droppedTools?: string[]
  compactionSummary?: string | null
  omittedMessages?: number
  intentAnalysis?: AgentIntentAnalysis
  pendingApproval?: AgentToolApprovalRequest
  pausedState?: AgentContextLoopState
  effectiveAgent?: AgentDefinition
  response?: AgentResponse
  startedAt?: number
  completedAt?: number
  turnCount?: number
  usageSummary?: string
}

function fallbackOrchestratorAgent(agentId: string): AgentDefinition {
  const canonicalAgentId = agentId === 'general-purpose'
    ? 'general-assistant'
    : agentId === 'canvas-orchestrator' || agentId === 'orchestrator'
      ? 'canvas-planner'
      : agentId
  if (agentId === DEFAULT_CHAT_AGENT_ID) {
    return {
      id: canonicalAgentId,
      source: 'builtin',
      name: 'General Purpose',
      description: 'Default conversation agent that understands, decomposes, clarifies, and delegates to local capabilities.',
      instructions: 'First understand the user message, decompose requirements, and inspect local capabilities. Ask for clarification when ambiguous. Never create canvas nodes for greetings or low-signal requests.',
      allowedTools: ['canvas.queryGraph', 'fs.read', 'fs.glob', 'fs.grep', 'web.search'],
      allowedSkills: '*',
      gatewayPolicy: { allowedChannels: ['text'] },
      contextPolicy: {
        includeCanvasGraph: true,
        includeSelectedAssets: true,
        includeRecentMessages: true,
        includeKnowledge: false,
        maxContextTokens: 8000
      },
      permissionPolicy: { allowedPermissionKinds: ['canvas.read', 'file.read', 'diagnostics', 'network'], requireAskForDestructive: true },
      triggerPolicy: { allowedTriggers: ['manual', 'mention', 'canvasChat'], defaultTrigger: 'canvasChat', autoRun: false },
      maxTurns: 8,
      effort: 'high',
      enabled: true
    }
  }

  return {
    id: canonicalAgentId,
    source: 'builtin',
    name: agentId === CANVAS_ORCHESTRATOR_AGENT_ID || agentId === 'orchestrator' ? 'Canvas Orchestrator' : agentId,
    description: 'Fallback Agent definition for isolated orchestrator tests.',
    instructions: 'Analyze the user request and produce safe ComicCanvas plans.',
    allowedTools: '*',
    allowedSkills: '*',
    gatewayPolicy: { allowedChannels: ['text', 'image', 'video'] },
    contextPolicy: {
      includeCanvasGraph: true,
      includeSelectedAssets: true,
      includeRecentMessages: true,
      includeKnowledge: false,
      maxContextTokens: 8000
    },
    permissionPolicy: { allowedPermissionKinds: ['canvas.read', 'canvas.write', 'file.read', 'network', 'provider.spend'], requireAskForDestructive: true },
    triggerPolicy: { allowedTriggers: ['manual', 'mention', 'canvasChat'], defaultTrigger: 'canvasChat', autoRun: false },
    maxTurns: 8,
    effort: 'high',
    enabled: true
  }
}

function isAsyncIterable(value: unknown): value is AsyncGenerator<OrchestratorPlannerDraft, AgentResponse | CanvasPlan> {
  return typeof value === 'object' && value !== null && Symbol.asyncIterator in value
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isAgentTriggerKind(value: unknown): value is AgentTriggerKind {
  return value === 'manual' || value === 'mention' || value === 'canvasChat' || value === 'workflowEvent'
}

function canonicalAgentRoleId(agentId: string): CanonicalAgentRoleId | null {
  if (CANONICAL_AGENT_ROLE_IDS.includes(agentId as CanonicalAgentRoleId)) {
    return agentId as CanonicalAgentRoleId
  }

  const roleAliases: Readonly<Record<string, CanonicalAgentRoleId>> = {
    'general-purpose': 'general-assistant',
    'canvas-orchestrator': 'canvas-planner',
    orchestrator: 'canvas-planner',
    canvas: 'canvas-operator',
    tooling: 'tooling-agent',
    pm: 'pm-agent'
  }
  return roleAliases[agentId] ?? null
}

function isToolPermissionKind(value: unknown): value is ToolPermissionKind {
  return value === 'canvas.read'
    || value === 'canvas.write'
    || value === 'file.read'
    || value === 'file.write'
    || value === 'network'
    || value === 'provider.spend'
    || value === 'destructive'
    || value === 'diagnostics'
}

function persistedToolPermission(value: unknown): ToolPermission | null {
  if (!isRecord(value) || !isToolPermissionKind(value.kind) || typeof value.reason !== 'string') {
    return null
  }

  return { kind: value.kind, reason: value.reason }
}

function persistedToolCall(value: unknown): AgentToolCall | null {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.toolId !== 'string') {
    return null
  }

  return {
    id: value.id,
    toolId: value.toolId,
    input: 'input' in value ? value.input : {}
  }
}

function persistedToolDescriptor(value: unknown): ToolDescriptor | null {
  if (
    !isRecord(value)
    || typeof value.id !== 'string'
    || typeof value.name !== 'string'
    || typeof value.description !== 'string'
    || !['canvas', 'asset', 'job', 'gateway', 'knowledge', 'file', 'web', 'model', 'custom'].includes(String(value.category))
    || !isRecord(value.owner)
    || !(
      (value.owner.kind === 'builtin' && value.owner.id === 'core')
      || (value.owner.kind === 'plugin' && typeof value.owner.id === 'string')
    )
    || typeof value.inputSchemaRef !== 'string'
    || typeof value.outputSchemaRef !== 'string'
    || !Array.isArray(value.permissions)
    || !['readonly', 'serial-write', 'exclusive'].includes(String(value.concurrency))
    || typeof value.enabled !== 'boolean'
  ) {
    return null
  }

  const permissions = value.permissions.map(persistedToolPermission)
  if (permissions.some((permission) => permission === null)) {
    return null
  }

  return {
    id: value.id,
    name: value.name,
    description: value.description,
    category: value.category as ToolDescriptor['category'],
    owner: value.owner as ToolDescriptor['owner'],
    inputSchemaRef: value.inputSchemaRef,
    outputSchemaRef: value.outputSchemaRef,
    ...(isRecord(value.inputParametersJsonSchema) ? { inputParametersJsonSchema: value.inputParametersJsonSchema } : {}),
    permissions: permissions as ToolPermission[],
    concurrency: value.concurrency as ToolDescriptor['concurrency'],
    enabled: value.enabled
  }
}

function persistedLoopMessage(value: unknown): AgentLoopMessage | null {
  if (!isRecord(value) || typeof value.content !== 'string') {
    return null
  }

  if (value.role === 'system' || value.role === 'user') {
    return { role: value.role, content: value.content }
  }

  if (value.role === 'assistant') {
    if (value.toolCalls === undefined) {
      return { role: 'assistant', content: value.content }
    }
    if (!Array.isArray(value.toolCalls)) {
      return null
    }
    const toolCalls = value.toolCalls.map(persistedToolCall)
    if (toolCalls.some((call) => call === null)) {
      return null
    }
    return { role: 'assistant', content: value.content, toolCalls: toolCalls as AgentToolCall[] }
  }

  if (
    value.role !== 'tool'
    || typeof value.toolId !== 'string'
    || typeof value.invocationId !== 'string'
    || !['accepted', 'running', 'completed', 'failed', 'denied'].includes(String(value.status))
  ) {
    return null
  }

  return {
    role: 'tool',
    toolId: value.toolId,
    invocationId: value.invocationId,
    ...(typeof value.toolCallId === 'string' ? { toolCallId: value.toolCallId } : {}),
    status: value.status as Extract<AgentLoopMessage, { role: 'tool' }>['status'],
    content: value.content
  }
}

/** Parses a durable context-loop checkpoint, rejecting partially malformed execution identity. */
export function parseAgentContextLoopState(
  value: unknown,
  enclosing?: { runId: string; agentId: string }
): AgentContextLoopState | null {
  if (
    !isRecord(value)
    || typeof value.agentId !== 'string'
    || !isAgentTriggerKind(value.trigger)
    || typeof value.turnCount !== 'number'
    || typeof value.maxTurns !== 'number'
    || !['start', 'tool_results', 'completed', 'approval_required', 'max_turns_exceeded'].includes(String(value.transition))
    || typeof value.systemPrompt !== 'string'
    || typeof value.userMessage !== 'string'
    || !Array.isArray(value.allowedTools)
    || !Array.isArray(value.droppedTools)
    || !value.droppedTools.every((entry) => typeof entry === 'string')
    || !Array.isArray(value.messages)
    || typeof value.tokenEstimate !== 'number'
    || !(typeof value.compactionSummary === 'string' || value.compactionSummary === null)
    || typeof value.omittedMessages !== 'number'
    || !(value.pendingToolCalls === undefined || Array.isArray(value.pendingToolCalls))
    || !(value.additionalContext === undefined || typeof value.additionalContext === 'string')
  ) {
    return null
  }

  const allowedTools = value.allowedTools.map(persistedToolDescriptor)
  const messages = value.messages.map(persistedLoopMessage)
  const pendingToolCalls = (value.pendingToolCalls ?? []).map(persistedToolCall)
  const execution = value.execution
  const canonicalRoles = new Set<string>(CANONICAL_AGENT_ROLE_IDS)
  const enclosingRoleId = enclosing ? canonicalAgentRoleId(enclosing.agentId) : null
  if (
    allowedTools.some((tool) => tool === null)
    || messages.some((message) => message === null)
    || pendingToolCalls.some((call) => call === null)
    || !(execution === undefined || (
      isRecord(execution)
      && typeof execution.runId === 'string' && execution.runId.length > 0
      && typeof execution.roleId === 'string' && canonicalRoles.has(execution.roleId)
      && Number.isInteger(execution.depth) && Number(execution.depth) >= 0
      && (execution.parentTraceId === undefined || (typeof execution.parentTraceId === 'string' && execution.parentTraceId.length > 0))
      && Array.isArray(execution.effectiveTools) && execution.effectiveTools.every((entry) => typeof entry === 'string')
      && Array.isArray(execution.effectiveSkills) && execution.effectiveSkills.every((entry) => typeof entry === 'string')
    ))
    || (execution !== undefined && enclosing !== undefined && (
      !isRecord(execution)
      || execution.runId !== enclosing.runId
      || enclosingRoleId === null
      || execution.roleId !== enclosingRoleId
    ))
  ) {
    return null
  }

  return {
    agentId: value.agentId,
    trigger: value.trigger,
    turnCount: value.turnCount,
    maxTurns: value.maxTurns,
    transition: value.transition as AgentContextLoopState['transition'],
    systemPrompt: value.systemPrompt,
    userMessage: value.userMessage,
    allowedTools: allowedTools as ToolDescriptor[],
    droppedTools: [...value.droppedTools],
    messages: messages as AgentLoopMessage[],
    tokenEstimate: value.tokenEstimate,
    compactionSummary: value.compactionSummary,
    omittedMessages: value.omittedMessages,
    pendingToolCalls: pendingToolCalls as AgentToolCall[],
    additionalContext: value.additionalContext ?? '',
    ...(isRecord(execution) ? {
      execution: {
        runId: execution.runId as string,
        roleId: execution.roleId as CanonicalAgentRoleId,
        depth: execution.depth as number,
        ...(typeof execution.parentTraceId === 'string' ? { parentTraceId: execution.parentTraceId } : {}),
        effectiveTools: [...execution.effectiveTools as string[]],
        effectiveSkills: [...execution.effectiveSkills as string[]]
      }
    } : {})
  }
}

function persistedApprovalRequest(value: unknown): AgentToolApprovalRequest | null {
  if (
    !isRecord(value)
    || typeof value.callId !== 'string'
    || typeof value.toolId !== 'string'
    || typeof value.reason !== 'string'
    || !Array.isArray(value.requiredPermissions)
  ) {
    return null
  }

  const requiredPermissions = value.requiredPermissions.map(persistedToolPermission)
  if (requiredPermissions.some((permission) => permission === null)) {
    return null
  }

  return {
    callId: value.callId,
    toolId: value.toolId,
    input: 'input' in value ? value.input : {},
    reason: value.reason,
    requiredPermissions: requiredPermissions as ToolPermission[]
  }
}

function restorePausedRun(record: AgentRunRecord): StoredRun | null {
  if (record.status !== 'approval_required' && record.status !== 'pending') {
    return null
  }

  const pendingApproval = persistedApprovalRequest(record.trace.pendingApproval)
  const traceMessageId = typeof record.trace.messageId === 'string' ? record.trace.messageId : ''
  const traceAgentId = typeof record.trace.agentId === 'string' ? record.trace.agentId : ''
  const traceJobId = typeof record.trace.jobId === 'string' ? record.trace.jobId : undefined
  const traceTrigger = isAgentTriggerKind(record.trace.trigger) ? record.trace.trigger : undefined
  const messageId = record.messageId || traceMessageId
  const agentId = record.agentId || traceAgentId
  const trigger = isAgentTriggerKind(record.trigger) ? record.trigger : traceTrigger
  const jobId = record.jobId ?? traceJobId
  const pausedState = agentId
    ? parseAgentContextLoopState(record.pausedState, { runId: record.id, agentId })
    : null

  if (!pendingApproval || !pausedState || !messageId || !agentId || !trigger) {
    return null
  }

  if (!pausedState.execution) {
    const canonicalRoleId = canonicalAgentRoleId(agentId)
    if (!canonicalRoleId) return null
    pausedState.execution = {
      runId: record.id,
      roleId: canonicalRoleId,
      depth: 0,
      effectiveTools: pausedState.allowedTools.map((tool) => tool.id),
      effectiveSkills: []
    }
  }

  return {
    runId: record.id,
    messageId,
    status: record.status,
    agentId,
    trigger,
    ...(jobId ? { jobId } : {}),
    ...(record.errorClass ? { errorClass: record.errorClass } : {}),
    pendingApproval,
    pausedState
  }
}

function isAgentResponse(value: unknown): value is AgentResponse {
  return isRecord(value)
    && (value.type === 'answer' || value.type === 'clarification' || value.type === 'canvasPlan')
}

function responseFromCanvasPlan(plan: CanvasPlan): AgentResponse {
  return { type: 'canvasPlan', plan: sanitizePlan(plan) }
}

function normalizeAgentResponse(value: AgentResponse | CanvasPlan): AgentResponse {
  if (isAgentResponse(value)) {
    return value.type === 'canvasPlan' ? responseFromCanvasPlan(value.plan) : value
  }

  return responseFromCanvasPlan(value)
}

function artifactTitleForResponse(response: AgentResponse): string {
  if (response.type === 'answer') return 'Answer'
  if (response.type === 'clarification') return 'Clarification'
  return 'Canvas Plan'
}

function artifactSummaryForResponse(response: AgentResponse): string {
  return response.type === 'canvasPlan' ? response.plan.summary : response.summary
}

function runFailureTrace(runId: string, messageId: string, previous: StoredRun | undefined, error: unknown): StoredRun {
  if (error instanceof AgentLoopTerminalError) {
    const status: AgentRunStatus = error.pendingApproval
      ? 'approval_required'
      : error.errorClass === 'agent_max_turns_exceeded' ? 'max_turns_exceeded' : 'failed'
    const failedRun: StoredRun = {
      ...(previous ?? { runId, messageId }),
      runId,
      messageId,
      status,
      errorClass: error.errorClass,
      droppedTools: error.droppedTools,
      compactionSummary: error.compactionSummary,
      omittedMessages: error.omittedMessages,
      ...(error.pendingApproval ? { pendingApproval: error.pendingApproval } : {}),
      ...(error.pausedState ? { pausedState: error.pausedState } : {})
    }
    if (!error.pendingApproval) {
      delete failedRun.pendingApproval
      delete failedRun.pausedState
    }
    return failedRun
  }

  const failedRun: StoredRun = {
    ...(previous ?? { runId, messageId }),
    runId,
    messageId,
    status: 'failed',
    errorClass: error instanceof Error ? error.message : 'agent_run_failed'
  }
  delete failedRun.pendingApproval
  delete failedRun.pausedState
  return failedRun
}

function applyContextPolicyOverride(agent: AgentDefinition, payload: Record<string, unknown>): AgentDefinition {
  const override = payload.contextPolicyOverride

  if (typeof override !== 'object' || override === null || Array.isArray(override)) {
    return agent
  }

  return {
    ...agent,
    contextPolicy: {
      ...agent.contextPolicy,
      ...(override as Partial<AgentDefinition['contextPolicy']>)
    }
  }
}

function approvalError(errorClass: string, message: string): { errorClass: string; message: string; retryable: false } {
  return { errorClass, message, retryable: false }
}

function denialPersistenceError(): { errorClass: 'agent_denial_failed'; message: string; retryable: true } {
  return {
    errorClass: 'agent_denial_failed',
    message: 'Tool denial could not be persisted. Retry the denial.',
    retryable: true
  }
}

function clarificationResponse(summary: string, question: string, missing: string[] = [], dropped: string[] = []): AgentResponse {
  return {
    type: 'clarification',
    summary,
    question,
    missing,
    dropped
  }
}

function weekdayName(date: Date): string {
  return ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][date.getDay()] ?? '未知'
}

function dateWithOffset(days: number): Date {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date
}

function relativeDay(message: string): { label: string; offsetDays: number } | null {
  if (/明天|tomorrow/iu.test(message)) {
    return { label: '明天', offsetDays: 1 }
  }

  if (/昨天|yesterday/iu.test(message)) {
    return { label: '昨天', offsetDays: -1 }
  }

  if (/今天|today/iu.test(message)) {
    return { label: '今天', offsetDays: 0 }
  }

  return null
}

function generalQuestionResponse(message: string): AgentResponse {
  const normalized = message.trim().toLowerCase()
  let answer = '这是一个普通问题，我会按通用 Agent 模式回答；如果你希望我操作画布，请直接说明要创建的节点、素材或工作流。'
  const day = relativeDay(normalized)

  if ((/(星期几|周几)/iu.test(normalized) || /what day (is it|is tomorrow|was yesterday)/iu.test(normalized)) && day) {
    answer = `${day.label}是${weekdayName(dateWithOffset(day.offsetDays))}。`
  } else if ((/几号|日期/iu.test(normalized) || /what date (is it|is tomorrow|was yesterday)/iu.test(normalized)) && day) {
    answer = `${day.label}是${new Intl.DateTimeFormat('zh-CN', { dateStyle: 'long' }).format(dateWithOffset(day.offsetDays))}。`
  } else if (/现在几点|what time is it/iu.test(normalized)) {
    answer = `现在是${new Intl.DateTimeFormat('zh-CN', { timeStyle: 'short' }).format(new Date())}。`
  }

  return {
    type: 'answer',
    summary: '用户提出了普通问题，应由通用 Agent 直接回答。',
    text: answer,
    dropped: []
  }
}

function assistantIdentityResponse(): AgentResponse {
  return {
    type: 'answer',
    summary: '用户询问助手身份或能力边界。',
    text: '我是 ComicCanvas Studio 里的通用 Agent 助手。你可以直接和我聊天，让我总结资料、分析需求、制定计划；当你要操作当前画布时，我会把任务交给画布专用 Agent，去创建节点、连接工作流并按规则执行。',
    dropped: []
  }
}

function smallTalkResponse(message: string): AgentResponse {
  if (/你是谁|你是.*谁|你叫什么|介绍一下自己|自我介绍|你能做什么|你可以做什么|who\s*are\s*you|what\s*can\s*you\s*do/iu.test(message.trim())) {
    return assistantIdentityResponse()
  }

  return {
    type: 'answer',
    summary: '用户只是打招呼或进行低负担寒暄。',
    text: '你好，我在。你可以直接和我聊天，也可以让我总结资料、分析需求，或者帮你创建、连接和运行当前画布里的节点。',
    dropped: []
  }
}

function searchUnavailableResponse(): AgentResponse {
  return {
    type: 'answer',
    summary: '用户提出了依赖当前互联网信息的问题。',
    text: '这个问题需要联网搜索后再总结来源，但当前本地确定性回复没有执行受控 web.search 工具调用。我不会假装已经搜索过；你可以批准联网搜索，或让我基于已有上下文先做非实时分析。',
    dropped: ['web.search:not_executed']
  }
}

function currentCanvasQueryUnavailableResponse(): AgentResponse {
  return {
    type: 'answer',
    summary: '用户请求读取当前画布状态。',
    text: '这个请求需要通过 canvas.queryGraph 读取当前画布状态。当前本地确定性回复不会创建、连接或运行节点，也不会把只读查询误转换成生成任务。',
    dropped: ['canvas.queryGraph:not_executed']
  }
}

function requirementPlanningResponse(): AgentResponse {
  return {
    type: 'clarification',
    summary: '用户提出了系统能力或产品方案设计请求。',
    question: '我可以先做需求分析并制定实施计划。你希望我优先保证哪一个结果：自然聊天体验、联网搜索总结，还是当前画布的自动编排执行？',
    missing: ['成功标准', '执行边界', '是否允许改代码'],
    dropped: []
  }
}

function directSimpleCanvasPlan(message: string): CanvasPlan {
  if (/视频|video/iu.test(message)) {
    return {
      kind: 'plan',
      summary: `Directly create one video reference node for: ${message}`,
      nodes: [
        {
          ref: 'video-1',
          type: 'video',
          title: '视频节点',
          data: {
            label: '视频节点',
            promptOverride: message,
            modelId: 'stub-video',
            orientation: 'landscape',
            durationSeconds: 3,
            firstFrameAssetId: null,
            lastFrameAssetId: null,
            assetId: null,
            status: 'idle'
          }
        }
      ],
      edges: [],
      runSteps: [],
      question: null,
      dropped: []
    }
  }

  if (/图片|图像|image/iu.test(message)) {
    return {
      kind: 'plan',
      summary: `Directly create one image reference node for: ${message}`,
      nodes: [
        {
          ref: 'image-1',
          type: 'image',
          title: '图片节点',
          data: {
            label: '图片节点',
            promptOverride: message,
            modelId: 'stub-image',
            orientation: 'landscape',
            assetId: null,
            status: 'idle'
          }
        }
      ],
      edges: [],
      runSteps: [],
      question: null,
      dropped: []
    }
  }

  return {
    kind: 'plan',
    summary: `Directly create one text node for: ${message}`,
    nodes: [
      {
        ref: 'text-1',
        type: 'text',
        title: '文本节点',
        data: {
          label: '文本节点',
          content: message
        }
      }
    ],
    edges: [],
    runSteps: [],
    question: null,
    dropped: []
  }
}

function runTrace(run: StoredRun): Record<string, unknown> {
  const capabilityCheck = run.intentAnalysis
    ? {
        localCapabilities: run.intentAnalysis.localCapabilities,
        selectedAgentId: run.intentAnalysis.recommendedAgentId,
        executionMode: run.intentAnalysis.executionMode,
        complexity: run.intentAnalysis.complexity
      }
    : undefined

  return {
    messageId: run.messageId,
    ...(run.planId ? { planId: run.planId } : {}),
    ...(run.agentId ? { agentId: run.agentId } : {}),
    ...(run.jobId ? { jobId: run.jobId } : {}),
    ...(run.trigger ? { trigger: run.trigger } : {}),
    ...(run.errorClass ? { errorClass: run.errorClass } : {}),
    ...(run.droppedTools ? { droppedTools: run.droppedTools } : {}),
    ...(run.compactionSummary !== undefined ? { compactionSummary: run.compactionSummary } : {}),
    ...(run.omittedMessages !== undefined ? { omittedMessages: run.omittedMessages } : {}),
    ...(run.intentAnalysis ? { intentAnalysis: run.intentAnalysis } : {}),
    ...(capabilityCheck ? { capabilityCheck } : {}),
    ...(run.response && run.response.type !== 'canvasPlan' ? { response: run.response } : {}),
    ...(run.pendingApproval ? { pendingApproval: run.pendingApproval } : {}),
    ...(run.startedAt !== undefined ? { startedAt: run.startedAt } : {}),
    ...(run.completedAt !== undefined ? { completedAt: run.completedAt } : {}),
    ...(run.turnCount !== undefined ? { turnCount: run.turnCount } : {}),
    ...(run.usageSummary ? { usageSummary: run.usageSummary } : {})
  }
}

function responseText(response: AgentResponse): string | null {
  if (response.type === 'answer') {
    return response.text
  }

  if (response.type === 'clarification') {
    return response.question
  }

  return null
}

function terminalTurnContent(turn: ChatTurn, fallbackContent: string): string {
  for (let index = turn.blocks.length - 1; index >= 0; index -= 1) {
    const block = turn.blocks[index]
    if (block?.kind === 'text' && block.markdown.trim().length > 0) {
      return block.markdown
    }
    if (block?.kind === 'error' && block.message.trim().length > 0) {
      return block.message
    }
  }

  return fallbackContent
}

function persistTerminalAssistantTurn(
  options: {
    chatMessages?: ChatMessageRepository
    runSpine?: AgentRunSpine
    workflowId?: string
    clock: () => number
  },
  input: {
    runId: string
    messageId: string
    fallbackTurn: ChatTurn
    fallbackContent: string
  }
): void {
  if (!options.chatMessages) {
    return
  }

  const snapshot = options.runSpine?.getSnapshot(input.runId)
  const turn = snapshot
    ? projectAgentRunSnapshot(snapshot).chatTurn
    : input.fallbackTurn

  options.chatMessages.upsertAssistant({
    id: `${input.messageId}-assistant`,
    ...(options.workflowId ? { workflowId: options.workflowId } : {}),
    agentRunId: input.runId,
    role: 'assistant',
    content: terminalTurnContent(turn, input.fallbackContent),
    blocksJson: JSON.stringify(turn.blocks),
    createdAt: Math.max(options.clock(), turn.createdAt + 1)
  })
}

function matchingApproval(run: StoredRun, input: { callId: string }): AgentToolApprovalRequest | null {
  if (run.status !== 'approval_required' || !run.pendingApproval || !run.pausedState) {
    return null
  }

  if (run.pendingApproval.callId !== input.callId) {
    return null
  }

  return run.pendingApproval
}

function approvalPolicyError(state: AgentContextLoopState, message: string): AgentLoopTerminalError {
  return new AgentLoopTerminalError({
    errorClass: 'agent_approval_policy_changed',
    message,
    turnsUsed: state.turnCount,
    droppedTools: state.droppedTools,
    compactionSummary: state.compactionSummary,
    omittedMessages: state.omittedMessages
  })
}

function revalidateApprovalLoop(input: {
  run: StoredRun
  approval: AgentToolApprovalRequest
  agent: AgentDefinition
  availableTools: ToolDescriptor[]
}): AgentContextLoopState {
  const pausedState = input.run.pausedState
  const trigger = input.run.trigger
  if (!pausedState || !trigger || !input.agent.enabled) {
    throw approvalPolicyError(
      pausedState ?? {
        agentId: input.agent.id,
        trigger: trigger ?? 'manual',
        turnCount: 0,
        maxTurns: input.agent.maxTurns,
        transition: 'approval_required',
        systemPrompt: '',
        userMessage: '',
        allowedTools: [],
        droppedTools: [],
        messages: [],
        tokenEstimate: 0,
        compactionSummary: null,
        omittedMessages: 0,
        pendingToolCalls: [],
        additionalContext: ''
      },
      'Agent is disabled or no longer available for this approval.'
    )
  }

  const current = createAgentContextLoop({
    agent: input.agent,
    trigger,
    message: pausedState.userMessage,
    availableTools: input.availableTools
  })
  const approvedTool = current.allowedTools.find((tool) => tool.id === input.approval.toolId)
  if (!approvedTool) {
    throw approvalPolicyError(pausedState, 'The approved tool is no longer allowed by the current Agent policy.')
  }

  const approvedPermissionKinds = new Set(input.approval.requiredPermissions.map((permission) => permission.kind))
  if (approvedTool.permissions.some((permission) => !approvedPermissionKinds.has(permission.kind))) {
    throw approvalPolicyError(pausedState, 'The tool now requires permissions that were not included in the user approval.')
  }

  const currentById = new Map(current.allowedTools.map((tool) => [tool.id, tool]))
  const allowedTools = pausedState.allowedTools.flatMap((pausedTool) => {
    const currentTool = currentById.get(pausedTool.id)
    if (!currentTool) return []
    const pausedPermissionKinds = new Set(pausedTool.permissions.map((permission) => permission.kind))
    return currentTool.permissions.every((permission) => pausedPermissionKinds.has(permission.kind))
      ? [currentTool]
      : []
  })
  const resumedToolIds = new Set(allowedTools.map((tool) => tool.id))
  const execution = pausedState.execution
    ? {
        ...pausedState.execution,
        effectiveTools: pausedState.execution.effectiveTools.filter((toolId) => resumedToolIds.has(toolId)),
        effectiveSkills: input.agent.allowedSkills === '*'
          ? [...pausedState.execution.effectiveSkills]
          : pausedState.execution.effectiveSkills.filter((skillId) => input.agent.allowedSkills.includes(skillId))
      }
    : undefined

  return {
    ...pausedState,
    agentId: input.agent.id,
    trigger,
    maxTurns: input.agent.maxTurns,
    systemPrompt: current.systemPrompt,
    allowedTools,
    ...(execution ? { execution } : {}),
    droppedTools: [...new Set([...pausedState.droppedTools, ...current.droppedTools])],
    messages: pausedState.messages.map((message, index) => {
      return index === 0 && message.role === 'system'
        ? { role: 'system' as const, content: current.systemPrompt }
        : message
    })
  }
}

function approvalPayload(value: Record<string, unknown>): ApprovalResumePayload | null {
  if (value.resumeKind !== 'approval') {
    return null
  }

  if (
    typeof value.runId !== 'string'
    || typeof value.messageId !== 'string'
    || typeof value.message !== 'string'
    || typeof value.agentId !== 'string'
    || typeof value.trigger !== 'string'
    || typeof value.approvedBy !== 'string'
    || typeof value.approval !== 'object'
    || value.approval === null
  ) {
    return null
  }

  const approval = value.approval as AgentToolApprovalRequest
  const approvalScope: PermissionGrantScope = value.approvalScope === 'once'
    || value.approvalScope === 'run'
    || value.approvalScope === 'session'
    ? value.approvalScope
    : 'session'

  return {
    kind: 'approval',
    runId: value.runId,
    messageId: value.messageId,
    message: value.message,
    agentId: value.agentId,
    trigger: value.trigger as AgentTriggerKind,
    approval,
    approvedBy: value.approvedBy,
    approvalScope,
    ...(typeof value.approvalSessionId === 'string' ? { approvalSessionId: value.approvalSessionId } : {})
  }
}

function plannerDraftToEvent(
  draft: OrchestratorPlannerDraft,
  runId: string,
  messageId: string
): OrchestratorEvent {
  if (draft.type === 'progress') {
    return { type: 'progress', runId, message: draft.message, progress: draft.progress }
  }

  if (draft.type === 'toolStarted') {
    return {
      type: 'toolStarted',
      runId,
      messageId,
      callId: draft.callId,
      toolId: draft.toolId,
      inputSummary: draft.inputSummary
    }
  }

  if (draft.type === 'toolCompleted') {
    return {
      type: 'toolCompleted',
      runId,
      messageId,
      callId: draft.callId,
      toolId: draft.toolId,
      invocationId: draft.invocationId,
      status: draft.status,
      summary: draft.summary
    }
  }

  return {
    type: 'permissionRequired',
    runId,
    messageId,
    callId: draft.callId,
    toolId: draft.toolId,
    reason: draft.reason,
    requiredPermissions: draft.requiredPermissions
  }
}

async function* plannerEvents(options: OrchestratorRunOptions): AsyncGenerator<OrchestratorEvent, AgentResponse> {
  const input: OrchestratorPlannerInput = {
    runId: options.runId,
    messageId: options.messageId,
    message: options.message,
    agentId: options.agentId
  }

  if (options.agent) {
    input.agent = options.agent
  }

  if (options.trigger) {
    input.trigger = options.trigger
  }

  if (options.loop) {
    input.loop = options.loop
  }

  if (options.onDelta) {
    input.onDelta = options.onDelta
  }

  const proposed = options.planner.proposePlan(input)

  if (isAsyncIterable(proposed)) {
    let next = await proposed.next()

    while (!next.done) {
      yield plannerDraftToEvent(next.value, options.runId, options.messageId)
      next = await proposed.next()
    }

    return normalizeAgentResponse(next.value)
  }

  return normalizeAgentResponse(await proposed)
}

async function* approvalPlannerEvents(options: OrchestratorRunOptions & {
  agent: AgentDefinition
  trigger: AgentTriggerKind
  loop: AgentContextLoopState
  approval: AgentToolApprovalRequest
  approvedBy: string
  approvalScope: PermissionGrantScope
}): AsyncGenerator<OrchestratorEvent, AgentResponse> {
  if (!options.planner.resumeApprovedTool) {
    throw new Error('agent_approval_resume_unavailable')
  }

  const proposed = options.planner.resumeApprovedTool({
    runId: options.runId,
    messageId: options.messageId,
    message: options.message,
    agentId: options.agentId,
    agent: options.agent,
    trigger: options.trigger,
    loop: options.loop,
    approval: options.approval,
    approvedBy: options.approvedBy,
    approvalScope: options.approvalScope
  })

  if (isAsyncIterable(proposed)) {
    let next = await proposed.next()

    while (!next.done) {
      yield plannerDraftToEvent(next.value, options.runId, options.messageId)
      next = await proposed.next()
    }

    return normalizeAgentResponse(next.value)
  }

  return normalizeAgentResponse(await proposed)
}

/**
 * Creates the built-in planner used when no model-backed planner has been
 * configured yet. It deliberately emits the accepted ComicCanvas migration
 * vocabulary instead of a one-node demo for comic-drama requests.
 * @returns The default deterministic orchestrator planner.
 * @see docs/api-contracts/canvas-plan.md
 */
export function createDefaultOrchestratorPlanner(): OrchestratorPlanner {
  return {
    proposePlan(input): AgentResponse {
      const message = input.message.trim()
      const analysis = analyzeAgentIntent(message)
      const isCurrentCanvasRead = /(查一下|查询|查看|看看|列出|读取).*(当前画布|这个画布|本画布|当前工作流|这个工作流|本工作流|节点|连线).*(有哪些|多少|列表|数量|状态|关系)|(?:list|query|inspect|read).*(current\s*canvas|nodes|edges|workflow|graph)/iu.test(message)

      if (analysis.kind === 'smallTalk') return smallTalkResponse(message)
      if (analysis.kind === 'generalChat') return generalQuestionResponse(message)
      if (analysis.kind === 'searchSummary') return searchUnavailableResponse()
      if (analysis.kind === 'requirementPlanning') return requirementPlanningResponse()
      if (analysis.kind !== 'canvasOperation') {
        return clarificationResponse(
          analysis.summary,
          '请补充你希望我完成的任务类型：聊天、联网总结、需求分析，或操作当前画布。',
          analysis.missing,
          []
        )
      }

      const wantsComicDrama = /漫画|短剧|角色|场景|配音|音频|合成|comic|drama|storyboard|episode|voice/i.test(message)

      if (isCurrentCanvasRead) {
        return currentCanvasQueryUnavailableResponse()
      }

      if (analysis.executionMode === 'direct') {
        return responseFromCanvasPlan(directSimpleCanvasPlan(message))
      }

      if (!wantsComicDrama) {
        return responseFromCanvasPlan({
          kind: 'plan',
          summary: `Create an image generation workflow for: ${message}`,
          nodes: [
            {
              ref: 'prompt-1',
              type: 'text',
              title: '提示词',
              data: {
                content: message
              }
            },
            {
              ref: 'image-1',
              type: 'imageConfigV2',
              title: '生成图片',
              data: {
                promptOverride: message,
                modelId: 'stub-image',
                orientation: 'landscape'
              }
            }
          ],
          edges: [{ source: 'prompt-1', target: 'image-1', edgeType: 'promptOrder' }],
          runSteps: [{ ref: 'image-1', action: 'imageRun' }],
          question: null,
          dropped: []
        })
      }

      return responseFromCanvasPlan({
        kind: 'plan',
        summary: `Create a comic-drama canvas workflow for: ${message}`,
        nodes: [
          {
            ref: 'story',
            type: 'text',
            title: '故事需求',
            data: {
              content: message
            }
          },
          {
            ref: 'character',
            type: 'character',
            title: '主角',
            data: {
              description: '从用户需求中提炼主角外观、身份、情绪和服装。'
            }
          },
          {
            ref: 'scene',
            type: 'scene',
            title: '场景',
            data: {
              description: '从用户需求中提炼环境、时间、氛围和关键道具。',
              category: 'exterior'
            }
          },
          {
            ref: 'key-image',
            type: 'imageConfigV2',
            title: '关键画面生成',
            data: {
              promptOverride: message,
              modelId: 'stub-image',
              orientation: 'landscape',
              status: 'idle'
            }
          },
          {
            ref: 'video-gen',
            type: 'videoConfigV2',
            title: '短视频生成',
            data: {
              promptOverride: message,
              modelId: 'stub-video',
              orientation: 'landscape',
              durationSeconds: 5,
              firstFrameAssetId: null,
              lastFrameAssetId: null,
              assetId: null,
              status: 'idle'
            }
          },
          {
            ref: 'voice',
            type: 'audio',
            title: '配音/环境声',
            data: {
              assetId: null,
              durationSeconds: 8,
              status: 'idle'
            }
          },
          {
            ref: 'compose',
            type: 'videoCompose',
            title: '视频合成',
            data: {
              inputOrder: [],
              transitionName: 'crossfade',
              modelId: 'local-compose',
              assetId: null,
              status: 'idle'
            }
          },
          {
            ref: 'mux',
            type: 'muxAudioVideo',
            title: '音视频合成',
            data: {
              modelId: 'local-mux',
              assetId: null,
              status: 'idle'
            }
          }
        ],
        edges: [
          { source: 'story', target: 'character', edgeType: 'promptOrder' },
          { source: 'story', target: 'scene', edgeType: 'promptOrder' },
          { source: 'story', target: 'key-image', edgeType: 'promptOrder' },
          { source: 'character', target: 'key-image', edgeType: 'default' },
          { source: 'scene', target: 'key-image', edgeType: 'default' },
          { source: 'key-image', target: 'video-gen', edgeType: 'imageRole', imageRole: 'first_frame' },
          { source: 'video-gen', target: 'compose', edgeType: 'default' },
          { source: 'voice', target: 'mux', edgeType: 'default' },
          { source: 'compose', target: 'mux', edgeType: 'default' }
        ],
        runSteps: [
          { ref: 'key-image', action: 'imageRun' },
          { ref: 'video-gen', action: 'videoRun' }
        ],
        question: null,
        dropped: []
      })
    }
  }
}

/**
 * Runs one orchestrator turn as an AsyncGenerator state machine.
 * @param options - Run IDs, user message, planner, and plan ID dependency.
 * @returns Final run result containing the produced CanvasPlan.
 * @throws Error when the planner fails or returns an invalid plan.
 * @see docs/api-contracts/agents.md
 */
export async function* runOrchestrator(options: OrchestratorRunOptions): AsyncGenerator<OrchestratorEvent, OrchestratorRunResult> {
  let state: 'start' | 'planning' | 'completed' = 'start'
  let response: AgentResponse | undefined
  let planId: string | undefined

  while (true) {
    if (state === 'start') {
      yield { type: 'progress', runId: options.runId, message: 'Starting orchestration', progress: 5 }
      const analysis = analyzeAgentIntent(options.message)
      yield { type: 'progress', runId: options.runId, message: formatIntentProgress(analysis), progress: 15 }
      yield { type: 'progress', runId: options.runId, message: `检查本地能力：${analysis.localCapabilities.join('、')}`, progress: 25 }
      state = 'planning'
      continue
    }

    if (state === 'planning') {
      const stream = plannerEvents(options)
      let next = await stream.next()

      while (!next.done) {
        yield next.value
        next = await stream.next()
      }

      response = normalizeAgentResponse(next.value)
      if (response.type === 'canvasPlan') {
        const plan = sanitizePlan(response.plan)
        response = { type: 'canvasPlan', plan }
        planId = options.planIdFactory()
        yield { type: 'plan', runId: options.runId, messageId: options.messageId, planId, plan }
      } else {
        yield { type: 'response', runId: options.runId, messageId: options.messageId, response }
      }
      state = 'completed'
      continue
    }

    if (!response) {
      throw new Error('agent_run_failed')
    }

    return {
      runId: options.runId,
      messageId: options.messageId,
      response,
      ...(planId ? { planId } : {}),
      ...(response.type === 'canvasPlan' ? { plan: response.plan } : {})
    }
  }
}

export async function* runApprovalOrchestrator(options: OrchestratorRunOptions & {
  agent: AgentDefinition
  trigger: AgentTriggerKind
  loop: AgentContextLoopState
  approval: AgentToolApprovalRequest
  approvedBy: string
  approvalScope: PermissionGrantScope
}): AsyncGenerator<OrchestratorEvent, OrchestratorRunResult> {
  yield { type: 'progress', runId: options.runId, message: 'Resuming approved tool call', progress: 5 }
  const stream = approvalPlannerEvents(options)
  let next = await stream.next()

  while (!next.done) {
    yield next.value
    next = await stream.next()
  }

  const response = normalizeAgentResponse(next.value)
  if (response.type === 'canvasPlan') {
    const plan = sanitizePlan(response.plan)
    const planId = options.planIdFactory()
    yield { type: 'plan', runId: options.runId, messageId: options.messageId, planId, plan }

    return {
      runId: options.runId,
      messageId: options.messageId,
      response: { type: 'canvasPlan', plan },
      planId,
      plan
    }
  }

  yield { type: 'response', runId: options.runId, messageId: options.messageId, response }
  return {
    runId: options.runId,
    messageId: options.messageId,
    response
  }
}

async function consumeRunStream(
  stream: AsyncGenerator<OrchestratorEvent, OrchestratorRunResult>,
  options: {
    jobId: string
    events: JobEventBus
    plansByMessage: Map<string, CanvasPlan>
    chatMessages?: ChatMessageRepository
    planEvents?: CanvasPlanEventBus
    runSpine?: AgentRunSpine
    runsById: Map<string, StoredRun>
    persistRun: (run: StoredRun) => void
    rememberRun: (run: StoredRun) => void
    transaction: <T>(operation: () => T) => T
    agentId: string
    trigger: AgentTriggerKind
    workflowId?: string
    clock: () => number
  }
): Promise<OrchestratorRunResult> {
  let turnCount = 0
  let usageSummary: string | undefined
  let next = await stream.next()
  // 与渲染层同源的块组装：终态序列化进 chat_messages.blocks_json 供会话恢复。
  let persistedTurn: ChatTurn | null = null

  while (!next.done) {
    if (next.value.type === 'progress') {
      if (next.value.message.startsWith('用量：')) {
        usageSummary = next.value.message
      }
      if (!persistedTurn) {
        persistedTurn = createAssistantTurn({ id: 'pending', createdAt: Date.now() })
      }
      persistedTurn = applyAgentEvent(persistedTurn, { type: 'progress', message: next.value.message })
      options.runSpine?.appendEvent(next.value.runId, 'progress', {
        message: next.value.message,
        progress: next.value.progress
      })
      options.events.emitProgress({
        channel: 'job.progress',
        jobId: options.jobId,
        progress: next.value.progress,
        message: next.value.message,
        emittedAt: Date.now()
      })
    } else if (next.value.type === 'toolStarted') {
      turnCount += 1
      if (!persistedTurn) {
        persistedTurn = createAssistantTurn({ id: 'pending', createdAt: Date.now() })
      }
      persistedTurn = applyAgentEvent(persistedTurn, {
        type: 'toolStarted',
        callId: next.value.callId,
        toolId: next.value.toolId,
        inputSummary: next.value.inputSummary
      })
      options.runSpine?.appendEvent(next.value.runId, 'tool.started', {
        callId: next.value.callId,
        toolId: next.value.toolId,
        inputSummary: next.value.inputSummary
      })
      options.planEvents?.emitToolStarted({
        runId: next.value.runId,
        messageId: next.value.messageId,
        callId: next.value.callId,
        toolId: next.value.toolId,
        inputSummary: next.value.inputSummary
      })
    } else if (next.value.type === 'toolCompleted') {
      if (persistedTurn) {
        persistedTurn = applyAgentEvent(persistedTurn, {
          type: 'toolCompleted',
          callId: next.value.callId,
          toolId: next.value.toolId,
          status: next.value.status,
          summary: next.value.summary
        })
      }
      options.runSpine?.appendEvent(next.value.runId, 'tool.completed', {
        callId: next.value.callId,
        toolId: next.value.toolId,
        invocationId: next.value.invocationId,
        status: next.value.status,
        summary: next.value.summary
      })
      options.planEvents?.emitToolCompleted({
        runId: next.value.runId,
        messageId: next.value.messageId,
        callId: next.value.callId,
        toolId: next.value.toolId,
        invocationId: next.value.invocationId,
        status: next.value.status,
        summary: next.value.summary
      })
    } else if (next.value.type === 'permissionRequired') {
      if (persistedTurn) {
        persistedTurn = applyAgentEvent(persistedTurn, {
          type: 'permissionRequired',
          callId: next.value.callId,
          toolId: next.value.toolId,
          reason: next.value.reason,
          requiredPermissions: next.value.requiredPermissions
        })
      }
      options.runSpine?.appendEvent(next.value.runId, 'permission.requested', {
        callId: next.value.callId,
        toolId: next.value.toolId,
        reason: next.value.reason,
        requiredPermissions: next.value.requiredPermissions
      })
      options.planEvents?.emitPermissionRequired({
        runId: next.value.runId,
        messageId: next.value.messageId,
        callId: next.value.callId,
        toolId: next.value.toolId,
        reason: next.value.reason,
        requiredPermissions: next.value.requiredPermissions
      })
    }

    next = await stream.next()
  }

  if (!persistedTurn) {
    persistedTurn = createAssistantTurn({ id: 'pending', createdAt: Date.now() })
  }

  if (next.value.response.type === 'canvasPlan' && next.value.plan && next.value.planId) {
    persistedTurn = applyAgentEvent(persistedTurn, { type: 'planReady', planId: next.value.planId })
  } else {
    const response = next.value.response
    if (response.type === 'canvasPlan') {
      throw new Error('agent_canvas_plan_missing_terminal_metadata')
    }

    persistedTurn = applyAgentEvent(persistedTurn, { type: 'responseReady', response })
  }

  const previousRun = options.runsById.get(next.value.runId)
  const completedRun: StoredRun = {
    ...(previousRun ?? { runId: next.value.runId, messageId: next.value.messageId }),
    runId: next.value.runId,
    messageId: next.value.messageId,
    ...(next.value.planId ? { planId: next.value.planId } : {}),
    response: next.value.response,
    status: 'completed',
    agentId: options.agentId,
    trigger: options.trigger,
    ...(previousRun?.intentAnalysis ? { intentAnalysis: previousRun.intentAnalysis } : {}),
    ...(previousRun?.startedAt ? { startedAt: previousRun.startedAt } : {}),
    completedAt: options.clock(),
    turnCount,
    ...(usageSummary ? { usageSummary } : {})
  }
  delete completedRun.pendingApproval
  delete completedRun.pausedState
  delete completedRun.errorClass
  const fallbackContent = next.value.response.type === 'canvasPlan'
    ? next.value.response.plan.summary
    : responseText(next.value.response) ?? next.value.response.summary

  options.transaction(() => {
    options.persistRun(completedRun)

    if (next.value.response.type === 'canvasPlan' && next.value.plan && next.value.planId) {
      options.chatMessages?.updatePlan(next.value.messageId, JSON.stringify(next.value.plan), 'draft')
      options.runSpine?.appendEvent(next.value.runId, 'plan.ready', {
        messageId: next.value.messageId,
        planId: next.value.planId
      })
      options.runSpine?.saveArtifact({
        id: `artifact-${next.value.runId}-canvasPlan`,
        runId: next.value.runId,
        kind: 'canvasPlan',
        title: artifactTitleForResponse(next.value.response),
        summary: artifactSummaryForResponse(next.value.response),
        payload: next.value.plan,
        createdAt: options.clock()
      })
    } else {
      const response = next.value.response
      if (response.type === 'canvasPlan') {
        throw new Error('agent_canvas_plan_missing_terminal_metadata')
      }
      options.runSpine?.appendEvent(next.value.runId, 'response.ready', {
        messageId: next.value.messageId,
        response
      })
      options.runSpine?.saveArtifact({
        id: `artifact-${next.value.runId}-${response.type}`,
        runId: next.value.runId,
        kind: response.type,
        title: artifactTitleForResponse(response),
        summary: artifactSummaryForResponse(response),
        payload: response,
        createdAt: options.clock()
      })
    }

    options.runSpine?.updateRun({
      runId: next.value.runId,
      status: 'completed',
      pausedState: null,
      trace: { pendingApproval: null },
      errorClass: null,
      lastCheckpoint: 'run.completed',
      usage: usageSummary ? { summary: usageSummary } : {}
    })
    options.runSpine?.appendEvent(next.value.runId, 'run.completed', { status: 'completed' })
    persistTerminalAssistantTurn(options, {
      runId: next.value.runId,
      messageId: next.value.messageId,
      fallbackTurn: persistedTurn,
      fallbackContent
    })
  })
  options.rememberRun(completedRun)

  if (next.value.response.type === 'canvasPlan' && next.value.plan && next.value.planId) {
    options.plansByMessage.set(next.value.messageId, next.value.plan)
    options.planEvents?.emitPlanReady({ messageId: next.value.messageId, planId: next.value.planId })
  } else if (next.value.response.type !== 'canvasPlan') {
    options.planEvents?.emitResponseReady({
      runId: next.value.runId,
      messageId: next.value.messageId,
      response: next.value.response
    })
  }

  return next.value
}

/**
 * Creates the orchestrator runtime used by chat IPC and agent job workers.
 * @param options - Queue, event bus, planner, and deterministic ID dependencies.
 * @returns Runtime facade for chat submission, plan lookup, and job handling.
 * @throws Error never intentionally during construction; job handler failures propagate to JobWorker.
 * @see docs/api-contracts/agents.md
 */
export function createOrchestratorRuntime(options: OrchestratorRuntimeOptions): OrchestratorRuntime {
  const idFactory = options.idFactory ?? ((prefix: 'message' | 'run') => `${prefix}-${crypto.randomUUID()}`)
  const planIdFactory = options.planIdFactory ?? (() => `plan-${crypto.randomUUID()}`)
  const appSessionId = options.appSessionId ?? crypto.randomUUID()
  const clock = options.clock ?? Date.now
  const transaction = options.transaction ?? (<T>(operation: () => T) => operation())
  const plansByMessage = new Map<string, CanvasPlan>()
  const runsById = new Map<string, StoredRun>()

  function loadRun(runId: string): StoredRun | undefined {
    const current = runsById.get(runId)
    if (current) {
      return current
    }

    const persisted = options.agentRuns?.getById(runId)
    if (!persisted) {
      return undefined
    }

    const restored = restorePausedRun(persisted)
    if (restored) {
      runsById.set(runId, restored)
    }

    return restored ?? undefined
  }

  function persistRun(run: StoredRun): void {
    if (options.agentRuns) {
      const existing = options.agentRuns.getById(run.runId)
      const record = {
        id: run.runId,
        agentId: run.agentId ?? existing?.agentId ?? DEFAULT_CHAT_AGENT_ID,
        status: run.status,
        trace: {
          ...(existing?.trace ?? {}),
          ...runTrace(run),
          ...(!run.pendingApproval ? { pendingApproval: null } : {})
        },
        pausedState: run.pausedState ? { ...run.pausedState } : null,
        createdAt: existing?.createdAt ?? clock(),
        updatedAt: clock(),
        ...(run.jobId ? { jobId: run.jobId } : {}),
        ...(run.errorClass ? { errorClass: run.errorClass } : {})
      }

      options.agentRuns.upsert(record)
    }
  }

  function rememberRun(run: StoredRun): void {
    runsById.set(run.runId, run)
  }

  function reconcileApprovalChild(runId: string, status?: 'pending' | 'running' | 'completed' | 'failed' | 'aborted', errorClass?: string): void {
    const child = options.runSpine?.getSnapshot(runId)
    const parentRunId = child?.run.trace.parentRunId
    if (!child || typeof parentRunId !== 'string') return
    const parent = options.runSpine?.getSnapshot(parentRunId)
    const task = parent?.childTasks.find((candidate) => candidate.id === runId)
    if (!parent || !task || parent.run.trace.standaloneApprovalProxy !== true
      || parent.run.trace.approvalTargetRunId !== runId) return
    const childStatus = status ?? child.run.status
    if (childStatus === 'approval_required') return
    const artifactIds = child.artifacts.map((artifact) => artifact.id)
    const outputSummary = approvalChildOutputSummary(child, task.outputSummary ?? '')
    const completed = childStatus === 'completed'
    const terminal = completed || childStatus === 'failed' || childStatus === 'aborted'
    const resolved = child.events.find((event) => event.type === 'permission.resolved')
    const hasRootEvent = (type: 'permission.resolved' | 'child.completed' | 'child.failed' | 'run.completed' | 'run.failed'): boolean => {
      return parent.events.some((event) => event.type === type)
    }
    const nextErrorClass = errorClass ?? child.run.errorClass ?? 'agent_child_run_failed'
    transaction(() => {
      if (resolved && !hasRootEvent('permission.resolved')) {
        options.runSpine?.appendEvent(parentRunId, 'permission.resolved', resolved.payload)
      }
      if (task.status === 'approval_required' || (terminal && task.status !== childStatus)) {
        options.runSpine?.upsertChildTask({
          ...task, status: terminal ? childStatus : 'running', outputSummary, artifactIds,
          ...(terminal && !completed ? { errorClass: nextErrorClass } : {}), updatedAt: clock()
        })
      }
      if (terminal && !hasRootEvent(completed ? 'child.completed' : 'child.failed')) {
        options.runSpine?.appendEvent(parentRunId, completed ? 'child.completed' : 'child.failed', completed ? {
          childTaskId: runId, roleId: task.roleId, outputSummary, artifactIds
        } : {
          childTaskId: runId, roleId: task.roleId, errorClass: nextErrorClass,
          ...(outputSummary ? { outputSummary } : {}), artifactIds
        })
      }
      if (terminal) {
        options.runSpine?.updateRun({
          runId: parentRunId, status: childStatus, errorClass: completed ? null : nextErrorClass,
          trace: { pendingApproval: null }, lastCheckpoint: completed ? 'run.completed' : 'run.failed'
        })
        if (!hasRootEvent(completed ? 'run.completed' : 'run.failed')) {
          options.runSpine?.appendEvent(parentRunId, completed ? 'run.completed' : 'run.failed', completed
            ? { status: 'completed' }
            : { errorClass: nextErrorClass, message: 'Child agent run failed.', retryable: false, checkpoint: 'run.failed' })
        }
      } else {
        options.runSpine?.updateRun({ runId: parentRunId, status: 'running', lastCheckpoint: 'permission.resolved' })
      }
    })
  }

  function setRun(run: StoredRun): void {
    persistRun(run)
    rememberRun(run)
  }

  function createSpineRun(input: {
    runId: string
    messageId: string
    jobId: string
    agentId: string
    trigger: AgentTriggerKind
    intentAnalysis: AgentIntentAnalysis
  }): void {
    if (!options.runSpine) {
      return
    }

    const workflowId = options.workflowId ?? 'default'
    options.runSpine.createRun({
      runId: input.runId,
      threadId: workflowId,
      workflowId,
      messageId: input.messageId,
      jobId: input.jobId,
      agentId: input.agentId,
      trigger: input.trigger,
      policyProfileId: 'local-default'
    })
    options.runSpine.appendEvent(input.runId, 'intent.analyzed', { ...input.intentAnalysis })
  }

  function submitRun(input: {
    message: string
    agentId: string
    trigger: AgentTriggerKind
    requestedBy: string
    intentAnalysis: AgentIntentAnalysis
    contextPolicyOverride?: AgentRunRequest['contextPolicyOverride']
  }): { runId: string; messageId: string; jobId: string } {
    const messageId = idFactory('message')
    const runId = idFactory('run')
    const committed = transaction(() => {
      const ticket = options.queue.enqueue({
        type: 'agent.run',
        targetId: messageId,
        payload: {
          runId,
          messageId,
          message: input.message,
          agentId: input.agentId,
          trigger: input.trigger,
          ...(input.contextPolicyOverride ? { contextPolicyOverride: input.contextPolicyOverride } : {})
        },
        requestedBy: { type: 'user', id: input.requestedBy }
      })
      const run: StoredRun = {
        runId,
        messageId,
        status: 'pending',
        agentId: input.agentId,
        jobId: ticket.jobId,
        trigger: input.trigger,
        intentAnalysis: input.intentAnalysis
      }

      createSpineRun({
        runId,
        messageId,
        jobId: ticket.jobId,
        agentId: input.agentId,
        trigger: input.trigger,
        intentAnalysis: input.intentAnalysis
      })
      persistRun(run)
      options.chatMessages?.create({
        id: messageId,
        ...(options.workflowId ? { workflowId: options.workflowId } : {}),
        agentRunId: runId,
        role: 'user',
        content: input.message,
        createdAt: clock()
      })

      return { ticket, run }
    })

    runsById.set(runId, committed.run)
    return { runId, messageId, jobId: committed.ticket.jobId }
  }

  function persistRunFailure(
    runId: string,
    messageId: string,
    error: unknown
  ): StoredRun {
    const failedRun = runFailureTrace(runId, messageId, runsById.get(runId), error)
    const snapshot = options.runSpine?.getSnapshot(runId)
    if (!options.runSpine || !snapshot) {
      const failedTurn = applyAgentEvent(
        createAssistantTurn({
          id: `${runId}-assistant`,
          runId,
          messageId,
          createdAt: failedRun.startedAt ?? clock()
        }),
        {
          type: 'runFailed',
          errorClass: failedRun.errorClass ?? 'agent_run_failed',
          message: error instanceof Error ? error.message : 'Agent run failed.',
          retryable: false
        }
      )
      transaction(() => {
        persistRun(failedRun)
        persistTerminalAssistantTurn({
          ...(options.chatMessages ? { chatMessages: options.chatMessages } : {}),
          ...(options.workflowId ? { workflowId: options.workflowId } : {}),
          clock
        }, {
          runId,
          messageId,
          fallbackTurn: failedTurn,
          fallbackContent: error instanceof Error ? error.message : 'Agent run failed.'
        })
      })
      rememberRun(failedRun)
      return failedRun
    }

    if (failedRun.status === 'approval_required' && failedRun.pendingApproval) {
      const alreadyRecorded = snapshot.events.some((event) => {
        const eventPayload: unknown = event.payload
        if (event.type !== 'permission.requested' || !isRecord(eventPayload)) return false
        return eventPayload.callId === failedRun.pendingApproval?.callId
      })
      transaction(() => {
        persistRun(failedRun)
        options.runSpine?.updateRun({
          runId,
          status: failedRun.status,
          pausedState: failedRun.pausedState ? { ...failedRun.pausedState } : null,
          trace: {
            pendingApproval: failedRun.pendingApproval ?? null
          },
          ...(failedRun.errorClass ? { errorClass: failedRun.errorClass } : {}),
          lastCheckpoint: 'permission.requested'
        })
        if (!alreadyRecorded) {
          options.runSpine?.appendEvent(runId, 'permission.requested', {
            callId: failedRun.pendingApproval!.callId,
            toolId: failedRun.pendingApproval!.toolId,
            reason: failedRun.pendingApproval!.reason,
            requiredPermissions: failedRun.pendingApproval!.requiredPermissions
          })
        }
      })
      rememberRun(failedRun)
      return failedRun
    }

    const alreadyTerminal = snapshot.events.some((event) => event.type === 'run.failed' || event.type === 'run.completed')
    const failureMessage = error instanceof Error ? error.message : 'Agent run failed.'
    const fallbackTurn = applyAgentEvent(
      projectAgentRunSnapshot(snapshot).chatTurn,
      {
        type: 'runFailed',
        errorClass: failedRun.errorClass ?? 'agent_run_failed',
        message: failureMessage,
        retryable: false
      }
    )
    transaction(() => {
      persistRun(failedRun)
      options.runSpine?.updateRun({
        runId,
        status: failedRun.status,
        pausedState: null,
        trace: { pendingApproval: null },
        ...(failedRun.errorClass ? { errorClass: failedRun.errorClass } : {}),
        lastCheckpoint: 'run.failed'
      })
      if (!alreadyTerminal) {
        options.runSpine?.appendEvent(runId, 'run.failed', {
          errorClass: failedRun.errorClass ?? 'agent_run_failed',
          message: failureMessage,
          retryable: false,
          checkpoint: 'run.failed'
        })
      }
      persistTerminalAssistantTurn({
        ...(options.chatMessages ? { chatMessages: options.chatMessages } : {}),
        ...(options.runSpine ? { runSpine: options.runSpine } : {}),
        ...(options.workflowId ? { workflowId: options.workflowId } : {}),
        clock
      }, {
        runId,
        messageId,
        fallbackTurn,
        fallbackContent: failureMessage
      })
    })
    rememberRun(failedRun)
    reconcileApprovalChild(runId, failedRun.status === 'aborted' ? 'aborted' : 'failed', failedRun.errorClass)

    return failedRun
  }

  function projectedRunFields(
    runId: string
  ): Partial<Pick<AgentRunViewResponse, 'snapshot' | 'projection' | 'contextPack'>> {
    try {
      const snapshot = options.runSpine?.getSnapshot(runId)
      if (!snapshot) {
        return {}
      }

      const contextPack = snapshot.run.contextPackId
        ? options.knowledgeStore?.getContextPack(snapshot.run.contextPackId)
        : null
      return {
        snapshot,
        projection: projectAgentRunSnapshot(snapshot),
        ...(contextPack ? { contextPack } : {})
      }
    } catch {
      // Legacy or corrupt replay rows must not hide the basic run status response.
      return {}
    }
  }

  const runtime: OrchestratorRuntime = {
    chatSend(input) {
      const agentId = input.agentId ?? DEFAULT_CHAT_AGENT_ID
      const trigger = input.trigger ?? 'canvasChat'
      const intentAnalysis = analyzeAgentIntent(input.message)
      const submitted = submitRun({
        message: input.message,
        agentId,
        trigger,
        requestedBy: input.requestedBy,
        intentAnalysis
      })

      return {
        runId: submitted.runId,
        jobId: submitted.jobId,
        messageId: submitted.messageId,
        status: 'pending'
      }
    },
    agentRun(input) {
      const agent = options.registry ? options.registry.get(input.agentId) : fallbackOrchestratorAgent(input.agentId)
      const trigger = agent?.triggerPolicy.defaultTrigger ?? 'manual'
      const intentAnalysis = analyzeAgentIntent(input.message)
      const submitted = submitRun({
        message: input.message,
        agentId: input.agentId,
        trigger,
        requestedBy: 'agent.run',
        intentAnalysis,
        ...(input.contextPolicyOverride ? { contextPolicyOverride: input.contextPolicyOverride } : {})
      })

      return { runId: submitted.runId, jobId: submitted.jobId, status: 'pending' }
    },
    approveTool(input) {
      const proxy = options.agentRuns?.getById(input.runId)
      const targetRunId = proxy?.trace.standaloneApprovalProxy === true
        && typeof proxy.trace.approvalTargetRunId === 'string' ? proxy.trace.approvalTargetRunId : null
      if (targetRunId) {
        const target = options.agentRuns?.getById(targetRunId)
        const result = target?.status === 'approval_required'
          ? runtime.approveTool({ ...input, runId: targetRunId })
          : target?.status === 'pending' || target?.status === 'running'
            ? { runId: targetRunId, jobId: target.jobId ?? '', status: 'pending' as const }
            : approvalError('agent_approval_unavailable', 'Agent run is not waiting for this approval.')
        reconcileApprovalChild(targetRunId)
        if (target?.status === 'completed' || target?.status === 'failed' || target?.status === 'aborted') {
          return result
        }
        return result
      }
      const run = loadRun(input.runId)

      if (!run) {
        return options.agentRuns?.getById(input.runId)
          ? approvalError('agent_approval_unavailable', 'Agent run is not waiting for this approval.')
          : approvalError('agent_not_found', 'Agent run was not found.')
      }

      const approval = matchingApproval(run, input)

      if (!approval || !run.pausedState || !run.agentId || !run.trigger) {
        return approvalError('agent_approval_unavailable', 'Agent run is not waiting for this approval.')
      }

      const currentAgent = options.registry
        ? options.registry.get(run.agentId)
        : fallbackOrchestratorAgent(run.agentId)
      try {
        if (!currentAgent) {
          throw approvalPolicyError(run.pausedState, 'Agent is no longer available for this approval.')
        }
        revalidateApprovalLoop({
          run,
          approval,
          agent: currentAgent,
          availableTools: options.listTools?.() ?? []
        })
      } catch {
        return approvalError(
          'agent_approval_policy_changed',
          'Agent or tool policy changed after this approval was requested.'
        )
      }

      const requestedScope = input.scope ?? 'session'
      const approvalScope: PermissionGrantScope = approval.requiredPermissions.some((permission) => {
        return permission.kind === 'destructive'
      }) ? 'once' : requestedScope

      const committed = transaction(() => {
        const ticket = options.queue.enqueue({
          type: 'agent.run',
          targetId: run.messageId,
          payload: {
            resumeKind: 'approval',
            runId: run.runId,
            messageId: run.messageId,
            message: run.pausedState?.userMessage ?? '',
            agentId: run.agentId,
            trigger: run.trigger,
            approval,
            approvedBy: input.approvedBy,
            approvalScope,
            approvalSessionId: appSessionId
          },
          requestedBy: { type: 'user', id: input.approvedBy }
        })
        const nextRun: StoredRun = {
          ...run,
          status: 'pending',
          jobId: ticket.jobId
        }
        delete nextRun.errorClass

        options.runSpine?.appendEvent(run.runId, 'permission.resolved', {
          callId: input.callId,
          approvedByLabel: input.approvedBy,
          decision: 'approved',
          phase: 'queued',
          requestedScope: approvalScope
        })
        options.runSpine?.updateRun({
          runId: run.runId,
          status: 'pending',
          jobId: ticket.jobId,
          trace: {
            approvalQueued: {
              callId: input.callId,
              requestedScope: approvalScope,
              approvedByLabel: input.approvedBy
            }
          },
          errorClass: null,
          lastCheckpoint: 'permission.resolved'
        })
        persistRun(nextRun)
        return { ticket, nextRun }
      })

      runsById.set(run.runId, committed.nextRun)
      return { runId: run.runId, jobId: committed.ticket.jobId, status: 'pending' }
    },
    denyTool(input) {
      const proxy = options.agentRuns?.getById(input.runId)
      const targetRunId = proxy?.trace.standaloneApprovalProxy === true
        && typeof proxy.trace.approvalTargetRunId === 'string' ? proxy.trace.approvalTargetRunId : null
      if (targetRunId) {
        const target = options.agentRuns?.getById(targetRunId)
        const result = target?.status === 'approval_required'
          ? runtime.denyTool({ ...input, runId: targetRunId })
          : target?.status === 'aborted'
            ? { runId: targetRunId, status: 'aborted' as const, errorClass: 'agent_tool_denied' as const }
            : approvalError('agent_approval_unavailable', 'Agent run is not waiting for this approval.')
        reconcileApprovalChild(targetRunId)
        return result
      }
      const run = loadRun(input.runId)

      if (!run) {
        return options.agentRuns?.getById(input.runId)
          ? approvalError('agent_approval_unavailable', 'Agent run is not waiting for this approval.')
          : approvalError('agent_not_found', 'Agent run was not found.')
      }

      const approval = matchingApproval(run, input)
      if (!approval) {
        return approvalError('agent_approval_unavailable', 'Agent run is not waiting for this approval.')
      }

      const completedAt = clock()
      const deniedRun: StoredRun = {
        ...run,
        status: 'aborted',
        errorClass: 'agent_tool_denied',
        completedAt
      }
      delete deniedRun.pendingApproval
      delete deniedRun.pausedState

      try {
        if (options.runSpine) {
          transaction(() => {
            options.runSpine?.denyTool({
              runId: run.runId,
              callId: input.callId,
              deniedByLabel: input.deniedBy,
              completedAt
            })
            persistTerminalAssistantTurn({
              ...(options.chatMessages ? { chatMessages: options.chatMessages } : {}),
              ...(options.runSpine ? { runSpine: options.runSpine } : {}),
              ...(options.workflowId ? { workflowId: options.workflowId } : {}),
              clock
            }, {
              runId: run.runId,
              messageId: run.messageId,
              fallbackTurn: createAssistantTurn({
                id: `${run.runId}-assistant`,
                runId: run.runId,
                messageId: run.messageId,
                createdAt: completedAt
              }),
              fallbackContent: 'Tool call was denied by the user.'
            })
          })
          rememberRun(deniedRun)
        } else {
          const deniedTurn = applyAgentEvent(
            createAssistantTurn({
              id: `${run.runId}-assistant`,
              runId: run.runId,
              messageId: run.messageId,
              createdAt: completedAt
            }),
            {
              type: 'runFailed',
              errorClass: 'agent_tool_denied',
              message: 'Tool call was denied by the user.',
              retryable: false
            }
          )
          transaction(() => {
            persistRun(deniedRun)
            persistTerminalAssistantTurn({
              ...(options.chatMessages ? { chatMessages: options.chatMessages } : {}),
              ...(options.workflowId ? { workflowId: options.workflowId } : {}),
              clock
            }, {
              runId: run.runId,
              messageId: run.messageId,
              fallbackTurn: deniedTurn,
              fallbackContent: 'Tool call was denied by the user.'
            })
          })
          rememberRun(deniedRun)
        }
      } catch {
        // Keep the paused approval unchanged when its terminal ledger cannot be committed atomically.
        return denialPersistenceError()
      }

      return {
        runId: run.runId,
        status: 'aborted',
        errorClass: 'agent_tool_denied'
      }
    },
    getRun(runId) {
      const run = runsById.get(runId)

      if (!run) {
        const persisted = options.agentRuns?.getById(runId)

        if (!persisted) {
          return null
        }

        return {
          runId: persisted.id,
          status: persisted.status,
          trace: persisted.trace,
          ...projectedRunFields(persisted.id)
        }
      }

      return {
        runId: run.runId,
        status: run.status,
        trace: runTrace(run),
        ...projectedRunFields(run.runId)
      }
    },
    getPlan(messageId) {
      const storedPlan = plansByMessage.get(messageId)

      if (storedPlan) {
        return storedPlan
      }

      const planJson = options.chatMessages?.getById(messageId)?.planJson

      if (!planJson) {
        return null
      }

      try {
        return sanitizePlan(JSON.parse(planJson) as unknown)
      } catch {
        // Corrupt stored plan JSON must not leak parser errors through chatGetPlan.
        return null
      }
    },
    createJobHandler() {
      return async (job) => {
        const approval = approvalPayload(job.payload)

        if (approval) {
          const run = loadRun(approval.runId)
          const resolvedAgent = options.registry ? options.registry.get(approval.agentId) : fallbackOrchestratorAgent(approval.agentId)

          if (!run || !run.pausedState || !resolvedAgent) {
            throw new Error('agent_approval_unavailable')
          }

          try {
            const agent = resolvedAgent
            const loop = revalidateApprovalLoop({
              run,
              approval: approval.approval,
              agent,
              availableTools: options.listTools?.() ?? []
            })
            const approvalScope = approval.approvalScope === 'session'
              && approval.approvalSessionId !== appSessionId
              ? 'once'
              : approval.approvalScope
            const runningRun: StoredRun = {
              ...run,
              status: 'running',
              jobId: job.id,
              effectiveAgent: agent,
              pausedState: loop
            }
            transaction(() => {
              options.runSpine?.updateRun({
                runId: approval.runId,
                status: 'running',
                jobId: job.id,
                pausedState: { ...loop },
                trace: {
                  effectiveApprovalScope: approvalScope
                },
                errorClass: null,
                lastCheckpoint: 'approval.execution_started'
              })
              options.runSpine?.appendEvent(approval.runId, 'permission.resolved', {
                callId: approval.approval.callId,
                approvedByLabel: approval.approvedBy,
                decision: 'approved',
                phase: 'executing',
                scope: approvalScope
              })
              options.runSpine?.appendEvent(approval.runId, 'run.started', {
                status: 'running',
                jobId: job.id,
                resumedFromApproval: true
              })
              persistRun(runningRun)
            })
            runsById.set(run.runId, runningRun)

            const stream = runApprovalOrchestrator({
              runId: approval.runId,
              messageId: approval.messageId,
              message: approval.message,
              agentId: approval.agentId,
              agent,
              trigger: approval.trigger,
              loop,
              approval: approval.approval,
              approvedBy: approval.approvedBy,
              approvalScope,
              planner: options.planner,
              planIdFactory
            })
            const result = await consumeRunStream(stream, {
              jobId: job.id,
              events: options.events,
              plansByMessage,
              ...(options.chatMessages ? { chatMessages: options.chatMessages } : {}),
              ...(options.planEvents ? { planEvents: options.planEvents } : {}),
              ...(options.runSpine ? { runSpine: options.runSpine } : {}),
              runsById,
              persistRun,
              rememberRun,
              transaction,
              agentId: approval.agentId,
              trigger: approval.trigger,
              ...(options.workflowId ? { workflowId: options.workflowId } : {}),
              clock
            })
            reconcileApprovalChild(result.runId, 'completed')

            return {
              kind: 'agentRun',
              runId: result.runId,
              ...(result.planId ? { planId: result.planId } : {}),
              ...(result.response.type !== 'canvasPlan' ? { response: result.response } : {})
            }
          } catch (error) {
            persistRunFailure(approval.runId, approval.messageId, error)
            throw error
          }
        }

        const runId = typeof job.payload.runId === 'string' ? job.payload.runId : idFactory('run')
        const messageId = typeof job.payload.messageId === 'string' ? job.payload.messageId : job.id
        const message = typeof job.payload.message === 'string' ? job.payload.message : ''
        const agentId = typeof job.payload.agentId === 'string' ? job.payload.agentId : DEFAULT_CHAT_AGENT_ID
        const trigger = typeof job.payload.trigger === 'string' ? job.payload.trigger as AgentTriggerKind : 'canvasChat'
        const intentAnalysis = analyzeAgentIntent(message)
        const resolvedAgent = options.registry ? options.registry.get(agentId) : fallbackOrchestratorAgent(agentId)
        if (!resolvedAgent) {
          const error = new Error('agent_not_found')
          persistRunFailure(runId, messageId, error)
          throw error
        }
        const agent = applyContextPolicyOverride(resolvedAgent, job.payload)

        if (!agent || !agent.enabled || !agent.triggerPolicy.allowedTriggers.includes(trigger)) {
          const error = new Error('agent_not_found')
          persistRunFailure(runId, messageId, error)
          throw error
        }

        setRun({
          ...(runsById.get(runId) ?? { runId, messageId }),
          runId,
          messageId,
          status: 'running',
          agentId,
          trigger,
          intentAnalysis,
          effectiveAgent: agent,
          startedAt: clock()
        })
        options.runSpine?.updateRun({
          runId,
          status: 'running',
          jobId: job.id,
          errorClass: null,
          lastCheckpoint: 'run.started'
        })
        options.runSpine?.appendEvent(runId, 'run.started', {
          status: 'running',
          jobId: job.id
        })

        // Load recent workflow conversation so follow-up messages keep context.
        const history = options.chatMessages && options.workflowId
          ? options.chatMessages.listByWorkflowId(options.workflowId)
              .filter((record) => record.id !== messageId && (record.role === 'user' || record.role === 'assistant') && record.content.trim().length > 0)
              .slice(-10)
              .map((record) => ({ role: record.role as 'user' | 'assistant', content: record.content }))
          : []

        // Build a bounded context pack (canvas summary, asset hints, recent messages).
        const recentMessages = options.chatMessages && options.workflowId
          ? options.chatMessages.listByWorkflowId(options.workflowId)
              .filter((record) => record.id !== messageId && (record.role === 'user' || record.role === 'assistant'))
          : []
        const knowledgeChunks = agent.contextPolicy.includeKnowledge && options.knowledgeStore
          ? options.knowledgeStore.retrieve({
              query: message,
              scope: {
                projectId: options.workflowId ?? 'default',
                userApprovedSourceIds: [options.workflowId ?? 'default']
              },
              limit: 5,
              retrievalMode: 'lexical'
            }).map((chunk) => ({
              id: chunk.id,
              text: chunk.text,
              citation: chunk.citation,
              ...(chunk.score !== undefined ? { score: chunk.score } : {})
            }))
          : undefined
        const contextResult = buildAgentContext({
          agentId,
          policy: agent.contextPolicy,
          workflowId: options.workflowId ?? 'default',
          recentMessages,
          ...(knowledgeChunks ? { knowledgeChunks } : {}),
          ...(options.getCanvasGraph && agent.contextPolicy.includeCanvasGraph
            ? {
                canvas: {
                  graph: options.getCanvasGraph(options.workflowId),
                  ...(options.getSelectedNodeIds ? { selectedNodeIds: options.getSelectedNodeIds() } : {})
                }
              }
            : {}),
          tokenBudget: Math.floor(agent.contextPolicy.maxContextTokens * 0.4),
          clock
        })
        options.knowledgeStore?.saveContextPack(contextResult.pack)
        options.runSpine?.updateRun({
          runId,
          status: 'running',
          contextPackId: contextResult.pack.id,
          trace: {
            contextTokenEstimate: contextResult.tokenEstimate,
            contextMessagesIncluded: contextResult.messagesIncluded
          },
          lastCheckpoint: 'context.built'
        })
        options.runSpine?.appendEvent(runId, 'context.built', {
          contextPackId: contextResult.pack.id,
          tokenEstimate: contextResult.tokenEstimate,
          messagesIncluded: contextResult.messagesIncluded,
          sourceCount: contextResult.pack.sources.length,
          redactionCount: contextResult.pack.redactions.length
        })
        const skillContext = options.skillRegistry
          ? buildSkillContext(agent, options.skillRegistry, Math.floor(agent.contextPolicy.maxContextTokens * 0.2))
          : ''
        const additionalContext = [contextResult.rendered, skillContext].filter((section) => section.length > 0).join('\n\n')

        const loop = createAgentContextLoop({
          agent,
          trigger,
          message,
          availableTools: options.listTools?.() ?? [],
          ...(history.length > 0 ? { history } : {}),
          ...(additionalContext ? { additionalContext } : {})
        })

        // Build a delta callback that fans token deltas to the renderer in real time.
        const onDelta = options.planEvents || options.runSpine
          ? (delta: string) => {
              options.planEvents?.emitDelta({ runId, messageId, delta })
              options.runSpine?.appendEvent(runId, 'model.delta', { delta })
            }
          : undefined

        try {
          const stream = runOrchestrator({
            runId,
            messageId,
            message,
            agentId,
            agent,
            trigger,
            loop,
            ...(onDelta ? { onDelta } : {}),
            planner: options.planner,
            planIdFactory
          })
          const result = await consumeRunStream(stream, {
            jobId: job.id,
            events: options.events,
            plansByMessage,
            ...(options.chatMessages ? { chatMessages: options.chatMessages } : {}),
            ...(options.planEvents ? { planEvents: options.planEvents } : {}),
            ...(options.runSpine ? { runSpine: options.runSpine } : {}),
            runsById,
            persistRun,
            rememberRun,
            transaction,
            agentId,
            trigger,
            ...(options.workflowId ? { workflowId: options.workflowId } : {}),
            clock
          })

          return {
            kind: 'agentRun',
            runId,
            ...(result.planId ? { planId: result.planId } : {}),
            ...(result.response.type !== 'canvasPlan' ? { response: result.response } : {})
          }
        } catch (error) {
          persistRunFailure(runId, messageId, error)
          throw error
        }
      }
    }
  }
  return runtime
}
