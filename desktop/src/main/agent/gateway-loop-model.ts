/**
 * Gateway-backed Agent loop model adapter for model-produced tool calls or CanvasPlan JSON.
 * @see docs/api-contracts/agents.md
 * @see docs/api-contracts/gateway-providers.md
 */

import type { AgentDefinition } from '../../../../shared/agents'
import type { GatewayRequest, GatewayResult } from '../../../../shared/gateway'
import type { CanvasPlan } from '../../../../shared/plan'
import type { ToolDescriptor } from '../../../../shared/tools'
import type { GatewayRegistry } from '../providers/registry'
import type { ToolRuntime } from '../tools/runtime'
import type { AgentContextLoopState, AgentLoopModel, AgentLoopStepResult, AgentToolCall, RunAgentContextLoopInput } from './context-loop'
import { resumeAgentContextLoopWithApproval, runAgentContextLoop } from './context-loop'
import type { OrchestratorPlanner, OrchestratorProgressDraft } from './orchestrator'
import { sanitizePlan } from './sanitize-plan'

interface GatewayAgentLoopModelOptions {
  gateways: Pick<GatewayRegistry, 'invoke'>
  agent: AgentDefinition
  runId: string
  gatewayId?: string
  modelId?: string
}

export interface GatewayAgentPlannerOptions {
  gateways: Pick<GatewayRegistry, 'invoke'>
  tools: Pick<ToolRuntime, 'invoke'>
  listTools: () => ToolDescriptor[]
  defaultGatewayId?: string
  defaultModelId?: string
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
    type: 'plan',
    plan: sanitizePlan({
      kind: 'clarify',
      summary: 'The Agent model response could not be parsed as declarative JSON.',
      nodes: [],
      edges: [],
      runSteps: [],
      question: '我需要再确认一下你的画布目标：你想生成哪些节点，以及图片/视频要参考哪些素材？',
      dropped: ['agent_model_json_invalid']
    }),
    message: 'Model response was not valid JSON; converted to a clarify plan.'
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
  return [
    'You are running inside ComicCanvas Studio Agent orchestration.',
    'Respond with exactly one JSON object and no markdown unless the JSON is fenced.',
    '',
    'Allowed response shapes:',
    stableJson({
      type: 'toolCalls',
      message: 'why these tools are needed',
      calls: [{ id: 'call-1', toolId: 'canvas.queryGraph', input: {} }]
    }),
    stableJson({
      kind: 'plan',
      summary: 'short summary',
      nodes: [],
      edges: [],
      runSteps: [],
      question: null,
      dropped: []
    }),
    stableJson({
      kind: 'clarify',
      summary: 'why clarification is needed',
      nodes: [],
      edges: [],
      runSteps: [],
      question: 'one user-facing question',
      dropped: []
    }),
    '',
    'Hard rules:',
    '- CanvasPlan is declarative JSON only. Never include executable code, scripts, shell commands, or provider secrets.',
    '- Image/video reference nodes do not generate. Use imageConfigV2 for imageRun and videoConfigV2 for videoRun.',
    '- Use only migrated node types: text, image, video, imageConfigV2, videoConfigV2, character, scene, audio, videoCompose, superResolution, muxAudioVideo.',
    '- If required assets, styles, models, or user intent are missing, return a clarify plan instead of inventing hidden defaults.',
    '',
    `Loop state: turn ${state.turnCount + 1}/${state.maxTurns}`,
    `Allowed tools: ${stableJson(compactToolsForPrompt(state.allowedTools))}`,
    `Dropped tools: ${stableJson(state.droppedTools)}`,
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
 * Creates an AgentLoopModel that asks a configured text gateway for each loop step.
 * @param options - Gateway registry, effective Agent, and model selection.
 * @returns AgentLoopModel compatible with the shared context loop.
 * @throws Error when the provider returns non-text or invalid JSON.
 * @see docs/api-contracts/agents.md
 */
export function createGatewayAgentLoopModel(options: GatewayAgentLoopModelOptions): AgentLoopModel {
  return {
    async step(state) {
      const gatewayId = options.gatewayId ?? options.agent.gatewayPolicy.gatewayId ?? 'stub-main'
      const result: GatewayResult = await options.gateways.invoke(gatewayId, gatewayRequest(options, state))

      if (result.kind !== 'text') {
        throw new Error('agent_model_non_text_result')
      }

      try {
        return parseModelJson(parseJsonObject(result.text))
      } catch {
        // Invalid model JSON is recoverable: return a safe clarify plan instead of failing the job.
        return clarifyFromInvalidModelResponse()
      }
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
    async *proposePlan(input): AsyncGenerator<OrchestratorProgressDraft, CanvasPlan> {
      if (!input.agent) {
        throw new Error('agent_not_found')
      }

      const modelOptions: GatewayAgentLoopModelOptions = {
        gateways: options.gateways,
        agent: input.agent,
        runId: input.runId
      }
      const gatewayId = input.agent.gatewayPolicy.gatewayId ?? options.defaultGatewayId
      const modelId = input.agent.gatewayPolicy.modelId ?? options.defaultModelId

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
        } else {
          yield { type: 'progress', message: 'Agent produced a CanvasPlan', progress: 90 }
        }

        next = await loop.next()
      }

      return sanitizePlan(next.value.plan)
    },
    async *resumeApprovedTool(input): AsyncGenerator<OrchestratorProgressDraft, CanvasPlan> {
      const modelOptions: GatewayAgentLoopModelOptions = {
        gateways: options.gateways,
        agent: input.agent,
        runId: input.runId
      }
      const gatewayId = input.agent.gatewayPolicy.gatewayId ?? options.defaultGatewayId
      const modelId = input.agent.gatewayPolicy.modelId ?? options.defaultModelId

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
        } else {
          yield { type: 'progress', message: 'Agent produced a CanvasPlan', progress: 90 }
        }

        next = await loop.next()
      }

      return sanitizePlan(next.value.plan)
    }
  }
}
