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

import { CANONICAL_AGENT_ROLE_IDS, type AgentDefinition } from '../../../../../shared/agents'
import type { CanvasGraphSnapshot } from '../../../../../shared/graph'
import type { ToolActor, ToolDescriptor, ToolPermission } from '../../../../../shared/tools'
import { createToolRuntime, defineTool, type ToolDefinition, type ToolInvocationInput } from '../runtime'
import type { ToolRuntime } from '../runtime'
import { spawnSubAgent, type SpawnParentContext, type SpawnSubAgentOptions } from '../../agent/spawn-sub-agent'
import type { AgentLoopModel } from '../../agent/context-loop'
import { AgentLoopTerminalError, createAgentContextLoop, runAgentContextLoop } from '../../agent/context-loop'
import type { AgentRegistry } from '../../agent/registry'
import type { AgentRunSpine } from '../../agent/run-spine'
import { createCanvasTools } from '../canvas'
import { createDraftGraphArtifactDraft, createIsolatedSubAgentDraft } from '../../agent/sub-agent-isolation'
import { sanitizePlan } from '../../agent/sanitize-plan'

export interface AgentSpawnToolOptions {
  /** Run a child agent synchronously and return its output. */
  runChild: SpawnSubAgentOptions['runChild']
  /** Resolves canonical child roles and the invoking parent role policy. */
  registry: Pick<AgentRegistry, 'get'>
  /** Current descriptors used to fail closed during child permission narrowing. */
  listTools?: () => ToolDescriptor[]
  /** Optional durable run spine for child task lifecycle facts. */
  runSpine?: Pick<AgentRunSpine, 'appendEvent' | 'upsertChildTask'> & Partial<Pick<
    AgentRunSpine,
    'transaction' | 'createRun' | 'updateRun' | 'getSnapshot' | 'saveArtifact'
  >>
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

function safeApprovalInputSummary(input: unknown): string {
  if (Array.isArray(input)) return `Array with ${input.length} item(s)`
  if (typeof input === 'object' && input !== null) {
    return `Object fields: ${Object.keys(input).sort().join(', ') || '(none)'}`
  }
  return `Input type: ${input === null ? 'null' : typeof input}`
}

/**
 * Creates the agent.spawnChild tool for model-callable sub-agent execution.
 * @param options - Parent agent context, child runner, and trace metadata.
 * @returns Tool definition for ToolRuntime registration.
 * @see docs/api-contracts/agents.md
 */
export function createAgentSpawnTool(options: AgentSpawnToolOptions): ToolDefinition<unknown, unknown> {
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
      concurrency: 'readonly'
    }),
    inputSchema: z.object({
      roleId: z.enum(CANONICAL_AGENT_ROLE_IDS),
      task: z.string().trim().min(1).max(4000).describe('What the built-in role should accomplish.')
    }).strict(),
    outputSchema: z.object({
      roleId: z.string(),
      output: z.string(),
      status: z.enum(['completed', 'failed', 'aborted', 'max_turns_exceeded', 'approval_required']),
      turnsUsed: z.number(),
      effectiveTools: z.array(z.string()),
      droppedTools: z.array(z.string()),
      droppedSkills: z.array(z.string()),
      artifactIds: z.array(z.string()),
      childRunId: z.string().optional(),
      trace: z.object({
        runId: z.string(), parentRunId: z.string(), parentTraceId: z.string(), depth: z.number(),
        startedAt: z.number(), completedAt: z.number(), requestedTools: z.array(z.string()),
        effectiveTools: z.array(z.string()), requestedSkills: z.array(z.string()),
        effectiveSkills: z.array(z.string()), droppedTools: z.array(z.string()),
        droppedSkills: z.array(z.string()),
        status: z.enum(['completed', 'failed', 'aborted', 'max_turns_exceeded', 'approval_required']),
        errorClass: z.string().optional()
      }),
      pendingApproval: z.object({
        callId: z.string(), toolId: z.string(), reason: z.string(),
        requiredPermissions: z.array(z.object({ kind: z.enum(['canvas.read', 'canvas.write', 'file.read', 'file.write', 'network', 'provider.spend', 'destructive', 'diagnostics']), reason: z.string() })),
        inputSummary: z.string()
      }).optional(),
      error: z.object({ errorClass: z.string(), message: z.string(), retryable: z.boolean() }).optional()
    }),
    renderToolUseMessage: (input) => `Spawn child agent: ${typeof input.task === 'string' ? input.task.slice(0, 80) : ''}`,
    async call(input, ctx) {
      const execution = ctx.execution ?? {
        runId: ctx.traceId,
        roleId: ctx.actor.id,
        depth: 0,
        effectiveTools: [],
        effectiveSkills: []
      }
      const parentContext: SpawnParentContext = {
        parentRunId: execution.runId,
        parentTraceId: ctx.traceId,
        allowedTools: execution.effectiveTools,
        allowedSkills: execution.effectiveSkills,
        depth: execution.depth
      }

      const spawnOptions: SpawnSubAgentOptions = {
        registry: options.registry,
        ...(options.listTools ? { listTools: options.listTools } : {}),
        runChild: options.runChild,
        ...(options.runSpine ? { runSpine: options.runSpine } : {}),
        ...(options.idFactory ? { idFactory: options.idFactory } : {}),
        ...(options.clock ? { clock: options.clock } : {})
      }

      const result = await spawnSubAgent(input, parentContext, spawnOptions)
      return {
        roleId: result.roleId,
        output: result.output,
        status: result.status,
        turnsUsed: result.turnsUsed,
        effectiveTools: result.effectiveTools,
        droppedTools: result.droppedTools,
        droppedSkills: result.droppedSkills,
        artifactIds: result.artifactIds,
        childRunId: result.trace.runId,
        trace: result.trace,
        ...(result.pendingApproval ? {
          pendingApproval: {
            callId: result.pendingApproval.callId,
            toolId: result.pendingApproval.toolId,
            reason: result.pendingApproval.reason,
            requiredPermissions: result.pendingApproval.requiredPermissions,
            inputSummary: safeApprovalInputSummary(result.pendingApproval.input)
          }
        } : {}),
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
  /** Lazily resolves a model bound to the effective child role and run identity. */
  resolveStepModel?: (input: { agent: AgentDefinition; runId: string }) => AgentLoopModel | null
  /** Actual parent workflow graph used to seed canvas-role draft execution. */
  getParentGraph?: (parentRunId: string) => CanvasGraphSnapshot
}): SpawnSubAgentOptions['runChild'] {
  return async (childInput) => {
    const childAgent: AgentDefinition = {
      ...childInput.role,
      allowedTools: childInput.allowedTools,
      allowedSkills: childInput.allowedSkills
    }

    const isCanvasWriter = childInput.role.id === 'canvas-planner' || childInput.role.id === 'canvas-operator'
    const parentGraph = isCanvasWriter && options.getParentGraph
      ? structuredClone(options.getParentGraph(childInput.parentRunId))
      : null
    const draft = parentGraph ? createIsolatedSubAgentDraft({
      parentGraph,
      parentRunId: childInput.parentRunId,
      childRunId: childInput.runId,
      traceId: childInput.traceId
    }) : null
    const draftRuntime = draft ? createToolRuntime({ tools: createCanvasTools({ graphStore: draft.graphStore }) }) : null
    const globalDescriptors = options.listTools()
    const draftDescriptors = draftRuntime?.list().filter((tool) => tool.id !== 'canvas.runNode') ?? []
    const descriptorById = new Map([...globalDescriptors, ...draftDescriptors].map((tool) => [tool.id, tool]))
    const availableTools = childInput.allowedTools.flatMap((toolId) => {
      const tool = descriptorById.get(toolId)
      return tool ? [tool] : []
    })
    const scopedTools: Pick<ToolRuntime, 'invoke'> = {
      invoke(input: ToolInvocationInput) {
        if (draftRuntime && input.toolId.startsWith('canvas.')) {
          if (input.toolId === 'canvas.runNode') {
            return Promise.resolve({
              record: { invocationId: `draft-denied:${childInput.runId}`, toolId: input.toolId, actor: input.actor,
                traceId: input.traceId, status: 'failed', createdAt: Date.now() },
              error: { errorClass: 'tool_not_allowed', message: 'Provider jobs cannot run in child draft execution.', retryable: false },
              progress: []
            })
          }
          return draftRuntime.invoke(input)
        }
        return options.toolRuntime.invoke(input)
      }
    }
    const actor: ToolActor = { type: 'agent', id: childInput.role.id }
    const initialState = createAgentContextLoop({
      agent: childAgent,
      message: childInput.task,
      trigger: 'manual',
      availableTools
    })

    // When no step model is provided (e.g. no gateway configured yet), return a graceful stub.
    const model = options.resolveStepModel?.({ agent: childAgent, runId: childInput.runId }) ?? options.stepModel ?? {
      step: () => Promise.resolve({
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
        tools: scopedTools,
        traceId: childInput.traceId,
        execution: {
          runId: childInput.runId,
          roleId: childInput.role.id,
          depth: childInput.depth,
          parentTraceId: childInput.parentTraceId,
          effectiveTools: [...childInput.allowedTools],
          effectiveSkills: [...childInput.allowedSkills]
        },
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

      const artifactDrafts = []
      if (resp.type === 'canvasPlan') {
        const plan = sanitizePlan(resp.plan)
        artifactDrafts.push({
          kind: 'canvasPlan' as const,
          title: 'Child CanvasPlan',
          summary: plan.summary,
          payload: plan
        })
      }
      if (draft && parentGraph && JSON.stringify(draft.getDraftGraph()) !== JSON.stringify(parentGraph)) {
        artifactDrafts.push(createDraftGraphArtifactDraft(draft))
      }

      return {
        output,
        status: 'completed',
        turnsUsed,
        ...(artifactDrafts.length > 0 ? { artifactDrafts } : {})
      }
    } catch (err) {
      if (err instanceof AgentLoopTerminalError
        && err.errorClass === 'agent_tool_approval_required'
        && err.pausedState
        && err.pendingApproval) {
        return {
          output: '', status: 'approval_required', turnsUsed: err.turnsUsed,
          pausedState: structuredClone(err.pausedState),
          pendingApproval: structuredClone(err.pendingApproval)
        }
      }
      const error = err instanceof Error ? err.message : 'agent_run_failed'
      return { output: '', status: 'failed', turnsUsed, error, droppedTools }
    }
  }
}
