/**
 * Pure Agent Run Spine projector used for live reconciliation and persisted replay.
 * @see docs/api-contracts/agents.md
 */

import type { AgentResponse } from './agents'
import type {
  AgentArtifactRecord,
  AgentArtifactViewBase,
  AgentArtifactViewModel,
  AgentCanvasPatchAction,
  AgentCanvasPatchEdgeChangeView,
  AgentCanvasPatchNodeChangeView,
  AgentCanvasPlanEdgeView,
  AgentCanvasPlanNodeView,
  AgentCanvasPlanRunStepView,
  AgentDiagnosticEntryView,
  AgentDiagnosticSeverity,
  AgentMemorySuggestionScope,
  AgentRunEventRecord,
  AgentRunProjection,
  AgentRunSnapshot,
  AgentSearchSourceView,
  RunInspectorModel
} from './agent-run-events'
import { applyAgentEvent, createAssistantTurn, type AgentChatEvent, type ChatTurn } from './chat-blocks'
import type { ToolPermission } from './tools'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
}

function optionalStringArray(value: unknown): string[] | null {
  if (value === undefined) {
    return []
  }

  return isStringArray(value) ? value : null
}

function artifactBase(artifact: AgentArtifactRecord): AgentArtifactViewBase {
  return {
    id: artifact.id,
    runId: artifact.runId,
    kind: artifact.kind,
    title: artifact.title,
    summary: artifact.summary,
    createdAt: artifact.createdAt
  }
}

const SENSITIVE_PAYLOAD_KEY_PARTS = [
  'token',
  'secret',
  'password',
  'apikey',
  'authorization',
  'cookie',
  'privatekey',
  'credential'
] as const
const INLINE_CREDENTIAL_FRAGMENT = /((?:authorization|auth[\s_-]*header|api[\s_-]*key|password|token|secret|cookie|private[\s_-]*key|credential)\s*[:=]\s*)(?:(["']?)(bearer|basic)\s+([^\s,;&"']+)\2|([^\s,;&]+))/giu
const BARE_BEARER_CREDENTIAL = /^([ \t]*Bearer[ \t]+)([A-Za-z0-9._~+/=-]{12,})([ \t]*)$/gimu
const PROVIDER_SECRET_KEY = /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/gu

function isSensitivePayloadKey(key: string): boolean {
  const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/gu, '')
  return SENSITIVE_PAYLOAD_KEY_PARTS.some((part) => normalizedKey.includes(part))
}

function redactCredentialFragments(value: string): string {
  return value
    .replace(INLINE_CREDENTIAL_FRAGMENT, (
      _match: string,
      prefix: string,
      quote: string,
      scheme: string | undefined
    ): string => {
      return scheme
        ? `${prefix}${quote}${scheme} [redacted]${quote}`
        : `${prefix}[redacted]`
    })
    .replace(BARE_BEARER_CREDENTIAL, '$1[redacted]$3')
    .replace(PROVIDER_SECRET_KEY, '[redacted]')
}

function payloadPreview(payload: unknown): string {
  const seen = new WeakSet<object>()

  try {
    const serialized = JSON.stringify(
      payload,
      (key: string, value: unknown): unknown => {
        if (isSensitivePayloadKey(key)) {
          return '[redacted]'
        }

        if (typeof value === 'string') {
          return redactCredentialFragments(value)
        }

        if (typeof value === 'bigint') {
          return `${value.toString()}n`
        }

        if (typeof value === 'undefined') {
          return '[undefined]'
        }

        if (typeof value === 'function') {
          return '[function]'
        }

        if (typeof value === 'symbol') {
          return value.toString()
        }

        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) {
            return '[circular]'
          }
          seen.add(value)
        }

        return value
      },
      2
    )
    const preview = serialized ?? String(payload)
    return preview.length > 12_000
      ? `${preview.slice(0, 12_000)}\n[preview truncated]`
      : preview
  } catch {
    // Unknown payloads may contain exotic host objects; keep the fallback inspectable.
    return Object.prototype.toString.call(payload)
  }
}

function fallbackArtifact(artifact: AgentArtifactRecord, reason: string): AgentArtifactViewModel {
  return {
    ...artifactBase(artifact),
    viewType: 'fallback',
    reason,
    payloadPreview: payloadPreview(artifact.payload)
  }
}

function malformedArtifact(artifact: AgentArtifactRecord): AgentArtifactViewModel {
  return fallbackArtifact(artifact, `${artifact.kind} payload 与类型化视图契约不匹配`)
}

function projectAnswerArtifact(artifact: AgentArtifactRecord): AgentArtifactViewModel {
  const data = artifact.payload
  if (!isRecord(data)
    || (data.type !== undefined && data.type !== 'answer')
    || typeof data.text !== 'string') {
    return malformedArtifact(artifact)
  }

  const dropped = optionalStringArray(data.dropped)
  if (!dropped) {
    return malformedArtifact(artifact)
  }

  return {
    ...artifactBase(artifact),
    viewType: 'answer',
    text: data.text,
    dropped
  }
}

function projectClarificationArtifact(artifact: AgentArtifactRecord): AgentArtifactViewModel {
  const data = artifact.payload
  if (!isRecord(data)
    || (data.type !== undefined && data.type !== 'clarification')
    || typeof data.question !== 'string') {
    return malformedArtifact(artifact)
  }

  const missing = optionalStringArray(data.missing)
  const dropped = optionalStringArray(data.dropped)
  if (!missing || !dropped) {
    return malformedArtifact(artifact)
  }

  return {
    ...artifactBase(artifact),
    viewType: 'clarification',
    question: data.question,
    missing,
    dropped
  }
}

function canvasPlanPayload(payload: unknown): Record<string, unknown> | null {
  if (!isRecord(payload)) {
    return null
  }

  if (payload.type === 'canvasPlan') {
    return isRecord(payload.plan) ? payload.plan : null
  }

  return payload
}

function canvasPlanNodes(value: unknown): AgentCanvasPlanNodeView[] | null {
  if (!Array.isArray(value)) {
    return null
  }

  const nodes: AgentCanvasPlanNodeView[] = []
  for (const entry of value) {
    if (!isRecord(entry)
      || typeof entry.ref !== 'string'
      || typeof entry.type !== 'string'
      || typeof entry.title !== 'string') {
      return null
    }
    nodes.push({ ref: entry.ref, type: entry.type, title: entry.title })
  }
  return nodes
}

function canvasPlanEdges(value: unknown): AgentCanvasPlanEdgeView[] | null {
  if (!Array.isArray(value)) {
    return null
  }

  const edges: AgentCanvasPlanEdgeView[] = []
  for (const entry of value) {
    if (!isRecord(entry)
      || typeof entry.source !== 'string'
      || typeof entry.target !== 'string'
      || typeof entry.edgeType !== 'string') {
      return null
    }
    edges.push({
      source: entry.source,
      target: entry.target,
      edgeType: entry.edgeType
    })
  }
  return edges
}

function canvasPlanRunSteps(value: unknown): AgentCanvasPlanRunStepView[] | null {
  if (!Array.isArray(value)) {
    return null
  }

  const runSteps: AgentCanvasPlanRunStepView[] = []
  for (const entry of value) {
    if (!isRecord(entry)
      || typeof entry.ref !== 'string'
      || typeof entry.action !== 'string') {
      return null
    }
    runSteps.push({ ref: entry.ref, action: entry.action })
  }
  return runSteps
}

function projectCanvasPlanArtifact(artifact: AgentArtifactRecord): AgentArtifactViewModel {
  const data = canvasPlanPayload(artifact.payload)
  if (!data
    || (data.kind !== 'plan' && data.kind !== 'clarify')
    || typeof data.summary !== 'string'
    || (data.question !== null && typeof data.question !== 'string')) {
    return malformedArtifact(artifact)
  }

  const nodes = canvasPlanNodes(data.nodes)
  const edges = canvasPlanEdges(data.edges)
  const runSteps = canvasPlanRunSteps(data.runSteps)
  const dropped = optionalStringArray(data.dropped)
  if (!nodes || !edges || !runSteps || !dropped) {
    return malformedArtifact(artifact)
  }

  return {
    ...artifactBase(artifact),
    viewType: 'canvasPlan',
    planKind: data.kind,
    planSummary: data.summary,
    ...(typeof data.question === 'string' ? { question: data.question } : {}),
    nodes,
    edges,
    runSteps,
    dropped
  }
}

function canvasPatchAction(value: unknown): AgentCanvasPatchAction | null {
  if (value === 'add' || value === 'added' || value === 'create') {
    return 'add'
  }
  if (value === 'update' || value === 'updated') {
    return 'update'
  }
  if (value === 'remove' || value === 'removed' || value === 'delete') {
    return 'remove'
  }
  return null
}

function canvasPatchNodeChanges(value: unknown): AgentCanvasPatchNodeChangeView[] | null {
  if (value === undefined) {
    return []
  }
  if (!Array.isArray(value)) {
    return null
  }

  const changes: AgentCanvasPatchNodeChangeView[] = []
  for (const entry of value) {
    if (!isRecord(entry) || typeof entry.ref !== 'string') {
      return null
    }
    const action = canvasPatchAction(entry.action)
    if (!action
      || (entry.type !== undefined && typeof entry.type !== 'string')
      || (entry.title !== undefined && typeof entry.title !== 'string')) {
      return null
    }
    changes.push({
      action,
      ref: entry.ref,
      ...(typeof entry.type === 'string' ? { type: entry.type } : {}),
      ...(typeof entry.title === 'string' ? { title: entry.title } : {})
    })
  }
  return changes
}

function canvasPatchEdgeChanges(value: unknown): AgentCanvasPatchEdgeChangeView[] | null {
  if (value === undefined) {
    return []
  }
  if (!Array.isArray(value)) {
    return null
  }

  const changes: AgentCanvasPatchEdgeChangeView[] = []
  for (const entry of value) {
    if (!isRecord(entry)
      || typeof entry.source !== 'string'
      || typeof entry.target !== 'string') {
      return null
    }
    const action = canvasPatchAction(entry.action)
    if (!action || (entry.edgeType !== undefined && typeof entry.edgeType !== 'string')) {
      return null
    }
    changes.push({
      action,
      source: entry.source,
      target: entry.target,
      ...(typeof entry.edgeType === 'string' ? { edgeType: entry.edgeType } : {})
    })
  }
  return changes
}

function projectCanvasPatchDraftArtifact(artifact: AgentArtifactRecord): AgentArtifactViewModel {
  const data = artifact.payload
  if (!isRecord(data) || (data.summary !== undefined && typeof data.summary !== 'string')) {
    return malformedArtifact(artifact)
  }

  const nodeChanges = canvasPatchNodeChanges(data.nodeChanges)
  const edgeChanges = canvasPatchEdgeChanges(data.edgeChanges)
  const warnings = optionalStringArray(data.warnings)
  if (!nodeChanges || !edgeChanges || !warnings) {
    return malformedArtifact(artifact)
  }

  return {
    ...artifactBase(artifact),
    viewType: 'canvasPatchDraft',
    patchSummary: typeof data.summary === 'string' ? data.summary : artifact.summary,
    nodeChanges,
    edgeChanges,
    warnings
  }
}

function searchSources(value: unknown): AgentSearchSourceView[] | null {
  if (value === undefined) {
    return []
  }
  if (!Array.isArray(value)) {
    return null
  }

  const sources: AgentSearchSourceView[] = []
  for (const entry of value) {
    if (!isRecord(entry)
      || (entry.title !== undefined && typeof entry.title !== 'string')
      || (entry.url !== undefined && typeof entry.url !== 'string')
      || (entry.citation !== undefined && typeof entry.citation !== 'string')
      || (entry.snippet !== undefined && typeof entry.snippet !== 'string')) {
      return null
    }
    const title = typeof entry.title === 'string'
      ? entry.title
      : (typeof entry.citation === 'string'
          ? entry.citation
          : (typeof entry.url === 'string' ? entry.url : null))
    if (!title) {
      return null
    }
    sources.push({
      title,
      ...(typeof entry.url === 'string' ? { url: entry.url } : {}),
      ...(typeof entry.citation === 'string' ? { citation: entry.citation } : {}),
      ...(typeof entry.snippet === 'string' ? { snippet: entry.snippet } : {})
    })
  }
  return sources
}

function projectSearchSummaryArtifact(artifact: AgentArtifactRecord): AgentArtifactViewModel {
  const data = artifact.payload
  if (!isRecord(data)
    || (data.query !== undefined && typeof data.query !== 'string')
    || (data.summary !== undefined && typeof data.summary !== 'string')) {
    return malformedArtifact(artifact)
  }

  const sources = searchSources(data.sources ?? data.results)
  const citations = optionalStringArray(data.citations)
  if (!sources || !citations) {
    return malformedArtifact(artifact)
  }

  return {
    ...artifactBase(artifact),
    viewType: 'searchSummary',
    ...(typeof data.query === 'string' ? { query: data.query } : {}),
    searchSummary: typeof data.summary === 'string' ? data.summary : artifact.summary,
    sources,
    citations
  }
}

function memorySuggestionScope(value: unknown): AgentMemorySuggestionScope | null {
  if (value === 'user' || value === 'workflow' || value === 'agentRole') {
    return value
  }
  if (value === 'agent-role') {
    return 'agentRole'
  }
  return null
}

function projectMemorySuggestionArtifact(artifact: AgentArtifactRecord): AgentArtifactViewModel {
  const data = artifact.payload
  if (!isRecord(data)
    || typeof data.content !== 'string'
    || (data.rationale !== undefined && typeof data.rationale !== 'string')) {
    return malformedArtifact(artifact)
  }

  const scope = memorySuggestionScope(data.scope)
  if (!scope) {
    return malformedArtifact(artifact)
  }

  return {
    ...artifactBase(artifact),
    viewType: 'memorySuggestion',
    scope,
    content: data.content,
    ...(typeof data.rationale === 'string' ? { rationale: data.rationale } : {}),
    confirmationState: 'pending'
  }
}

function diagnosticSeverity(value: unknown): AgentDiagnosticSeverity | null {
  return value === 'info' || value === 'warning' || value === 'error'
    ? value
    : null
}

function diagnosticEntries(
  value: unknown,
  defaultSeverity: AgentDiagnosticSeverity
): AgentDiagnosticEntryView[] | null {
  if (!Array.isArray(value)) {
    return null
  }

  const diagnostics: AgentDiagnosticEntryView[] = []
  for (const entry of value) {
    if (!isRecord(entry)
      || typeof entry.code !== 'string'
      || typeof entry.message !== 'string'
      || (entry.path !== undefined && typeof entry.path !== 'string')) {
      return null
    }
    const severity = entry.severity === undefined
      ? defaultSeverity
      : diagnosticSeverity(entry.severity)
    if (!severity) {
      return null
    }
    diagnostics.push({
      code: entry.code,
      severity,
      message: entry.message,
      ...(typeof entry.path === 'string' ? { path: entry.path } : {}),
      ...(entry.details !== undefined ? { detailsPreview: payloadPreview(entry.details) } : {})
    })
  }
  return diagnostics
}

function projectDiagnosticArtifact(artifact: AgentArtifactRecord): AgentArtifactViewModel {
  const data = artifact.payload
  if (!isRecord(data)) {
    return malformedArtifact(artifact)
  }

  const severity = data.severity === undefined
    ? 'info'
    : diagnosticSeverity(data.severity)
  if (!severity) {
    return malformedArtifact(artifact)
  }

  const diagnostics = diagnosticEntries(data.diagnostics, severity)
  if (!diagnostics) {
    return malformedArtifact(artifact)
  }

  return {
    ...artifactBase(artifact),
    viewType: 'diagnostics',
    severity,
    diagnostics
  }
}

/**
 * Projects one unknown persisted artifact payload into a safe renderer view.
 * @param artifact - Durable artifact record with untrusted JSON payload.
 * @returns Typed read-only view or a diagnostic fallback.
 */
export function projectAgentArtifact(artifact: AgentArtifactRecord): AgentArtifactViewModel {
  switch (artifact.kind) {
    case 'answer':
      return projectAnswerArtifact(artifact)
    case 'clarification':
      return projectClarificationArtifact(artifact)
    case 'canvasPlan':
      return projectCanvasPlanArtifact(artifact)
    case 'canvasPatchDraft':
      return projectCanvasPatchDraftArtifact(artifact)
    case 'searchSummary':
      return projectSearchSummaryArtifact(artifact)
    case 'memorySuggestion':
      return projectMemorySuggestionArtifact(artifact)
    case 'diagnosticReport':
      return projectDiagnosticArtifact(artifact)
    case 'draftGraph':
    case 'assetReference':
    case 'runExport':
      return fallbackArtifact(artifact, `${artifact.kind} 暂无专用只读视图`)
  }
}

/**
 * Projects artifact records in stable creation order for live and replay views.
 * @param artifacts - Durable artifact records from one Agent run.
 * @returns Deterministic typed artifact view models.
 */
export function projectAgentArtifacts(artifacts: AgentArtifactRecord[]): AgentArtifactViewModel[] {
  return [...artifacts]
    .sort((left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id))
    .map(projectAgentArtifact)
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

function isAgentResponse(value: unknown): value is AgentResponse {
  if (!isRecord(value)) {
    return false
  }

  if (value.type === 'answer') {
    return typeof value.summary === 'string'
      && typeof value.text === 'string'
      && isStringArray(value.dropped)
  }

  if (value.type === 'clarification') {
    return typeof value.summary === 'string'
      && typeof value.question === 'string'
      && isStringArray(value.missing)
      && isStringArray(value.dropped)
  }

  if (value.type === 'canvasPlan') {
    const plan = value.plan
    return isRecord(plan)
      && (plan.kind === 'plan' || plan.kind === 'clarify')
      && typeof plan.summary === 'string'
      && Array.isArray(plan.nodes)
      && Array.isArray(plan.edges)
      && Array.isArray(plan.runSteps)
      && (plan.question === null || typeof plan.question === 'string')
      && isStringArray(plan.dropped)
  }

  return false
}

function payload(event: AgentRunEventRecord): Record<string, unknown> {
  return isRecord(event.payload) ? event.payload : {}
}

function permissionDecision(data: Record<string, unknown>): 'approved' | 'denied' {
  if (data.decision === 'denied' || typeof data.deniedByLabel === 'string') {
    return 'denied'
  }

  return 'approved'
}

function orderedEvents(snapshot: AgentRunSnapshot): AgentRunEventRecord[] {
  return [...snapshot.events].sort((left, right) => left.sequence - right.sequence)
}

function toChatEvent(event: AgentRunEventRecord): AgentChatEvent | null {
  const data = payload(event)

  switch (event.type) {
    case 'progress':
      return typeof data.message === 'string' ? { type: 'progress', message: data.message } : null
    case 'model.delta':
      return typeof data.delta === 'string' ? { type: 'delta', delta: data.delta } : null
    case 'tool.started':
      return typeof data.callId === 'string' && typeof data.toolId === 'string'
        ? {
            type: 'toolStarted',
            callId: data.callId,
            toolId: data.toolId,
            inputSummary: typeof data.inputSummary === 'string' ? data.inputSummary : ''
          }
        : null
    case 'tool.completed':
      return typeof data.callId === 'string'
        && typeof data.toolId === 'string'
        && typeof data.summary === 'string'
        ? {
            type: 'toolCompleted',
            callId: data.callId,
            toolId: data.toolId,
            status: data.status === 'failed' || data.status === 'denied' ? data.status : 'completed',
            summary: data.summary
          }
        : null
    case 'permission.requested':
      if (typeof data.callId === 'string'
        && typeof data.toolId === 'string'
        && typeof data.reason === 'string') {
        const requiredPermissions = toolPermissions(data.requiredPermissions)
        return {
          type: 'permissionRequired',
          callId: data.callId,
          toolId: data.toolId,
          reason: data.reason,
          ...(requiredPermissions ? { requiredPermissions } : {})
        }
      }
      return null
    case 'permission.resolved':
      if (typeof data.callId !== 'string') return null
      return {
        type: 'permissionResolved',
        callId: data.callId,
        decision: permissionDecision(data),
        ...(data.scope === 'once' || data.scope === 'run' || data.scope === 'session'
          ? { scope: data.scope }
          : {})
      }
    case 'response.ready':
      return isAgentResponse(data.response)
        ? { type: 'responseReady', response: data.response }
        : null
    case 'plan.ready':
      return typeof data.planId === 'string'
        ? { type: 'planReady', planId: data.planId }
        : null
    case 'run.failed':
      return typeof data.errorClass === 'string' && typeof data.message === 'string'
        ? {
            type: 'runFailed',
            errorClass: data.errorClass,
            message: data.message,
            retryable: data.retryable === true
          }
        : null
    case 'child.started':
    case 'child.completed':
    case 'child.failed':
      return null
    default:
      return null
  }
}

function reconcileTurnStatus(turn: ChatTurn, snapshot: AgentRunSnapshot): ChatTurn {
  switch (snapshot.run.status) {
    case 'completed':
      return { ...turn, status: 'completed' }
    case 'failed':
    case 'aborted':
    case 'max_turns_exceeded':
      return { ...turn, status: 'failed' }
    case 'running':
    case 'approval_required':
      return turn.status === 'pending' ? { ...turn, status: 'streaming' } : turn
    case 'pending':
      return turn
  }
}

function projectChatTurn(snapshot: AgentRunSnapshot): ChatTurn {
  const turn = createAssistantTurn({
    id: `${snapshot.run.id}-assistant`,
    runId: snapshot.run.id,
    messageId: snapshot.run.messageId,
    createdAt: snapshot.run.createdAt
  })
  const projected = orderedEvents(snapshot).reduce((current, event) => {
    const chatEvent = toChatEvent(event)
    return chatEvent ? applyAgentEvent(current, chatEvent) : current
  }, turn)

  return reconcileTurnStatus(projected, snapshot)
}

function projectInspector(
  snapshot: AgentRunSnapshot,
  artifacts: AgentArtifactViewModel[]
): RunInspectorModel {
  const events = orderedEvents(snapshot)
  const tools: RunInspectorModel['tools'] = []
  const permissions: RunInspectorModel['permissions'] = []
  let error: RunInspectorModel['error'] | undefined

  for (const event of events) {
    const data = payload(event)

    if (event.type === 'tool.started' && typeof data.callId === 'string' && typeof data.toolId === 'string') {
      const existing = tools.find((entry) => entry.callId === data.callId)
      if (existing) {
        existing.toolId = data.toolId
        existing.status = 'running'
      } else {
        tools.push({ callId: data.callId, toolId: data.toolId, status: 'running' })
      }
    }

    if (event.type === 'tool.completed' && typeof data.callId === 'string') {
      let tool = tools.find((entry) => entry.callId === data.callId)
      if (!tool && typeof data.toolId === 'string') {
        tool = { callId: data.callId, toolId: data.toolId, status: 'completed' }
        tools.push(tool)
      }
      if (tool) {
        tool.status = typeof data.status === 'string' ? data.status : 'completed'
        if (typeof data.summary === 'string') tool.summary = data.summary
      }
    }

    if (event.type === 'permission.requested'
      && typeof data.callId === 'string'
      && typeof data.toolId === 'string'
      && typeof data.reason === 'string') {
      const existing = permissions.find((entry) => entry.callId === data.callId)
      if (existing) {
        existing.toolId = data.toolId
        existing.reason = data.reason
        existing.resolved = false
      } else {
        permissions.push({
          callId: data.callId,
          toolId: data.toolId,
          reason: data.reason,
          resolved: false
        })
      }
    }

    if (event.type === 'permission.resolved' && typeof data.callId === 'string') {
      const permission = permissions.find((entry) => entry.callId === data.callId)
      if (permission) {
        permission.resolved = true
        permission.decision = permissionDecision(data)
      }
    }

    if (event.type === 'run.failed'
      && typeof data.errorClass === 'string'
      && typeof data.message === 'string') {
      error = {
        errorClass: data.errorClass,
        message: data.message,
        retryable: data.retryable === true
      }
    }
  }

  const latestEventType = events.at(-1)?.type

  return {
    runId: snapshot.run.id,
    status: snapshot.run.status,
    agentId: snapshot.run.agentId,
    workflowId: snapshot.run.workflowId,
    trigger: snapshot.run.trigger,
    modelLabel: [snapshot.run.gatewayId, snapshot.run.modelId].filter(Boolean).join('/') || 'local',
    ...(latestEventType ? { latestEventType } : {}),
    tools,
    permissions,
    artifacts: artifacts.map((artifact) => ({
      id: artifact.id,
      kind: artifact.kind,
      title: artifact.title,
      summary: artifact.summary
    })),
    childTasks: [...snapshot.childTasks]
      .sort((left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id))
      .map((task) => ({
        id: task.id,
        parentRunId: task.parentRunId,
        roleId: task.roleId,
        status: task.status,
        summary: task.outputSummary ?? task.inputSummary,
        artifactIds: task.artifactIds,
        ...(task.errorClass ? { errorClass: task.errorClass } : {})
      })),
    ...(error ? { error } : {})
  }
}

/**
 * Projects one durable Agent run snapshot into chat, task tree, and inspector views.
 * @param snapshot - Persisted run state and append-only events.
 * @returns Deterministic renderer-facing projection.
 * @see docs/api-contracts/agents.md
 */
export function projectAgentRunSnapshot(snapshot: AgentRunSnapshot): AgentRunProjection {
  const artifacts = projectAgentArtifacts(snapshot.artifacts)
  const inspector = projectInspector(snapshot, artifacts)

  return {
    chatTurn: projectChatTurn(snapshot),
    taskTree: inspector.childTasks,
    inspector,
    artifacts
  }
}
