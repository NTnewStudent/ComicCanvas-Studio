/**
 * Gateway-backed Agent loop model adapter for model-produced tool calls or CanvasPlan JSON.
 * @see docs/api-contracts/agents.md
 * @see docs/api-contracts/gateway-providers.md
 */

import type { AgentDefinition } from '../../../../shared/agents'
import type { AgentResponse } from '../../../../shared/agents'
import type { GatewayRequest, GatewayResult } from '../../../../shared/gateway'
import type { ToolDescriptor } from '../../../../shared/tools'
import type { GatewayRegistry } from '../providers/registry'
import type { ToolRuntime } from '../tools/runtime'
import type { AgentContextLoopState, AgentLoopModel, AgentLoopStepResult, AgentToolCall, RunAgentContextLoopInput } from './context-loop'
import { resumeAgentContextLoopWithApproval, runAgentContextLoop } from './context-loop'
import type { OrchestratorPlanner, OrchestratorProgressDraft } from './orchestrator'
import { sanitizePlan } from './sanitize-plan'
import { estimateCostUsd } from './cost'

interface GatewayAgentLoopModelOptions {
  gateways: Pick<GatewayRegistry, 'invoke'>
  agent: AgentDefinition
  runId: string
  gatewayId?: string
  modelId?: string
  /** Optional fallback gateway+model tried once when the primary call fails. */
  fallbackGatewayId?: string
  fallbackModelId?: string
  /** Optional streaming token delta callback forwarded to the provider. */
  onDelta?: (delta: string) => void
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

function noTextModelClarification(): AgentResponse {
  return {
    type: 'clarification',
    summary: '未配置可用的文本模型。',
    question: '我需要一个文本模型才能回答问题或进行通用对话。请在「设置 → 网关」中添加并启用一个文本模型（例如 OpenAI 兼容网关），然后重试。',
    missing: ['文本模型网关'],
    dropped: []
  }
}

function compactToolsForPrompt(tools: readonly ToolDescriptor[]): Array<Pick<ToolDescriptor, 'id' | 'name' | 'description' | 'inputSchemaRef'>> {
  return tools.map((tool) => ({
    id: tool.id,
    name: tool.name,
    description: tool.description,
    inputSchemaRef: tool.inputSchemaRef
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

function gatewayRequest(options: GatewayAgentLoopModelOptions, state: AgentContextLoopState): GatewayRequest {
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

  async function invokeWithFallback(gatewayId: string, request: GatewayRequest): Promise<GatewayResult> {
    const ctx = options.onDelta ? { onDelta: options.onDelta } : undefined
    try {
      return await options.gateways.invoke(gatewayId, request, ctx)
    } catch (primaryError) {
      if (options.fallbackGatewayId && options.fallbackModelId) {
        const fallbackRequest: GatewayRequest = { ...request, modelKey: options.fallbackModelId }
        return options.gateways.invoke(options.fallbackGatewayId, fallbackRequest)
      }
      throw primaryError
    }
  }

  return {
    async step(state) {
      const gatewayId = options.gatewayId ?? options.agent.gatewayPolicy.gatewayId ?? 'stub-main'
      const request = gatewayRequest(options, state)
      const result = await invokeWithFallback(gatewayId, request)

      if (result.kind !== 'text') {
        throw new Error('agent_model_non_text_result')
      }

      // Record usage for the loop accumulator.
      lastRawUsage = result.usage
        ? { inputTokens: result.usage.inputTokens, outputTokens: result.usage.outputTokens }
        : undefined

      try {
        return parseModelJson(parseJsonObject(result.text))
      } catch {
        return clarifyFromInvalidModelResponse()
      }
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
 * Creates an OrchestratorPlanner backed by the Agent context loop and gateway text models.
 * @param options - Gateway, ToolRuntime, tool descriptor, and default model dependencies.
 * @returns OrchestratorPlanner that yields loop progress and returns sanitized CanvasPlan.
 * @throws Error when called without a resolved AgentDefinition.
 * @see docs/api-contracts/agents.md
 */
export function createGatewayAgentPlanner(options: GatewayAgentPlannerOptions): OrchestratorPlanner {
  return {
    async *proposePlan(input): AsyncGenerator<OrchestratorProgressDraft, AgentResponse> {
      if (!input.agent) {
        throw new Error('agent_not_found')
      }

      const modelOptions: GatewayAgentLoopModelOptions = {
        gateways: options.gateways,
        agent: input.agent,
        runId: input.runId,
        ...(options.fallbackGatewayId ? { fallbackGatewayId: options.fallbackGatewayId } : {}),
        ...(options.fallbackModelId ? { fallbackModelId: options.fallbackModelId } : {}),
        ...(input.onDelta ? { onDelta: input.onDelta } : {})
      }
      const resolvedDefault = options.resolveDefaultModel ? options.resolveDefaultModel() : { gatewayId: options.defaultGatewayId, modelId: options.defaultModelId }

      if (options.resolveDefaultModel && resolvedDefault === null && !input.agent.gatewayPolicy.gatewayId) {
        // No real text model is configured: ask the user to add one instead of prompting the stub.
        yield { type: 'progress', message: '未检测到可用的文本模型', progress: 10 }
        return noTextModelClarification()
      }

      const gatewayId = input.agent.gatewayPolicy.gatewayId ?? resolvedDefault?.gatewayId
      const modelId = input.agent.gatewayPolicy.modelId ?? resolvedDefault?.modelId

      if (gatewayId) {
        modelOptions.gatewayId = gatewayId
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
        if (next.value.type === 'progress') {
          yield { type: 'progress', message: next.value.message, progress: next.value.progress }
        } else if (next.value.type === 'tool') {
          const status = next.value.result.record.status
          yield { type: 'progress', message: `Tool ${next.value.call.toolId} ${status}`, progress: 50 }
        } else if (next.value.response.type === 'canvasPlan') {
          yield { type: 'progress', message: 'Agent produced a CanvasPlan', progress: 90 }
        } else {
          yield { type: 'progress', message: 'Agent produced an answer', progress: 90 }
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
    async *resumeApprovedTool(input): AsyncGenerator<OrchestratorProgressDraft, AgentResponse> {
      const modelOptions: GatewayAgentLoopModelOptions = {
        gateways: options.gateways,
        agent: input.agent,
        runId: input.runId,
        ...(options.fallbackGatewayId ? { fallbackGatewayId: options.fallbackGatewayId } : {}),
        ...(options.fallbackModelId ? { fallbackModelId: options.fallbackModelId } : {}),
        ...(input.onDelta ? { onDelta: input.onDelta } : {})
      }
      const resolvedDefault = options.resolveDefaultModel ? options.resolveDefaultModel() : { gatewayId: options.defaultGatewayId, modelId: options.defaultModelId }
      const gatewayId = input.agent.gatewayPolicy.gatewayId ?? resolvedDefault?.gatewayId
      const modelId = input.agent.gatewayPolicy.modelId ?? resolvedDefault?.modelId

      if (gatewayId) {
        modelOptions.gatewayId = gatewayId
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
        model: createGatewayAgentLoopModel(modelOptions),
        tools: options.tools,
        traceId: input.runId,
        actor: { type: 'agent', id: input.agent.id }
      })
      let next = await loop.next()

      while (!next.done) {
        if (next.value.type === 'progress') {
          yield { type: 'progress', message: next.value.message, progress: next.value.progress }
        } else if (next.value.type === 'tool') {
          const status = next.value.result.record.status
          yield { type: 'progress', message: `Tool ${next.value.call.toolId} ${status}`, progress: 50 }
        } else if (next.value.response.type === 'canvasPlan') {
          yield { type: 'progress', message: 'Agent produced a CanvasPlan', progress: 90 }
        } else {
          yield { type: 'progress', message: 'Agent produced an answer', progress: 90 }
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
