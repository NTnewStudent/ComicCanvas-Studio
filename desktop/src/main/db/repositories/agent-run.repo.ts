/**
 * Agent run repository boundary for durable orchestration traces.
 * @see docs/api-contracts/agents.md
 */

import type { Database as BetterSqliteDatabase } from 'better-sqlite3'

import type { AgentRunStatus } from '../../../../../shared/agents'
import { decodeJson, encodeJson } from './json'

export interface AgentRunRecord {
  id: string
  agentId: string
  status: AgentRunStatus
  trace: Record<string, unknown>
  createdAt: number
  updatedAt: number
  jobId?: string
  contextPackId?: string
  errorClass?: string
}

interface AgentRunRow {
  id: string
  agent_id: string
  job_id: string | null
  status: AgentRunStatus
  context_pack_id: string | null
  trace_json: string
  error_class: string | null
  created_at: number
  updated_at: number
}

export interface AgentRunRepository {
  getById(id: string): AgentRunRecord | null
  upsert(record: AgentRunRecord): AgentRunRecord
}

function rowToRecord(row: AgentRunRow): AgentRunRecord {
  const record: AgentRunRecord = {
    id: row.id,
    agentId: row.agent_id,
    status: row.status,
    trace: decodeJson<Record<string, unknown>>(row.trace_json) ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }

  if (row.job_id) {
    record.jobId = row.job_id
  }

  if (row.context_pack_id) {
    record.contextPackId = row.context_pack_id
  }

  if (row.error_class) {
    record.errorClass = row.error_class
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
      id, agent_id, job_id, status, context_pack_id, trace_json, error_class, created_at, updated_at
    ) VALUES (
      @id, @agentId, @jobId, @status, @contextPackId, @traceJson, @errorClass, @createdAt, @updatedAt
    )
    ON CONFLICT(id) DO UPDATE SET
      agent_id = excluded.agent_id,
      job_id = excluded.job_id,
      status = excluded.status,
      context_pack_id = excluded.context_pack_id,
      trace_json = excluded.trace_json,
      error_class = excluded.error_class,
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
    upsert(record) {
      upsertRun.run({
        id: record.id,
        agentId: record.agentId,
        jobId: record.jobId ?? null,
        status: record.status,
        contextPackId: record.contextPackId ?? null,
        traceJson: encodeJson(record.trace),
        errorClass: record.errorClass ?? null,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt
      })

      return record
    }
  }
}
