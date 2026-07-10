/**
 * Pure Agent Run Spine projector used for live reconciliation and persisted replay.
 * @see docs/api-contracts/agents.md
 */

import type { AgentResponse } from './agents'
import type {
  AgentRunEventRecord,
  AgentRunProjection,
  AgentRunSnapshot,
  RunInspectorModel
} from './agent-run-events'
import { applyAgentEvent, createAssistantTurn, type AgentChatEvent, type ChatTurn } from './chat-blocks'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
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
      return typeof data.callId === 'string'
        && typeof data.toolId === 'string'
        && typeof data.reason === 'string'
        ? {
            type: 'permissionRequired',
            callId: data.callId,
            toolId: data.toolId,
            reason: data.reason
          }
        : null
    case 'permission.resolved':
      return typeof data.callId === 'string'
        ? { type: 'permissionResolved', callId: data.callId }
        : null
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

function projectInspector(snapshot: AgentRunSnapshot): RunInspectorModel {
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
      if (permission) permission.resolved = true
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
    artifacts: snapshot.artifacts.map((artifact) => ({
      id: artifact.id,
      kind: artifact.kind,
      title: artifact.title,
      summary: artifact.summary
    })),
    childTasks: snapshot.childTasks.map((task) => ({
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
  const inspector = projectInspector(snapshot)

  return {
    chatTurn: projectChatTurn(snapshot),
    taskTree: inspector.childTasks,
    inspector,
    artifacts: snapshot.artifacts
  }
}
