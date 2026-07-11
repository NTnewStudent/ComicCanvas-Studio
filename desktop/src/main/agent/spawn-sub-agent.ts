/**
 * Built-in role sub-agent spawning with durable parent lifecycle facts.
 * @see docs/api-contracts/agents.md
 */

import { createHash, randomUUID } from 'node:crypto'

import {
  CANONICAL_AGENT_ROLE_IDS,
  MAX_SPAWN_DEPTH,
  type AgentDefinition,
  type AgentRunStatus,
  type SpawnSubAgentError,
  type SpawnSubAgentInput,
  type SpawnSubAgentResult,
  type SubAgentRunTrace
} from '../../../../shared/agents'
import type { AgentRunSnapshot } from '../../../../shared/agent-run-events'
import type { ToolDescriptor } from '../../../../shared/tools'
import { redactSensitiveText } from '../security/redaction'
import type { AgentRegistry } from './registry'
import type { AgentRunSpine } from './run-spine'
import type { AgentContextLoopState, AgentToolApprovalRequest } from './context-loop'

type PermissionSet = string[] | '*'
type SpawnPersistence = Pick<AgentRunSpine, 'appendEvent' | 'upsertChildTask'> & Partial<Pick<
  AgentRunSpine,
  'transaction' | 'createRun' | 'updateRun' | 'getSnapshot'
>>
type DurableSpawnPersistence = Pick<
  AgentRunSpine,
  'transaction' | 'createRun' | 'updateRun' | 'getSnapshot' | 'appendEvent' | 'upsertChildTask'
>

export interface SpawnParentContext {
  parentRunId: string
  parentTraceId: string
  allowedTools: PermissionSet
  allowedSkills?: PermissionSet
  depth: number
}

export interface ChildAgentRunInput {
  runId: string
  parentRunId: string
  role: AgentDefinition
  task: string
  allowedTools: string[]
  allowedSkills: string[]
  traceId: string
  parentTraceId: string
  depth: number
}

export interface ChildAgentRunResult {
  output: string
  status: Exclude<AgentRunStatus, 'pending' | 'running'>
  turnsUsed: number
  artifactIds?: string[]
  error?: string
  pausedState?: AgentContextLoopState
  pendingApproval?: AgentToolApprovalRequest
}

export interface SpawnSubAgentOptions {
  registry: Pick<AgentRegistry, 'get'>
  listTools?: () => ToolDescriptor[]
  runSpine?: SpawnPersistence
  idFactory?: () => string
  clock?: () => number
  runChild: (input: ChildAgentRunInput) => Promise<ChildAgentRunResult> | ChildAgentRunResult
}

const canonicalRoleIds = new Set<string>(CANONICAL_AGENT_ROLE_IDS)

function createRunId(): string {
  return `agent-run-${randomUUID()}`
}

function safeSummary(value: string): string {
  return redactSensitiveText(value.replace(/\s+/gu, ' ').trim()).slice(0, 240)
}

function requestFingerprint(input: {
  task: string
  roleId: string
  effectiveTools: readonly string[]
  effectiveSkills: readonly string[]
}): string {
  const normalizedTask = input.task.replace(/\s+/gu, ' ').trim()
  const canonical = JSON.stringify({
    task: normalizedTask,
    roleId: input.roleId,
    effectiveTools: [...new Set(input.effectiveTools)].sort(),
    effectiveSkills: [...new Set(input.effectiveSkills)].sort()
  })
  return `sha256:${createHash('sha256').update(canonical).digest('hex')}`
}

function rolePermissionItems(value: PermissionSet): string[] {
  return value === '*' ? [] : [...value]
}

function durablePersistence(value: SpawnPersistence | undefined): DurableSpawnPersistence | null {
  if (
    !value?.transaction
    || !value.createRun
    || !value.updateRun
    || !value.getSnapshot
  ) {
    return null
  }
  return value as DurableSpawnPersistence
}

function isTerminalStatus(status: AgentRunStatus): status is Exclude<AgentRunStatus, 'pending' | 'running'> {
  return status === 'completed' || status === 'failed' || status === 'aborted'
}

function cachedResult(input: {
  roleId: string
  child: AgentRunSnapshot['run']
  task: AgentRunSnapshot['childTasks'][number]
  parent: SpawnParentContext
  requestedTools: string[]
  effectiveTools: string[]
  requestedSkills: string[]
  effectiveSkills: string[]
  droppedTools: string[]
  droppedSkills: string[]
}): SpawnSubAgentResult {
  const status = isTerminalStatus(input.child.status) ? input.child.status : 'failed'
  const errorClass = input.task.errorClass === 'agent_role_not_spawnable'
    || input.task.errorClass === 'agent_depth_exceeded'
    || input.task.errorClass === 'agent_child_run_failed'
    ? input.task.errorClass
    : 'agent_child_run_failed'

  return {
    roleId: input.roleId,
    output: safeSummary(input.task.outputSummary ?? ''),
    status,
    turnsUsed: 0,
    effectiveTools: input.effectiveTools,
    droppedTools: input.droppedTools,
    droppedSkills: input.droppedSkills,
    artifactIds: [...input.task.artifactIds],
    ...(status === 'completed' ? {} : { error: spawnError(errorClass) }),
    trace: createTrace({
      runId: input.child.id,
      parent: input.parent,
      depth: typeof input.child.trace.depth === 'number' ? input.child.trace.depth : input.parent.depth + 1,
      startedAt: input.task.createdAt,
      completedAt: input.task.updatedAt,
      requestedTools: input.requestedTools,
      effectiveTools: input.effectiveTools,
      requestedSkills: input.requestedSkills,
      effectiveSkills: input.effectiveSkills,
      droppedTools: input.droppedTools,
      droppedSkills: input.droppedSkills,
      status,
      ...(status === 'completed' ? {} : { errorClass })
    })
  }
}

function intersectPermissionSet(requested: string[], parentAllowed: PermissionSet | undefined): { effective: string[]; dropped: string[] } {
  if (parentAllowed === '*') {
    return { effective: [...requested], dropped: [] }
  }

  const parent = new Set(parentAllowed ?? [])
  return {
    effective: requested.filter((item) => parent.has(item)),
    dropped: requested.filter((item) => !parent.has(item))
  }
}

function narrowTools(
  role: AgentDefinition,
  parentAllowed: PermissionSet,
  descriptors: readonly ToolDescriptor[]
): { effective: string[]; dropped: string[] } {
  const parentTools = parentAllowed === '*' ? descriptors.map((tool) => tool.id) : parentAllowed
  const roleTools = role.allowedTools === '*' ? parentTools : role.allowedTools
  const descriptorById = new Map(descriptors.map((tool) => [tool.id, tool]))
  const allowedPermissionKinds = new Set(role.permissionPolicy.allowedPermissionKinds)
  const effective = roleTools.filter((toolId) => {
    if (!parentTools.includes(toolId)) return false
    const descriptor = descriptorById.get(toolId)
    return descriptor?.enabled === true
      && descriptor.permissions.every((permission) => allowedPermissionKinds.has(permission.kind))
  })

  return { effective, dropped: roleTools.filter((toolId) => !effective.includes(toolId)) }
}

function spawnError(errorClass: SpawnSubAgentError['errorClass']): SpawnSubAgentError {
  const messages: Record<SpawnSubAgentError['errorClass'], string> = {
    agent_role_not_spawnable: 'Only canonical built-in agent roles can be spawned.',
    agent_depth_exceeded: 'Maximum sub-agent nesting depth reached.',
    agent_child_run_failed: 'Child agent run failed.'
  }
  return { errorClass, message: messages[errorClass], retryable: false }
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
  errorClass?: SpawnSubAgentError['errorClass']
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
    ...(input.errorClass ? { errorClass: input.errorClass } : {})
  }
}

function failureResult(input: {
  roleId: string
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
  errorClass: SpawnSubAgentError['errorClass']
  artifactIds?: string[]
}): SpawnSubAgentResult {
  return {
    roleId: input.roleId,
    output: '',
    status: 'failed',
    turnsUsed: 0,
    effectiveTools: input.effectiveTools,
    droppedTools: input.droppedTools,
    droppedSkills: input.droppedSkills,
    artifactIds: input.artifactIds ?? [],
    error: spawnError(input.errorClass),
    trace: createTrace({ ...input, status: 'failed' })
  }
}

/**
 * Spawns one canonical built-in role and records its lifecycle on the parent run.
 * @param input - Canonical role ID and bounded task supplied by the parent model.
 * @param parent - Actual parent run trace, role permissions, and current depth.
 * @param options - Registry, optional durable spine, deterministic dependencies, and child delegate.
 * @returns Child output or a structured failure that remains consumable by the parent run.
 * @throws Error never intentionally; runner failures become `agent_child_run_failed` results.
 * @see docs/api-contracts/agents.md
 */
export async function spawnSubAgent(
  input: SpawnSubAgentInput,
  parent: SpawnParentContext,
  options: SpawnSubAgentOptions
): Promise<SpawnSubAgentResult> {
  const runId = options.idFactory?.() ?? createRunId()
  const startedAt = options.clock?.() ?? Date.now()
  const depth = parent.depth + 1
  const role = canonicalRoleIds.has(input.roleId) ? options.registry.get(input.roleId) : null

  if (!role || role.source !== 'builtin' || role.id !== input.roleId) {
    return failureResult({
      roleId: input.roleId,
      runId,
      parent,
      depth,
      startedAt,
      completedAt: options.clock?.() ?? Date.now(),
      requestedTools: [],
      effectiveTools: [],
      requestedSkills: [],
      effectiveSkills: [],
      droppedTools: [],
      droppedSkills: [],
      errorClass: 'agent_role_not_spawnable'
    })
  }

  const requestedTools = rolePermissionItems(role.allowedTools)
  const requestedSkills = rolePermissionItems(role.allowedSkills)
  const tools = narrowTools(role, parent.allowedTools, options.listTools?.() ?? [])
  const skills = role.allowedSkills === '*' && parent.allowedSkills !== '*'
    ? { effective: [...(parent.allowedSkills ?? [])], dropped: [] }
    : intersectPermissionSet(requestedSkills, parent.allowedSkills ?? [])

  if (depth > MAX_SPAWN_DEPTH) {
    return failureResult({
      roleId: role.id,
      runId,
      parent,
      depth,
      startedAt,
      completedAt: options.clock?.() ?? Date.now(),
      requestedTools,
      effectiveTools: tools.effective,
      requestedSkills,
      effectiveSkills: skills.effective,
      droppedTools: tools.dropped,
      droppedSkills: skills.dropped,
      errorClass: 'agent_depth_exceeded'
    })
  }

  const inputSummary = requestFingerprint({
    task: input.task,
    roleId: role.id,
    effectiveTools: tools.effective,
    effectiveSkills: skills.effective
  })
  const startedRecord = {
    id: runId,
    parentRunId: parent.parentRunId,
    roleId: role.id,
    inputSummary,
    effectiveTools: tools.effective,
    status: 'running' as const,
    artifactIds: [],
    createdAt: startedAt,
    updatedAt: startedAt
  }
  const durable = durablePersistence(options.runSpine)

  if (durable) {
    const existingChild = durable.getSnapshot(runId)
    if (existingChild) {
      const parentSnapshot = durable.getSnapshot(parent.parentRunId)
      const childTask = parentSnapshot?.childTasks.find((task) => task.id === runId)
      const identityMatches = existingChild.run.agentId === role.id
        && existingChild.run.trace.parentRunId === parent.parentRunId
        && childTask?.parentRunId === parent.parentRunId
        && childTask.roleId === role.id
        && childTask.inputSummary === inputSummary

      if (!identityMatches || !childTask || !isTerminalStatus(existingChild.run.status)) {
        return failureResult({
          roleId: role.id,
          runId,
          parent,
          depth,
          startedAt,
          completedAt: options.clock?.() ?? Date.now(),
          requestedTools,
          effectiveTools: tools.effective,
          requestedSkills,
          effectiveSkills: skills.effective,
          droppedTools: tools.dropped,
          droppedSkills: skills.dropped,
          errorClass: 'agent_child_run_failed'
        })
      }

      return cachedResult({
        roleId: role.id,
        child: existingChild.run,
        task: childTask,
        parent,
        requestedTools,
        effectiveTools: tools.effective,
        requestedSkills,
        effectiveSkills: skills.effective,
        droppedTools: tools.dropped,
        droppedSkills: skills.dropped
      })
    }
  }

  try {
    if (durable) {
      const claim = durable.transaction(() => {
        const parentSnapshot = durable.getSnapshot(parent.parentRunId)
        if (!parentSnapshot) {
          throw new Error(`Parent agent run not found: ${parent.parentRunId}`)
        }

        const existingChild = durable.getSnapshot(runId)
        if (existingChild) {
          const childTask = parentSnapshot.childTasks.find((task) => task.id === runId)
          const identityMatches = existingChild.run.agentId === role.id
            && existingChild.run.trace.parentRunId === parent.parentRunId
            && existingChild.run.trace.parentTraceId === parent.parentTraceId
            && childTask?.parentRunId === parent.parentRunId
            && childTask.roleId === role.id
            && childTask.inputSummary === inputSummary
          if (!identityMatches || !childTask || !isTerminalStatus(existingChild.run.status)) {
            return { kind: 'conflict' as const }
          }
          return { kind: 'cached' as const, child: existingChild.run, task: childTask }
        }
        if (!existingChild) {
          durable.createRun({
            runId,
            threadId: parentSnapshot.run.threadId,
            workflowId: parentSnapshot.run.workflowId,
            messageId: parentSnapshot.run.messageId,
            agentId: role.id,
            trigger: parentSnapshot.run.trigger,
            policyProfileId: parentSnapshot.run.policyProfileId,
            ...(parentSnapshot.run.gatewayId ? { gatewayId: parentSnapshot.run.gatewayId } : {}),
            ...(parentSnapshot.run.modelId ? { modelId: parentSnapshot.run.modelId } : {})
          })
        }

        durable.updateRun({
          runId,
          status: 'running',
          trace: {
            parentRunId: parent.parentRunId,
            parentTraceId: parent.parentTraceId,
            depth
          },
          errorClass: null,
          lastCheckpoint: 'run.started'
        })
        durable.appendEvent(runId, 'run.started', { status: 'running' })
        durable.upsertChildTask(startedRecord)
        durable.appendEvent(parent.parentRunId, 'child.started', {
          childTaskId: runId,
          roleId: role.id,
          inputSummary,
          effectiveTools: tools.effective
        })
        return { kind: 'claimed' as const }
      })
      if (claim.kind === 'cached') {
        return cachedResult({
          roleId: role.id, child: claim.child, task: claim.task, parent,
          requestedTools, effectiveTools: tools.effective, requestedSkills,
          effectiveSkills: skills.effective, droppedTools: tools.dropped, droppedSkills: skills.dropped
        })
      }
      if (claim.kind === 'conflict') {
        return failureResult({
          roleId: role.id, runId, parent, depth, startedAt,
          completedAt: options.clock?.() ?? Date.now(), requestedTools,
          effectiveTools: tools.effective, requestedSkills, effectiveSkills: skills.effective,
          droppedTools: tools.dropped, droppedSkills: skills.dropped,
          errorClass: 'agent_child_run_failed'
        })
      }
    } else {
      options.runSpine?.upsertChildTask(startedRecord)
      options.runSpine?.appendEvent(parent.parentRunId, 'child.started', {
        childTaskId: runId,
        roleId: role.id,
        inputSummary,
        effectiveTools: tools.effective
      })
    }

    const childResult = await options.runChild({
      runId,
      parentRunId: parent.parentRunId,
      role,
      task: input.task,
      allowedTools: tools.effective,
      allowedSkills: skills.effective,
      traceId: `${parent.parentTraceId}/${runId}`,
      parentTraceId: parent.parentTraceId,
      depth
    })
    const completedAt = options.clock?.() ?? Date.now()
    const artifactIds = [...(childResult.artifactIds ?? [])]
    const outputSummary = safeSummary(childResult.output)

    if (childResult.status === 'approval_required' && childResult.pausedState && childResult.pendingApproval) {
      const pausedState = structuredClone(childResult.pausedState)
      const pendingApproval = structuredClone(childResult.pendingApproval)
      const persistApproval = () => {
        durable?.updateRun({
          runId, status: 'approval_required', pausedState: { ...pausedState },
          trace: { pendingApproval }, errorClass: 'agent_tool_approval_required',
          lastCheckpoint: 'permission.requested'
        })
        durable?.appendEvent(runId, 'permission.requested', {
          callId: pendingApproval.callId, toolId: pendingApproval.toolId,
          reason: pendingApproval.reason, requiredPermissions: pendingApproval.requiredPermissions
        })
        options.runSpine?.upsertChildTask({
          ...startedRecord, status: 'approval_required', artifactIds,
          errorClass: 'agent_tool_approval_required', updatedAt: completedAt
        })
      }
      if (durable) durable.transaction(persistApproval)
      else persistApproval()

      return {
        roleId: role.id, output: childResult.output, status: 'approval_required',
        turnsUsed: childResult.turnsUsed, effectiveTools: tools.effective,
        droppedTools: tools.dropped, droppedSkills: skills.dropped, artifactIds,
        pausedState, pendingApproval,
        trace: createTrace({
          runId, parent, depth, startedAt, completedAt, requestedTools,
          effectiveTools: tools.effective, requestedSkills, effectiveSkills: skills.effective,
          droppedTools: tools.dropped, droppedSkills: skills.dropped, status: 'approval_required'
        })
      }
    }

    if (childResult.status !== 'completed') {
      const error = spawnError('agent_child_run_failed')
      const persistFailure = () => {
        durable?.updateRun({
          runId,
          status: 'failed',
          errorClass: error.errorClass,
          lastCheckpoint: 'run.failed'
        })
        durable?.appendEvent(runId, 'run.failed', {
          errorClass: error.errorClass,
          message: error.message,
          retryable: false,
          checkpoint: 'run.failed'
        })
        options.runSpine?.upsertChildTask({
          ...startedRecord,
          status: 'failed',
          ...(outputSummary ? { outputSummary } : {}),
          artifactIds,
          errorClass: error.errorClass,
          updatedAt: completedAt
        })
        options.runSpine?.appendEvent(parent.parentRunId, 'child.failed', {
          childTaskId: runId,
          roleId: role.id,
          errorClass: error.errorClass,
          ...(outputSummary ? { outputSummary } : {}),
          artifactIds
        })
      }
      if (durable) {
        durable.transaction(persistFailure)
      } else {
        persistFailure()
      }
      return failureResult({
        roleId: role.id,
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
        errorClass: error.errorClass,
        artifactIds
      })
    }

    const persistCompletion = () => {
      durable?.updateRun({ runId, status: 'completed', lastCheckpoint: 'run.completed' })
      durable?.appendEvent(runId, 'run.completed', { status: 'completed' })
      options.runSpine?.upsertChildTask({
        ...startedRecord,
        status: 'completed',
        outputSummary,
        artifactIds,
        updatedAt: completedAt
      })
      options.runSpine?.appendEvent(parent.parentRunId, 'child.completed', {
        childTaskId: runId,
        roleId: role.id,
        outputSummary,
        artifactIds
      })
    }
    if (durable) {
      durable.transaction(persistCompletion)
    } else {
      persistCompletion()
    }

    return {
      roleId: role.id,
      output: childResult.output,
      status: 'completed',
      turnsUsed: childResult.turnsUsed,
      effectiveTools: tools.effective,
      droppedTools: tools.dropped,
      droppedSkills: skills.dropped,
      artifactIds,
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
        status: 'completed'
      })
    }
  } catch {
    // Child exceptions are reduced to a safe class so the parent loop can continue from tool output.
    const completedAt = options.clock?.() ?? Date.now()
    const error = spawnError('agent_child_run_failed')
    try {
      const persistFailure = () => {
        const childSnapshot = durable?.getSnapshot(runId)
        if (childSnapshot) {
          durable?.updateRun({
            runId,
            status: 'failed',
            errorClass: error.errorClass,
            lastCheckpoint: 'run.failed'
          })
          durable?.appendEvent(runId, 'run.failed', {
            errorClass: error.errorClass,
            message: error.message,
            retryable: false,
            checkpoint: 'run.failed'
          })
          options.runSpine?.upsertChildTask({
            ...startedRecord,
            status: 'failed',
            artifactIds: [],
            errorClass: error.errorClass,
            updatedAt: completedAt
          })
          options.runSpine?.appendEvent(parent.parentRunId, 'child.failed', {
            childTaskId: runId,
            roleId: role.id,
            errorClass: error.errorClass,
            artifactIds: []
          })
        } else if (!durable) {
          options.runSpine?.upsertChildTask({
            ...startedRecord,
            status: 'failed',
            artifactIds: [],
            errorClass: error.errorClass,
            updatedAt: completedAt
          })
          options.runSpine?.appendEvent(parent.parentRunId, 'child.failed', {
            childTaskId: runId,
            roleId: role.id,
            errorClass: error.errorClass,
            artifactIds: []
          })
        }
      }
      if (durable) {
        durable.transaction(persistFailure)
      } else {
        persistFailure()
      }
    } catch {
      // Persistence failures remain a structured child failure and never escape into the parent loop.
    }
    return failureResult({
      roleId: role.id,
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
      errorClass: error.errorClass
    })
  }
}
