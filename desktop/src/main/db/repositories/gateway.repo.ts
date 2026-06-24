/**
 * Gateway repository boundary placeholder for provider configuration.
 * @see docs/api-contracts/gateway-providers.md
 */

import type { Database as BetterSqliteDatabase } from 'better-sqlite3'

export interface GatewayRepository {
  readonly ready: true
}

/**
 * Creates the gateway repository boundary.
 * @param db - Open SQLite database handle.
 * @returns Gateway repository API.
 * @throws Error when future repository statements cannot be prepared.
 * @see docs/api-contracts/gateway-providers.md
 */
export function createGatewayRepository(_db: BetterSqliteDatabase): GatewayRepository {
  void _db
  return { ready: true }
}
