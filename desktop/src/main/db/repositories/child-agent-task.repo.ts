/**
 * Durable child Agent task repository.
 * @see docs/api-contracts/agents.md
 */

import type { Database as BetterSqliteDatabase } from 'better-sqlite3'

import type { ChildAgentTaskRecord } from '../../../../../shared/agent-run-events'
import type { AgentRunStatus } from '../../../../../shared/agents'
import { decodeJson, encodeJson } from './json'

interface ChildAgentTaskRow {
  id: string
  parent_run_id: string
  role_id: string
  input_summary: string
  effective_tools_json: string
  status: AgentRunStatus
  output_summary: string | null
  artifact_ids_json: string
  error_class: string | null
  created_at: number
  updated_at: number
}

/** Persistence operations for visible child Agent task summaries. */
export interface ChildAgentTaskRepository {
  upsert(record: ChildAgentTaskRecord): ChildAgentTaskRecord
  listByParentRunId(parentRunId: string): ChildAgentTaskRecord[]
}

function rowToRecord(row: ChildAgentTaskRow): ChildAgentTaskRecord {
  const record: ChildAgentTaskRecord = {
    id: row.id,
    parentRunId: row.parent_run_id,
    roleId: row.role_id,
    inputSummary: row.input_summary,
    effectiveTools: decodeJson<string[]>(row.effective_tools_json) ?? [],
    status: row.status,
    artifactIds: decodeJson<string[]>(row.artifact_ids_json) ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }

  if (row.output_summary !== null) record.outputSummary = row.output_summary
  if (row.error_class !== null) record.errorClass = row.error_class

  return record
}

/**
 * Creates the child Agent task repository.
 * @param db - Open SQLite database handle.
 * @returns Child task upsert and parent-run list operations.
 * @throws Error when a child task cannot be encoded or persisted.
 * @see docs/api-contracts/agents.md
 */
export function createChildAgentTaskRepository(db: BetterSqliteDatabase): ChildAgentTaskRepository {
  const upsert = db.prepare(`
    INSERT INTO child_agent_tasks (
      id, parent_run_id, role_id, input_summary, effective_tools_json, status,
      output_summary, artifact_ids_json, error_class, created_at, updated_at
    ) VALUES (
      @id, @parentRunId, @roleId, @inputSummary, @effectiveToolsJson, @status,
      @outputSummary, @artifactIdsJson, @errorClass, @createdAt, @updatedAt
    )
    ON CONFLICT(id) DO UPDATE SET
      parent_run_id = excluded.parent_run_id,
      role_id = excluded.role_id,
      input_summary = excluded.input_summary,
      effective_tools_json = excluded.effective_tools_json,
      status = excluded.status,
      output_summary = excluded.output_summary,
      artifact_ids_json = excluded.artifact_ids_json,
      error_class = excluded.error_class,
      updated_at = excluded.updated_at
  `)
  const selectByParent = db.prepare(`
    SELECT * FROM child_agent_tasks WHERE parent_run_id = ? ORDER BY created_at ASC, id ASC
  `)

  return {
    upsert(record) {
      upsert.run({
        id: record.id,
        parentRunId: record.parentRunId,
        roleId: record.roleId,
        inputSummary: record.inputSummary,
        effectiveToolsJson: encodeJson(record.effectiveTools),
        status: record.status,
        outputSummary: record.outputSummary ?? null,
        artifactIdsJson: encodeJson(record.artifactIds),
        errorClass: record.errorClass ?? null,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt
      })

      return record
    },
    listByParentRunId(parentRunId) {
      return (selectByParent.all(parentRunId) as ChildAgentTaskRow[]).map(rowToRecord)
    }
  }
}
