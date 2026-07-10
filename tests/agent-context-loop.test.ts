import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import type { AgentDefinition } from '../shared/agents'
import type { ToolDescriptor } from '../shared/tools'
import { AgentLoopTerminalError, compactAgentMessages, createAgentContextLoop, filterAgentTools, resumeAgentContextLoopWithApproval, runAgentContextLoop } from '../desktop/src/main/agent/context-loop'
import { createToolRuntime, defineTool } from '../desktop/src/main/tools/runtime'
import type { CanvasPlan } from '../shared/plan'

const readTool: ToolDescriptor = {
  id: 'canvas.queryGraph',
  name: 'Query graph',
  description: 'Reads graph.',
  category: 'canvas',
  owner: { kind: 'builtin', id: 'core' },
  inputSchemaRef: 'canvas.queryGraph.input',
  outputSchemaRef: 'canvas.queryGraph.output',
  permissions: [{ kind: 'canvas.read', reason: 'Reads canvas graph.' }],
  concurrency: 'readonly',
  enabled: true
}

const writeTool: ToolDescriptor = {
  id: 'canvas.createNode',
  name: 'Create node',
  description: 'Writes graph.',
  category: 'canvas',
  owner: { kind: 'builtin', id: 'core' },
  inputSchemaRef: 'canvas.createNode.input',
  outputSchemaRef: 'canvas.createNode.output',
  permissions: [{ kind: 'canvas.write', reason: 'Mutates canvas graph.' }],
  concurrency: 'serial-write',
  enabled: true
}

const disabledTool: ToolDescriptor = {
  ...readTool,
  id: 'canvas.disabled',
  enabled: false
}

const finalPlan: CanvasPlan = {
  kind: 'plan',
  summary: 'Create one prompt node.',
  nodes: [{ ref: 'prompt-1', type: 'text', title: 'Prompt', data: { content: 'spaceship' } }],
  edges: [],
  runSteps: [],
  question: null,
  dropped: []
}

function agent(overrides: Partial<AgentDefinition> = {}): AgentDefinition {
  return {
    id: 'agent-reader',
    source: 'user',
    name: 'Reader',
    description: 'Reads canvas context.',
    instructions: 'Inspect the canvas before planning.',
    allowedTools: ['canvas.queryGraph', 'canvas.createNode'],
    allowedSkills: [],
    gatewayPolicy: { allowedChannels: ['text'] },
    contextPolicy: {
      includeCanvasGraph: true,
      includeSelectedAssets: false,
      includeRecentMessages: true,
      includeKnowledge: false,
      maxContextTokens: 4000
    },
    permissionPolicy: { allowedPermissionKinds: ['canvas.read'], requireAskForDestructive: true },
    triggerPolicy: { allowedTriggers: ['manual', 'mention'], defaultTrigger: 'manual', autoRun: false },
    maxTurns: 4,
    effort: 'medium',
    enabled: true,
    ...overrides
  }
}

describe('Agent context loop policy', () => {
  it('filters tools by explicit allowlist, enabled state, and permission kinds', () => {
    const result = filterAgentTools(agent(), [readTool, writeTool, disabledTool])

    expect(result.allowedTools.map((tool) => tool.id)).toEqual(['canvas.queryGraph'])
    expect(result.droppedTools).toEqual(['canvas.createNode', 'canvas.disabled'])
  })

  it('builds initial loop state with prompt, trigger, turn budget, and dropped tool trace', () => {
    const loop = createAgentContextLoop({
      agent: agent({ allowedTools: '*' }),
      message: '生成一个角色设定',
      trigger: 'mention',
      availableTools: [readTool, writeTool]
    })

    expect(loop).toMatchObject({
      agentId: 'agent-reader',
      trigger: 'mention',
      turnCount: 0,
      maxTurns: 4,
      transition: 'start',
      userMessage: '生成一个角色设定',
      droppedTools: ['canvas.createNode']
    })
    expect(loop.allowedTools.map((tool) => tool.id)).toEqual(['canvas.queryGraph'])
    expect(loop.systemPrompt).toContain('Inspect the canvas before planning.')
    expect(loop.systemPrompt).toContain('Trigger: mention')
  })

  it('rejects triggers outside the agent trigger policy', () => {
    expect(() =>
      createAgentContextLoop({
        agent: agent(),
        message: 'run from canvas chat',
        trigger: 'canvasChat',
        availableTools: [readTool]
      })
    ).toThrow(AgentLoopTerminalError)
  })

  it('runs tool calls through ToolRuntime and feeds observations into the next model step', async () => {
    const runtime = createToolRuntime({
      idFactory: () => 'invoke-1',
      clock: () => 1_783_700_000_000,
      tools: [
        defineTool({
          descriptor: readTool,
          inputSchema: z.object({}),
          outputSchema: z.object({ nodeCount: z.number() }),
          renderToolUseMessage: () => 'Query graph',
          call() {
            return { nodeCount: 0 }
          }
        })
      ]
    })
    const seenToolMessages: string[] = []
    const events = []
    const loop = runAgentContextLoop({
      agent: agent(),
      message: '先看画布再规划',
      trigger: 'manual',
      availableTools: [readTool, writeTool],
      tools: runtime,
      traceId: 'trace-loop-1',
      model: {
        step(state) {
          if (state.turnCount === 0) {
            return { type: 'toolCalls', calls: [{ id: 'call-1', toolId: 'canvas.queryGraph', input: {} }], message: 'Need graph context.' }
          }

          seenToolMessages.push(...state.messages.filter((message) => message.role === 'tool').map((message) => message.content))
          return { type: 'plan', plan: finalPlan, message: 'Plan ready.' }
        }
      }
    })
    let next = await loop.next()

    while (!next.done) {
      events.push(next.value)
      next = await loop.next()
    }

    expect(events.map((event) => event.type)).toEqual(['progress', 'toolStarted', 'tool', 'progress', 'response'])
    expect(seenToolMessages).toEqual(['{"nodeCount":0}'])
    expect(next.value).toMatchObject({
      response: { type: 'canvasPlan', plan: finalPlan },
      turnsUsed: 2,
      droppedTools: ['canvas.createNode'],
      compactionSummary: null,
      omittedMessages: 0
    })
  })

  it('records denied model-requested tools without invoking ToolRuntime', async () => {
    let invoked = false
    const runtime = {
      invoke() {
        invoked = true
        return Promise.reject(new Error('should_not_invoke'))
      }
    }
    const loop = runAgentContextLoop({
      agent: agent({ allowedTools: ['canvas.queryGraph'] }),
      message: 'try denied tool',
      trigger: 'manual',
      availableTools: [readTool, writeTool],
      tools: runtime,
      traceId: 'trace-loop-2',
      model: {
        step(state) {
          if (state.turnCount === 0) {
            return { type: 'toolCalls', calls: [{ id: 'call-denied', toolId: 'canvas.createNode', input: { type: 'text' } }] }
          }

          return { type: 'plan', plan: finalPlan }
        }
      }
    })

    for await (const event of loop) {
      void event
      // Drain the loop so denied tool observations can feed the second turn.
    }

    expect(invoked).toBe(false)
  })

  it('pauses with structured approval metadata when ToolRuntime returns ask', async () => {
    const runtime = createToolRuntime({
      idFactory: () => 'invoke-ask-write',
      clock: () => 1_783_700_000_100,
      permissionPolicy: () => ({
        decision: 'ask',
        decisionReason: 'Creating canvas nodes requires user approval.',
        requiredPermissions: [{ kind: 'canvas.write', reason: 'Mutates canvas graph.' }]
      }),
      tools: [
        defineTool({
          descriptor: writeTool,
          inputSchema: z.object({ type: z.string() }),
          outputSchema: z.object({ nodeId: z.string() }),
          renderToolUseMessage: () => 'Create node',
          call() {
            throw new Error('should_not_execute_without_approval')
          }
        })
      ]
    })
    const loop = runAgentContextLoop({
      agent: agent({ permissionPolicy: { allowedPermissionKinds: ['canvas.write'], requireAskForDestructive: true } }),
      message: '创建一个节点',
      trigger: 'manual',
      availableTools: [writeTool],
      tools: runtime,
      traceId: 'trace-loop-approval',
      model: {
        step() {
          return { type: 'toolCalls', calls: [{ id: 'call-write', toolId: 'canvas.createNode', input: { type: 'text' } }] }
        }
      }
    })
    const events = []
    let caught: unknown

    try {
      for await (const event of loop) {
        events.push(event)
      }
    } catch (error) {
      caught = error
    }

    expect(events.map((event) => event.type)).toEqual(['progress', 'toolStarted', 'tool', 'permissionRequired'])
    expect(caught).toBeInstanceOf(AgentLoopTerminalError)
    expect(caught).toMatchObject({
      errorClass: 'agent_tool_approval_required',
      turnsUsed: 1,
      pendingApproval: {
        callId: 'call-write',
        toolId: 'canvas.createNode',
        input: { type: 'text' },
        reason: 'Creating canvas nodes requires user approval.',
        requiredPermissions: [{ kind: 'canvas.write', reason: 'Mutates canvas graph.' }]
      }
    })
    expect(caught instanceof AgentLoopTerminalError ? caught.pausedState?.messages.filter((message) => message.role === 'tool') : []).toEqual([])
  })

  it('executes remaining tool calls after an approved call before continuing the model loop', async () => {
    let rememberedScope: string | undefined
    const runtime = createToolRuntime({
      idFactory: (() => {
        let next = 0
        return () => `invoke-approval-batch-${(next += 1)}`
      })(),
      clock: () => 1_783_700_000_150,
      permissionPolicy: (tool) => tool.descriptor.id === 'canvas.createNode'
        ? {
            decision: 'ask',
            decisionReason: 'Creating canvas nodes requires user approval.',
            requiredPermissions: [{ kind: 'canvas.write', reason: 'Mutates canvas graph.' }]
          }
        : {
            decision: 'allow',
            decisionReason: 'Read is allowed.',
            requiredPermissions: []
          },
      permissionGrantStore: {
        remember(input) {
          rememberedScope = input.approvedInvocation?.scope
        },
        has() {
          return false
        }
      },
      tools: [
        defineTool({
          descriptor: writeTool,
          inputSchema: z.object({ type: z.string() }),
          outputSchema: z.object({ nodeId: z.string() }),
          renderToolUseMessage: () => 'Create node',
          call() {
            return { nodeId: 'node-approved' }
          }
        }),
        defineTool({
          descriptor: readTool,
          inputSchema: z.object({}),
          outputSchema: z.object({ nodeCount: z.number() }),
          renderToolUseMessage: () => 'Query graph',
          call() {
            return { nodeCount: 1 }
          }
        })
      ]
    })
    const initialLoop = runAgentContextLoop({
      agent: agent({ permissionPolicy: { allowedPermissionKinds: ['canvas.write', 'canvas.read'], requireAskForDestructive: true } }),
      message: '创建节点后读取画布',
      trigger: 'manual',
      availableTools: [writeTool, readTool],
      tools: runtime,
      traceId: 'trace-loop-approval-batch',
      model: {
        step() {
          return {
            type: 'toolCalls',
            calls: [
              { id: 'call-write', toolId: 'canvas.createNode', input: { type: 'text' } },
              { id: 'call-read', toolId: 'canvas.queryGraph', input: {} }
            ]
          }
        }
      }
    })
    let caught: unknown

    try {
      for await (const event of initialLoop) {
        void event
      }
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(AgentLoopTerminalError)
    if (!(caught instanceof AgentLoopTerminalError) || !caught.pausedState || !caught.pendingApproval) {
      throw new Error('expected_paused_approval_state')
    }

    const resumed = resumeAgentContextLoopWithApproval({
      agent: agent({ permissionPolicy: { allowedPermissionKinds: ['canvas.write', 'canvas.read'], requireAskForDestructive: true } }),
      message: '创建节点后读取画布',
      trigger: 'manual',
      availableTools: [writeTool, readTool],
      tools: runtime,
      traceId: 'trace-loop-approval-batch-resume',
      initialState: caught.pausedState,
      approval: caught.pendingApproval,
      approvedBy: { type: 'user', id: 'user-local' },
      approvalScope: 'run',
      model: {
        step(state) {
          const toolCallIds = state.messages
            .filter((message) => message.role === 'tool')
            .map((message) => message.toolCallId)

          expect(toolCallIds).toEqual(['call-write', 'call-read'])
          return { type: 'plan', plan: finalPlan }
        }
      }
    })
    let next = await resumed.next()

    while (!next.done) {
      next = await resumed.next()
    }

    expect(next.value.response).toEqual({ type: 'canvasPlan', plan: finalPlan })
    expect(rememberedScope).toBe('run')
  })

  it('compacts older loop messages into a deterministic summary when over budget', () => {
    const messages = [
      { role: 'system' as const, content: 'system prompt' },
      { role: 'user' as const, content: 'current user request' },
      { role: 'assistant' as const, content: 'older assistant analysis '.repeat(20) },
      { role: 'tool' as const, toolId: 'canvas.queryGraph', invocationId: 'invoke-old', status: 'completed' as const, content: 'older tool output '.repeat(20) },
      { role: 'assistant' as const, content: 'recent assistant note' },
      { role: 'tool' as const, toolId: 'canvas.queryGraph', invocationId: 'invoke-new', status: 'completed' as const, content: 'recent tool output' }
    ]

    const compacted = compactAgentMessages(messages, 80)

    expect(compacted.compactionSummary).toContain('Context compacted')
    expect(compacted.compactionSummary).toContain('older assistant analysis')
    expect(compacted.omittedMessages).toBeGreaterThan(0)
    expect(compacted.messages[0]).toEqual({ role: 'system', content: 'system prompt' })
    expect(compacted.messages[1]).toEqual({ role: 'user', content: 'current user request' })
  })

  it('feeds compacted summaries into model state before the next step', async () => {
    const summariesSeen: Array<string | null> = []
    const loop = runAgentContextLoop({
      agent: agent({
        contextPolicy: {
          includeCanvasGraph: true,
          includeSelectedAssets: false,
          includeRecentMessages: true,
          includeKnowledge: false,
          maxContextTokens: 24
        }
      }),
      message: '需要很多上下文',
      trigger: 'manual',
      availableTools: [readTool],
      tools: createToolRuntime({ tools: [] }),
      traceId: 'trace-loop-compact',
      model: {
        step(state) {
          summariesSeen.push(state.compactionSummary)

          if (state.turnCount < 2) {
            return {
              type: 'toolCalls',
              calls: [],
              message: `assistant context turn ${state.turnCount} `.repeat(80)
            }
          }

          return { type: 'plan', plan: finalPlan }
        }
      }
    })

    let result = await loop.next()
    while (!result.done) {
      result = await loop.next()
    }

    expect(summariesSeen[0]).toBeNull()
    expect(summariesSeen.some((summary) => summary?.includes('Context compacted'))).toBe(true)
    expect(result.value.compactionSummary).toContain('Context compacted')
    expect(result.value.omittedMessages).toBeGreaterThan(0)
  })

  it('throws a stable max-turns error when no plan is produced', async () => {
    const loop = runAgentContextLoop({
      agent: agent({ maxTurns: 1 }),
      message: 'never finish',
      trigger: 'manual',
      availableTools: [readTool],
      tools: createToolRuntime({ tools: [] }),
      traceId: 'trace-loop-max-turns',
      model: {
        step() {
          return { type: 'toolCalls', calls: [], message: 'still thinking' }
        }
      }
    })

    let caught: unknown

    try {
      for await (const event of loop) {
        void event
        // Drain until the max-turns terminal error is raised.
      }
    } catch (error) {
      caught = error
    }

    expect(caught).toBeInstanceOf(AgentLoopTerminalError)
    expect(caught).toMatchObject({
      errorClass: 'agent_max_turns_exceeded',
      turnsUsed: 1,
      droppedTools: [],
      retryable: false
    })
  })
})
