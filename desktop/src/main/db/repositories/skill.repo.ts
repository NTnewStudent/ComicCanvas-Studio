/**
 * Skill repository for enabled-state overrides and invocation traces.
 * @see docs/api-contracts/skills.md
 */

import type { Database as BetterSqliteDatabase } from 'better-sqlite3'

import type { SkillDefinition, SkillInvocationRecord, SkillReference } from '../../../../../shared/skills'
import { decodeJson, encodeJson } from './json'

interface SkillRow {
  id: string
  source: string
  version: string
  name: string
  entry: string
  metadata_json: string
  enabled: number
  created_at: number
  updated_at: number
}

interface SkillInvocationRow {
  id: string
  skill_id: string
  version: string
  agent_run_id: string
  loaded_refs_json: string
  status: string
  created_at: number
}

export interface SkillRepository {
  getEnabledOverride(skillId: string): boolean | null
  setEnabled(skill: SkillDefinition, enabled: boolean, clock: number): void
  recordInvocation(record: SkillInvocationRecord, clock: number): void
  listInvocations(agentRunId: string): SkillInvocationRecord[]
}

function rowToInvocation(row: SkillInvocationRow): SkillInvocationRecord {
  return {
    id: row.id,
    skillId: row.skill_id,
    version: row.version,
    agentRunId: row.agent_run_id,
    loadedReferences: decodeJson<SkillReference[]>(row.loaded_refs_json) ?? [],
    requiredPermissionKinds: [],
    status: row.status === 'failed' ? 'failed' : 'completed'
  }
}

/**
 * Creates the skill repository boundary.
 * @param db - Open SQLite database handle.
 * @returns Skill repository API.
 * @throws Error when repository SQL statements cannot be prepared.
 * @see docs/api-contracts/skills.md
 */
export function createSkillRepository(db: BetterSqliteDatabase): SkillRepository {
  const selectEnabled = db.prepare('SELECT enabled FROM skills WHERE id = ?')
  const upsertSkill = db.prepare(`
    INSERT INTO skills (id, source, version, name, entry, metadata_json, enabled, created_at, updated_at)
    VALUES (@id, @source, @version, @name, @entry, @metadataJson, @enabled, @createdAt, @updatedAt)
    ON CONFLICT(id) DO UPDATE SET
      enabled = excluded.enabled,
      updated_at = excluded.updated_at
  `)
  const insertInvocation = db.prepare(`
    INSERT INTO skill_invocations (id, skill_id, version, agent_run_id, loaded_refs_json, status, created_at)
    VALUES (@id, @skillId, @version, @agentRunId, @loadedRefsJson, @status, @createdAt)
  `)
  const selectInvocations = db.prepare(`
    SELECT * FROM skill_invocations WHERE agent_run_id = ? ORDER BY created_at ASC
  `)

  return {
    getEnabledOverride(skillId) {
      const row = selectEnabled.get(skillId) as SkillRow | undefined
      return row ? row.enabled === 1 : null
    },
    setEnabled(skill, enabled, clock) {
      upsertSkill.run({
        id: skill.id,
        source: skill.source,
        version: skill.version,
        name: skill.name,
        entry: skill.entry,
        metadataJson: encodeJson({
          description: skill.description,
          references: skill.references,
          requiredTools: skill.requiredTools,
          requiredPermissions: skill.requiredPermissions
        }),
        enabled: enabled ? 1 : 0,
        createdAt: clock,
        updatedAt: clock
      })
    },
    recordInvocation(record, clock) {
      insertInvocation.run({
        id: record.id,
        skillId: record.skillId,
        version: record.version,
        agentRunId: record.agentRunId,
        loadedRefsJson: encodeJson(record.loadedReferences),
        status: record.status,
        createdAt: clock
      })
    },
    listInvocations(agentRunId) {
      return (selectInvocations.all(agentRunId) as SkillInvocationRow[]).map(rowToInvocation)
    }
  }
}
