/**
 * Skill repository boundary placeholder for skill metadata and invocation traces.
 * @see docs/api-contracts/skills.md
 */

import type { Database as BetterSqliteDatabase } from 'better-sqlite3'

export interface SkillRepository {
  readonly ready: true
}

/**
 * Creates the skill repository boundary.
 * @param db - Open SQLite database handle.
 * @returns Skill repository API.
 * @throws Error when future repository statements cannot be prepared.
 * @see docs/api-contracts/skills.md
 */
export function createSkillRepository(_db: BetterSqliteDatabase): SkillRepository {
  void _db
  return { ready: true }
}
