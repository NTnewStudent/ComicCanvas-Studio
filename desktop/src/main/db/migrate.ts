/**
 * SQLite migration runner for the app-controlled M1 migration baseline.
 * @see docs/architecture/core-platform-implementation-readiness.md
 */

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import Database from 'better-sqlite3'
import type { Database as BetterSqliteDatabase } from 'better-sqlite3'

export interface MigrationReport {
  applied: string[]
  skipped: string[]
}

const migrations = [
  {
    id: '0001_initial_core_platform',
    fileName: '0001_initial_core_platform.sql'
  },
  {
    id: '0002_add_asset_cloud_fields',
    fileName: '0002_add_asset_cloud_fields.sql'
  },
  {
    id: '0003_style_presets',
    fileName: '0003_style_presets.sql'
  },
  {
    id: '0004_canvas_snippets',
    fileName: '0004_canvas_snippets.sql'
  }
] as const

const migrationTableSql = `
CREATE TABLE IF NOT EXISTS __comiccanvas_migrations (
  id TEXT PRIMARY KEY,
  applied_at INTEGER NOT NULL
);
`

/**
 * Applies pending SQLite migrations in deterministic order.
 * @param db - Open better-sqlite3 database handle.
 * @returns IDs of applied and skipped migrations.
 * @throws Error when a migration cannot be read or executed.
 * @see docs/architecture/core-platform-implementation-readiness.md
 */
export function applyMigrations(db: BetterSqliteDatabase): MigrationReport {
  db.exec(migrationTableSql)

  const applied: string[] = []
  const skipped: string[] = []
  const select = db.prepare('SELECT id FROM __comiccanvas_migrations WHERE id = ?')
  const insert = db.prepare('INSERT INTO __comiccanvas_migrations (id, applied_at) VALUES (?, ?)')
  const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), 'migrations')

  for (const migration of migrations) {
    const row = select.get(migration.id)

    if (row) {
      skipped.push(migration.id)
      continue
    }

    const sql = readFileSync(join(migrationsDir, migration.fileName), 'utf8')

    db.transaction(() => {
      db.exec(sql)
      insert.run(migration.id, Date.now())
    })()

    applied.push(migration.id)
  }

  return { applied, skipped }
}

export interface TemporaryMigrationResult {
  report: MigrationReport
  tableNames: string[]
}

/**
 * Opens a SQLite database at the provided path, applies migrations, and returns table names.
 * @param dbPath - Filesystem path for the SQLite database.
 * @returns Migration report and discovered SQLite table names.
 * @throws Error when the database cannot be opened or migrated.
 * @see docs/architecture/core-platform-implementation-readiness.md
 */
export function migrateDatabaseAtPath(dbPath: string): TemporaryMigrationResult {
  const db = new Database(dbPath)

  try {
    const report = applyMigrations(db)
    const tableRows = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all() as Array<{ name: string }>

    return {
      report,
      tableNames: tableRows.map((row) => row.name)
    }
  } finally {
    db.close()
  }
}

/**
 * Opens a SQLite database handle for repository use.
 * @param dbPath - Filesystem path for the SQLite database.
 * @returns Open better-sqlite3 database handle.
 * @throws Error when SQLite cannot open the database.
 * @see docs/architecture/core-platform-implementation-readiness.md
 */
export function openDatabaseAtPath(dbPath: string): BetterSqliteDatabase {
  return new Database(dbPath)
}
