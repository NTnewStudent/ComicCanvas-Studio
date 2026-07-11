/**
 * Durable local Agent Run Spine service.
 * @see docs/api-contracts/agents.md
 */

import type {
  AgentArtifactRecord,
  AgentRunEventAppend,
  AgentRunEventPayloadMap,
  AgentRunEventRecord,
  AgentRunEventType,
  AgentRunSnapshot,
  ChildAgentTaskRecord,
  LocalPermissionGrant
} from '../../../../shared/agent-run-events'
import type { AgentRunStatus, AgentTriggerKind } from '../../../../shared/agents'
import { redactSensitiveData } from '../security/redaction'
import type { AgentArtifactRepository } from '../db/repositories/agent-artifact.repo'
import type { AgentPermissionGrantRepository } from '../db/repositories/agent-permission-grant.repo'
import type {
  AgentRunEventAppendInput,
  AgentRunEventRepository
} from '../db/repositories/agent-run-event.repo'
import type {
  AgentRunRecord,
  AgentRunRepository,
  AgentRunUpsertInput
} from '../db/repositories/agent-run.repo'
import type { ChildAgentTaskRepository } from '../db/repositories/child-agent-task.repo'

/** Metadata required before an Agent run can start work. */
export interface CreateAgentRunSpineInput {
  runId: string
  threadId: string
  workflowId: string
  messageId: string
  agentId: string
  trigger: AgentTriggerKind
  policyProfileId: string
  jobId?: string
  gatewayId?: string
  modelId?: string
}

/** Mutable lifecycle fields for an existing Agent run. */
export interface UpdateAgentRunInput {
  runId: string
  status: AgentRunStatus
  jobId?: string
  contextPackId?: string
  pausedState?: Record<string, unknown> | null
  usage?: Record<string, unknown>
  trace?: Record<string, unknown>
  errorClass?: string | null
  lastCheckpoint?: string | null
}

/** Atomic terminal facts written when a user denies one paused tool call. */
export interface DenyAgentToolRunInput {
  runId: string
  callId: string
  deniedByLabel: string
  completedAt: number
}

/** Durable service boundary for Agent lifecycle facts and replay snapshots. */
export interface AgentRunSpine {
  transaction<T>(operation: () => T): T
  createRun(input: CreateAgentRunSpineInput): AgentRunRecord
  updateRun(input: UpdateAgentRunInput): AgentRunRecord
  denyTool(input: DenyAgentToolRunInput): AgentRunRecord
  appendEvent: AgentRunEventAppend
  saveArtifact(record: AgentArtifactRecord): AgentArtifactRecord
  savePermissionGrant(record: LocalPermissionGrant): LocalPermissionGrant
  upsertChildTask(record: ChildAgentTaskRecord): ChildAgentTaskRecord
  getSnapshot(runId: string): AgentRunSnapshot | null
}

/** Repositories and deterministic dependencies required by the Run Spine. */
export interface AgentRunSpineOptions {
  runs: AgentRunRepository
  events: AgentRunEventRepository
  artifacts: AgentArtifactRepository
  grants: AgentPermissionGrantRepository
  childTasks: ChildAgentTaskRepository
  idFactory?: (prefix: 'event' | 'artifact' | 'grant' | 'child') => string
  clock?: () => number
  transaction: <T>(operation: () => T) => T
}

/**
 * Creates the durable Run Spine service.
 * @param options - Repositories, clock, and ID dependencies.
 * @returns Run lifecycle, event, artifact, permission, child task, and replay operations.
 * @throws Error when callers mutate a missing run or create a duplicate run.
 * @see docs/api-contracts/agents.md
 */
export function createAgentRunSpine(options: AgentRunSpineOptions): AgentRunSpine {
  const clock = options.clock ?? Date.now
  const idFactory = options.idFactory ?? ((prefix) => `${prefix}-${crypto.randomUUID()}`)

  function requireRun(runId: string): AgentRunRecord {
    const run = options.runs.getById(runId)
    if (!run) {
      // Orphan events and artifacts would make replay disagree with the run list.
      throw new Error(`Agent run not found: ${runId}`)
    }
    return run
  }

  function appendEvent<Type extends AgentRunEventType>(
    runId: string,
    type: Type,
    payload: AgentRunEventPayloadMap[NoInfer<Type>],
    createdAt = clock()
  ): AgentRunEventRecord<Type> {
    requireRun(runId)
    const appendInput = {
      id: idFactory('event'),
      runId,
      type,
      payload: redactSensitiveData(payload),
      createdAt
    } as AgentRunEventAppendInput
    return options.events.append(appendInput) as AgentRunEventRecord<Type>
  }

  function updateRun(input: UpdateAgentRunInput): AgentRunRecord {
    const existing = requireRun(input.runId)
    const next: AgentRunUpsertInput = {
      ...existing,
      status: input.status,
      trace: input.trace ? { ...existing.trace, ...input.trace } : existing.trace,
      updatedAt: clock()
    }

    if (input.jobId) next.jobId = input.jobId
    if (input.contextPackId) next.contextPackId = input.contextPackId
    if (input.usage) next.usage = input.usage
    if (input.pausedState !== undefined) next.pausedState = input.pausedState
    if (input.errorClass !== undefined) next.errorClass = input.errorClass
    if (input.lastCheckpoint !== undefined) next.lastCheckpoint = input.lastCheckpoint

    return options.runs.upsert(next)
  }

  return {
    transaction(operation) {
      return options.transaction(operation)
    },
    createRun(input) {
      if (options.runs.getById(input.runId)) {
        // A second run.created fact for one run ID would violate lifecycle uniqueness.
        throw new Error(`Agent run already exists: ${input.runId}`)
      }

      const now = clock()
      const record = options.runs.upsert({
        id: input.runId,
        threadId: input.threadId,
        workflowId: input.workflowId,
        messageId: input.messageId,
        trigger: input.trigger,
        agentId: input.agentId,
        status: 'pending',
        policyProfileId: input.policyProfileId,
        trace: {
          messageId: input.messageId,
          agentId: input.agentId,
          trigger: input.trigger
        },
        usage: {},
        createdAt: now,
        updatedAt: now,
        ...(input.jobId ? { jobId: input.jobId } : {}),
        ...(input.gatewayId ? { gatewayId: input.gatewayId } : {}),
        ...(input.modelId ? { modelId: input.modelId } : {})
      })

      appendEvent(input.runId, 'run.created', {
        threadId: input.threadId,
        workflowId: input.workflowId,
        agentId: input.agentId,
        trigger: input.trigger,
        messageId: input.messageId,
        policyProfileId: input.policyProfileId,
        ...(input.jobId ? { jobId: input.jobId } : {}),
        ...(input.gatewayId ? { gatewayId: input.gatewayId } : {}),
        ...(input.modelId ? { modelId: input.modelId } : {})
      }, now)

      return record
    },
    updateRun,
    denyTool(input) {
      return options.transaction(() => {
        const deniedRun = updateRun({
          runId: input.runId,
          status: 'aborted',
          pausedState: null,
          trace: {
            pendingApproval: null,
            deniedCallId: input.callId,
            deniedByLabel: input.deniedByLabel,
            completedAt: input.completedAt
          },
          errorClass: 'agent_tool_denied',
          lastCheckpoint: 'run.failed'
        })
        appendEvent(input.runId, 'permission.resolved', {
          callId: input.callId,
          deniedByLabel: input.deniedByLabel,
          decision: 'denied'
        })
        appendEvent(input.runId, 'run.failed', {
          errorClass: 'agent_tool_denied',
          message: 'Tool call was denied by the user.',
          retryable: false,
          checkpoint: 'run.failed'
        })
        return deniedRun
      })
    },
    appendEvent,
    saveArtifact(record) {
      requireRun(record.runId)
      const saved = options.artifacts.create(record)
      appendEvent(saved.runId, 'artifact.created', {
        artifactId: saved.id,
        kind: saved.kind,
        title: saved.title,
        summary: saved.summary
      })
      return saved
    },
    savePermissionGrant(record) {
      if (record.runId) requireRun(record.runId)
      return options.grants.save(record)
    },
    upsertChildTask(record) {
      requireRun(record.parentRunId)
      return options.childTasks.upsert(record)
    },
    getSnapshot(runId) {
      const run = options.runs.getById(runId)
      if (!run) {
        return null
      }

      return {
        run: {
          id: run.id,
          threadId: run.threadId,
          workflowId: run.workflowId,
          agentId: run.agentId,
          status: run.status,
          trigger: run.trigger,
          messageId: run.messageId,
          policyProfileId: run.policyProfileId,
          trace: run.trace,
          usage: run.usage,
          createdAt: run.createdAt,
          updatedAt: run.updatedAt,
          ...(run.jobId ? { jobId: run.jobId } : {}),
          ...(run.contextPackId ? { contextPackId: run.contextPackId } : {}),
          ...(run.gatewayId ? { gatewayId: run.gatewayId } : {}),
          ...(run.modelId ? { modelId: run.modelId } : {}),
          ...(run.pausedState ? { pausedState: run.pausedState } : {}),
          ...(run.errorClass ? { errorClass: run.errorClass } : {}),
          ...(run.lastCheckpoint ? { lastCheckpoint: run.lastCheckpoint } : {})
        },
        events: options.events.listByRunId(runId),
        artifacts: options.artifacts.listByRunId(runId),
        permissionGrants: options.grants.listByRunId(runId),
        childTasks: options.childTasks.listByParentRunId(runId)
      }
    }
  }
}
