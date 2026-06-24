/**
 * Knowledge repository boundary placeholder for documents, chunks, and context packs.
 * @see docs/api-contracts/knowledge-context.md
 */

import type { Database as BetterSqliteDatabase } from 'better-sqlite3'

export interface KnowledgeRepository {
  readonly ready: true
}

/**
 * Creates the knowledge repository boundary.
 * @param db - Open SQLite database handle.
 * @returns Knowledge repository API.
 * @throws Error when future repository statements cannot be prepared.
 * @see docs/api-contracts/knowledge-context.md
 */
export function createKnowledgeRepository(_db: BetterSqliteDatabase): KnowledgeRepository {
  void _db
  return { ready: true }
}
