import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import type { AgentDefinition, AgentResponse } from '../shared/agents'
import type { GatewayRequest, GatewayResult } from '../shared/gateway'
import type { CanvasPlan } from '../shared/plan'
import type { ToolDescriptor } from '../shared/tools'
import { createGatewayAgentPlanner } from '../desktop/src/main/agent/gateway-loop-model'
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

describe('Gateway-backed Agent loop planner', () => {
  it('turns model toolCalls and tool observations into a sanitized CanvasPlan', async () => {
    const prompts: string[] = []
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
      async invoke(_gatewayId: string, request: GatewayRequest): Promise<GatewayResult> {
        prompts.push(request.prompt)

        if (prompts.length === 1) {
          return textResult(JSON.stringify({
            type: 'toolCalls',
            message: 'Read the graph first.',
            calls: [{ id: 'call-query', toolId: 'canvas.queryGraph', input: {} }]
          }))
        }

        return textResult(`\`\`\`json\n${JSON.stringify({ type: 'plan', plan: finalPlan })}\n\`\`\``)
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
      progress.push(next.value.message)
      next = await stream.next()
    }

    expect(progress).toEqual([
      'Agent loop turn 1',
      'Tool canvas.queryGraph completed',
      'Agent loop turn 2',
      'Agent produced a CanvasPlan'
    ])
    expect(prompts).toHaveLength(2)
    expect(prompts[0]).toContain('Allowed tools')
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
        async invoke() {
          return textResult(JSON.stringify(unsafePlan))
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

  it('converts invalid model JSON into a safe clarify plan with dropped audit', async () => {
    const planner = createGatewayAgentPlanner({
      gateways: {
        async invoke() {
          return textResult('I think you should make a cool picture, but this is not JSON.')
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
})
