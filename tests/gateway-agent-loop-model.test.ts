import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import type { AgentDefinition, AgentResponse } from '../shared/agents'
import type { GatewayChatMessage, GatewayRequest, GatewayResult } from '../shared/gateway'
import type { CanvasPlan } from '../shared/plan'
import type { ToolDescriptor } from '../shared/tools'
import { createGatewayAgentPlanner } from '../desktop/src/main/agent/gateway-loop-model'
import { createAgentContextLoop } from '../desktop/src/main/agent/context-loop'
import type { OrchestratorPlannerDraft } from '../desktop/src/main/agent/orchestrator'
import { createToolRuntime, defineTool } from '../desktop/src/main/tools/runtime'

const queryGraphDescriptor: ToolDescriptor = {
  id: 'canvas.queryGraph',
  name: 'Query graph',
  description: 'Reads the current canvas graph snapshot.',
  category: 'canvas',
  owner: { kind: 'builtin', id: 'core' },
  inputSchemaRef: 'canvas.queryGraph.input',
  outputSchemaRef: 'canvas.graph.output',
  permissions: [{ kind: 'canvas.read', reason: 'Reads graph.' }],
  concurrency: 'readonly',
  enabled: true
}

const finalPlan: CanvasPlan = {
  kind: 'plan',
  summary: 'Create a prompt and image generation config.',
  nodes: [
    { ref: 'prompt-1', type: 'text', title: 'Prompt', data: { content: '雨夜侦探' } },
    {
      ref: 'image-1',
      type: 'imageConfigV2',
      title: '关键画面',
      data: { promptOverride: '雨夜侦探', modelId: 'stub-image', orientation: 'portrait' }
    }
  ],
  edges: [{ source: 'prompt-1', target: 'image-1', edgeType: 'promptOrder' }],
  runSteps: [{ ref: 'image-1', action: 'imageRun' }],
  question: null,
  dropped: []
}

function agent(overrides: Partial<AgentDefinition> = {}): AgentDefinition {
  return {
    id: 'orchestrator',
    source: 'builtin',
    name: 'Orchestrator',
    description: 'Turns natural language into declarative CanvasPlan JSON.',
    instructions: 'Inspect tools before planning.',
    allowedTools: ['canvas.queryGraph'],
    allowedSkills: [],
    gatewayPolicy: { gatewayId: 'agent-gateway', modelId: 'agent-model', allowedChannels: ['text'] },
    contextPolicy: {
      includeCanvasGraph: true,
      includeSelectedAssets: false,
      includeRecentMessages: true,
      includeKnowledge: false,
      maxContextTokens: 4000
    },
    permissionPolicy: { allowedPermissionKinds: ['canvas.read'], requireAskForDestructive: true },
    triggerPolicy: { allowedTriggers: ['canvasChat'], defaultTrigger: 'canvasChat', autoRun: false },
    maxTurns: 4,
    effort: 'medium',
    enabled: true,
    ...overrides
  }
}

function textResult(text: string): GatewayResult {
  return { kind: 'text', text }
}

function expectAgentResponse(value: CanvasPlan | AgentResponse): AgentResponse {
  if (!('type' in value)) {
    throw new Error('expected_agent_response')
  }

  return value
}

function plannerDraftMessage(draft: OrchestratorPlannerDraft): string {
  if (draft.type === 'progress') {
    return draft.message
  }

  if (draft.type === 'toolCompleted') {
    return `Tool ${draft.toolId} ${draft.status}`
  }

  return draft.type
}

function expectClosedNativeToolCalls(messages: readonly GatewayChatMessage[]): void {
  const pending = new Map<string, number>()

  for (const message of messages) {
    if (message.role === 'assistant') {
      expect([...pending.entries()], 'assistant/model request started before prior tool calls were closed').toEqual([])
      for (const call of message.tool_calls ?? []) {
        expect(pending.has(call.id), `duplicate assistant tool call id ${call.id}`).toBe(false)
        pending.set(call.id, 0)
      }
      continue
    }

    if (message.role !== 'tool') {
      continue
    }

    const toolCallId = message.tool_call_id
    expect(toolCallId, 'tool observation missing provider call id').toBeTypeOf('string')
    expect(pending.has(toolCallId ?? ''), `orphan tool observation ${toolCallId ?? ''}`).toBe(true)
    pending.set(toolCallId ?? '', (pending.get(toolCallId ?? '') ?? 0) + 1)
    expect(pending.get(toolCallId ?? ''), `duplicate tool observation ${toolCallId ?? ''}`).toBe(1)
    pending.delete(toolCallId ?? '')
  }

  expect([...pending.keys()], 'assistant tool calls missing tool observations').toEqual([])
}

describe('Gateway-backed Agent loop planner', () => {
  it('uses paused execution metadata when the gateway planner resumes an approved child tool', async () => {
    const observedExecution: unknown[] = []
    const runtime = createToolRuntime({
      tools: [defineTool({
        descriptor: queryGraphDescriptor,
        inputSchema: z.object({ page: z.number() }),
        outputSchema: z.object({ page: z.number() }),
        renderToolUseMessage: () => 'Query graph',
        call(input, context) {
          observedExecution.push(context.execution)
          return { page: input.page }
        }
      })]
    })
    const effectiveAgent = agent()
    const loop = createAgentContextLoop({
      agent: effectiveAgent, message: 'Inspect page 3.', trigger: 'canvasChat',
      availableTools: [queryGraphDescriptor]
    })
    loop.transition = 'approval_required'
    loop.turnCount = 1
    loop.messages.push({
      role: 'assistant', content: '',
      toolCalls: [{ id: 'call-gateway-resume', toolId: 'canvas.queryGraph', input: { page: 3 } }]
    })
    Object.assign(loop, {
      execution: {
        runId: 'run-child-gateway', roleId: 'qa-verifier', depth: 2,
        parentTraceId: 'trace-parent', effectiveTools: ['canvas.queryGraph'],
        effectiveSkills: ['gateway-review']
      }
    })
    const planner = createGatewayAgentPlanner({
      gateways: { invoke: () => Promise.resolve(textResult(JSON.stringify({ type: 'canvasPlan', plan: finalPlan }))) },
      tools: runtime,
      listTools: () => [queryGraphDescriptor]
    })
    const stream = planner.resumeApprovedTool?.({
      runId: 'resume-wrapper-run', messageId: 'message-gateway-resume', message: 'Inspect page 3.',
      agentId: effectiveAgent.id, agent: effectiveAgent, trigger: 'canvasChat', loop,
      approval: {
        callId: 'call-gateway-resume', toolId: 'canvas.queryGraph', input: { page: 3 },
        reason: 'Read approval.', requiredPermissions: [{ kind: 'canvas.read', reason: 'Reads graph.' }]
      },
      approvedBy: 'user-local', approvalScope: 'run'
    })
    if (!(typeof stream === 'object' && stream !== null && Symbol.asyncIterator in stream)) {
      throw new Error('expected_async_gateway_resume')
    }
    let next = await stream.next()
    while (!next.done) next = await stream.next()

    expect(observedExecution).toEqual([{
      runId: 'run-child-gateway', roleId: 'qa-verifier', depth: 2,
      parentTraceId: 'trace-parent', effectiveTools: ['canvas.queryGraph'],
      effectiveSkills: ['gateway-review']
    }])
  })

  it('answers greetings locally when no text model is configured', async () => {
    const planner = createGatewayAgentPlanner({
      gateways: {
        invoke() {
          throw new Error('gateway_should_not_be_called_for_greeting')
        }
      },
      tools: createToolRuntime(),
      listTools: () => [queryGraphDescriptor],
      resolveDefaultModel: () => null
    })
    const stream = planner.proposePlan({
      runId: 'run-no-model-hi',
      messageId: 'message-no-model-hi',
      message: 'hi',
      agentId: 'general-purpose',
      agent: agent({
        id: 'general-purpose',
        name: 'General Purpose',
        instructions: 'Answer ordinary messages.',
        allowedTools: ['canvas.queryGraph'],
        gatewayPolicy: { allowedChannels: ['text'] },
        permissionPolicy: { allowedPermissionKinds: ['canvas.read'], requireAskForDestructive: true },
      }),
      trigger: 'canvasChat'
    })

    if (!(typeof stream === 'object' && stream !== null && Symbol.asyncIterator in stream)) {
      throw new Error('expected_async_gateway_planner')
    }

    const progress: string[] = []
    let next = await stream.next()
    while (!next.done) {
      if (next.value.type === 'progress') {
        progress.push(next.value.message)
      }
      next = await stream.next()
    }

    const response = expectAgentResponse(next.value)
    expect(progress).toContain('识别为寒暄，使用本地确定性回复')
    expect(response.type).toBe('answer')
    if (response.type !== 'answer') throw new Error('expected_answer_response')
    expect(response.text).toContain('你好')
    expect(response.text).toContain('画布')
  })

  it('answers greetings locally even when the selected agent points at the stub text gateway', async () => {
    const planner = createGatewayAgentPlanner({
      gateways: {
        invoke() {
          throw new Error('stub_gateway_should_not_answer_greetings')
        }
      },
      tools: createToolRuntime(),
      listTools: () => [queryGraphDescriptor],
      resolveDefaultModel: () => ({ gatewayId: 'stub-main', modelId: 'stub-text' }),
      resolveGatewayType: () => 'stub'
    })
    const stream = planner.proposePlan({
      runId: 'run-stub-hi',
      messageId: 'message-stub-hi',
      message: '你好！',
      agentId: 'general-purpose',
      agent: agent({
        id: 'general-purpose',
        name: 'General Purpose',
        instructions: 'Answer ordinary messages.',
        allowedTools: ['canvas.queryGraph'],
        gatewayPolicy: { gatewayId: 'stub-main', modelId: 'stub-text', allowedChannels: ['text'] },
        permissionPolicy: { allowedPermissionKinds: ['canvas.read'], requireAskForDestructive: true },
      }),
      trigger: 'canvasChat'
    })

    if (!(typeof stream === 'object' && stream !== null && Symbol.asyncIterator in stream)) {
      throw new Error('expected_async_gateway_planner')
    }

    const progress: string[] = []
    let next = await stream.next()
    while (!next.done) {
      if (next.value.type === 'progress') {
        progress.push(next.value.message)
      }
      next = await stream.next()
    }

    const response = expectAgentResponse(next.value)
    expect(progress).toContain('识别为寒暄，使用本地确定性回复')
    expect(response.type).toBe('answer')
    if (response.type !== 'answer') throw new Error('expected_answer_response')
    expect(response.text).toContain('你好')
    expect(response.text).toContain('画布')
  })

  it('answers assistant identity questions locally without calling tools or the gateway', async () => {
    const planner = createGatewayAgentPlanner({
      gateways: {
        invoke() {
          throw new Error('gateway_should_not_answer_identity_questions')
        }
      },
      tools: createToolRuntime({
        permissionPolicy: () => ({
          decision: 'ask',
          decisionReason: 'Any tool would require approval.',
          requiredPermissions: [{ kind: 'network', reason: 'Network access.' }]
        })
      }),
      listTools: () => [queryGraphDescriptor],
      resolveDefaultModel: () => ({ gatewayId: 'deepseek', modelId: 'deepseek-chat' }),
      resolveGatewayType: (gatewayId) => gatewayId === 'deepseek' ? 'openai_compat' : 'stub'
    })
    const stream = planner.proposePlan({
      runId: 'run-identity-local',
      messageId: 'message-identity-local',
      message: '你是谁',
      agentId: 'general-purpose',
      agent: agent({
        id: 'general-purpose',
        name: 'General Purpose',
        instructions: 'Answer ordinary messages.',
        allowedTools: ['canvas.queryGraph'],
        gatewayPolicy: { gatewayId: 'agent-gateway', modelId: 'agent-model', allowedChannels: ['text'] },
        permissionPolicy: { allowedPermissionKinds: ['canvas.read'], requireAskForDestructive: true },
      }),
      trigger: 'canvasChat'
    })

    if (!(typeof stream === 'object' && stream !== null && Symbol.asyncIterator in stream)) {
      throw new Error('expected_async_gateway_planner')
    }

    const progress: string[] = []
    let next = await stream.next()
    while (!next.done) {
      if (next.value.type === 'progress') {
        progress.push(next.value.message)
      }
      next = await stream.next()
    }

    const response = expectAgentResponse(next.value)
    expect(progress).toContain('识别为身份问答，使用本地确定性回复')
    expect(response.type).toBe('answer')
    if (response.type !== 'answer') throw new Error('expected_answer_response')
    expect(response.text).toContain('ComicCanvas')
    expect(response.text).toContain('通用 Agent')
    expect(response.text).toContain('画布')
  })

  it('answers deterministic date questions locally without calling stub or real text gateways', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-08T12:00:00+08:00'))

    try {
      const planner = createGatewayAgentPlanner({
        gateways: {
          invoke() {
            throw new Error('gateway_should_not_answer_deterministic_date_questions')
          }
        },
        tools: createToolRuntime(),
        listTools: () => [queryGraphDescriptor],
        resolveDefaultModel: () => ({ gatewayId: 'deepseek', modelId: 'deepseek-chat' }),
        resolveGatewayType: (gatewayId) => gatewayId === 'deepseek' ? 'openai_compat' : 'stub'
      })
      const stream = planner.proposePlan({
        runId: 'run-date-local',
        messageId: 'message-date-local',
        message: '今天星期几',
        agentId: 'general-purpose',
        agent: agent({
          id: 'general-purpose',
          name: 'General Purpose',
          instructions: 'Answer ordinary messages.',
          allowedTools: ['canvas.queryGraph'],
          gatewayPolicy: { gatewayId: 'stub-main', modelId: 'stub-text', allowedChannels: ['text'] },
          permissionPolicy: { allowedPermissionKinds: ['canvas.read'], requireAskForDestructive: true },
        }),
        trigger: 'canvasChat'
      })

      if (!(typeof stream === 'object' && stream !== null && Symbol.asyncIterator in stream)) {
        throw new Error('expected_async_gateway_planner')
      }

      const progress: string[] = []
      let next = await stream.next()
      while (!next.done) {
        if (next.value.type === 'progress') {
          progress.push(next.value.message)
        }
        next = await stream.next()
      }

      const response = expectAgentResponse(next.value)
      expect(progress).toContain('识别为本地确定性问题，使用本地回复')
      expect(response).toMatchObject({
        type: 'answer',
        text: '今天是星期三。'
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('answers tomorrow weekday questions locally without calling text gateways', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-08T12:00:00+08:00'))

    try {
      const planner = createGatewayAgentPlanner({
        gateways: {
          invoke() {
            throw new Error('gateway_should_not_answer_tomorrow_weekday_questions')
          }
        },
        tools: createToolRuntime(),
        listTools: () => [queryGraphDescriptor],
        resolveDefaultModel: () => ({ gatewayId: 'deepseek', modelId: 'deepseek-chat' }),
        resolveGatewayType: (gatewayId) => gatewayId === 'deepseek' ? 'openai_compat' : 'stub'
      })
      const stream = planner.proposePlan({
        runId: 'run-tomorrow-date-local',
        messageId: 'message-tomorrow-date-local',
        message: '明天星期几',
        agentId: 'general-purpose',
        agent: agent({
          id: 'general-purpose',
          name: 'General Purpose',
          instructions: 'Answer ordinary messages.',
          allowedTools: ['canvas.queryGraph'],
          gatewayPolicy: { gatewayId: 'stub-main', modelId: 'stub-text', allowedChannels: ['text'] },
          permissionPolicy: { allowedPermissionKinds: ['canvas.read'], requireAskForDestructive: true },
        }),
        trigger: 'canvasChat'
      })

      if (!(typeof stream === 'object' && stream !== null && Symbol.asyncIterator in stream)) {
        throw new Error('expected_async_gateway_planner')
      }

      const progress: string[] = []
      let next = await stream.next()
      while (!next.done) {
        if (next.value.type === 'progress') {
          progress.push(next.value.message)
        }
        next = await stream.next()
      }

      const response = expectAgentResponse(next.value)
      expect(progress).toContain('识别为本地确定性问题，使用本地回复')
      expect(response).toMatchObject({
        type: 'answer',
        text: '明天是星期四。'
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('routes ordinary general chat to the real default text model instead of an agent-pinned stub gateway', async () => {
    const calls: Array<{ gatewayId: string; request: GatewayRequest }> = []
    const planner = createGatewayAgentPlanner({
      gateways: {
        invoke(gatewayId, request) {
          calls.push({ gatewayId, request })
          if (gatewayId === 'stub-main') {
            throw new Error('stub_gateway_should_not_handle_general_chat')
          }

          return Promise.resolve(textResult('今天是星期三。'))
        }
      },
      tools: createToolRuntime(),
      listTools: () => [queryGraphDescriptor],
      resolveDefaultModel: () => ({ gatewayId: 'deepseek', modelId: 'deepseek-chat' }),
      resolveGatewayType: (gatewayId) => gatewayId === 'deepseek' ? 'openai_compat' : 'stub'
    })
    const stream = planner.proposePlan({
      runId: 'run-real-default-date',
      messageId: 'message-real-default-date',
      message: '帮我解释一下蒙太奇是什么',
      agentId: 'general-purpose',
      agent: agent({
        id: 'general-purpose',
        name: 'General Purpose',
        instructions: 'Answer ordinary messages.',
        allowedTools: ['canvas.queryGraph'],
        gatewayPolicy: { gatewayId: 'stub-main', modelId: 'stub-text', allowedChannels: ['text'] },
        permissionPolicy: { allowedPermissionKinds: ['canvas.read'], requireAskForDestructive: true },
      }),
      trigger: 'canvasChat'
    })

    if (!(typeof stream === 'object' && stream !== null && Symbol.asyncIterator in stream)) {
      throw new Error('expected_async_gateway_planner')
    }

    let next = await stream.next()
    while (!next.done) {
      next = await stream.next()
    }

    const response = expectAgentResponse(next.value)
    expect(calls.map((call) => call.gatewayId)).toEqual(['deepseek'])
    expect(calls[0]?.request.modelKey).toBe('deepseek-chat')
    expect(response).toMatchObject({ type: 'answer', text: '今天是星期三。' })
  })

  it('does not fall back to stub text when a real general-chat model call fails', async () => {
    const calls: string[] = []
    const planner = createGatewayAgentPlanner({
      gateways: {
        invoke(gatewayId) {
          calls.push(gatewayId)
          if (gatewayId === 'stub-main') {
            throw new Error('stub_gateway_should_not_be_used_as_text_fallback')
          }

          throw new Error('real_gateway_unavailable')
        }
      },
      tools: createToolRuntime(),
      listTools: () => [queryGraphDescriptor],
      fallbackGatewayId: 'stub-main',
      fallbackModelId: 'stub-text',
      resolveDefaultModel: () => ({ gatewayId: 'deepseek', modelId: 'deepseek-chat' }),
      resolveGatewayType: (gatewayId) => gatewayId === 'deepseek' ? 'openai_compat' : 'stub'
    })
    const stream = planner.proposePlan({
      runId: 'run-real-fail-no-stub',
      messageId: 'message-real-fail-no-stub',
      message: '帮我解释一下蒙太奇是什么',
      agentId: 'general-purpose',
      agent: agent({
        id: 'general-purpose',
        name: 'General Purpose',
        instructions: 'Answer ordinary messages.',
        allowedTools: ['canvas.queryGraph'],
        gatewayPolicy: { allowedChannels: ['text'] },
        permissionPolicy: { allowedPermissionKinds: ['canvas.read'], requireAskForDestructive: true },
      }),
      trigger: 'canvasChat'
    })

    if (!(typeof stream === 'object' && stream !== null && Symbol.asyncIterator in stream)) {
      throw new Error('expected_async_gateway_planner')
    }

    await expect(async () => {
      let next = await stream.next()
      while (!next.done) {
        next = await stream.next()
      }
    }).rejects.toThrow('real_gateway_unavailable')
    // 瞬时失败重试 2 次（共 3 次主网关调用）；stub 永不用作文本 fallback。
    expect(calls).toEqual(['deepseek', 'deepseek', 'deepseek'])
    expect(calls).not.toContain('stub-main')
  })

  it('turns model toolCalls and tool observations into a sanitized CanvasPlan', async () => {
    const prompts: string[] = []
    const gatewayIds: string[] = []
    const modelKeys: string[] = []
    const runtime = createToolRuntime({
      idFactory: () => 'invoke-query',
      clock: () => 1_783_900_000_000,
      tools: [
        defineTool({
          descriptor: queryGraphDescriptor,
          inputSchema: z.object({}),
          outputSchema: z.object({ nodeCount: z.number() }),
          renderToolUseMessage: () => 'Query graph',
          call() {
            return { nodeCount: 0 }
          }
        })
      ]
    })
    const gateways = {
      invoke(gatewayId: string, request: GatewayRequest): Promise<GatewayResult> {
        gatewayIds.push(gatewayId)
        modelKeys.push(request.modelKey)
        prompts.push(request.prompt)

        if (prompts.length === 1) {
          return Promise.resolve(textResult(JSON.stringify({
            type: 'toolCalls',
            message: 'Read the graph first.',
            calls: [{ id: 'call-query', toolId: 'canvas.queryGraph', input: {} }]
          })))
        }

        return Promise.resolve(textResult(`\`\`\`json\n${JSON.stringify({ type: 'plan', plan: finalPlan })}\n\`\`\``))
      }
    }
    const planner = createGatewayAgentPlanner({
      gateways,
      tools: runtime,
      listTools: () => [queryGraphDescriptor]
    })
    const stream = planner.proposePlan({
      runId: 'run-gateway-agent',
      messageId: 'message-gateway-agent',
      message: '做一个雨夜侦探竖屏画面',
      agentId: 'orchestrator',
      agent: agent(),
      trigger: 'canvasChat'
    })

    if (!(typeof stream === 'object' && stream !== null && Symbol.asyncIterator in stream)) {
      throw new Error('expected_async_gateway_planner')
    }

    const progress: string[] = []
    let next = await stream.next()

    while (!next.done) {
      progress.push(plannerDraftMessage(next.value))
      next = await stream.next()
    }

    expect(progress).toEqual([
      'Agent loop turn 1',
      'toolStarted',
      'Tool canvas.queryGraph completed',
      'Agent loop turn 2',
      'Agent produced a CanvasPlan'
    ])
    expect(prompts).toHaveLength(2)
    expect(gatewayIds).toEqual(['agent-gateway', 'agent-gateway'])
    expect(modelKeys).toEqual(['agent-model', 'agent-model'])
    expect(prompts[0]).toContain('Allowed tools')
    expect(prompts[0]).toContain('Use web.search before answering current, latest, price, news, or time-sensitive questions')
    expect(prompts[0]).toContain('If web.search is unavailable or denied, say that clearly')
    expect(prompts[0]).toContain('cite the relevant source URL or numbered source marker')
    expect(prompts[0]).toContain('CanvasPlan only describes new nodes, edges, and run steps')
    expect(prompts[1]).toContain('\\"nodeCount\\":0')
    expect(expectAgentResponse(next.value)).toEqual({ type: 'canvasPlan', plan: finalPlan })
  })

  it('sanitizes unsafe model-produced CanvasPlan fields before returning', async () => {
    const unsafePlan = {
      ...finalPlan,
      nodes: [
        ...finalPlan.nodes,
        { ref: 'legacy', type: 'mjImage', title: 'Legacy', data: { onRun: 'window.alert(1)' } }
      ],
      dropped: ['model:raw-warning']
    }
    const planner = createGatewayAgentPlanner({
      gateways: {
        invoke() {
          return Promise.resolve(textResult(JSON.stringify(unsafePlan)))
        }
      },
      tools: createToolRuntime(),
      listTools: () => [queryGraphDescriptor]
    })
    const result = planner.proposePlan({
      runId: 'run-unsafe-agent',
      messageId: 'message-unsafe-agent',
      message: 'try legacy node',
      agentId: 'orchestrator',
      agent: agent(),
      trigger: 'canvasChat'
    })

    if (!(typeof result === 'object' && result !== null && Symbol.asyncIterator in result)) {
      throw new Error('expected_async_gateway_planner')
    }

    let next = await result.next()
    while (!next.done) {
      next = await result.next()
    }

    const response = expectAgentResponse(next.value)
    expect(response.type).toBe('canvasPlan')
    if (response.type !== 'canvasPlan') {
      throw new Error('expected_canvas_plan_response')
    }
    expect(response.plan.nodes.map((node) => node.type)).toEqual(['text', 'imageConfigV2'])
    expect(response.plan.dropped).toEqual(expect.arrayContaining(['model:raw-warning', 'node:legacy:unsupported_type']))
  })

  it('turns a fully dropped model mutation into a clarification instead of an empty plan', async () => {
    const planner = createGatewayAgentPlanner({
      gateways: {
        invoke() {
          return Promise.resolve(textResult(JSON.stringify({
            type: 'canvasPlan',
            plan: {
              kind: 'plan',
              summary: 'Update Character 1 to 凌霜月.',
              nodes: [{ type: 'character', title: '凌霜月', data: { label: '凌霜月' } }],
              edges: [],
              runSteps: [],
              question: null,
              dropped: []
            }
          })))
        }
      },
      tools: createToolRuntime(),
      listTools: () => [queryGraphDescriptor]
    })
    const result = planner.proposePlan({
      runId: 'run-fully-dropped-plan',
      messageId: 'message-fully-dropped-plan',
      message: '把当前角色节点 Character 1 改为凌霜月',
      agentId: 'orchestrator',
      agent: agent(),
      trigger: 'canvasChat'
    })

    if (!(typeof result === 'object' && result !== null && Symbol.asyncIterator in result)) {
      throw new Error('expected_async_gateway_planner')
    }

    let next = await result.next()
    while (!next.done) {
      next = await result.next()
    }

    const response = expectAgentResponse(next.value)
    expect(response.type).toBe('clarification')
    if (response.type !== 'clarification') {
      throw new Error('expected_clarification_response')
    }
    expect(response.dropped).toContain('node[0].ref:invalid_string')
  })

  it('converts invalid model JSON into a safe clarify plan with dropped audit', async () => {
    const planner = createGatewayAgentPlanner({
      gateways: {
        invoke() {
          return Promise.resolve(textResult('I think you should make a cool picture, but this is not JSON.'))
        }
      },
      tools: createToolRuntime(),
      listTools: () => [queryGraphDescriptor]
    })
    const result = planner.proposePlan({
      runId: 'run-invalid-json-agent',
      messageId: 'message-invalid-json-agent',
      message: 'make something cool',
      agentId: 'orchestrator',
      agent: agent(),
      trigger: 'canvasChat'
    })

    if (!(typeof result === 'object' && result !== null && Symbol.asyncIterator in result)) {
      throw new Error('expected_async_gateway_planner')
    }

    let next = await result.next()
    while (!next.done) {
      next = await result.next()
    }

    const response = expectAgentResponse(next.value)
    expect(response).toMatchObject({
      type: 'clarification',
      missing: ['画布目标', '节点类型', '参考素材'],
      dropped: ['agent_model_json_invalid']
    })
    expect(response.type).toBe('clarification')
    if (response.type !== 'clarification') {
      throw new Error('expected_clarification_response')
    }
    expect(response.question).toContain('画布目标')
  })

  it('uses native gateway tools for openai_compat gateways', async () => {
    const requests: GatewayRequest[] = []
    const runtime = createToolRuntime({
      idFactory: () => 'invoke-query-runtime',
      tools: [
        defineTool({
          descriptor: { ...queryGraphDescriptor, inputParametersJsonSchema: { type: 'object', properties: {}, additionalProperties: false } },
          inputSchema: z.object({}),
          outputSchema: z.object({ nodeCount: z.number() }),
          renderToolUseMessage: () => 'Query graph',
          call() {
            return { nodeCount: 0 }
          }
        })
      ]
    })
    const planner = createGatewayAgentPlanner({
      gateways: {
        invoke(_gatewayId, request) {
          requests.push(request)
          if (requests.length === 1) {
            return Promise.resolve({
              kind: 'text',
              text: '',
              toolCalls: [{
                id: 'call-query',
                type: 'function',
                function: { name: 'tool_canvas_d_queryGraph', arguments: '{}' }
              }]
            })
          }

          return Promise.resolve(textResult(JSON.stringify({ type: 'canvasPlan', plan: finalPlan })))
        }
      },
      tools: runtime,
      listTools: () => [queryGraphDescriptor],
      resolveGatewayType: () => 'openai_compat'
    })
    const stream = planner.proposePlan({
      runId: 'run-native-tools',
      messageId: 'message-native-tools',
      message: '做一个雨夜侦探竖屏画面',
      agentId: 'orchestrator',
      agent: agent({ gatewayPolicy: { gatewayId: 'openai-local', modelId: 'gpt-test', allowedChannels: ['text'] } }),
      trigger: 'canvasChat'
    })

    if (!(typeof stream === 'object' && stream !== null && Symbol.asyncIterator in stream)) {
      throw new Error('expected_async_gateway_planner')
    }

    let next = await stream.next()
    while (!next.done) {
      next = await stream.next()
    }

    expect(requests[0]?.tools?.map((tool) => tool.function.name)).toEqual(['tool_canvas_d_queryGraph'])
    expect(requests[0]?.messages?.some((message) => message.role === 'system')).toBe(true)
    expect(requests[1]?.messages?.find((message) => message.role === 'tool')).toMatchObject({
      role: 'tool',
      tool_call_id: 'call-query',
      name: 'tool_canvas_d_queryGraph'
    })
    expect(expectAgentResponse(next.value).type).toBe('canvasPlan')
  })

  it('closes multiple native calls to the same tool with their distinct provider IDs', async () => {
    const requests: GatewayRequest[] = []
    const invokedPages: number[] = []
    const pagedDescriptor: ToolDescriptor = {
      ...queryGraphDescriptor,
      inputParametersJsonSchema: {
        type: 'object',
        properties: { page: { type: 'number' } },
        required: ['page'],
        additionalProperties: false
      }
    }
    const runtime = createToolRuntime({
      idFactory: (() => {
        let next = 0
        return () => `invoke-query-${next += 1}`
      })(),
      tools: [
        defineTool({
          descriptor: pagedDescriptor,
          inputSchema: z.object({ page: z.number() }),
          outputSchema: z.object({ page: z.number() }),
          renderToolUseMessage: () => 'Query graph',
          call(input) {
            invokedPages.push(input.page)
            return { page: input.page }
          }
        })
      ]
    })
    const planner = createGatewayAgentPlanner({
      gateways: {
        invoke(_gatewayId, request) {
          requests.push(request)
          if (requests.length === 1) {
            return Promise.resolve({
              kind: 'text',
              text: '',
              toolCalls: [
                {
                  id: 'provider-call-page-1',
                  type: 'function',
                  function: { name: 'tool_canvas_d_queryGraph', arguments: '{"page":1}' }
                },
                {
                  id: 'provider-call-page-2',
                  type: 'function',
                  function: { name: 'tool_canvas_d_queryGraph', arguments: '{"page":2}' }
                }
              ]
            })
          }

          return Promise.resolve(textResult(JSON.stringify({ type: 'canvasPlan', plan: finalPlan })))
        }
      },
      tools: runtime,
      listTools: () => [pagedDescriptor],
      resolveGatewayType: () => 'openai_compat'
    })
    const stream = planner.proposePlan({
      runId: 'run-native-tools-repeated',
      messageId: 'message-native-tools-repeated',
      message: '读取两页画布再规划',
      agentId: 'orchestrator',
      agent: agent({ gatewayPolicy: { gatewayId: 'openai-local', modelId: 'gpt-test', allowedChannels: ['text'] } }),
      trigger: 'canvasChat'
    })

    if (!(typeof stream === 'object' && stream !== null && Symbol.asyncIterator in stream)) {
      throw new Error('expected_async_gateway_planner')
    }

    let next = await stream.next()
    while (!next.done) {
      next = await stream.next()
    }

    expect(invokedPages).toEqual([1, 2])
    expect(requests[1]?.messages?.find((message) => message.role === 'assistant')?.tool_calls?.map((call) => call.id)).toEqual([
      'provider-call-page-1',
      'provider-call-page-2'
    ])
    expect(requests[1]?.messages?.filter((message) => message.role === 'tool').map((message) => message.tool_call_id)).toEqual([
      'provider-call-page-1',
      'provider-call-page-2'
    ])
    expect(expectAgentResponse(next.value).type).toBe('canvasPlan')
  })

  it('closes a failed native tool call before the next model request', async () => {
    const requests: GatewayRequest[] = []
    const runtime = createToolRuntime({
      idFactory: () => 'invoke-native-failed',
      tools: [
        defineTool({
          descriptor: {
            ...queryGraphDescriptor,
            inputParametersJsonSchema: { type: 'object', properties: {}, additionalProperties: false }
          },
          inputSchema: z.object({}),
          outputSchema: z.object({ nodeCount: z.number() }),
          renderToolUseMessage: () => 'Query graph',
          call() {
            throw new Error('native graph unavailable')
          }
        })
      ]
    })
    const planner = createGatewayAgentPlanner({
      gateways: {
        invoke(_gatewayId, request) {
          requests.push(request)
          if (requests.length === 1) {
            return Promise.resolve({
              kind: 'text',
              text: '',
              toolCalls: [{
                id: 'provider-call-failed-query',
                type: 'function',
                function: { name: 'tool_canvas_d_queryGraph', arguments: '{}' }
              }]
            })
          }

          return Promise.resolve(textResult(JSON.stringify({ type: 'canvasPlan', plan: finalPlan })))
        }
      },
      tools: runtime,
      listTools: () => [queryGraphDescriptor],
      resolveGatewayType: () => 'openai_compat'
    })
    const stream = planner.proposePlan({
      runId: 'run-native-tools-failed',
      messageId: 'message-native-tools-failed',
      message: '读取画布再规划',
      agentId: 'orchestrator',
      agent: agent({ gatewayPolicy: { gatewayId: 'openai-local', modelId: 'gpt-test', allowedChannels: ['text'] } }),
      trigger: 'canvasChat'
    })

    if (!(typeof stream === 'object' && stream !== null && Symbol.asyncIterator in stream)) {
      throw new Error('expected_async_gateway_planner')
    }

    let next = await stream.next()
    while (!next.done) {
      next = await stream.next()
    }

    expect(requests).toHaveLength(2)
    expectClosedNativeToolCalls(requests[1]?.messages ?? [])
    const toolMessages = requests[1]?.messages?.filter((message) => message.role === 'tool') ?? []
    expect(toolMessages).toHaveLength(1)
    expect(toolMessages[0]).toMatchObject({
      role: 'tool',
      tool_call_id: 'provider-call-failed-query',
      name: 'tool_canvas_d_queryGraph'
    })
    expect(toolMessages[0]?.content).toContain('native graph unavailable')
    expect(expectAgentResponse(next.value).type).toBe('canvasPlan')
  })

  it('quarantines and denies non-canonical native provider calls without executing them', async () => {
    const requests: GatewayRequest[] = []
    let runtimeInvoked = false
    const planner = createGatewayAgentPlanner({
      gateways: {
        invoke(_gatewayId, request) {
          requests.push(request)
          if (requests.length === 1) {
            return Promise.resolve({
              kind: 'text',
              text: '',
              toolCalls: [{
                id: 'provider-call-non-canonical',
                type: 'function',
                function: { name: 'tool_canvas_x2e_queryGraph', arguments: '{}' }
              }]
            })
          }

          return Promise.resolve(textResult(JSON.stringify({ type: 'canvasPlan', plan: finalPlan })))
        }
      },
      tools: {
        invoke() {
          runtimeInvoked = true
          throw new Error('unknown_tool_should_not_reach_runtime')
        }
      },
      listTools: () => [queryGraphDescriptor],
      resolveGatewayType: () => 'openai_compat'
    })
    const stream = planner.proposePlan({
      runId: 'run-native-tools-non-canonical',
      messageId: 'message-native-tools-non-canonical',
      message: '尝试非规范工具名',
      agentId: 'orchestrator',
      agent: agent({ gatewayPolicy: { gatewayId: 'openai-local', modelId: 'gpt-test', allowedChannels: ['text'] } }),
      trigger: 'canvasChat'
    })

    if (!(typeof stream === 'object' && stream !== null && Symbol.asyncIterator in stream)) {
      throw new Error('expected_async_gateway_planner')
    }

    let next = await stream.next()
    while (!next.done) {
      next = await stream.next()
    }

    expect(runtimeInvoked).toBe(false)
    expect(requests[1]?.messages?.filter((message) => message.role === 'tool')).toEqual([
      expect.objectContaining({
        role: 'tool',
        tool_call_id: 'provider-call-non-canonical',
        name: 'tool_unknown_d_gateway-tool_d_malformed_d_1',
        content: 'Tool denied by agent policy.'
      })
    ])
    expect(expectAgentResponse(next.value).type).toBe('canvasPlan')
  })

  it('quarantines malformed native calls behind closed synthetic transcript IDs without executing permissive tools', async () => {
    const requests: GatewayRequest[] = []
    const executedInputs: unknown[] = []
    const permissiveDescriptor: ToolDescriptor = {
      ...queryGraphDescriptor,
      inputParametersJsonSchema: { type: 'object', additionalProperties: true }
    }
    const runtime = createToolRuntime({
      tools: [defineTool({
        descriptor: permissiveDescriptor,
        inputSchema: z.unknown(),
        outputSchema: z.unknown(),
        renderToolUseMessage: () => 'Query graph',
        call(input) {
          executedInputs.push(input)
          return input
        }
      })]
    })
    const planner = createGatewayAgentPlanner({
      gateways: {
        invoke(_gatewayId, request) {
          requests.push(request)
          if (requests.length === 1) {
            return Promise.resolve({
              kind: 'text',
              text: '',
              toolCalls: [
                {
                  id: '',
                  type: 'function',
                  function: { name: 'tool_canvas_d_queryGraph', arguments: '{}' }
                },
                {
                  id: 'provider-call-invalid-json',
                  type: 'function',
                  function: { name: 'tool_canvas_d_queryGraph', arguments: '{"page":' }
                }
              ]
            })
          }

          return Promise.resolve(textResult(JSON.stringify({ type: 'canvasPlan', plan: finalPlan })))
        }
      },
      tools: runtime,
      listTools: () => [permissiveDescriptor],
      resolveGatewayType: () => 'openai_compat'
    })
    const stream = planner.proposePlan({
      runId: 'run-native-tools-malformed-provider-calls',
      messageId: 'message-native-tools-malformed-provider-calls',
      message: '尝试格式错误的原生工具调用',
      agentId: 'orchestrator',
      agent: agent({ gatewayPolicy: { gatewayId: 'openai-local', modelId: 'gpt-test', allowedChannels: ['text'] } }),
      trigger: 'canvasChat'
    })

    if (!(typeof stream === 'object' && stream !== null && Symbol.asyncIterator in stream)) {
      throw new Error('expected_async_gateway_planner')
    }

    for await (const draft of stream) {
      void draft
    }

    expect(executedInputs).toEqual([])
    expectClosedNativeToolCalls(requests[1]?.messages ?? [])
    const assistantCalls = requests[1]?.messages?.find((message) => message.role === 'assistant')?.tool_calls ?? []
    const toolMessages = requests[1]?.messages?.filter((message) => message.role === 'tool') ?? []
    expect(assistantCalls.map((call) => call.id)).toEqual(['model-tool-call-1', 'model-tool-call-2'])
    expect(toolMessages.map((message) => message.tool_call_id)).toEqual(['model-tool-call-1', 'model-tool-call-2'])
    expect(toolMessages).toEqual([
      expect.objectContaining({
        name: 'tool_unknown_d_gateway-tool_d_malformed_d_1',
        content: 'Tool denied by agent policy.'
      }),
      expect.objectContaining({
        name: 'tool_unknown_d_gateway-tool_d_malformed_d_2',
        content: 'Tool denied by agent policy.'
      })
    ])
  })

  it('closes duplicate native IDs without executing duplicate side effects', async () => {
    const requests: GatewayRequest[] = []
    const invokedPages: number[] = []
    const pagedDescriptor: ToolDescriptor = {
      ...queryGraphDescriptor,
      inputParametersJsonSchema: {
        type: 'object',
        properties: { page: { type: 'number' } },
        required: ['page'],
        additionalProperties: false
      }
    }
    const runtime = createToolRuntime({
      tools: [defineTool({
        descriptor: pagedDescriptor,
        inputSchema: z.object({ page: z.number() }),
        outputSchema: z.object({ page: z.number() }),
        renderToolUseMessage: () => 'Query graph',
        call(input) {
          invokedPages.push(input.page)
          return { page: input.page }
        }
      })]
    })
    const planner = createGatewayAgentPlanner({
      gateways: {
        invoke(_gatewayId, request) {
          requests.push(request)
          if (requests.length === 1) {
            return Promise.resolve({
              kind: 'text',
              text: '',
              toolCalls: [
                {
                  id: 'provider-call-duplicate',
                  type: 'function',
                  function: { name: 'tool_canvas_d_queryGraph', arguments: '{"page":1}' }
                },
                {
                  id: 'provider-call-duplicate',
                  type: 'function',
                  function: { name: 'tool_canvas_d_queryGraph', arguments: '{"page":2}' }
                }
              ]
            })
          }

          return Promise.resolve(textResult(JSON.stringify({ type: 'canvasPlan', plan: finalPlan })))
        }
      },
      tools: runtime,
      listTools: () => [pagedDescriptor],
      resolveGatewayType: () => 'openai_compat'
    })
    const stream = planner.proposePlan({
      runId: 'run-native-tools-duplicate-id',
      messageId: 'message-native-tools-duplicate-id',
      message: 'read once despite duplicate provider IDs',
      agentId: 'orchestrator',
      agent: agent({ gatewayPolicy: { gatewayId: 'openai-local', modelId: 'gpt-test', allowedChannels: ['text'] } }),
      trigger: 'canvasChat'
    })

    if (!(typeof stream === 'object' && stream !== null && Symbol.asyncIterator in stream)) {
      throw new Error('expected_async_gateway_planner')
    }

    for await (const draft of stream) {
      void draft
    }

    expect(invokedPages).toEqual([1])
    expectClosedNativeToolCalls(requests[1]?.messages ?? [])
    const assistantIds = requests[1]?.messages?.find((message) => message.role === 'assistant')?.tool_calls?.map((call) => call.id) ?? []
    expect(new Set(assistantIds).size).toBe(2)
  })
})
