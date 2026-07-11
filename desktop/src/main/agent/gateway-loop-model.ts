/**
 * Gateway-backed Agent loop model adapter for model-produced tool calls or CanvasPlan JSON.
 * @see docs/api-contracts/agents.md
 * @see docs/api-contracts/gateway-providers.md
 */

import type { AgentDefinition } from '../../../../shared/agents'
import type { AgentResponse } from '../../../../shared/agents'
import type { GatewayRequest, GatewayResult, GatewayType } from '../../../../shared/gateway'
import type { CanvasPlan } from '../../../../shared/plan'
import type { ToolDescriptor } from '../../../../shared/tools'
import type { GatewayRegistry } from '../providers/registry'
import type { ToolRuntime } from '../tools/runtime'
import {
  gatewayToolCallsToAgentCalls,
  loopMessagesToGatewayMessages,
  resolveAgentToolProtocol,
  toolDescriptorsToGatewayTools,
  type AgentToolProtocol
} from '../lib/agent-gateway-tools'
import type { AgentContextLoopState, AgentLoopEvent, AgentLoopModel, AgentLoopStepResult, AgentToolCall, RunAgentContextLoopInput } from './context-loop'
import { resumeAgentContextLoopWithApproval, runAgentContextLoop } from './context-loop'
import { analyzeAgentIntent } from './intent-analysis'
import { createDefaultOrchestratorPlanner, type OrchestratorPlanner, type OrchestratorPlannerDraft } from './orchestrator'
import { sanitizePlan } from './sanitize-plan'
import { estimateCostUsd } from './cost'
import { GatewayRetryExhaustedError, isContextOverflowError, withGatewayRetry } from './recovery'

export interface GatewayAgentLoopModelOptions {
  gateways: Pick<GatewayRegistry, 'invoke'>
  agent: AgentDefinition
  runId: string
  gatewayId?: string
  modelId?: string
  /** Tool protocol for this gateway; defaults from gateway type when omitted. */
  toolProtocol?: AgentToolProtocol
  /** Optional fallback gateway+model tried once when the primary call fails. */
  fallbackGatewayId?: string
  fallbackModelId?: string
  /** Resolved type of the fallback gateway, used to block text fallback to stubs. */
  fallbackGatewayType?: GatewayType
  /** Optional streaming token delta callback forwarded to the provider. */
  onDelta?: (delta: string) => void
}

interface EffectiveTextModel {
  gatewayId?: string
  modelId?: string
}

export interface GatewayAgentPlannerOptions {
  gateways: Pick<GatewayRegistry, 'invoke'>
  tools: Pick<ToolRuntime, 'invoke'>
  listTools: () => ToolDescriptor[]
  defaultGatewayId?: string
  defaultModelId?: string
  /** Optional fallback gateway+model when the primary text model fails. */
  fallbackGatewayId?: string
  fallbackModelId?: string
  /** Resolves gateway type for native-vs-json tool protocol selection. */
  resolveGatewayType?: (gatewayId: string) => GatewayType | undefined
  /**
   * Lazily resolves the effective default text model for agents that do not pin
   * their own gateway. Returning null signals that no real text model is
   * configured, so the planner asks the user to configure one instead of
   * sending prompts to the no-op stub. When omitted, defaultGatewayId/ModelId
   * are used (preserves existing test behavior).
   */
  resolveDefaultModel?: () => { gatewayId: string; modelId: string } | null
}

type ModelJson = Record<string, unknown>

function stableJson(value: unknown): string {
  return JSON.stringify(value, null, 2)
}

function isRecord(value: unknown): value is ModelJson {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseJsonObject(text: string): ModelJson {
  const trimmed = text.trim()

  try {
    const direct = JSON.parse(trimmed) as unknown

    if (isRecord(direct)) {
      return direct
    }
  } catch {
    // Some providers wrap JSON in prose or fences; fall through to extraction.
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/iu)

  if (fenced?.[1]) {
    const parsed = JSON.parse(fenced[1]) as unknown

    if (isRecord(parsed)) {
      return parsed
    }
  }

  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')

  if (start >= 0 && end > start) {
    const parsed = JSON.parse(trimmed.slice(start, end + 1)) as unknown

    if (isRecord(parsed)) {
      return parsed
    }
  }

  throw new Error('agent_model_json_invalid')
}

function parseToolCall(entry: unknown, index: number): AgentToolCall | null {
  if (!isRecord(entry) || typeof entry.toolId !== 'string') {
    return null
  }

  return {
    id: typeof entry.id === 'string' && entry.id.trim().length > 0 ? entry.id : `model-tool-call-${index + 1}`,
    toolId: entry.toolId,
    input: 'input' in entry ? entry.input : {}
  }
}

function parseModelJson(json: ModelJson): AgentLoopStepResult {
  if (json.type === 'toolCalls' && Array.isArray(json.calls)) {
    return {
      type: 'toolCalls',
      calls: json.calls.map(parseToolCall).filter((call): call is AgentToolCall => call !== null),
      ...(typeof json.message === 'string' ? { message: json.message } : {})
    }
  }

  if (json.type === 'answer' && typeof json.text === 'string') {
    return {
      type: 'response',
      response: {
        type: 'answer',
        summary: typeof json.summary === 'string' ? json.summary : 'General answer.',
        text: json.text,
        dropped: Array.isArray(json.dropped) ? json.dropped.filter((item): item is string => typeof item === 'string') : []
      },
      ...(typeof json.message === 'string' ? { message: json.message } : {})
    }
  }

  if (json.type === 'clarification' && typeof json.question === 'string') {
    return {
      type: 'response',
      response: {
        type: 'clarification',
        summary: typeof json.summary === 'string' ? json.summary : 'Clarification required.',
        question: json.question,
        missing: Array.isArray(json.missing) ? json.missing.filter((item): item is string => typeof item === 'string') : [],
        dropped: Array.isArray(json.dropped) ? json.dropped.filter((item): item is string => typeof item === 'string') : []
      },
      ...(typeof json.message === 'string' ? { message: json.message } : {})
    }
  }

  if (json.type === 'canvasPlan' && isRecord(json.plan)) {
    return {
      type: 'response',
      response: { type: 'canvasPlan', plan: sanitizePlan(json.plan) },
      ...(typeof json.message === 'string' ? { message: json.message } : {})
    }
  }

  const planSource = isRecord(json.plan) ? json.plan : json
  const plan = sanitizePlan(planSource)

  return {
    type: 'plan',
    plan,
    ...(typeof json.message === 'string' ? { message: json.message } : {})
  }
}

function clarifyFromInvalidModelResponse(): AgentLoopStepResult {
  return {
    type: 'response',
    response: {
      type: 'clarification',
      summary: 'The Agent model response could not be parsed as declarative JSON.',
      question: '我需要再确认一下你的画布目标：你想生成哪些节点，以及图片/视频要参考哪些素材？',
      missing: ['画布目标', '节点类型', '参考素材'],
      dropped: ['agent_model_json_invalid']
    },
    message: 'Model response was not valid JSON; converted to a clarify plan.'
  }
}

type OrchestratorPlannerTerminal = AgentResponse | CanvasPlan
type OrchestratorPlannerResult = ReturnType<OrchestratorPlanner['proposePlan']>

function isAsyncPlannerResult(value: OrchestratorPlannerResult): value is AsyncGenerator<OrchestratorPlannerDraft, OrchestratorPlannerTerminal> {
  return typeof value === 'object' && value !== null && Symbol.asyncIterator in value
}

async function resolvePlannerTerminal(value: OrchestratorPlannerResult): Promise<OrchestratorPlannerTerminal> {
  if (!isAsyncPlannerResult(value)) {
    return Promise.resolve(value)
  }

  let next = await value.next()
  while (!next.done) {
    next = await value.next()
  }

  return next.value
}

async function localFallbackResponse(input: Parameters<OrchestratorPlanner['proposePlan']>[0]): Promise<AgentResponse> {
  const local = createDefaultOrchestratorPlanner().proposePlan(input)
  const value = await resolvePlannerTerminal(local)
  return 'type' in value ? value : { type: 'canvasPlan', plan: sanitizePlan(value) }
}

function isDeterministicLocalQuestion(message: string): boolean {
  return /(?:今天|明天|昨天).*(?:星期几|周几|几号|日期)|现在几点|what day (?:is it|is tomorrow|was yesterday)|what date (?:is it|is tomorrow|was yesterday)|what time is it/iu.test(message.trim())
}

function localFirstProgressMessage(message: string): string | null {
  if (analyzeAgentIntent(message).kind === 'smallTalk') {
    if (/你是谁|你是.*谁|你叫什么|介绍一下自己|自我介绍|你能做什么|你可以做什么|who\s*are\s*you|what\s*can\s*you\s*do/iu.test(message.trim())) {
      return '识别为身份问答，使用本地确定性回复'
    }

    return '识别为寒暄，使用本地确定性回复'
  }

  if (isDeterministicLocalQuestion(message)) {
    return '识别为本地确定性问题，使用本地回复'
  }

  return null
}

function shouldUseLocalFirstResponse(message: string): boolean {
  return localFirstProgressMessage(message) !== null
}

function localFirstProgress(message: string): string {
  return localFirstProgressMessage(message) ?? '使用本地确定性回复'
}

function isStubGateway(options: Pick<GatewayAgentPlannerOptions, 'resolveGatewayType'>, gatewayId: string | undefined): boolean {
  return gatewayId === 'stub-main' || (gatewayId !== undefined && options.resolveGatewayType?.(gatewayId) === 'stub')
}

function textModelSelection(gatewayId: string | undefined, modelId: string | undefined): EffectiveTextModel {
  const out: EffectiveTextModel = {}

  if (gatewayId) {
    out.gatewayId = gatewayId
  }

  if (modelId) {
    out.modelId = modelId
  }

  return out
}

function resolvePlannerDefaultTextModel(options: GatewayAgentPlannerOptions): EffectiveTextModel | null {
  if (options.resolveDefaultModel) {
    return options.resolveDefaultModel()
  }

  return textModelSelection(options.defaultGatewayId, options.defaultModelId)
}

function resolveEffectiveTextModel(
  options: Pick<GatewayAgentPlannerOptions, 'resolveGatewayType'>,
  agent: AgentDefinition,
  resolvedDefault: EffectiveTextModel | null | undefined
): EffectiveTextModel {
  const defaultIsReal = Boolean(resolvedDefault?.gatewayId && !isStubGateway(options, resolvedDefault.gatewayId))
  const agentGatewayId = agent.gatewayPolicy.gatewayId

  if (!agentGatewayId) {
    return textModelSelection(resolvedDefault?.gatewayId, agent.gatewayPolicy.modelId ?? resolvedDefault?.modelId)
  }

  if (isStubGateway(options, agentGatewayId) && defaultIsReal) {
    return textModelSelection(resolvedDefault?.gatewayId, resolvedDefault?.modelId)
  }

  return textModelSelection(agentGatewayId, agent.gatewayPolicy.modelId ?? resolvedDefault?.modelId)
}

function createPlannerLoopModelOptions(
  options: GatewayAgentPlannerOptions,
  agent: AgentDefinition,
  runId: string,
  onDelta: ((delta: string) => void) | undefined
): GatewayAgentLoopModelOptions {
  const modelOptions: GatewayAgentLoopModelOptions = {
    gateways: options.gateways,
    agent,
    runId
  }

  if (options.fallbackGatewayId) {
    modelOptions.fallbackGatewayId = options.fallbackGatewayId
  }

  if (options.fallbackModelId) {
    modelOptions.fallbackModelId = options.fallbackModelId
  }

  if (options.fallbackGatewayId && options.resolveGatewayType) {
    const fallbackGatewayType = options.resolveGatewayType(options.fallbackGatewayId)
    if (fallbackGatewayType) {
      modelOptions.fallbackGatewayType = fallbackGatewayType
    }
  }

  if (onDelta) {
    modelOptions.onDelta = onDelta
  }

  return modelOptions
}

function compactToolsForPrompt(tools: readonly ToolDescriptor[]): Array<{
  id: string
  name: string
  description: string
  inputSchemaRef: string
  inputParametersJsonSchema?: Record<string, unknown>
}> {
  return tools.map((tool) => ({
    id: tool.id,
    name: tool.name,
    description: tool.description,
    inputSchemaRef: tool.inputSchemaRef,
    ...(tool.inputParametersJsonSchema ? { inputParametersJsonSchema: tool.inputParametersJsonSchema } : {})
  }))
}

function buildPrompt(state: AgentContextLoopState): string {
  const contextSection = state.additionalContext
    ? `\n${state.additionalContext}\n`
    : ''

  return [
    'You are running inside ComicCanvas Studio Agent orchestration.',
    'Respond with exactly one JSON object and no markdown unless the JSON is fenced.',
    '',
    'Allowed response shapes:',
    stableJson({
      type: 'answer',
      summary: 'short summary',
      text: 'direct answer for ordinary questions',
      dropped: []
    }),
    stableJson({
      type: 'clarification',
      summary: 'why clarification is needed',
      question: 'one user-facing question',
      missing: ['specific missing item'],
      dropped: []
    }),
    stableJson({
      type: 'canvasPlan',
      plan: {
        kind: 'plan',
        summary: 'short summary',
        nodes: [],
        edges: [],
        runSteps: [],
        question: null,
        dropped: []
      }
    }),
    stableJson({
      type: 'toolCalls',
      message: 'why these tools are needed',
      calls: [{ id: 'call-1', toolId: 'canvas.queryGraph', input: {} }]
    }),
    '',
    'Hard rules:',
    '- Use the prior turns in Messages to accumulate context. A short follow-up like "创建"/"画布节点"/"create" refers to what was already discussed — never restart or re-ask details the user already gave.',
    '- Use web.search before answering current, latest, price, news, or time-sensitive questions when that tool is available.',
    '- If web.search is unavailable or denied, say that clearly. Never pretend to have searched.',
    '- After web.search, cite the relevant source URL or numbered source marker for every factual claim drawn from the search evidence.',
    '- For pure greetings, return type=answer with a natural greeting and mention chat/search/planning/canvas help briefly.',
    '- For system capability design requests, analyze requirements first and ask one key question before implementation or canvas mutations.',
    '- Prefer action over questions. When the user expresses a clear creative intent (e.g. "做一个角色"/"生成一张图"), produce a CanvasPlan NOW using sensible defaults derived from the conversation, and note any assumptions in the plan summary.',
    '- Ask at most ONE clarification in the entire conversation, and only when you genuinely cannot produce anything useful. NEVER ask which operation to perform — infer it (e.g. "想做一个角色" → create a character node; "画布节点" after describing a character → create that character node).',
    '- For pure greetings, small talk, or general questions with no canvas intent, return type=answer. Do not invent canvas nodes for those.',
    '- CanvasPlan is declarative JSON only. Never include executable code, scripts, shell commands, or provider secrets.',
    '- Image/video reference nodes do not generate. Use imageConfigV2 for imageRun and videoConfigV2 for videoRun.',
    '- Use only migrated node types: text, image, video, imageConfigV2, videoConfigV2, character, scene, audio, videoCompose, superResolution, muxAudioVideo.',
    '- If a minor detail is missing (a name, exact color), pick a reasonable default and proceed; only clarify when the core goal itself is unknowable.',
    '',
    `Loop state: turn ${state.turnCount + 1}/${state.maxTurns}`,
    `Allowed tools: ${stableJson(compactToolsForPrompt(state.allowedTools))}`,
    `Dropped tools: ${stableJson(state.droppedTools)}`,
    contextSection,
    `Messages: ${stableJson(state.messages)}`
  ].join('\n')
}

function buildNativeSystemPrompt(state: AgentContextLoopState): string {
  const contextSection = state.additionalContext
    ? `\n${state.additionalContext}\n`
    : ''

  return [
    'You are running inside ComicCanvas Studio Agent orchestration.',
    'Use the provided native tools for canvas and filesystem operations.',
    'When you are ready to finish, respond with exactly one JSON object (no markdown unless fenced) using one of these terminal shapes:',
    stableJson({
      type: 'answer',
      summary: 'short summary',
      text: 'direct answer for ordinary questions',
      dropped: []
    }),
    stableJson({
      type: 'clarification',
      summary: 'why clarification is needed',
      question: 'one user-facing question',
      missing: ['specific missing item'],
      dropped: []
    }),
    stableJson({
      type: 'canvasPlan',
      plan: {
        kind: 'plan',
        summary: 'short summary',
        nodes: [],
        edges: [],
        runSteps: [],
        question: null,
        dropped: []
      }
    }),
    '',
    'Hard rules:',
    '- Use prior turns in Messages; short follow-ups like "创建" refer to earlier context.',
    '- Use web.search before answering current, latest, price, news, or time-sensitive questions when that tool is available.',
    '- If web.search is unavailable or denied, say that clearly. Never pretend to have searched.',
    '- After web.search, cite the relevant source URL or numbered source marker for every factual claim drawn from the search evidence.',
    '- For pure greetings, return type=answer with a natural greeting and mention chat/search/planning/canvas help briefly.',
    '- For system capability design requests, analyze requirements first and ask one key question before implementation or canvas mutations.',
    '- Prefer action over questions for clear creative intents; produce a CanvasPlan with sensible defaults.',
    '- CanvasPlan is declarative JSON only. Never include executable code or provider secrets.',
    '- Image/video reference nodes do not generate. Use imageConfigV2 for imageRun and videoConfigV2 for videoRun.',
    '- Use only migrated node types: text, image, video, imageConfigV2, videoConfigV2, character, scene, audio, videoCompose, superResolution, muxAudioVideo.',
    '',
    `Loop state: turn ${state.turnCount + 1}/${state.maxTurns}`,
    `Dropped tools: ${stableJson(state.droppedTools)}`,
    contextSection
  ].join('\n')
}

function gatewayJsonRequest(options: GatewayAgentLoopModelOptions, state: AgentContextLoopState): GatewayRequest {
  return {
    channel: 'text',
    modelKey: options.modelId ?? options.agent.gatewayPolicy.modelId ?? '',
    prompt: buildPrompt(state),
    references: [],
    parameters: {
      temperature: options.agent.effort === 'low' ? 0.1 : options.agent.effort === 'medium' ? 0.3 : 0.5,
      response_format: { type: 'json_object' }
    },
    idempotencyKey: `${options.runId}:turn-${state.turnCount + 1}`
  }
}

function gatewayNativeRequest(options: GatewayAgentLoopModelOptions, state: AgentContextLoopState): GatewayRequest {
  const transcript = loopMessagesToGatewayMessages(state.messages)
  const systemIndex = transcript.findIndex((message) => message.role === 'system')
  const nativeSystem = buildNativeSystemPrompt(state)

  if (systemIndex >= 0) {
    transcript[systemIndex] = { role: 'system', content: nativeSystem }
  } else {
    transcript.unshift({ role: 'system', content: nativeSystem })
  }

  return {
    channel: 'text',
    modelKey: options.modelId ?? options.agent.gatewayPolicy.modelId ?? '',
    prompt: '',
    references: [],
    messages: transcript,
    tools: toolDescriptorsToGatewayTools(state.allowedTools),
    toolChoice: 'auto',
    parameters: {
      temperature: options.agent.effort === 'low' ? 0.1 : options.agent.effort === 'medium' ? 0.3 : 0.5
    },
    idempotencyKey: `${options.runId}:turn-${state.turnCount + 1}`
  }
}

function parseGatewayTextStep(text: string): AgentLoopStepResult {
  const trimmed = text.trim()
  if (trimmed.length === 0) {
    return clarifyFromInvalidModelResponse()
  }

  try {
    return parseModelJson(parseJsonObject(trimmed))
  } catch {
    return {
      type: 'response',
      response: {
        type: 'answer',
        summary: 'General answer.',
        text: trimmed,
        dropped: []
      }
    }
  }
}

function gatewayRequestForProtocol(
  options: GatewayAgentLoopModelOptions,
  state: AgentContextLoopState,
  protocol: AgentToolProtocol
): GatewayRequest {
  return protocol === 'native' ? gatewayNativeRequest(options, state) : gatewayJsonRequest(options, state)
}

function parseGatewayStepResult(
  result: GatewayResult,
  state: AgentContextLoopState,
  protocol: AgentToolProtocol
): AgentLoopStepResult {
  if (result.kind !== 'text') {
    throw new Error('agent_model_non_text_result')
  }

  if (protocol === 'native' && result.toolCalls && result.toolCalls.length > 0) {
    const allowed = new Set(state.allowedTools.map((tool) => tool.id))
    const calls = gatewayToolCallsToAgentCalls(result.toolCalls, allowed)

    if (calls.length > 0) {
      return {
        type: 'toolCalls',
        calls,
        ...(result.text.trim().length > 0 ? { message: result.text } : {})
      }
    }
  }

  return parseGatewayTextStep(result.text)
}

/**
 * Creates an AgentLoopModel that asks a configured text gateway for each loop step,
 * tracks token usage, and retries against a fallback gateway when the primary fails.
 * @param options - Gateway registry, effective Agent, model selection, and optional fallback.
 * @returns AgentLoopModel compatible with the shared context loop.
 * @throws Error when the provider returns non-text or invalid JSON.
 * @see docs/api-contracts/agents.md
 */
export function createGatewayAgentLoopModel(options: GatewayAgentLoopModelOptions): AgentLoopModel {
  let lastRawUsage: { inputTokens: number | undefined; outputTokens: number | undefined } | undefined
  const toolProtocol = options.toolProtocol ?? 'json'

  async function invokeWithFallback(gatewayId: string, request: GatewayRequest): Promise<GatewayResult> {
    const ctx = options.onDelta ? { onDelta: options.onDelta } : undefined
    try {
      // 瞬时失败（超时/网络/5xx）指数退避重试 2 次（500ms/2000ms）后再走 fallback。
      return await withGatewayRetry(() => options.gateways.invoke(gatewayId, request, ctx), {
        retries: 2,
        baseDelayMs: 500,
      })
    } catch (primaryError) {
      // 上下文超限不是瞬时故障：交给上层反应式压缩，不切换 fallback。
      if (isContextOverflowError(primaryError)) {
        throw primaryError
      }
      if (request.channel === 'text' && options.fallbackGatewayType === 'stub') {
        throw primaryError
      }
      if (options.fallbackGatewayId && options.fallbackModelId) {
        const fallbackRequest: GatewayRequest = { ...request, modelKey: options.fallbackModelId }
        try {
          return await options.gateways.invoke(options.fallbackGatewayId, fallbackRequest)
        } catch (fallbackError) {
          // 主网关重试与备用网关都失败：以稳定 errorClass 终态。
          throw new GatewayRetryExhaustedError(fallbackError)
        }
      }
      throw new GatewayRetryExhaustedError(primaryError)
    }
  }

  return {
    async step(state) {
      const gatewayId = options.gatewayId ?? options.agent.gatewayPolicy.gatewayId ?? 'stub-main'
      const request = gatewayRequestForProtocol(options, state, toolProtocol)
      const result = await invokeWithFallback(gatewayId, request)

      if (result.kind !== 'text') {
        throw new Error('agent_model_non_text_result')
      }

      lastRawUsage = result.usage
        ? { inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens }
        : undefined

      if (toolProtocol === 'json') {
        try {
          return parseModelJson(parseJsonObject(result.text))
        } catch {
          return clarifyFromInvalidModelResponse()
        }
      }

      return parseGatewayStepResult(result, state, toolProtocol)
    },
    lastUsage() {
      if (!lastRawUsage) return undefined
      const modelId = options.modelId ?? options.agent.gatewayPolicy.modelId
      const inp = lastRawUsage.inputTokens ?? 0
      const out = lastRawUsage.outputTokens ?? 0
      const costUsd = estimateCostUsd(modelId, inp, out)
      return { inputTokens: inp, outputTokens: out, costUsd }
    }
  }
}

/**
 * Resolves and creates a gateway loop model for one child Agent run.
 * @param options - Parent-equivalent gateway, model-policy, and protocol dependencies.
 * @param input - Effective child role and durable child run identity.
 * @returns A configured loop model, or null when no real text model is available.
 * @see docs/api-contracts/agents.md
 */
export function createGatewayChildLoopModel(
  options: Omit<GatewayAgentPlannerOptions, 'tools' | 'listTools'>,
  input: { agent: AgentDefinition; runId: string }
): AgentLoopModel | null {
  const resolvedDefault = resolvePlannerDefaultTextModel(options as GatewayAgentPlannerOptions)
  const effectiveModel = resolveEffectiveTextModel(options, input.agent, resolvedDefault)
  const gatewayId = effectiveModel.gatewayId

  if (!gatewayId || isStubGateway(options, gatewayId)) {
    return null
  }

  const modelOptions = createPlannerLoopModelOptions(
    options as GatewayAgentPlannerOptions,
    input.agent,
    input.runId,
    undefined
  )
  modelOptions.gatewayId = gatewayId
  modelOptions.toolProtocol = resolveAgentToolProtocol(options.resolveGatewayType?.(gatewayId))
  if (effectiveModel.modelId) {
    modelOptions.modelId = effectiveModel.modelId
  }

  return createGatewayAgentLoopModel(modelOptions)
}

function summarizeToolInput(input: unknown): string {
  try {
    const text = JSON.stringify(input)
    return text.length > 160 ? `${text.slice(0, 157)}...` : text
  } catch {
    return '{}'
  }
}

function loopEventToPlannerDraft(event: AgentLoopEvent): OrchestratorPlannerDraft | null {
  if (event.type === 'progress') {
    return { type: 'progress', message: event.message, progress: event.progress }
  }

  if (event.type === 'toolStarted') {
    return {
      type: 'toolStarted',
      callId: event.call.id,
      toolId: event.call.toolId,
      inputSummary: summarizeToolInput(event.call.input)
    }
  }

  if (event.type === 'tool') {
    const status = event.result.record.status === 'completed' ? 'completed' : event.result.record.status === 'denied' ? 'denied' : 'failed'
    return {
      type: 'toolCompleted',
      callId: event.call.id,
      toolId: event.call.toolId,
      invocationId: event.result.record.invocationId,
      status,
      summary: `${event.call.toolId} ${status}`
    }
  }

  if (event.type === 'permissionRequired') {
    return {
      type: 'permissionRequired',
      callId: event.request.callId,
      toolId: event.request.toolId,
      reason: event.request.reason,
      requiredPermissions: event.request.requiredPermissions
    }
  }

  if (event.type === 'response') {
    if (event.response.type === 'canvasPlan') {
      return { type: 'progress', message: 'Agent produced a CanvasPlan', progress: 90 }
    }

    return { type: 'progress', message: 'Agent produced an answer', progress: 90 }
  }

  return null
}

/**
 * Creates an OrchestratorPlanner backed by the Agent context loop and gateway text models.
 * @param options - Gateway, ToolRuntime, tool descriptor, and default model dependencies.
 * @returns OrchestratorPlanner that yields loop progress and returns sanitized CanvasPlan.
 * @throws Error when called without a resolved AgentDefinition.
 * @see docs/api-contracts/agents.md
 */
export function createGatewayAgentPlanner(options: GatewayAgentPlannerOptions): OrchestratorPlanner {
  return {
    async *proposePlan(input): AsyncGenerator<OrchestratorPlannerDraft, AgentResponse> {
      if (!input.agent) {
        throw new Error('agent_not_found')
      }

      if (shouldUseLocalFirstResponse(input.message)) {
        yield { type: 'progress', message: localFirstProgress(input.message), progress: 10 }
        return localFallbackResponse(input)
      }

      const modelOptions = createPlannerLoopModelOptions(options, input.agent, input.runId, input.onDelta)
      const resolvedDefault = resolvePlannerDefaultTextModel(options)

      if (options.resolveDefaultModel && resolvedDefault === null && !input.agent.gatewayPolicy.gatewayId) {
        yield { type: 'progress', message: '未检测到可用的文本模型，尝试本地确定性回复', progress: 10 }
        return localFallbackResponse(input)
      }

      const effectiveModel = resolveEffectiveTextModel(options, input.agent, resolvedDefault)
      const gatewayId = effectiveModel.gatewayId
      const modelId = effectiveModel.modelId

      if (options.resolveDefaultModel && (!gatewayId || isStubGateway(options, gatewayId))) {
        yield { type: 'progress', message: '未检测到可用的真实文本模型，使用本地确定性回复', progress: 10 }
        return localFallbackResponse(input)
      }

      if (gatewayId) {
        modelOptions.gatewayId = gatewayId
        modelOptions.toolProtocol = resolveAgentToolProtocol(options.resolveGatewayType?.(gatewayId))
      }

      if (modelId) {
        modelOptions.modelId = modelId
      }

      const loopInput: RunAgentContextLoopInput = {
        agent: input.agent,
        message: input.message,
        trigger: input.trigger ?? input.agent.triggerPolicy.defaultTrigger,
        availableTools: options.listTools(),
        model: createGatewayAgentLoopModel(modelOptions),
        tools: options.tools,
        traceId: input.runId,
        actor: { type: 'agent', id: input.agent.id }
      }

      if (input.loop) {
        loopInput.initialState = input.loop
      }

      const loop = runAgentContextLoop(loopInput)
      let next = await loop.next()

      while (!next.done) {
        const draft = loopEventToPlannerDraft(next.value)
        if (draft) {
          yield draft
        }

        next = await loop.next()
      }

      const loopResult = next.value
      if (loopResult.usage.inputTokens > 0 || loopResult.usage.outputTokens > 0) {
        const { formatUsage } = await import('./cost')
        yield { type: 'progress', message: formatUsage(loopResult.usage), progress: 99 }
      }
      return loopResult.response.type === 'canvasPlan'
        ? { type: 'canvasPlan', plan: sanitizePlan(loopResult.response.plan) }
        : loopResult.response
    },
    async *resumeApprovedTool(input): AsyncGenerator<OrchestratorPlannerDraft, AgentResponse> {
      const modelOptions = createPlannerLoopModelOptions(options, input.agent, input.runId, input.onDelta)
      const resolvedDefault = resolvePlannerDefaultTextModel(options)
      const effectiveModel = resolveEffectiveTextModel(options, input.agent, resolvedDefault)
      const gatewayId = effectiveModel.gatewayId
      const modelId = effectiveModel.modelId

      if (gatewayId) {
        modelOptions.gatewayId = gatewayId
        modelOptions.toolProtocol = resolveAgentToolProtocol(options.resolveGatewayType?.(gatewayId))
      }

      if (modelId) {
        modelOptions.modelId = modelId
      }

      const loop = resumeAgentContextLoopWithApproval({
        agent: input.agent,
        message: input.message,
        trigger: input.trigger,
        availableTools: options.listTools(),
        initialState: input.loop,
        approval: input.approval,
        approvedBy: { type: 'user', id: input.approvedBy },
        approvalScope: input.approvalScope,
        model: createGatewayAgentLoopModel(modelOptions),
        tools: options.tools,
        traceId: input.runId,
        actor: { type: 'agent', id: input.agent.id },
        ...(input.loop.execution ? { execution: input.loop.execution } : {})
      })
      let next = await loop.next()

      while (!next.done) {
        const draft = loopEventToPlannerDraft(next.value)
        if (draft) {
          yield draft
        }

        next = await loop.next()
      }

      const loopResult = next.value
      if (loopResult.usage.inputTokens > 0 || loopResult.usage.outputTokens > 0) {
        const { formatUsage } = await import('./cost')
        yield { type: 'progress', message: formatUsage(loopResult.usage), progress: 99 }
      }
      return loopResult.response.type === 'canvasPlan'
        ? { type: 'canvasPlan', plan: sanitizePlan(loopResult.response.plan) }
        : loopResult.response
    }
  }
}
