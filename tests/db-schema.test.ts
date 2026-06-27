import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { migrateDatabaseAtPath } from '../desktop/src/main/db/migrate'
import { schemaTables } from '../desktop/src/main/db/schema'

describe('M1 DB schema and migration baseline', () => {
  it('declares the required foundation tables', () => {
    expect(schemaTables).toEqual([
      'jobs',
      'assets',
      'asset_folders',
      'asset_references',
      'workflows',
      'workflow_versions',
      'chat_messages',
      'gateway_configs',
      'tools',
      'tool_audit',
      'agents',
      'agent_runs',
      'skills',
      'skill_invocations',
      'style_presets',
      'canvas_snippets',
      'knowledge_documents',
      'knowledge_chunks',
      'context_packs'
    ])
  })

  it('runs the initial migration against a temporary SQLite database', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-db-'))
    const dbPath = join(tempDir, 'test.sqlite')

    try {
      const result = migrateDatabaseAtPath(dbPath)

      expect(result.report.applied).toContain('0001_initial_core_platform')
      for (const table of schemaTables) {
        expect(result.tableNames).toContain(table)
      }

      expect(result.tableNames).toContain('__comiccanvas_migrations')
    } finally {
      rmSync(tempDir, { recursive: true, force: true })
    }
  })
})
