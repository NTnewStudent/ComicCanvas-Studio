/**
 * Built-in agent.spawnChild tool — lets the model spawn a child agent mid-loop.
 *
 * The parent agent calls this tool with a task description and optional tool allowlist.
 * The runtime intersects permissions with the parent's grant (monotonic narrowing),
 * runs the child agent to completion using the same loop + tools, and returns its output.
 *
 * @see docs/api-contracts/agents.md
 */

import { z } from 'zod'

import type { AgentDefinition, AgentEffort } from '../../../../../shared/agents'
import type { ToolActor, ToolDescriptor, ToolPermission } from '../../../../../shared/tools'
import { defineTool, ToolExecutionError, type ToolDefinition } from '../runtime'
import type { ToolRuntime } from '../runtime'
import { spawnSubAgent, type SpawnParentContext, type SpawnSubAgentOptions } from '../../agent/spawn-sub-agent'
import type { AgentLoopModel } from '../../agent/context-loop'
import { createAgentContextLoop, runAgentContextLoop } from '../../agent/context-loop'
import { GENERAL_PURPOSE_PROMPT } from '../../agent/prompts'

export interface AgentSpawnToolOptions {
  /** Run a child agent synchronously and return its output. */
  runChild: SpawnSubAgentOptions['runChild']
  /** Current running agent definition used to derive the parent permission set. */
  parentAgent: AgentDefinition
  /** Current run ID for trace correlation. */
  parentRunId: string
  /** Current trace ID for hierarchical sub-agent tracing. */
  parentTraceId: string
  /** Monotonically narrowing max spawn depth guard. */
  currentDepth: number
  /** Optional deterministic ID factory (tests). */
  idFactory?: () => string
  /** Optional clock (tests). */
  clock?: () => number
}

const agentSpawnPermission: ToolPermission = {
  kind: 'diagnostics',
  reason: 'Spawns a child agent run within parent permission bounds.'
}

function descriptor(input: Omit<ToolDescriptor, 'category' | 'owner' | 'enabled'>): ToolDescriptor {
  return {
    ...input,
    category: 'custom',
    owner: { kind: 'builtin', id: 'core' },
    enabled: true
  }
}

/**
 * Creates the agent.spawnChild tool for model-callable sub-agent execution.
 * @param options - Parent agent context, child runner, and trace metadata.
 * @returns Tool definition for ToolRuntime registration.
 * @see docs/api-contracts/agents.md
 */
export function createAgentSpawnTool(options: AgentSpawnToolOptions): ToolDefinition<unknown, unknown> {
  const parentAllowedTools: string[] | '*' =
    options.parentAgent.allowedTools === '*' ? '*' : [...options.parentAgent.allowedTools]

  return defineTool({
    descriptor: descriptor({
      id: 'agent.spawnChild',
      name: 'Spawn Child Agent',
      description: [
        'Runs a focused sub-agent synchronously and returns its output.',
        'The child receives a subset of the parent\'s tool permissions.',
        'Use when a sub-task benefits from a separate reasoning context.',
        'Prefer direct tool calls for simple operations.'
      ].join(' '),
      inputSchemaRef: 'agent.spawnChild.input',
      outputSchemaRef: 'agent.spawnChild.output',
      permissions: [agentSpawnPermission],
      concurrency: 'serial-write'
    }),
    inputSchema: z.object({
      task: z.string().min(1).describe('What the child agent should accomplish.'),
      systemPrompt: z.string().min(1).describe('System prompt for the child agent.'),
      allowedTools: z.array(z.string()).describe('Tool IDs the child may use (subset of parent tools).'),
      maxTurns: z.number().int().min(1).max(6).default(3),
      effort: z.enum(['low', 'medium', 'high']).optional(),
      modelId: z.string().optional()
    }),
    outputSchema: z.object({
      output: z.string(),
      status: z.string(),
      turnsUsed: z.number(),
      droppedTools: z.array(z.string()),
      error: z.string().optional()
    }),
    renderToolUseMessage: (input) => `Spawn child agent: ${typeof input.task === 'string' ? input.task.slice(0, 80) : ''}`,
    async call(input) {
      const parentContext: SpawnParentContext = {
        parentRunId: options.parentRunId,
        parentTraceId: options.parentTraceId,
        allowedTools: parentAllowedTools,
        allowedSkills: options.parentAgent.allowedSkills === '*' ? '*' : [...(options.parentAgent.allowedSkills ?? [])]
      }

      const spawnInput = {
        spec: {
          task: input.task,
          systemPrompt: input.systemPrompt,
          allowedTools: input.allowedTools,
          maxTurns: input.maxTurns,
          ...(input.effort ? { effort: input.effort as AgentEffort } : {}),
          ...(input.modelId ? { modelId: input.modelId } : {})
        },
        depth: options.currentDepth
      }

      const spawnOptions: SpawnSubAgentOptions = {
        runChild: options.runChild,
        ...(options.idFactory ? { idFactory: options.idFactory } : {}),
        ...(options.clock ? { clock: options.clock } : {})
      }

      const result = await spawnSubAgent(spawnInput, parentContext, spawnOptions)

      if (result.status === 'failed' && result.error === 'agent_depth_exceeded') {
        throw new ToolExecutionError({
          code: 'agent_depth_exceeded',
          message: 'Maximum sub-agent nesting depth reached.',
          retryable: false
        })
      }

      return {
        output: result.output,
        status: result.status,
        turnsUsed: result.turnsUsed,
        droppedTools: result.droppedTools,
        ...(result.error ? { error: result.error } : {})
      }
    }
  })
}

/**
 * Creates a child agent runner backed by the provided loop model and ToolRuntime.
 * @param options - Tool runtime, available tool descriptors, and optional step model.
 * @returns runChild function compatible with SpawnSubAgentOptions.
 */
export function createChildAgentRunner(options: {
  toolRuntime: Pick<ToolRuntime, 'invoke'>
  listTools: () => ToolDescriptor[]
  /** Model used by child agents. When omitted the child loop returns a stub response. */
  stepModel?: AgentLoopModel
}): SpawnSubAgentOptions['runChild'] {
  return async (childInput) => {
    const childAgent: AgentDefinition = {
      id: `child-${childInput.runId}`,
      source: 'builtin',
      name: 'Child Agent',
      description: 'Focused sub-agent run.',
      instructions: childInput.systemPrompt || GENERAL_PURPOSE_PROMPT,
      allowedTools: childInput.allowedTools,
      allowedSkills: childInput.allowedSkills,
      gatewayPolicy: { allowedChannels: ['text'] },
      contextPolicy: {
        includeCanvasGraph: false,
        includeSelectedAssets: false,
        includeRecentMessages: false,
        includeKnowledge: false,
        maxContextTokens: 4000
      },
      permissionPolicy: {
        allowedPermissionKinds: ['canvas.read', 'file.read', 'diagnostics'],
        requireAskForDestructive: true
      },
      triggerPolicy: {
        allowedTriggers: ['manual'],
        defaultTrigger: 'manual',
        autoRun: false
      },
      maxTurns: childInput.maxTurns,
      effort: childInput.effort ?? 'medium',
      enabled: true
    }

    const availableTools = options.listTools().filter((t) => childInput.allowedTools.includes(t.id))
    const actor: ToolActor = { type: 'agent', id: childInput.runId }
    const initialState = createAgentContextLoop({
      agent: childAgent,
      message: childInput.task,
      trigger: 'manual',
      availableTools
    })

    // When no step model is provided (e.g. no gateway configured yet), return a graceful stub.
    const model = options.stepModel ?? {
      step: async () => ({
        type: 'response' as const,
        response: {
          type: 'answer' as const,
          summary: 'No model configured for child agent.',
          text: 'Child agent requires a configured text model gateway.',
          dropped: []
        }
      })
    }

    let output = ''
    let droppedTools: string[] = []
    let turnsUsed = 0

    try {
      const gen = runAgentContextLoop({
        agent: childAgent,
        message: childInput.task,
        trigger: 'manual',
        availableTools,
        model,
        tools: options.toolRuntime,
        traceId: childInput.traceId,
        actor,
        initialState
      })

      let next = await gen.next()
      while (!next.done) {
        next = await gen.next()
      }

      const result = next.value
      droppedTools = result.droppedTools
      turnsUsed = result.turnsUsed
      const resp = result.response
      if (resp.type === 'answer') output = resp.text
      else if (resp.type === 'clarification') output = resp.question
      else if (resp.type === 'canvasPlan') output = resp.plan.summary

      return { output, status: 'completed', turnsUsed }
    } catch (err) {
      const error = err instanceof Error ? err.message : 'agent_run_failed'
      return { output: '', status: 'failed', turnsUsed, error, droppedTools }
    }
  }
}
