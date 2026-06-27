/**
 * Agent repository boundary placeholder for built-in and user agent records.
 * @see docs/api-contracts/agents.md
 */

import type { Database as BetterSqliteDatabase } from 'better-sqlite3'

import type { AgentDefinition, AgentSource } from '../../../../../shared/agents'
import { decodeJson, encodeJson } from './json'

type PersistedAgent = AgentDefinition & { source: AgentSource }

interface AgentRow {
  id: string
  source: string
  name: string
  description: string
  instructions: string
  policy_json: string
  enabled: number
  created_at: number
  updated_at: number
}

export interface AgentRepository {
  list(options?: { includeDisabled?: boolean }): AgentDefinition[]
  upsert(agent: PersistedAgent, timestamp: number): AgentDefinition
  delete(agentId: string): boolean
}

function policyFromAgent(agent: AgentDefinition): Record<string, unknown> {
  return {
    allowedTools: agent.allowedTools,
    allowedSkills: agent.allowedSkills,
    gatewayPolicy: agent.gatewayPolicy,
    contextPolicy: agent.contextPolicy,
    permissionPolicy: agent.permissionPolicy,
    triggerPolicy: agent.triggerPolicy,
    maxTurns: agent.maxTurns,
    effort: agent.effort
  }
}

function agentFromRow(row: AgentRow): AgentDefinition {
  const policy = decodeJson<Partial<AgentDefinition>>(row.policy_json) ?? {}

  return {
    id: row.id,
    source: row.source === 'builtin' ? 'builtin' : 'user',
    name: row.name,
    description: row.description,
    instructions: row.instructions,
    allowedTools: policy.allowedTools ?? [],
    allowedSkills: policy.allowedSkills ?? [],
    gatewayPolicy: policy.gatewayPolicy ?? { allowedChannels: ['text'] },
    contextPolicy: policy.contextPolicy ?? {
      includeCanvasGraph: true,
      includeSelectedAssets: false,
      includeRecentMessages: true,
      includeKnowledge: false,
      maxContextTokens: 4000
    },
    permissionPolicy: policy.permissionPolicy ?? { allowedPermissionKinds: ['canvas.read'], requireAskForDestructive: true },
    triggerPolicy: policy.triggerPolicy ?? {
      allowedTriggers: ['manual', 'mention'],
      defaultTrigger: 'manual',
      autoRun: false
    },
    maxTurns: policy.maxTurns ?? 4,
    effort: policy.effort ?? 'medium',
    enabled: Boolean(row.enabled)
  }
}

/**
 * Creates the agent repository boundary.
 * @param db - Open SQLite database handle.
 * @returns Agent repository API.
 * @throws Error when repository SQL statements cannot be prepared.
 * @see docs/api-contracts/agents.md
 */
export function createAgentRepository(db: BetterSqliteDatabase): AgentRepository {
  const selectAll = db.prepare("SELECT * FROM agents WHERE source IN ('builtin', 'user') ORDER BY created_at ASC, id ASC")
  const upsertAgent = db.prepare(`
    INSERT INTO agents (id, source, name, description, instructions, policy_json, enabled, created_at, updated_at)
    VALUES (@id, @source, @name, @description, @instructions, @policyJson, @enabled, @createdAt, @updatedAt)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      instructions = excluded.instructions,
      policy_json = excluded.policy_json,
      enabled = excluded.enabled,
      updated_at = excluded.updated_at
  `)
  const deleteAgent = db.prepare('DELETE FROM agents WHERE id = ? AND source = ?')

  return {
    list(options = {}) {
      return (selectAll.all() as AgentRow[]).map(agentFromRow).filter((agent) => options.includeDisabled || agent.enabled)
    },
    upsert(agent, timestamp) {
      upsertAgent.run({
        id: agent.id,
        source: agent.source,
        name: agent.name,
        description: agent.description,
        instructions: agent.instructions,
        policyJson: encodeJson(policyFromAgent(agent)),
        enabled: agent.enabled ? 1 : 0,
        createdAt: timestamp,
        updatedAt: timestamp
      })

      return agent
    },
    delete(agentId) {
      const result = deleteAgent.run(agentId, 'user')
      return result.changes > 0
    }
  }
}
