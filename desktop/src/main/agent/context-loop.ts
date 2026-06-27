/**
 * Agent context loop policy helpers inspired by cc-haha's AsyncGenerator loop.
 * @see docs/api-contracts/agents.md
 */

import type { AgentDefinition, AgentTriggerKind } from '../../../../shared/agents'
import type { CanvasPlan } from '../../../../shared/plan'
import type { ToolActor, ToolDescriptor, ToolInvocationRecord, ToolPermission } from '../../../../shared/tools'
import type { ToolInvocationResult, ToolRuntime } from '../tools/runtime'

export interface AgentContextLoopInput {
  agent: AgentDefinition
  message: string
  trigger: AgentTriggerKind
  availableTools: readonly ToolDescriptor[]
}

export interface AgentContextLoopState {
  agentId: string
  trigger: AgentTriggerKind
  turnCount: number
  maxTurns: number
  transition: 'start' | 'tool_results' | 'completed' | 'approval_required' | 'max_turns_exceeded'
  systemPrompt: string
  userMessage: string
  allowedTools: ToolDescriptor[]
  droppedTools: string[]
  messages: AgentLoopMessage[]
  tokenEstimate: number
  compactionSummary: string | null
  omittedMessages: number
}

export type AgentLoopMessage =
  | { role: 'system'; content: string }
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string }
  | { role: 'tool'; toolId: string; invocationId: string; status: ToolInvocationRecord['status']; content: string }

export interface AgentToolCall {
  id: string
  toolId: string
  input: unknown
}

export type AgentLoopStepResult =
  | { type: 'plan'; plan: CanvasPlan; message?: string }
  | { type: 'toolCalls'; calls: AgentToolCall[]; message?: string }

export interface AgentLoopModel {
  step(state: AgentContextLoopState): Promise<AgentLoopStepResult> | AgentLoopStepResult
}

export type AgentLoopEvent =
  | { type: 'progress'; message: string; progress: number }
  | { type: 'tool'; call: AgentToolCall; result: ToolInvocationResult }
  | { type: 'plan'; plan: CanvasPlan }

export interface RunAgentContextLoopInput extends AgentContextLoopInput {
  model: AgentLoopModel
  tools: Pick<ToolRuntime, 'invoke'>
  traceId: string
  actor?: ToolActor
  initialState?: AgentContextLoopState
}

export interface AgentContextLoopResult {
  plan: CanvasPlan
  turnsUsed: number
  droppedTools: string[]
  compactionSummary: string | null
  omittedMessages: number
}

export interface AgentLoopTerminalErrorOptions {
  errorClass: 'agent_max_turns_exceeded' | 'agent_trigger_denied' | 'agent_tool_approval_required'
  message: string
  turnsUsed: number
  droppedTools: string[]
  compactionSummary: string | null
  omittedMessages: number
  pendingApproval?: AgentToolApprovalRequest
  pausedState?: AgentContextLoopState
}

export interface AgentToolApprovalRequest {
  callId: string
  toolId: string
  input: unknown
  reason: string
  requiredPermissions: ToolPermission[]
}

export class AgentLoopTerminalError extends Error {
  readonly errorClass: AgentLoopTerminalErrorOptions['errorClass']
  readonly turnsUsed: number
  readonly droppedTools: string[]
  readonly compactionSummary: string | null
  readonly omittedMessages: number
  readonly pendingApproval?: AgentToolApprovalRequest
  readonly pausedState?: AgentContextLoopState
  readonly details?: Record<string, unknown>
  readonly retryable = false

  /**
   * Creates a structured terminal Agent loop error for JobWorker/UI mapping.
   * @param options - Stable error metadata and loop audit counters.
   * @see docs/api-contracts/agents.md
   */
  constructor(options: AgentLoopTerminalErrorOptions) {
    super(options.message)
    this.name = 'AgentLoopTerminalError'
    this.errorClass = options.errorClass
    this.turnsUsed = options.turnsUsed
    this.droppedTools = [...options.droppedTools]
    this.compactionSummary = options.compactionSummary
    this.omittedMessages = options.omittedMessages
    if (options.pausedState) {
      this.pausedState = cloneAgentContextLoopState(options.pausedState)
    }
    if (options.pendingApproval) {
      this.pendingApproval = {
        ...options.pendingApproval,
        requiredPermissions: options.pendingApproval.requiredPermissions.map((permission) => ({ ...permission }))
      }
      this.details = { pendingApproval: this.pendingApproval }
    }
  }
}

export interface CompactAgentMessagesResult {
  messages: AgentLoopMessage[]
  tokenEstimate: number
  compactionSummary: string | null
  omittedMessages: number
}

export interface ResumeAgentContextLoopWithApprovalInput extends RunAgentContextLoopInput {
  initialState: AgentContextLoopState
  approval: AgentToolApprovalRequest
  approvedBy: ToolActor
}

function toolAllowedById(agent: AgentDefinition, tool: ToolDescriptor): boolean {
  return agent.allowedTools === '*' || agent.allowedTools.includes(tool.id)
}

function toolAllowedByPermission(agent: AgentDefinition, tool: ToolDescriptor): boolean {
  const allowedKinds = new Set(agent.permissionPolicy.allowedPermissionKinds)

  return tool.permissions.every((permission) => allowedKinds.has(permission.kind))
}

function buildSystemPrompt(agent: AgentDefinition, trigger: AgentTriggerKind): string {
  return [
    agent.instructions.trim(),
    '',
    `Agent: ${agent.name} (${agent.id})`,
    `Trigger: ${trigger}`,
    `Effort: ${agent.effort}`,
    `Max turns: ${agent.maxTurns}`,
    'Return declarative ComicCanvas outputs only; use ToolRuntime for side effects.'
  ].join('\n')
}

function toolResultContent(result: ToolInvocationResult): string {
  if (result.error) {
    return `Tool failed: ${result.error.errorClass}: ${result.error.message}`
  }

  return JSON.stringify(result.output ?? result.record)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toolPermissions(value: unknown): ToolPermission[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((entry): entry is ToolPermission => {
    return isRecord(entry) && typeof entry.kind === 'string' && typeof entry.reason === 'string'
  }).map((permission) => ({ ...permission }))
}

function approvalRequestFromDeniedTool(call: AgentToolCall, result: ToolInvocationResult): AgentToolApprovalRequest | null {
  const details = result.error?.details

  if (!details || details.decision !== 'ask') {
    return null
  }

  return {
    callId: call.id,
    toolId: call.toolId,
    input: call.input,
    reason: result.error?.message ?? 'Tool requires explicit confirmation.',
    requiredPermissions: toolPermissions(details.requiredPermissions)
  }
}

function estimateTokensForText(value: string): number {
  return Math.max(1, Math.ceil(value.length / 4))
}

function estimateTokens(messages: readonly AgentLoopMessage[]): number {
  return messages.reduce((total, message) => total + estimateTokensForText(message.content), 0)
}

function summarizeMessage(message: AgentLoopMessage): string {
  const prefix = message.role === 'tool' ? `tool:${message.toolId}:${message.status}` : message.role
  const content = message.content.replace(/\s+/gu, ' ').trim()
  return `${prefix}=${content.slice(0, 120)}`
}

/**
 * Deterministically compacts loop messages to fit an Agent token budget.
 * @param messages - Current loop messages.
 * @param budget - Maximum approximate token budget.
 * @returns Compacted messages and summary metadata.
 * @throws Error never intentionally; tiny budgets keep the minimum system/user boundary.
 * @see docs/api-contracts/knowledge-context.md
 */
export function compactAgentMessages(messages: readonly AgentLoopMessage[], budget: number): CompactAgentMessagesResult {
  const tokenBudget = Math.max(1, Math.trunc(budget))
  const currentEstimate = estimateTokens(messages)

  if (currentEstimate <= tokenBudget || messages.length <= 2) {
    return {
      messages: [...messages],
      tokenEstimate: currentEstimate,
      compactionSummary: null,
      omittedMessages: 0
    }
  }

  const system = messages.find((message) => message.role === 'system')
  const firstUser = messages.find((message) => message.role === 'user')
  const tail = messages.slice(-1)
  const protectedMessages = [system, firstUser, ...tail].filter((message, index, array): message is AgentLoopMessage => {
    return Boolean(message) && array.findIndex((candidate) => candidate === message) === index
  })
  const protectedSet = new Set(protectedMessages)
  const omitted = messages.filter((message) => !protectedSet.has(message))

  if (omitted.length === 0) {
    return {
      messages: [...messages],
      tokenEstimate: currentEstimate,
      compactionSummary: null,
      omittedMessages: 0
    }
  }

  const summary = omitted.map(summarizeMessage).join(' | ')
  const summaryMessage: AgentLoopMessage = {
    role: 'assistant',
    content: `Context compacted (${omitted.length} messages): ${summary}`
  }
  let compacted = [system, firstUser, summaryMessage, ...tail].filter((message, index, array): message is AgentLoopMessage => {
    return Boolean(message) && array.findIndex((candidate) => candidate === message) === index
  })
  const boundary = compacted.slice(0, 2)

  while (estimateTokens(compacted) > tokenBudget && compacted.length > boundary.length + 1) {
    compacted = [...boundary, summaryMessage, ...compacted.slice(boundary.length + 2)]
  }

  return {
    messages: compacted,
    tokenEstimate: estimateTokens(compacted),
    compactionSummary: summaryMessage.content,
    omittedMessages: omitted.length
  }
}

/**
 * Filters tools through both explicit tool IDs and permission kinds.
 * @param agent - Effective Agent definition.
 * @param tools - Tool descriptors available in the runtime.
 * @returns Allowed descriptors plus dropped tool IDs for trace/debug output.
 * @throws Error never intentionally; malformed descriptors are treated as dropped by normal checks.
 * @see docs/api-contracts/agents.md
 */
export function filterAgentTools(agent: AgentDefinition, tools: readonly ToolDescriptor[]): { allowedTools: ToolDescriptor[]; droppedTools: string[] } {
  const allowedTools: ToolDescriptor[] = []
  const droppedTools: string[] = []

  for (const tool of tools) {
    if (tool.enabled && toolAllowedById(agent, tool) && toolAllowedByPermission(agent, tool)) {
      allowedTools.push(tool)
    } else {
      droppedTools.push(tool.id)
    }
  }

  return { allowedTools, droppedTools }
}

/**
 * Builds the initial context-loop state for a selected Agent run.
 * @param input - Effective Agent, trigger, user message, and available tools.
 * @returns Initial loop state ready for a model-backed planner/executor.
 * @throws Error when the trigger is not allowed by the Agent policy.
 * @see docs/api-contracts/agents.md
 */
export function createAgentContextLoop(input: AgentContextLoopInput): AgentContextLoopState {
  if (!input.agent.triggerPolicy.allowedTriggers.includes(input.trigger)) {
    throw new AgentLoopTerminalError({
      errorClass: 'agent_trigger_denied',
      message: 'Agent trigger is not allowed by policy.',
      turnsUsed: 0,
      droppedTools: [],
      compactionSummary: null,
      omittedMessages: 0
    })
  }

  const { allowedTools, droppedTools } = filterAgentTools(input.agent, input.availableTools)
  const systemPrompt = buildSystemPrompt(input.agent, input.trigger)
  const messages: AgentLoopMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: input.message }
  ]

  return {
    agentId: input.agent.id,
    trigger: input.trigger,
    turnCount: 0,
    maxTurns: input.agent.maxTurns,
    transition: 'start',
    systemPrompt,
    userMessage: input.message,
    allowedTools,
    droppedTools,
    messages,
    tokenEstimate: estimateTokens(messages),
    compactionSummary: null,
    omittedMessages: 0
  }
}

function cloneAgentLoopMessage(message: AgentLoopMessage): AgentLoopMessage {
  if (message.role === 'tool') {
    return { ...message }
  }

  return { ...message }
}

function cloneAgentContextLoopState(state: AgentContextLoopState): AgentContextLoopState {
  return {
    ...state,
    allowedTools: state.allowedTools.map((tool) => ({ ...tool, permissions: tool.permissions.map((permission) => ({ ...permission })) })),
    droppedTools: [...state.droppedTools],
    messages: state.messages.map(cloneAgentLoopMessage)
  }
}

/**
 * Runs a cc-haha-style context loop until the model returns a CanvasPlan.
 * @param input - Agent, model adapter, ToolRuntime facade, and trace metadata.
 * @returns Async events followed by the final CanvasPlan result.
 * @throws Error when the loop exceeds the configured turn limit or requests a denied tool.
 * @see docs/api-contracts/agents.md
 */
export async function* runAgentContextLoop(input: RunAgentContextLoopInput): AsyncGenerator<AgentLoopEvent, AgentContextLoopResult> {
  const state = input.initialState ? cloneAgentContextLoopState(input.initialState) : createAgentContextLoop(input)
  const allowedToolIds = new Set(state.allowedTools.map((tool) => tool.id))
  const actor = input.actor ?? { type: 'agent', id: input.agent.id }

  while (state.turnCount < state.maxTurns) {
    const compacted = compactAgentMessages(state.messages, input.agent.contextPolicy.maxContextTokens)
    state.messages = compacted.messages
    state.tokenEstimate = compacted.tokenEstimate
    state.compactionSummary = compacted.compactionSummary ?? state.compactionSummary
    state.omittedMessages += compacted.omittedMessages

    yield { type: 'progress', message: `Agent loop turn ${state.turnCount + 1}`, progress: Math.min(95, 10 + state.turnCount * 10) }

    const step = await input.model.step(state)
    state.turnCount += 1

    if (step.message) {
      state.messages.push({ role: 'assistant', content: step.message })
    }

    if (step.type === 'plan') {
      state.transition = 'completed'
      yield { type: 'plan', plan: step.plan }
      return {
        plan: step.plan,
        turnsUsed: state.turnCount,
        droppedTools: state.droppedTools,
        compactionSummary: state.compactionSummary,
        omittedMessages: state.omittedMessages
      }
    }

    for (const call of step.calls) {
      if (!allowedToolIds.has(call.toolId)) {
        state.droppedTools.push(call.toolId)
        state.messages.push({ role: 'tool', toolId: call.toolId, invocationId: call.id, status: 'denied', content: 'Tool denied by agent policy.' })
        continue
      }

      const result = await input.tools.invoke({
        toolId: call.toolId,
        input: call.input,
        actor,
        traceId: input.traceId
      })

      yield { type: 'tool', call, result }
      state.messages.push({
        role: 'tool',
        toolId: call.toolId,
        invocationId: result.record.invocationId,
        status: result.record.status,
        content: toolResultContent(result)
      })

      const pendingApproval = approvalRequestFromDeniedTool(call, result)

      if (pendingApproval) {
        state.transition = 'approval_required'
        throw new AgentLoopTerminalError({
          errorClass: 'agent_tool_approval_required',
          message: 'Tool requires user approval before execution.',
          turnsUsed: state.turnCount,
          droppedTools: state.droppedTools,
          compactionSummary: state.compactionSummary,
          omittedMessages: state.omittedMessages,
          pendingApproval,
          pausedState: state
        })
      }
    }

    state.transition = 'tool_results'
  }

  state.transition = 'max_turns_exceeded'
  throw new AgentLoopTerminalError({
    errorClass: 'agent_max_turns_exceeded',
    message: 'Agent loop exceeded the configured maximum turns before producing a plan.',
    turnsUsed: state.turnCount,
    droppedTools: state.droppedTools,
    compactionSummary: state.compactionSummary,
    omittedMessages: state.omittedMessages
  })
}

/**
 * Resumes a paused Agent context loop by executing the approved pending tool call.
 * @param input - Paused state, approval metadata, model adapter, and ToolRuntime facade.
 * @returns Async events followed by the final CanvasPlan result.
 * @throws Error when approval no longer matches the paused tool call or the resumed loop reaches max turns.
 * @see docs/api-contracts/agents.md
 */
export async function* resumeAgentContextLoopWithApproval(input: ResumeAgentContextLoopWithApprovalInput): AsyncGenerator<AgentLoopEvent, AgentContextLoopResult> {
  const state = cloneAgentContextLoopState(input.initialState)

  if (state.transition !== 'approval_required') {
    throw new AgentLoopTerminalError({
      errorClass: 'agent_trigger_denied',
      message: 'Agent run is not waiting for tool approval.',
      turnsUsed: state.turnCount,
      droppedTools: state.droppedTools,
      compactionSummary: state.compactionSummary,
      omittedMessages: state.omittedMessages
    })
  }

  const call: AgentToolCall = {
    id: input.approval.callId,
    toolId: input.approval.toolId,
    input: input.approval.input
  }
  const result = await input.tools.invoke({
    toolId: call.toolId,
    input: call.input,
    actor: input.actor ?? { type: 'agent', id: input.agent.id },
    traceId: input.traceId,
    approvedInvocation: {
      toolId: call.toolId,
      input: call.input,
      approvedBy: input.approvedBy
    }
  })

  yield { type: 'tool', call, result }
  state.messages.push({
    role: 'tool',
    toolId: call.toolId,
    invocationId: result.record.invocationId,
    status: result.record.status,
    content: toolResultContent(result)
  })
  state.transition = 'tool_results'

  return yield* runAgentContextLoop({
    ...input,
    initialState: state
  })
}
