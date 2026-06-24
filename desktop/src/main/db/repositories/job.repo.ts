/**
 * Job repository boundary for durable queue state.
 * @see docs/api-contracts/jobs.md
 */

import type { Database as BetterSqliteDatabase } from 'better-sqlite3'

import type { JobRecord, JobStatus, JobType } from '../../../../../shared/jobs'
import { decodeJson, encodeJson } from './json'

export interface JobCreateRecord {
  id: string
  type: JobType
  status: JobStatus
  targetId?: string
  payload: Record<string, unknown>
  progress: number
  attempts: number
  retryable: boolean
  createdAt: number
  updatedAt: number
}

interface JobRow {
  id: string
  type: JobType
  status: JobStatus
  target_id: string | null
  payload_json: string
  result_json: string | null
  error_class: string | null
  error_message: string | null
  retryable: number
  lease_owner: string | null
  attempts: number
  progress: number
  created_at: number
  updated_at: number
}

export interface JobRepository {
  create(record: JobCreateRecord): void
  getById(id: string): (JobRecord & { payload: Record<string, unknown> }) | null
}

/**
 * Creates a repository for persisted job rows.
 * @param db - Open SQLite database handle.
 * @returns Job repository API.
 * @throws Error when repository SQL statements cannot be prepared.
 * @see docs/api-contracts/jobs.md
 */
export function createJobRepository(db: BetterSqliteDatabase): JobRepository {
  const insert = db.prepare(`
    INSERT INTO jobs (
      id, type, status, target_id, payload_json, retryable, attempts, progress, created_at, updated_at
    ) VALUES (
      @id, @type, @status, @targetId, @payloadJson, @retryable, @attempts, @progress, @createdAt, @updatedAt
    )
  `)
  const select = db.prepare('SELECT * FROM jobs WHERE id = ?')

  return {
    create(record) {
      insert.run({
        ...record,
        targetId: record.targetId ?? null,
        payloadJson: encodeJson(record.payload),
        retryable: record.retryable ? 1 : 0
      })
    },
    getById(id) {
      const row = select.get(id) as JobRow | undefined

      if (!row) {
        return null
      }

      const job: JobRecord & { payload: Record<string, unknown> } = {
        id: row.id,
        type: row.type,
        status: row.status,
        progress: row.progress,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        payload: decodeJson<Record<string, unknown>>(row.payload_json) ?? {}
      }

      if (row.target_id) {
        job.targetId = row.target_id
      }

      const result = decodeJson<JobRecord['result']>(row.result_json)
      if (result) {
        job.result = result
      }

      if (row.error_class) {
        job.error = { errorClass: row.error_class, message: row.error_message ?? row.error_class, retryable: Boolean(row.retryable) }
      }

      return job
    }
  }
}
