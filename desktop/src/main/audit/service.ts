/**
 * Audit service for permissioned actions and trace correlation.
 * @see docs/api-contracts/audit-observability.md
 */

import { randomUUID } from 'node:crypto'

import { redactSensitiveText } from '../security/redaction'

export interface AuditEntry {
  id: string
  traceId: string
  actorId: string
  capability: string
  targetId: string
  decision: 'allow' | 'ask' | 'deny'
  message: string
  createdAt: number
}

export interface AuditService {
  record(entry: Omit<AuditEntry, 'id' | 'createdAt' | 'message'> & { message?: string }): AuditEntry
  list(filter: { traceId?: string; actorId?: string; capability?: string; limit: number }): AuditEntry[]
}

/**
 * Creates an in-memory audit service backed by optional persistence hook.
 * @param options - Clock and id factory dependencies.
 * @returns Audit service API.
 */
export function createAuditService(options?: { clock?: () => number; idFactory?: () => string }): AuditService {
  const clock = options?.clock ?? Date.now
  const idFactory = options?.idFactory ?? (() => randomUUID())
  const entries: AuditEntry[] = []

  return {
    record(input) {
      const entry: AuditEntry = {
        id: idFactory(),
        traceId: input.traceId,
        actorId: input.actorId,
        capability: input.capability,
        targetId: input.targetId,
        decision: input.decision,
        message: redactSensitiveText(input.message ?? `${input.decision} ${input.capability}`),
        createdAt: clock()
      }
      entries.unshift(entry)
      return entry
    },
    list(filter) {
      return entries
        .filter((entry) => (filter.traceId ? entry.traceId === filter.traceId : true))
        .filter((entry) => (filter.actorId ? entry.actorId === filter.actorId : true))
        .filter((entry) => (filter.capability ? entry.capability === filter.capability : true))
        .slice(0, filter.limit)
    }
  }
}

export type HealthComponent =
  | 'database'
  | 'jobRuntime'
  | 'toolRegistry'
  | 'agentRegistry'
  | 'skillRegistry'
  | 'knowledgeIndex'

export interface HealthCheckResult {
  component: HealthComponent
  status: 'ok' | 'degraded' | 'failed'
  message: string
}

export interface HealthCheckReport {
  status: 'ok' | 'degraded' | 'failed'
  checks: HealthCheckResult[]
  checkedAt: number
}

/**
 * Runs registered health checks and aggregates component status.
 * @param checks - Component check callbacks.
 * @param clock - Timestamp provider.
 * @returns Aggregated health report.
 */
export function runHealthChecks(
  checks: Array<{ component: HealthComponent; run: () => HealthCheckResult }>,
  clock: () => number = Date.now,
): HealthCheckReport {
  const results = checks.map((check) => check.run())
  const failed = results.some((result) => result.status === 'failed')
  const degraded = results.some((result) => result.status === 'degraded')

  return {
    status: failed ? 'failed' : degraded ? 'degraded' : 'ok',
    checks: results,
    checkedAt: clock()
  }
}
