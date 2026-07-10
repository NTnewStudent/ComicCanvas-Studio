/**
 * Agent run repository boundary for durable orchestration traces.
 * @see docs/api-contracts/agents.md
 */

import type { Database as BetterSqliteDatabase } from 'better-sqlite3'

import type { AgentRunStatus, AgentTriggerKind } from '../../../../../shared/agents'
import { decodeJson, encodeJson } from './json'

/** Complete durable representation of one agent run. */
export interface AgentRunRecord {
  id: string
  threadId: string
  workflowId: string
  messageId: string
  trigger: AgentTriggerKind
  agentId: string
  status: AgentRunStatus
  policyProfileId: string
  trace: Record<string, unknown>
  usage: Record<string, unknown>
  createdAt: number
  updatedAt: number
  jobId?: string
  contextPackId?: string
  gatewayId?: string
  modelId?: string
  pausedState?: Record<string, unknown>
  errorClass?: string
  lastCheckpoint?: string
}

/**
 * Agent run write input. New spine metadata stays optional while legacy runtime
 * callers are migrated; omitted values preserve existing persisted metadata.
 */
export interface AgentRunUpsertInput {
  id: string
  agentId: string
  status: AgentRunStatus
  trace: Record<string, unknown>
  createdAt: number
  updatedAt: number
  threadId?: string
  workflowId?: string
  messageId?: string
  trigger?: AgentTriggerKind
  policyProfileId?: string
  usage?: Record<string, unknown>
  jobId?: string
  contextPackId?: string
  gatewayId?: string
  modelId?: string
  pausedState?: Record<string, unknown>
  errorClass?: string
  lastCheckpoint?: string
}

interface AgentRunRow {
  id: string
  thread_id: string
  workflow_id: string
  message_id: string
  trigger: AgentTriggerKind
  agent_id: string
  job_id: string | null
  status: AgentRunStatus
  policy_profile_id: string
  context_pack_id: string | null
  gateway_id: string | null
  model_id: string | null
  trace_json: string
  paused_state_json: string | null
  usage_json: string
  error_class: string | null
  last_checkpoint: string | null
  created_at: number
  updated_at: number
}

/** Persistence operations for durable Agent run records. */
export interface AgentRunRepository {
  getById(id: string): AgentRunRecord | null
  upsert(record: AgentRunUpsertInput): AgentRunRecord
}

function rowToRecord(row: AgentRunRow): AgentRunRecord {
  const record: AgentRunRecord = {
    id: row.id,
    threadId: row.thread_id || 'default-thread',
    workflowId: row.workflow_id || 'default',
    messageId: row.message_id || '',
    trigger: row.trigger || 'manual',
    agentId: row.agent_id,
    status: row.status,
    policyProfileId: row.policy_profile_id || 'local-default',
    trace: decodeJson<Record<string, unknown>>(row.trace_json) ?? {},
    usage: decodeJson<Record<string, unknown>>(row.usage_json) ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }

  if (row.job_id) {
    record.jobId = row.job_id
  }

  if (row.context_pack_id) {
    record.contextPackId = row.context_pack_id
  }

  if (row.gateway_id) {
    record.gatewayId = row.gateway_id
  }

  if (row.model_id) {
    record.modelId = row.model_id
  }

  const pausedState = decodeJson<Record<string, unknown>>(row.paused_state_json)
  if (pausedState) {
    record.pausedState = pausedState
  }

  if (row.error_class) {
    record.errorClass = row.error_class
  }

  if (row.last_checkpoint) {
    record.lastCheckpoint = row.last_checkpoint
  }

  return record
}

/**
 * Creates a repository for persisted Agent run traces.
 * @param db - Open SQLite database handle.
 * @returns Agent run repository API.
 * @throws Error when repository SQL statements cannot be prepared.
 * @see docs/api-contracts/agents.md
 */
export function createAgentRunRepository(db: BetterSqliteDatabase): AgentRunRepository {
  const selectById = db.prepare('SELECT * FROM agent_runs WHERE id = ?')
  const upsertRun = db.prepare(`
    INSERT INTO agent_runs (
      id, thread_id, workflow_id, message_id, trigger, agent_id, job_id, status,
      policy_profile_id, context_pack_id, gateway_id, model_id, trace_json,
      paused_state_json, usage_json, error_class, last_checkpoint, created_at, updated_at
    ) VALUES (
      @id, @threadId, @workflowId, @messageId, @trigger, @agentId, @jobId, @status,
      @policyProfileId, @contextPackId, @gatewayId, @modelId, @traceJson,
      @pausedStateJson, @usageJson, @errorClass, @lastCheckpoint, @createdAt, @updatedAt
    )
    ON CONFLICT(id) DO UPDATE SET
      thread_id = excluded.thread_id,
      workflow_id = excluded.workflow_id,
      message_id = excluded.message_id,
      trigger = excluded.trigger,
      agent_id = excluded.agent_id,
      job_id = excluded.job_id,
      status = excluded.status,
      policy_profile_id = excluded.policy_profile_id,
      context_pack_id = excluded.context_pack_id,
      gateway_id = excluded.gateway_id,
      model_id = excluded.model_id,
      trace_json = excluded.trace_json,
      paused_state_json = excluded.paused_state_json,
      usage_json = excluded.usage_json,
      error_class = excluded.error_class,
      last_checkpoint = excluded.last_checkpoint,
      updated_at = excluded.updated_at
  `)

  return {
    getById(id) {
      const row = selectById.get(id) as AgentRunRow | undefined

      if (!row) {
        return null
      }

      return rowToRecord(row)
    },
    upsert(input) {
      const existingRow = selectById.get(input.id) as AgentRunRow | undefined
      const existing = existingRow ? rowToRecord(existingRow) : null
      const record: AgentRunRecord = {
        id: input.id,
        threadId: input.threadId ?? existing?.threadId ?? 'default-thread',
        workflowId: input.workflowId ?? existing?.workflowId ?? 'default',
        messageId: input.messageId ?? existing?.messageId ?? '',
        trigger: input.trigger ?? existing?.trigger ?? 'manual',
        agentId: input.agentId,
        status: input.status,
        policyProfileId: input.policyProfileId ?? existing?.policyProfileId ?? 'local-default',
        trace: input.trace,
        usage: input.usage ?? existing?.usage ?? {},
        createdAt: existing?.createdAt ?? input.createdAt,
        updatedAt: input.updatedAt
      }

      const jobId = input.jobId ?? existing?.jobId
      const contextPackId = input.contextPackId ?? existing?.contextPackId
      const gatewayId = input.gatewayId ?? existing?.gatewayId
      const modelId = input.modelId ?? existing?.modelId
      const pausedState = input.pausedState ?? existing?.pausedState
      const errorClass = input.errorClass ?? existing?.errorClass
      const lastCheckpoint = input.lastCheckpoint ?? existing?.lastCheckpoint

      if (jobId) record.jobId = jobId
      if (contextPackId) record.contextPackId = contextPackId
      if (gatewayId) record.gatewayId = gatewayId
      if (modelId) record.modelId = modelId
      if (pausedState) record.pausedState = pausedState
      if (errorClass) record.errorClass = errorClass
      if (lastCheckpoint) record.lastCheckpoint = lastCheckpoint

      upsertRun.run({
        id: record.id,
        threadId: record.threadId,
        workflowId: record.workflowId,
        messageId: record.messageId,
        trigger: record.trigger,
        agentId: record.agentId,
        jobId: record.jobId ?? null,
        status: record.status,
        policyProfileId: record.policyProfileId,
        contextPackId: record.contextPackId ?? null,
        gatewayId: record.gatewayId ?? null,
        modelId: record.modelId ?? null,
        traceJson: encodeJson(record.trace),
        pausedStateJson: record.pausedState ? encodeJson(record.pausedState) : null,
        usageJson: encodeJson(record.usage),
        errorClass: record.errorClass ?? null,
        lastCheckpoint: record.lastCheckpoint ?? null,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt
      })

      return record
    }
  }
}
