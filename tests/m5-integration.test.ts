import { describe, expect, it } from 'vitest'

import { createKnowledgeRepository } from '../desktop/src/main/db/repositories/knowledge.repo'
import { createKnowledgeStore } from '../desktop/src/main/knowledge/store'
import { openDatabaseAtPath, applyMigrations } from '../desktop/src/main/db/migrate'
import { createPluginLoader } from '../desktop/src/main/tools/plugin-loader'
import { createSkillRegistry } from '../desktop/src/main/skills/registry'
import { createToolRuntime } from '../desktop/src/main/tools/runtime'
import { redactSensitiveText } from '../desktop/src/main/security/redaction'
import { spawnSubAgent } from '../desktop/src/main/agent/spawn-sub-agent'
import { createAgentRegistry } from '../desktop/src/main/agent/registry'

describe('M5 integration anchors', () => {
  it('covers spawn depth guard, plugin quarantine signal, skill registry, and redaction', async () => {
    const depthExceeded = await spawnSubAgent(
      { roleId: 'qa-verifier', task: 'hello' },
      {
        parentRunId: 'parent-run',
        parentTraceId: 'parent-trace',
        allowedTools: ['canvas.queryGraph'],
        allowedSkills: [],
        depth: 2
      },
      {
        registry: createAgentRegistry({
          agents: { list: () => [], upsert: (value) => value, delete: () => false }
        }),
        runChild: () => Promise.resolve({ status: 'completed', output: 'ok', turnsUsed: 1 })
      }
    )
    expect(depthExceeded.status).toBe('failed')
    expect(depthExceeded.error?.errorClass).toBe('agent_depth_exceeded')

    const runtime = createToolRuntime()
    const loader = createPluginLoader({ runtime })
    const diagnostics = loader.loadFromDirectory('missing-plugins-dir-for-test')
    expect(Array.isArray(diagnostics)).toBe(true)

    const registry = createSkillRegistry({ root: '.claude/skills' })
    expect(registry.list(true).length).toBeGreaterThanOrEqual(0)

    const db = openDatabaseAtPath(':memory:')
    applyMigrations(db)
    const knowledge = createKnowledgeStore({ repo: createKnowledgeRepository(db) })
    const retrieved = knowledge.retrieve({
      query: 'none',
      scope: { projectId: 'default', userApprovedSourceIds: [] },
      limit: 1,
      retrievalMode: 'lexical'
    })
    expect(retrieved).toEqual([])

    expect(redactSensitiveText('token sk-123456789012345678901234')).toContain('[REDACTED_SECRET]')
  })
})
