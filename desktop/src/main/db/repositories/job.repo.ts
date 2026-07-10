/**
 * Job repository boundary for durable queue state.
 * @see docs/api-contracts/jobs.md
 */

import type { Database as BetterSqliteDatabase } from 'better-sqlite3'

import type { JobError, JobListFilter, JobRecord, JobResult, JobStatus, JobType } from '../../../../../shared/jobs'
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

export interface JobClaimInput {
  leaseOwner: string
  claimedAt: number
}

export type PersistedJobRecord = JobRecord & { payload: Record<string, unknown> }

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
  getById(id: string): PersistedJobRecord | null
  list(filter?: JobListFilter): PersistedJobRecord[]
  listUnfinished(): PersistedJobRecord[]
  claimNextPending(input: JobClaimInput): PersistedJobRecord | null
  complete(id: string, result: JobResult, completedAt: number): void
  fail(id: string, error: JobError, failedAt: number): void
  requeue(id: string, requeuedAt: number): void
  recoverComplete(id: string, result: JobResult, completedAt: number): void
  recoverFail(id: string, error: JobError, failedAt: number): void
  requeueProcessing(requeuedAt: number): string[]
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
  const listAll = db.prepare('SELECT * FROM jobs ORDER BY created_at DESC LIMIT ?')
  const listByStatus = db.prepare('SELECT * FROM jobs WHERE status = ? ORDER BY created_at DESC LIMIT ?')
  const listByType = db.prepare('SELECT * FROM jobs WHERE type = ? ORDER BY created_at DESC LIMIT ?')
  const listByTargetId = db.prepare('SELECT * FROM jobs WHERE target_id = ? ORDER BY created_at DESC LIMIT ?')
  const listByStatusAndType = db.prepare('SELECT * FROM jobs WHERE status = ? AND type = ? ORDER BY created_at DESC LIMIT ?')
  const listByStatusAndTargetId = db.prepare('SELECT * FROM jobs WHERE status = ? AND target_id = ? ORDER BY created_at DESC LIMIT ?')
  const listByTypeAndTargetId = db.prepare('SELECT * FROM jobs WHERE type = ? AND target_id = ? ORDER BY created_at DESC LIMIT ?')
  const listByAllFilters = db.prepare('SELECT * FROM jobs WHERE status = ? AND type = ? AND target_id = ? ORDER BY created_at DESC LIMIT ?')
  const listUnfinished = db.prepare("SELECT * FROM jobs WHERE status IN ('pending', 'processing') ORDER BY created_at ASC")
  const selectNextPending = db.prepare("SELECT * FROM jobs WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1")
  const claimPending = db.prepare(`
    UPDATE jobs
    SET status = 'processing',
      lease_owner = @leaseOwner,
      attempts = attempts + 1,
      updated_at = @claimedAt
    WHERE id = @id AND status = 'pending'
  `)
  const complete = db.prepare(`
    UPDATE jobs
    SET status = 'completed',
      result_json = @resultJson,
      progress = 100,
      lease_owner = NULL,
      updated_at = @completedAt
    WHERE id = @id AND status = 'processing'
  `)
  const fail = db.prepare(`
    UPDATE jobs
    SET status = 'failed',
      error_class = @errorClass,
      error_message = @errorMessage,
      retryable = @retryable,
      lease_owner = NULL,
      updated_at = @failedAt
    WHERE id = @id AND status = 'processing'
  `)
  const requeue = db.prepare(`
    UPDATE jobs
    SET status = 'pending',
      progress = 0,
      lease_owner = NULL,
      updated_at = @requeuedAt
    WHERE id = @id AND status = 'processing'
  `)
  const recoverFail = db.prepare(`
    UPDATE jobs
    SET status = 'failed',
      error_class = @errorClass,
      error_message = @errorMessage,
      retryable = @retryable,
      lease_owner = NULL,
      updated_at = @failedAt
    WHERE id = @id AND status IN ('pending', 'processing')
  `)
  const recoverComplete = db.prepare(`
    UPDATE jobs
    SET status = 'completed',
      result_json = @resultJson,
      progress = 100,
      error_class = NULL,
      error_message = NULL,
      retryable = 0,
      lease_owner = NULL,
      updated_at = @completedAt
    WHERE id = @id AND status IN ('pending', 'processing')
  `)
  const selectProcessing = db.prepare("SELECT id FROM jobs WHERE status = 'processing' ORDER BY created_at ASC")
  const requeueProcessing = db.prepare(`
    UPDATE jobs
    SET status = 'pending',
      progress = 0,
      lease_owner = NULL,
      updated_at = @requeuedAt
    WHERE status = 'processing'
  `)

  function mapRow(row: JobRow): PersistedJobRecord {
    const job: PersistedJobRecord = {
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

  function assertTransition(changes: number, message: string): void {
    if (changes !== 1) {
      throw new Error(message)
    }
  }

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

      return mapRow(row)
    },
    list(filter = {}) {
      const requestedLimit = Math.trunc(filter.limit ?? 100)
      if (requestedLimit <= 0) {
        return []
      }

      const limit = Math.min(500, requestedLimit)
      let rows: JobRow[]

      if (filter.status && filter.type && filter.targetId) {
        rows = listByAllFilters.all(filter.status, filter.type, filter.targetId, limit) as JobRow[]
      } else if (filter.status && filter.type) {
        rows = listByStatusAndType.all(filter.status, filter.type, limit) as JobRow[]
      } else if (filter.status && filter.targetId) {
        rows = listByStatusAndTargetId.all(filter.status, filter.targetId, limit) as JobRow[]
      } else if (filter.type && filter.targetId) {
        rows = listByTypeAndTargetId.all(filter.type, filter.targetId, limit) as JobRow[]
      } else if (filter.status) {
        rows = listByStatus.all(filter.status, limit) as JobRow[]
      } else if (filter.type) {
        rows = listByType.all(filter.type, limit) as JobRow[]
      } else if (filter.targetId) {
        rows = listByTargetId.all(filter.targetId, limit) as JobRow[]
      } else {
        rows = listAll.all(limit) as JobRow[]
      }

      return rows.map(mapRow)
    },
    listUnfinished() {
      return (listUnfinished.all() as JobRow[]).map(mapRow)
    },
    claimNextPending(input) {
      const row = selectNextPending.get() as JobRow | undefined

      if (!row) {
        return null
      }

      const result = claimPending.run({ id: row.id, leaseOwner: input.leaseOwner, claimedAt: input.claimedAt })

      if (result.changes !== 1) {
        return null
      }

      return this.getById(row.id)
    },
    complete(id, result, completedAt) {
      const updateResult = complete.run({ id, resultJson: encodeJson(result), completedAt })
      assertTransition(updateResult.changes, 'job_transition_invalid')
    },
    fail(id, error, failedAt) {
      const updateResult = fail.run({
        id,
        errorClass: error.errorClass,
        errorMessage: error.message,
        retryable: error.retryable ? 1 : 0,
        failedAt
      })
      assertTransition(updateResult.changes, 'job_transition_invalid')
    },
    requeue(id, requeuedAt) {
      const updateResult = requeue.run({ id, requeuedAt })
      assertTransition(updateResult.changes, 'job_transition_invalid')
    },
    recoverComplete(id, result, completedAt) {
      const updateResult = recoverComplete.run({
        id,
        resultJson: encodeJson(result),
        completedAt
      })
      assertTransition(updateResult.changes, 'job_transition_invalid')
    },
    recoverFail(id, error, failedAt) {
      const updateResult = recoverFail.run({
        id,
        errorClass: error.errorClass,
        errorMessage: error.message,
        retryable: error.retryable ? 1 : 0,
        failedAt
      })
      assertTransition(updateResult.changes, 'job_transition_invalid')
    },
    requeueProcessing(requeuedAt) {
      const rows = selectProcessing.all() as Array<{ id: string }>
      requeueProcessing.run({ requeuedAt })

      return rows.map((row) => row.id)
    }
  }
}
