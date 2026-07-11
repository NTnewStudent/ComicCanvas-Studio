/**
 * Durable Agent artifact repository.
 * @see docs/api-contracts/agents.md
 */

import type { Database as BetterSqliteDatabase } from 'better-sqlite3'

import type { AgentArtifactRecord } from '../../../../../shared/agent-run-events'
import { decodeJson, encodeJson } from './json'

interface AgentArtifactRow {
  id: string
  run_id: string
  kind: AgentArtifactRecord['kind']
  title: string
  summary: string
  payload_json: string
  created_at: number
}

/** Persistence operations for durable run artifacts. */
export interface AgentArtifactRepository {
  create(record: AgentArtifactRecord): AgentArtifactRecord
  getById(id: string): AgentArtifactRecord | null
  listByRunId(runId: string): AgentArtifactRecord[]
}

function rowToRecord(row: AgentArtifactRow): AgentArtifactRecord {
  return {
    id: row.id,
    runId: row.run_id,
    kind: row.kind,
    title: row.title,
    summary: row.summary,
    payload: decodeJson<AgentArtifactRecord['payload']>(row.payload_json) ?? {},
    createdAt: row.created_at
  }
}

/**
 * Creates the durable artifact repository.
 * @param db - Open SQLite database handle.
 * @returns Artifact create and run-scoped list operations.
 * @throws Error when an artifact cannot be persisted.
 * @see docs/api-contracts/agents.md
 */
export function createAgentArtifactRepository(db: BetterSqliteDatabase): AgentArtifactRepository {
  const insert = db.prepare(`
    INSERT INTO agent_artifacts (id, run_id, kind, title, summary, payload_json, created_at)
    VALUES (@id, @runId, @kind, @title, @summary, @payloadJson, @createdAt)
  `)
  const selectByRun = db.prepare(`
    SELECT * FROM agent_artifacts WHERE run_id = ? ORDER BY created_at ASC, id ASC
  `)
  const selectById = db.prepare('SELECT * FROM agent_artifacts WHERE id = ?')

  return {
    create(record) {
      insert.run({
        id: record.id,
        runId: record.runId,
        kind: record.kind,
        title: record.title,
        summary: record.summary,
        payloadJson: encodeJson(record.payload),
        createdAt: record.createdAt
      })

      return record
    },
    getById(id) {
      const row = selectById.get(id) as AgentArtifactRow | undefined
      return row ? rowToRecord(row) : null
    },
    listByRunId(runId) {
      return (selectByRun.all(runId) as AgentArtifactRow[]).map(rowToRecord)
    }
  }
}
