/**
 * Durable local Agent permission grant repository.
 * @see docs/api-contracts/agents.md
 */

import type { Database as BetterSqliteDatabase } from 'better-sqlite3'

import type { LocalPermissionGrant } from '../../../../../shared/agent-run-events'
import type { ToolPermissionKind } from '../../../../../shared/tools'
import { decodeJson, encodeJson } from './json'

interface AgentPermissionGrantRow {
  id: string
  run_id: string | null
  workflow_id: string
  tool_id: string
  permission_json: string
  scope: LocalPermissionGrant['scope']
  expires_at: number | null
  approved_by_label: string
  created_at: number
  revoked_at: number | null
}

/** Required attributes for resolving a reusable local permission grant. */
export interface PermissionGrantLookup {
  runId: string
  workflowId: string
  toolId: string
  permissionKinds: ToolPermissionKind[]
  now: number
  sessionStartedAt?: number
}

/** Persistence and active-grant lookup operations. */
export interface AgentPermissionGrantRepository {
  save(record: LocalPermissionGrant): LocalPermissionGrant
  findActive(input: PermissionGrantLookup): LocalPermissionGrant | null
  listByRunId(runId: string): LocalPermissionGrant[]
}

function rowToRecord(row: AgentPermissionGrantRow): LocalPermissionGrant {
  const record: LocalPermissionGrant = {
    id: row.id,
    workflowId: row.workflow_id,
    toolId: row.tool_id,
    permissionKinds: decodeJson<ToolPermissionKind[]>(row.permission_json) ?? [],
    scope: row.scope,
    approvedByLabel: row.approved_by_label,
    createdAt: row.created_at
  }

  if (row.run_id !== null) record.runId = row.run_id
  if (row.expires_at !== null) record.expiresAt = row.expires_at
  if (row.revoked_at !== null) record.revokedAt = row.revoked_at

  return record
}

function isGrantInScope(grant: LocalPermissionGrant, input: PermissionGrantLookup): boolean {
  return grant.scope === 'session'
    || ((grant.scope === 'run' || grant.scope === 'once') && grant.runId === input.runId)
}

function includesPermissions(grant: LocalPermissionGrant, input: PermissionGrantLookup): boolean {
  return input.permissionKinds.every((kind) => grant.permissionKinds.includes(kind))
}

function belongsToCurrentSession(grant: LocalPermissionGrant, input: PermissionGrantLookup): boolean {
  return grant.scope !== 'session'
    || input.sessionStartedAt === undefined
    || grant.createdAt >= input.sessionStartedAt
}

/**
 * Creates the permission grant repository.
 * @param db - Open SQLite database handle.
 * @returns Grant persistence and lookup operations.
 * @throws Error when a grant cannot be encoded or persisted.
 * @see docs/api-contracts/agents.md
 */
export function createAgentPermissionGrantRepository(db: BetterSqliteDatabase): AgentPermissionGrantRepository {
  const upsert = db.prepare(`
    INSERT INTO agent_permission_grants (
      id, run_id, workflow_id, tool_id, permission_json, scope,
      expires_at, approved_by_label, created_at, revoked_at
    ) VALUES (
      @id, @runId, @workflowId, @toolId, @permissionJson, @scope,
      @expiresAt, @approvedByLabel, @createdAt, @revokedAt
    )
    ON CONFLICT(id) DO UPDATE SET
      run_id = excluded.run_id,
      workflow_id = excluded.workflow_id,
      tool_id = excluded.tool_id,
      permission_json = excluded.permission_json,
      scope = excluded.scope,
      expires_at = excluded.expires_at,
      approved_by_label = excluded.approved_by_label,
      revoked_at = excluded.revoked_at
  `)
  const selectCandidates = db.prepare(`
    SELECT * FROM agent_permission_grants
    WHERE workflow_id = @workflowId
      AND tool_id = @toolId
      AND revoked_at IS NULL
      AND (expires_at IS NULL OR expires_at > @now)
    ORDER BY created_at DESC, id DESC
  `)
  const selectByRun = db.prepare(`
    SELECT * FROM agent_permission_grants WHERE run_id = ? ORDER BY created_at ASC, id ASC
  `)

  return {
    save(record) {
      upsert.run({
        id: record.id,
        runId: record.runId ?? null,
        workflowId: record.workflowId,
        toolId: record.toolId,
        permissionJson: encodeJson(record.permissionKinds),
        scope: record.scope,
        expiresAt: record.expiresAt ?? null,
        approvedByLabel: record.approvedByLabel,
        createdAt: record.createdAt,
        revokedAt: record.revokedAt ?? null
      })

      return record
    },
    findActive(input) {
      const candidates = (selectCandidates.all({
        workflowId: input.workflowId,
        toolId: input.toolId,
        now: input.now
      }) as AgentPermissionGrantRow[]).map(rowToRecord)

      return candidates.find((grant) => {
        return isGrantInScope(grant, input)
          && includesPermissions(grant, input)
          && belongsToCurrentSession(grant, input)
      }) ?? null
    },
    listByRunId(runId) {
      return (selectByRun.all(runId) as AgentPermissionGrantRow[]).map(rowToRecord)
    }
  }
}
