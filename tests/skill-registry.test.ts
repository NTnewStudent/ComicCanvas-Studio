import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { openDatabaseAtPath, applyMigrations } from '../desktop/src/main/db/migrate'
import { createSkillRepository } from '../desktop/src/main/db/repositories/skill.repo'
import { createSkillRegistry } from '../desktop/src/main/skills/registry'
import { createSkillService } from '../desktop/src/main/skills/skill.service'
import type { AgentDefinition } from '../shared/agents'

function writeSkill(root: string, folder: string, name: string, description: string, body: string): void {
  const folderPath = join(root, folder)
  mkdirSync(folderPath, { recursive: true })
  writeFileSync(join(folderPath, 'SKILL.md'), `---\nname: ${name}\ndescription: ${description}\n---\n\n${body}`, 'utf8')
}

describe('SkillRegistry and invoke service', () => {
  let tempRoot = ''
  let dbPath = ''
  let db: ReturnType<typeof openDatabaseAtPath> | null = null

  afterEach(() => {
    db?.close()
    db = null
    if (tempRoot) {
      try {
        rmSync(tempRoot, { recursive: true, force: true })
      } catch {
        // Windows may keep SQLite handles briefly; ignore cleanup races in tests.
      }
      tempRoot = ''
    }
    dbPath = ''
  })

  it('discovers builtin and user skill roots with different default enabled states', () => {
    tempRoot = mkdtempSync(join(tmpdir(), 'cc-skill-roots-'))
    const builtinRoot = join(tempRoot, 'builtin')
    const userRoot = join(tempRoot, 'user')
    writeSkill(builtinRoot, 'alpha', 'Alpha', 'Built-in skill.', 'Alpha body.')
    writeSkill(userRoot, 'beta', 'Beta', 'User skill.', 'Beta body.')

    const registry = createSkillRegistry({
      roots: [
        { root: builtinRoot, source: 'builtin', defaultEnabled: true },
        { root: userRoot, source: 'user', defaultEnabled: false }
      ]
    })

    const skills = registry.list(true)
    expect(skills.find((skill) => skill.id === 'alpha')?.enabled).toBe(true)
    expect(skills.find((skill) => skill.id === 'user:beta')?.source).toBe('user')
    expect(skills.find((skill) => skill.id === 'user:beta')?.enabled).toBe(false)
  })

  it('keeps previous snapshot when reload encounters invalid metadata', () => {
    tempRoot = mkdtempSync(join(tmpdir(), 'cc-skill-reload-'))
    writeSkill(tempRoot, 'stable', 'Stable', 'Stable skill.', 'Stable body.')
    const registry = createSkillRegistry({ root: tempRoot })
    expect(registry.list()).toHaveLength(1)
    writeFileSync(join(tempRoot, 'stable', 'SKILL.md'), 'broken', 'utf8')
    registry.reload()
    expect(registry.get('stable')?.name).toBe('Stable')
    expect(registry.loadInstructions('stable')).toContain('Stable body.')
  })

  it('invokes allowed skills and rejects permission overreach', () => {
    tempRoot = mkdtempSync(join(tmpdir(), 'cc-skill-invoke-'))
    dbPath = join(tempRoot, 'skills.db')
    writeSkill(tempRoot, 'planner', 'Planner', 'Planning skill.', 'Plan carefully.')

    db = openDatabaseAtPath(dbPath)
    applyMigrations(db)
    const repo = createSkillRepository(db)
    const registry = createSkillRegistry({ root: tempRoot, repo })
    const service = createSkillService({ registry, repo, clock: () => 1_700_000_000_000 })

    const allowedAgent: Pick<AgentDefinition, 'allowedSkills' | 'permissionPolicy'> = {
      allowedSkills: ['planner'],
      permissionPolicy: {
        allowedPermissionKinds: ['canvas.read', 'canvas.write'],
        requireAskForDestructive: true
      }
    }

    const deniedAgent: Pick<AgentDefinition, 'allowedSkills' | 'permissionPolicy'> = {
      allowedSkills: ['other'],
      permissionPolicy: allowedAgent.permissionPolicy
    }

    const ok = service.invoke({ skillId: 'planner', agentRunId: 'run-1', input: {} }, allowedAgent)
    expect('errorClass' in ok).toBe(false)
    if (!('errorClass' in ok)) {
      expect(ok.status).toBe('completed')
      expect(repo.listInvocations('run-1')).toHaveLength(1)
    }

    const denied = service.invoke({ skillId: 'planner', agentRunId: 'run-2', input: {} }, deniedAgent)
    expect(denied).toMatchObject({ errorClass: 'skill_permission_denied' })
  })
})
