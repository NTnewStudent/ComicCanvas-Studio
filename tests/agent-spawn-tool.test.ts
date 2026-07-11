import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import type { AgentDefinition } from '../shared/agents'
import type { CanvasGraphSnapshot } from '../shared/graph'
import type { ToolDescriptor } from '../shared/tools'
import type { AgentRepository } from '../desktop/src/main/db/repositories/agent.repo'
import { filterAgentTools, type AgentContextLoopState } from '../desktop/src/main/agent/context-loop'
import { createAgentRegistry } from '../desktop/src/main/agent/registry'
import { createAgentSpawnTool, createChildAgentRunner } from '../desktop/src/main/tools/agent'
import { createToolRuntime, defineTool } from '../desktop/src/main/tools/runtime'

const registry = createAgentRegistry({
  agents: {
    list: () => [],
    upsert: (agent) => agent,
    delete: () => false
  } satisfies AgentRepository
})

const role: AgentDefinition = {
  id: 'qa-verifier', source: 'builtin', name: 'QA', description: '', instructions: 'Verify.',
  allowedTools: ['canvas.queryGraph'], allowedSkills: [], gatewayPolicy: { allowedChannels: ['text'] },
  contextPolicy: { includeCanvasGraph: true, includeSelectedAssets: false, includeRecentMessages: false, includeKnowledge: false, maxContextTokens: 4000 },
  permissionPolicy: { allowedPermissionKinds: ['canvas.read'], requireAskForDestructive: true },
  triggerPolicy: { allowedTriggers: ['manual'], defaultTrigger: 'manual', autoRun: false },
  maxTurns: 4, effort: 'high', enabled: true
}

describe('Task 23 agent.spawnChild tool', () => {
  it('routes canvas operator writes to an isolated parent-seeded draft and returns a draft artifact', async () => {
    const liveGraph: CanvasGraphSnapshot = {
      nodes: [{ id: 'text-live', type: 'text', position: { x: 0, y: 0 }, data: { label: 'Live', content: 'seed' } }],
      edges: [], viewport: { x: 0, y: 0, zoom: 1 }
    }
    const liveBytes = JSON.stringify(liveGraph)
    const runner = createChildAgentRunner({
      toolRuntime: { invoke: vi.fn(() => { throw new Error('canvas tool reached global runtime') }) },
      listTools: () => [], getParentGraph: () => liveGraph,
      stepModel: { step: vi.fn()
        .mockResolvedValueOnce({ type: 'toolCalls', calls: [{ id: 'create', toolId: 'canvas.createNode', input: {
          type: 'text', position: { x: 200, y: 0 }, data: { label: 'Draft', content: 'child' }
        } }] })
        .mockResolvedValueOnce({ type: 'response', response: { type: 'answer', summary: 'done', text: 'done', dropped: [] } }) }
    })

    const result = await runner({
      runId: 'run-child-draft', parentRunId: 'run-parent', role: registry.get('canvas-operator')!, task: 'Add text.',
      allowedTools: ['canvas.createNode'], allowedSkills: [], traceId: 'trace/run-child-draft', parentTraceId: 'trace', depth: 1
    })

    expect(JSON.stringify(liveGraph)).toBe(liveBytes)
    const draftArtifact = result.artifactDrafts?.[0]
    expect(draftArtifact?.kind).toBe('draftGraph')
    if (draftArtifact?.kind !== 'draftGraph') throw new Error('Expected a draft graph artifact')
    expect(draftArtifact.payload.graph.nodes.some((node) => node.data.label === 'Draft')).toBe(true)
  })

  it('does not create a graph artifact for non-canvas children', async () => {
    const runner = createChildAgentRunner({
      toolRuntime: { invoke: vi.fn() }, listTools: () => [],
      getParentGraph: () => ({ nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } }),
      stepModel: { step: () => ({ type: 'response', response: { type: 'answer', summary: 'ok', text: 'ok', dropped: [] } }) }
    })
    const result = await runner({ runId: 'run-child-qa', parentRunId: 'run-parent', role, task: 'Verify.', allowedTools: [],
      allowedSkills: [], traceId: 'trace/run-child-qa', parentTraceId: 'trace', depth: 1 })
    expect(result.artifactDrafts).toBeUndefined()
  })

  it('returns a sanitized CanvasPlan artifact draft owned by the child response', async () => {
    const runner = createChildAgentRunner({
      toolRuntime: { invoke: vi.fn() }, listTools: () => [],
      getParentGraph: () => ({ nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } }),
      stepModel: { step: () => ({ type: 'response', response: { type: 'canvasPlan', plan: {
        kind: 'plan', summary: 'Create scene', question: null,
        nodes: [{ ref: 'text-1', type: 'text', title: 'Prompt', data: { content: 'safe' } }],
        edges: [], runSteps: [], dropped: []
      } } }) }
    })
    const result = await runner({ runId: 'run-child-plan', parentRunId: 'run-parent', role: registry.get('canvas-planner')!,
      task: 'Plan.', allowedTools: [], allowedSkills: [], traceId: 'trace/run-child-plan', parentTraceId: 'trace', depth: 1 })
    const planArtifact = result.artifactDrafts?.[0]
    expect(planArtifact?.kind).toBe('canvasPlan')
    if (planArtifact?.kind !== 'canvasPlan') throw new Error('Expected a CanvasPlan artifact')
    expect(planArtifact.payload).toMatchObject({ kind: 'plan', summary: 'Create scene' })
  })
  it('exposes spawnChild through runtime filtering only to canonical delegating roles', () => {
    const spawnTool = createAgentSpawnTool({ registry, runChild: vi.fn() })
    const roles = registry.list({ includeDisabled: true })
    const visibleTo = roles.filter((candidate) => (
      filterAgentTools(candidate, [spawnTool.descriptor]).allowedTools.some((tool) => tool.id === 'agent.spawnChild')
    ))

    expect(visibleTo.map((candidate) => candidate.id)).toEqual(['general-assistant'])
    expect(visibleTo.every((candidate) => candidate.permissionPolicy.allowedPermissionKinds.includes('diagnostics'))).toBe(true)
    expect(filterAgentTools(registry.get('canvas-operator')!, [spawnTool.descriptor]).droppedTools).toContain('agent.spawnChild')
    expect(filterAgentTools(registry.get('workflow-runner')!, [spawnTool.descriptor]).droppedTools).toContain('agent.spawnChild')
  })

  it('resolves a real loop model per child with the narrowed role and child run identity', async () => {
    const resolveStepModel = vi.fn((input: { agent: AgentDefinition; runId: string }) => {
      expect(input.agent).toMatchObject({
        id: 'qa-verifier',
        instructions: 'Verify.',
        allowedTools: [],
        allowedSkills: []
      })
      expect(input.runId).toBe('run-child-real-model')
      return {
        step: vi.fn(() => Promise.resolve({
          type: 'response' as const,
          response: {
            type: 'answer' as const,
            summary: 'Verified.',
            text: 'Child used the configured gateway model.',
            dropped: []
          }
        }))
      }
    })
    const runner = createChildAgentRunner({
      toolRuntime: { invoke: vi.fn() },
      listTools: () => [],
      resolveStepModel
    })

    const result = await runner({
      runId: 'run-child-real-model',
      parentRunId: 'run-parent',
      role,
      task: 'Verify the graph.',
      allowedTools: [],
      allowedSkills: [],
      traceId: 'run-parent/run-child-real-model',
      parentTraceId: 'run-parent',
      depth: 1
    })

    expect(resolveStepModel).toHaveBeenCalledOnce()
    expect(result).toMatchObject({
      output: 'Child used the configured gateway model.',
      status: 'completed'
    })
  })

  it('forwards explicit child execution metadata to nested tool invocations', async () => {
    const invoke = vi.fn(() => Promise.resolve({
      record: {
        invocationId: 'nested-invocation',
        toolId: 'canvas.queryGraph',
        actor: { type: 'agent' as const, id: 'run-child-metadata' },
        traceId: 'trace-root/run-child-metadata',
        status: 'completed' as const,
        createdAt: 1
      },
      output: {},
      progress: []
    }))
    const runner = createChildAgentRunner({
      toolRuntime: { invoke },
      listTools: () => [{
        id: 'canvas.queryGraph', name: 'Query', description: '', category: 'canvas',
        owner: { kind: 'builtin', id: 'core' }, inputSchemaRef: 'in', outputSchemaRef: 'out',
        permissions: [], concurrency: 'readonly', enabled: true
      }],
      stepModel: {
        step: vi.fn()
          .mockResolvedValueOnce({ type: 'toolCalls', calls: [{ id: 'call-1', toolId: 'canvas.queryGraph', input: {} }] })
          .mockResolvedValueOnce({
            type: 'response',
            response: { type: 'answer', summary: 'done', text: 'done', dropped: [] }
          })
      }
    })

    await runner({
      runId: 'run-child-metadata', parentRunId: 'run-root', role, task: 'Inspect.',
      allowedTools: ['canvas.queryGraph'], allowedSkills: [],
      traceId: 'trace-root/run-child-metadata', parentTraceId: 'trace-root', depth: 1
    })

    expect(invoke).toHaveBeenCalledWith(expect.objectContaining({
      execution: {
        runId: 'run-child-metadata',
        roleId: 'qa-verifier',
        depth: 1,
        parentTraceId: 'trace-root',
        effectiveTools: ['canvas.queryGraph'],
        effectiveSkills: []
      }
    }))
  })

  it('returns cloned approval state and pending call metadata when a child tool requires approval', async () => {
    const approvalTool: ToolDescriptor = {
      id: 'canvas.queryGraph', name: 'Query', description: '', category: 'canvas' as const,
      owner: { kind: 'builtin' as const, id: 'core' }, inputSchemaRef: 'in', outputSchemaRef: 'out',
      permissions: [{ kind: 'canvas.read' as const, reason: 'Reads graph.' }], concurrency: 'readonly' as const, enabled: true
    }
    const runner = createChildAgentRunner({
      toolRuntime: createToolRuntime({
        idFactory: () => 'invoke-child-approval',
        permissionPolicy: () => ({
          decision: 'ask', decisionReason: 'Child query requires approval.',
          requiredPermissions: [{ kind: 'canvas.read', reason: 'Reads graph.' }]
        }),
        tools: [defineTool({
          descriptor: approvalTool,
          inputSchema: z.object({ nodeId: z.string() }),
          outputSchema: z.object({ found: z.boolean() }),
          renderToolUseMessage: () => 'Query graph',
          call: () => ({ found: true })
        })]
      }),
      listTools: () => [approvalTool],
      stepModel: {
        step: () => ({ type: 'toolCalls', calls: [
          { id: 'call-child-query', toolId: 'canvas.queryGraph', input: { nodeId: 'node-1' } }
        ] })
      }
    })

    const result = await runner({
      runId: 'run-child-approval', parentRunId: 'run-parent', role, task: 'Inspect node.',
      allowedTools: ['canvas.queryGraph'], allowedSkills: [],
      traceId: 'run-parent/run-child-approval', parentTraceId: 'run-parent', depth: 1
    })

    expect(result).toMatchObject({
      status: 'approval_required', turnsUsed: 1,
      pendingApproval: { callId: 'call-child-query', toolId: 'canvas.queryGraph', input: { nodeId: 'node-1' } },
      pausedState: { transition: 'approval_required', pendingToolCalls: [] }
    })
    expect(result.pausedState?.messages.find((message) => (
      message.role === 'assistant'
    ))?.toolCalls?.[0]?.id).toBe('call-child-query')
  })

  it('returns an actionable safe approval continuation through ToolRuntime without durable prompt state', async () => {
    const pausedState: AgentContextLoopState = {
      agentId: 'qa-verifier',
      trigger: 'manual',
      turnCount: 1,
      maxTurns: 4,
      transition: 'approval_required',
      systemPrompt: 'private child system prompt',
      userMessage: 'Inspect node 42.',
      allowedTools: [],
      droppedTools: [],
      messages: [{ role: 'system', content: 'private child system prompt' }],
      tokenEstimate: 7,
      compactionSummary: null,
      omittedMessages: 0,
      pendingToolCalls: [],
      additionalContext: '',
      execution: {
        runId: 'child-safe-approval',
        roleId: 'qa-verifier',
        depth: 1,
        parentTraceId: 'trace-parent',
        effectiveTools: [],
        effectiveSkills: []
      }
    }
    const tool = createAgentSpawnTool({
      registry: { get: () => role },
      idFactory: () => 'child-safe-approval',
      runChild: () => ({
        output: '', status: 'approval_required' as const, turnsUsed: 1,
        pausedState,
        pendingApproval: {
          callId: 'call-safe-approval', toolId: 'canvas.queryGraph',
          input: { nodeId: 'node-42', secret: 'must-not-leak' },
          reason: 'Child query requires approval.',
          requiredPermissions: [{ kind: 'canvas.read', reason: 'Reads graph.' }]
        }
      })
    })
    const runtime = createToolRuntime({ tools: [tool], idFactory: () => 'invoke-safe-approval' })

    const result = await runtime.invoke({
      toolId: 'agent.spawnChild', input: { roleId: 'qa-verifier', task: 'Inspect node 42.' },
      actor: { type: 'agent', id: 'general-assistant' }, traceId: 'trace-parent',
      execution: {
        runId: 'run-parent', roleId: 'general-assistant', depth: 0,
        effectiveTools: ['agent.spawnChild'], effectiveSkills: []
      }
    })

    expect(result.output).toBeTypeOf('object')
    expect(result.output).not.toBeNull()
    if (typeof result.output !== 'object' || result.output === null) {
      throw new Error('Expected agent.spawnChild to return an object.')
    }
    expect(result.output).toMatchObject({
      status: 'approval_required',
      trace: { runId: 'child-safe-approval', parentRunId: 'run-parent', depth: 1 }
    })
    if (!('childRunId' in result.output)) {
      throw new Error('Expected agent.spawnChild to return a child run identifier.')
    }
    expect(result.output.childRunId).toBe('child-safe-approval')
    if (!('pendingApproval' in result.output)) {
      throw new Error('Expected agent.spawnChild to return pending approval details.')
    }
    const { pendingApproval } = result.output
    expect(pendingApproval).toBeTypeOf('object')
    expect(pendingApproval).not.toBeNull()
    if (typeof pendingApproval !== 'object' || pendingApproval === null) {
      throw new Error('Expected agent.spawnChild to return pending approval details.')
    }
    expect(pendingApproval).toMatchObject({
      toolId: 'canvas.queryGraph',
      reason: 'Child query requires approval.',
      requiredPermissions: [{ kind: 'canvas.read', reason: 'Reads graph.' }]
    })
    if (!('callId' in pendingApproval)) {
      throw new Error('Expected pending approval details to include a call identifier.')
    }
    expect(pendingApproval.callId).toBe('call-safe-approval')
    if (!('inputSummary' in pendingApproval)) {
      throw new Error('Expected pending approval details to include an input summary.')
    }
    expect(pendingApproval.inputSummary).toBeTypeOf('string')
    const serialized = JSON.stringify(result.output)
    expect(serialized).not.toContain('pausedState')
    expect(serialized).not.toContain('systemPrompt')
    expect(serialized).not.toContain('messages')
    expect(serialized).not.toContain('must-not-leak')
  })

  it('uses invoking effective capabilities and never reconstructs removed grants from the parent role', async () => {
    const runChild = vi.fn(() => ({ output: 'narrowed', status: 'completed' as const, turnsUsed: 1 }))
    const parent = { ...role, id: 'general-assistant', allowedTools: '*', allowedSkills: '*' } satisfies AgentDefinition
    const child = {
      ...role,
      allowedTools: ['canvas.queryGraph', 'canvas.createNode', 'missing.tool'],
      allowedSkills: ['storyboard', 'removed-skill'],
      permissionPolicy: { allowedPermissionKinds: ['canvas.read'] as const, requireAskForDestructive: true }
    } satisfies AgentDefinition
    const tool = createAgentSpawnTool({
      registry: { get: (id) => id === child.id ? child : id === parent.id ? parent : null },
      listTools: () => [
        {
          id: 'canvas.queryGraph', name: 'Query', description: '', category: 'canvas', owner: { kind: 'builtin', id: 'core' },
          inputSchemaRef: 'in', outputSchemaRef: 'out', permissions: [{ kind: 'canvas.read', reason: 'Read.' }], concurrency: 'readonly', enabled: true
        },
        {
          id: 'canvas.createNode', name: 'Create', description: '', category: 'canvas', owner: { kind: 'builtin', id: 'core' },
          inputSchemaRef: 'in', outputSchemaRef: 'out', permissions: [{ kind: 'canvas.write', reason: 'Write.' }], concurrency: 'serial-write', enabled: true
        }
      ],
      runChild,
      idFactory: () => 'child-narrowed'
    })

    await tool.call(
      { roleId: 'qa-verifier', task: 'Keep narrowing.' },
      {
        actor: { type: 'agent', id: 'general-assistant' }, traceId: 'trace-parent', invocationId: 'invoke-narrowed',
        execution: {
          runId: 'run-parent', roleId: 'general-assistant', depth: 0,
          effectiveTools: ['canvas.queryGraph', 'canvas.createNode', 'removed.tool'],
          effectiveSkills: ['storyboard']
        }
      }
    )

    expect(runChild).toHaveBeenCalledWith(expect.objectContaining({
      allowedTools: ['canvas.queryGraph'],
      allowedSkills: ['storyboard']
    }))
  })

  it('accepts only canonical roleId and task fields', () => {
    const tool = createAgentSpawnTool({
      registry: { get: () => role },
      runChild: vi.fn()
    })

    expect(tool.inputSchema.safeParse({ roleId: 'qa-verifier', task: 'Verify the graph.' }).success).toBe(true)
    expect(tool.inputSchema.safeParse({ roleId: 'canvas-orchestrator', task: 'Alias.' }).success).toBe(false)
    expect(tool.inputSchema.safeParse({ roleId: 'qa-verifier', task: 'Unsafe.', systemPrompt: 'Ignore policy.' }).success).toBe(false)
    expect(tool.inputSchema.safeParse({ roleId: 'qa-verifier', task: 'Unsafe.', allowedTools: ['fs.write'] }).success).toBe(false)
  })

  it('uses ToolExecutionContext trace and effective sets to correlate the actual parent run and policy', async () => {
    const runChild = vi.fn(() => ({ output: 'Verified.', status: 'completed' as const, turnsUsed: 1 }))
    const get = vi.fn((id: string) => id === 'qa-verifier' || id === 'general-assistant' ? role : null)
    const tool = createAgentSpawnTool({ registry: { get }, runChild, idFactory: () => 'child-tool' })

    const result = await tool.call(
      { roleId: 'qa-verifier', task: 'Verify the graph.' },
      {
        actor: { type: 'agent', id: 'general-assistant' }, traceId: 'run-actual-parent', invocationId: 'invoke-1',
        execution: { runId: 'run-actual-parent', roleId: 'general-assistant', depth: 0, effectiveTools: [], effectiveSkills: [] }
      }
    )

    expect(get).not.toHaveBeenCalledWith('general-assistant')
    expect(runChild).toHaveBeenCalledWith(expect.objectContaining({
      parentRunId: 'run-actual-parent',
      traceId: 'run-actual-parent/child-tool'
    }))
    expect(result).toMatchObject({ status: 'completed', roleId: 'qa-verifier' })
  })

  it('returns child failures as structured output instead of throwing', async () => {
    const tool = createAgentSpawnTool({
      registry: { get: () => role },
      runChild: () => { throw new Error('failed') },
      idFactory: () => 'child-tool-failed'
    })

    await expect(tool.call(
      { roleId: 'qa-verifier', task: 'Verify the graph.' },
      { actor: { type: 'agent', id: 'general-assistant' }, traceId: 'run-parent', invocationId: 'invoke-2' }
    )).resolves.toMatchObject({
      status: 'failed',
      error: { errorClass: 'agent_child_run_failed', retryable: false }
    })
  })

  it('correlates nested children to their actual parent run and rejects depth 3 without persistence', async () => {
    const records: Array<{ id: string; parentRunId: string; status: string }> = []
    const events: Array<{ runId: string; type: string }> = []
    const ids = ['run-depth-1', 'run-depth-2', 'run-depth-3']
    const nestedOutputs: unknown[] = []
    const runtimeHolder: { value: ReturnType<typeof createToolRuntime> | null } = { value: null }
    const runChild = createChildAgentRunner({
      toolRuntime: {
        async invoke(input) {
          if (!runtimeHolder.value) throw new Error('Nested test runtime is not initialized.')
          const result = await runtimeHolder.value.invoke(input)
          nestedOutputs.push(result.output)
          return result
        }
      },
      listTools: () => runtimeHolder.value?.list() ?? [],
      resolveStepModel: ({ runId }) => ({
        step: vi.fn()
          .mockResolvedValueOnce({
            type: 'toolCalls',
            calls: [{ id: `call-${runId}`, toolId: 'agent.spawnChild', input: { roleId: 'general-assistant', task: `Nested from ${runId}` } }]
          })
          .mockResolvedValueOnce({ type: 'response', response: { type: 'answer', summary: 'done', text: 'done', dropped: [] } })
      })
    })
    const spawnTool = createAgentSpawnTool({
      registry,
      listTools: () => runtimeHolder.value?.list() ?? [],
      runChild,
      idFactory: () => ids.shift() ?? 'unexpected-child',
      runSpine: {
        upsertChildTask(record) {
          records.push({ id: record.id, parentRunId: record.parentRunId, status: record.status })
          return record
        },
        appendEvent(runId, type, payload) {
          events.push({ runId, type })
          return { id: `event-${events.length}`, runId, sequence: events.length, type, payload, createdAt: 1 }
        }
      }
    })
    const runtime = createToolRuntime({ tools: [spawnTool], idFactory: () => `inv-${events.length}` })
    runtimeHolder.value = runtime

    const rootResult = await runtime.invoke({
      toolId: 'agent.spawnChild', input: { roleId: 'general-assistant', task: 'Depth one.' },
      actor: { type: 'agent', id: 'general-assistant' }, traceId: 'trace-root',
      execution: {
        runId: 'run-root', roleId: 'general-assistant', depth: 0,
        effectiveTools: ['agent.spawnChild'], effectiveSkills: []
      }
    })

    expect(rootResult.record.status).toBe('completed')
    expect(records).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'run-depth-1', parentRunId: 'run-root' }),
      expect.objectContaining({ id: 'run-depth-2', parentRunId: 'run-depth-1' })
    ]))
    expect(records.some((record) => record.id === 'run-depth-3')).toBe(false)
    expect(events.some((event) => event.runId === 'run-depth-1' && event.type === 'child.started')).toBe(true)
    expect(JSON.stringify(nestedOutputs)).toContain('agent_depth_exceeded')
  })
})
