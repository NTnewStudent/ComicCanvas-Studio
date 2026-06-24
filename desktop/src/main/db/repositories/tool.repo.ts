/**
 * Tool repository boundary placeholder for registry snapshots and audit rows.
 * @see docs/api-contracts/tools-plugins.md
 */

import type { Database as BetterSqliteDatabase } from 'better-sqlite3'

export interface ToolRepository {
  readonly ready: true
}

/**
 * Creates the tool repository boundary.
 * @param db - Open SQLite database handle.
 * @returns Tool repository API.
 * @throws Error when future repository statements cannot be prepared.
 * @see docs/api-contracts/tools-plugins.md
 */
export function createToolRepository(_db: BetterSqliteDatabase): ToolRepository {
  void _db
  return { ready: true }
}
