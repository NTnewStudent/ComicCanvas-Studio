import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { migrateDatabaseAtPath, openDatabaseAtPath } from '../desktop/src/main/db/migrate'

function withTempDb<T>(run: (db: ReturnType<typeof openDatabaseAtPath>) => T): T {
  const tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-run-spine-db-'))
  const dbPath = join(tempDir, 'run-spine.sqlite')
  migrateDatabaseAtPath(dbPath)
  const db = openDatabaseAtPath(dbPath)

  try {
    return run(db)
  } finally {
    db.close()
    rmSync(tempDir, { recursive: true, force: true })
  }
}

describe('Agent Run Spine SQLite schema', () => {
  it('applies migration 0015 and creates run spine tables', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-run-spine-migration-'))
    const dbPath = join(tempDir, 'migration.sqlite')

    try {
      const result = migrateDatabaseAtPath(dbPath)

      expect(result.report.applied).toContain('0015_agent_run_spine')
      expect(result.tableNames).toEqual(expect.arrayContaining([
        'agent_run_events',
        'agent_artifacts',
        'agent_permission_grants',
        'child_agent_tasks',
      ]))
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('adds local run metadata columns to agent_runs', () => {
    withTempDb((db) => {
      const columns = db.prepare('PRAGMA table_info(agent_runs)').all() as Array<{ name: string }>
      const names = columns.map((column) => column.name)

      expect(names).toEqual(expect.arrayContaining([
        'thread_id',
        'workflow_id',
        'trigger',
        'message_id',
        'policy_profile_id',
        'gateway_id',
        'model_id',
        'paused_state_json',
        'usage_json',
        'last_checkpoint',
      ]))
    })
  })

  it('creates ordering and lookup indexes for replay', () => {
    withTempDb((db) => {
      const indexes = db.prepare("SELECT name FROM sqlite_master WHERE type = 'index' ORDER BY name").all() as Array<{ name: string }>
      const names = indexes.map((index) => index.name)

      expect(names).toEqual(expect.arrayContaining([
        'idx_agent_run_events_run_sequence',
        'idx_agent_artifacts_run',
        'idx_agent_permission_grants_lookup',
        'idx_child_agent_tasks_parent',
      ]))
    })
  })
})
