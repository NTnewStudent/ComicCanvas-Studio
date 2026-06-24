/**
 * Sub-agent spawning runtime with permission inheritance and trace isolation.
 * @see docs/api-contracts/agents.md
 */

import { randomUUID } from 'node:crypto'

import type { AgentEffort, AgentRunStatus, SpawnSubAgentInput, SpawnSubAgentResult, SubAgentRunTrace } from '../../../../shared/agents'
import { MAX_SPAWN_DEPTH } from '../../../../shared/agents'

type PermissionSet = string[] | '*'

export interface SpawnParentContext {
  parentRunId: string
  parentTraceId: string
  allowedTools: PermissionSet
  allowedSkills?: PermissionSet
}

export interface ChildAgentRunInput {
  runId: string
  parentRunId: string
  task: string
  systemPrompt: string
  allowedTools: string[]
  allowedSkills: string[]
  modelId?: string
  maxTurns: number
  effort?: AgentEffort
  traceId: string
  depth: number
}

export interface ChildAgentRunResult {
  output: string
  status: Exclude<AgentRunStatus, 'pending' | 'running'>
  turnsUsed: number
  error?: string
}

export interface SpawnSubAgentOptions {
  idFactory?: () => string
  clock?: () => number
  runChild: (input: ChildAgentRunInput) => Promise<ChildAgentRunResult> | ChildAgentRunResult
}

function createRunId(): string {
  return `agent-run-${randomUUID()}`
}

function intersectPermissionSet(requested: string[], parentAllowed: PermissionSet | undefined): { effective: string[]; dropped: string[] } {
  if (parentAllowed === '*') {
    return { effective: [...requested], dropped: [] }
  }

  const parent = new Set(parentAllowed ?? [])
  const effective: string[] = []
  const dropped: string[] = []

  for (const item of requested) {
    if (parent.has(item)) {
      effective.push(item)
    } else {
      dropped.push(item)
    }
  }

  return { effective, dropped }
}

function createTrace(input: {
  runId: string
  parent: SpawnParentContext
  depth: number
  startedAt: number
  completedAt: number
  requestedTools: string[]
  effectiveTools: string[]
  requestedSkills: string[]
  effectiveSkills: string[]
  droppedTools: string[]
  droppedSkills: string[]
  status: Exclude<AgentRunStatus, 'pending' | 'running'>
  error?: string
}): SubAgentRunTrace {
  return {
    runId: input.runId,
    parentRunId: input.parent.parentRunId,
    parentTraceId: input.parent.parentTraceId,
    depth: input.depth,
    startedAt: input.startedAt,
    completedAt: input.completedAt,
    requestedTools: input.requestedTools,
    effectiveTools: input.effectiveTools,
    requestedSkills: input.requestedSkills,
    effectiveSkills: input.effectiveSkills,
    droppedTools: input.droppedTools,
    droppedSkills: input.droppedSkills,
    status: input.status,
    ...(input.error ? { error: input.error } : {})
  }
}

function failedResult(input: {
  runId: string
  parent: SpawnParentContext
  depth: number
  startedAt: number
  completedAt: number
  requestedTools: string[]
  effectiveTools: string[]
  requestedSkills: string[]
  effectiveSkills: string[]
  droppedTools: string[]
  droppedSkills: string[]
  error: string
}): SpawnSubAgentResult {
  return {
    output: '',
    status: 'failed',
    turnsUsed: 0,
    droppedTools: input.droppedTools,
    droppedSkills: input.droppedSkills,
    error: input.error,
    trace: createTrace({
      runId: input.runId,
      parent: input.parent,
      depth: input.depth,
      startedAt: input.startedAt,
      completedAt: input.completedAt,
      requestedTools: input.requestedTools,
      effectiveTools: input.effectiveTools,
      requestedSkills: input.requestedSkills,
      effectiveSkills: input.effectiveSkills,
      droppedTools: input.droppedTools,
      droppedSkills: input.droppedSkills,
      status: 'failed',
      error: input.error
    })
  }
}

/**
 * Spawns a child agent run without allowing the child to exceed parent permissions.
 * @param input - Requested child agent spec and current parent depth.
 * @param parent - Parent run trace and maximum tool/skill permissions.
 * @param options - Deterministic IDs, clock, and child run delegate.
 * @returns Child output, terminal status, dropped permissions, and independent trace metadata.
 * @throws Error never intentionally; child runner exceptions are converted to `agent_run_failed`.
 * @see docs/api-contracts/agents.md
 */
export async function spawnSubAgent(
  input: SpawnSubAgentInput,
  parent: SpawnParentContext,
  options: SpawnSubAgentOptions
): Promise<SpawnSubAgentResult> {
  const runId = options.idFactory?.() ?? createRunId()
  const startedAt = options.clock?.() ?? Date.now()
  const depth = (input.depth ?? 0) + 1
  const requestedTools = [...input.spec.allowedTools]
  const requestedSkills = [...(input.spec.allowedSkills ?? [])]
  const tools = intersectPermissionSet(requestedTools, parent.allowedTools)
  const skills = intersectPermissionSet(requestedSkills, parent.allowedSkills ?? [])

  if (depth > MAX_SPAWN_DEPTH) {
    const completedAt = options.clock?.() ?? Date.now()

    return failedResult({
      runId,
      parent,
      depth,
      startedAt,
      completedAt,
      requestedTools,
      effectiveTools: tools.effective,
      requestedSkills,
      effectiveSkills: skills.effective,
      droppedTools: tools.dropped,
      droppedSkills: skills.dropped,
      error: 'agent_depth_exceeded'
    })
  }

  if (tools.dropped.length > 0 || skills.dropped.length > 0) {
    const completedAt = options.clock?.() ?? Date.now()

    return failedResult({
      runId,
      parent,
      depth,
      startedAt,
      completedAt,
      requestedTools,
      effectiveTools: tools.effective,
      requestedSkills,
      effectiveSkills: skills.effective,
      droppedTools: tools.dropped,
      droppedSkills: skills.dropped,
      error: 'agent_permission_denied'
    })
  }

  try {
    const childResult = await options.runChild({
      runId,
      parentRunId: parent.parentRunId,
      task: input.spec.task,
      systemPrompt: input.spec.systemPrompt,
      allowedTools: tools.effective,
      allowedSkills: skills.effective,
      maxTurns: input.spec.maxTurns,
      traceId: `${parent.parentTraceId}/${runId}`,
      depth,
      ...(input.spec.modelId ? { modelId: input.spec.modelId } : {}),
      ...(input.spec.effort ? { effort: input.spec.effort } : {})
    })
    const completedAt = options.clock?.() ?? Date.now()

    return {
      output: childResult.output,
      status: childResult.status,
      turnsUsed: childResult.turnsUsed,
      droppedTools: tools.dropped,
      droppedSkills: skills.dropped,
      ...(childResult.error ? { error: childResult.error } : {}),
      trace: createTrace({
        runId,
        parent,
        depth,
        startedAt,
        completedAt,
        requestedTools,
        effectiveTools: tools.effective,
        requestedSkills,
        effectiveSkills: skills.effective,
        droppedTools: tools.dropped,
        droppedSkills: skills.dropped,
        status: childResult.status,
        ...(childResult.error ? { error: childResult.error } : {})
      })
    }
  } catch {
    // Child runner failures are converted to a stable safe agent error class for parent consumption.
    const completedAt = options.clock?.() ?? Date.now()

    return failedResult({
      runId,
      parent,
      depth,
      startedAt,
      completedAt,
      requestedTools,
      effectiveTools: tools.effective,
      requestedSkills,
      effectiveSkills: skills.effective,
      droppedTools: tools.dropped,
      droppedSkills: skills.dropped,
      error: 'agent_run_failed'
    })
  }
}
