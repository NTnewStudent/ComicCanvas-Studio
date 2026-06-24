/**
 * Agent repository boundary placeholder for built-in and user agent records.
 * @see docs/api-contracts/agents.md
 */

import type { Database as BetterSqliteDatabase } from 'better-sqlite3'

export interface AgentRepository {
  readonly ready: true
}

/**
 * Creates the agent repository boundary.
 * @param db - Open SQLite database handle.
 * @returns Agent repository API.
 * @throws Error when future repository statements cannot be prepared.
 * @see docs/api-contracts/agents.md
 */
export function createAgentRepository(_db: BetterSqliteDatabase): AgentRepository {
  void _db
  return { ready: true }
}
