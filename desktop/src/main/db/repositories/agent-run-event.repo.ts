/**
 * Append-only Agent Run Spine event repository.
 * @see docs/api-contracts/agents.md
 */

import type { Database as BetterSqliteDatabase } from 'better-sqlite3'

import type {
  AgentRunEventPayload,
  AgentRunEventRecord,
  AgentRunEventType
} from '../../../../../shared/agent-run-events'
import { decodeJson, encodeJson } from './json'

interface AgentRunEventRow {
  id: string
  run_id: string
  sequence: number
  type: AgentRunEventType
  payload_json: string
  created_at: number
}

/** Data required to append one immutable run event. */
export interface AgentRunEventAppendInput {
  id: string
  runId: string
  type: AgentRunEventType
  payload: AgentRunEventPayload
  createdAt: number
}

/** Append and replay operations for one run's immutable event stream. */
export interface AgentRunEventRepository {
  append(input: AgentRunEventAppendInput): AgentRunEventRecord
  listByRunId(runId: string): AgentRunEventRecord[]
}

function rowToRecord(row: AgentRunEventRow): AgentRunEventRecord {
  return {
    id: row.id,
    runId: row.run_id,
    sequence: row.sequence,
    type: row.type,
    payload: decodeJson<AgentRunEventPayload>(row.payload_json) ?? {},
    createdAt: row.created_at
  }
}

/**
 * Creates the append-only event repository.
 * @param db - Open SQLite database handle.
 * @returns Event append and ordered replay operations.
 * @throws Error when an event ID or run sequence violates persistence invariants.
 * @see docs/api-contracts/agents.md
 */
export function createAgentRunEventRepository(db: BetterSqliteDatabase): AgentRunEventRepository {
  const appendEvent = db.prepare(`
    INSERT INTO agent_run_events (id, run_id, sequence, type, payload_json, created_at)
    SELECT @id, @runId, COALESCE(MAX(sequence), 0) + 1, @type, @payloadJson, @createdAt
    FROM agent_run_events
    WHERE run_id = @runId
  `)
  const selectById = db.prepare('SELECT * FROM agent_run_events WHERE id = ?')
  const selectByRun = db.prepare('SELECT * FROM agent_run_events WHERE run_id = ? ORDER BY sequence ASC')

  return {
    append(input) {
      appendEvent.run({
        id: input.id,
        runId: input.runId,
        type: input.type,
        payloadJson: encodeJson(input.payload),
        createdAt: input.createdAt
      })

      const row = selectById.get(input.id) as AgentRunEventRow | undefined
      if (!row) {
        // An acknowledged insert without a readable event would make replay incomplete.
        throw new Error(`Agent run event was not persisted: ${input.id}`)
      }

      return rowToRecord(row)
    },
    listByRunId(runId) {
      return (selectByRun.all(runId) as AgentRunEventRow[]).map(rowToRecord)
    }
  }
}
