import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import type { AgentDefinition } from '../shared/agents'
import { migrateDatabaseAtPath, openDatabaseAtPath } from '../desktop/src/main/db/migrate'
import { createAgentRepository } from '../desktop/src/main/db/repositories/agent.repo'
import { createAgentRegistry } from '../desktop/src/main/agent/registry'
import { registerAgentHandlers } from '../desktop/src/main/ipc/agent.handler'

type Handler = (_event: unknown, request: unknown) => unknown

function createFakeIpcMain(): { handlers: Map<string, Handler>; ipcMain: { handle(channel: string, handler: Handler): void } } {
  const handlers = new Map<string, Handler>()

  return {
    handlers,
    ipcMain: {
      handle(channel, handler) {
        handlers.set(channel, handler)
      }
    }
  }
}

function customAgent(overrides: Partial<AgentDefinition> = {}): AgentDefinition {
  return {
    id: 'agent-storyboard',
    source: 'user',
    name: 'Storyboard agent',
    description: 'Breaks a comic-drama prompt into panels.',
    instructions: 'Create concise storyboards for text to image to video workflows.',
    allowedTools: ['canvas.queryGraph', 'canvas.proposePlan'],
    allowedSkills: ['storyboard'],
    gatewayPolicy: { allowedChannels: ['text'], modelId: 'stub-text' },
    contextPolicy: {
      includeCanvasGraph: true,
      includeSelectedAssets: false,
      includeRecentMessages: true,
      includeKnowledge: false,
      maxContextTokens: 4000
    },
    permissionPolicy: { allowedPermissionKinds: ['canvas.read'], requireAskForDestructive: true },
    maxTurns: 6,
    effort: 'medium',
    enabled: true,
    ...overrides
  }
}

async function withAgents(run: (dependencies: { handlers: Map<string, Handler>; repo: ReturnType<typeof createAgentRepository> }) => Promise<void> | void): Promise<void> {
  const tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-agents-'))
  const dbPath = join(tempDir, 'agents.sqlite')
  migrateDatabaseAtPath(dbPath)
  const db = openDatabaseAtPath(dbPath)

  try {
    const repo = createAgentRepository(db)
    const registry = createAgentRegistry({ agents: repo, clock: () => 1_782_920_000_000 })
    const { ipcMain, handlers } = createFakeIpcMain()
    registerAgentHandlers(ipcMain, { registry })
    await run({ handlers, repo })
  } finally {
    db.close()
    rmSync(tempDir, { recursive: true, force: true })
  }
}

describe('M5 custom Agent settings IPC', () => {
  it('lists built-in agents alongside enabled custom agents', async () => {
    await withAgents(async ({ handlers }) => {
      const saved = await handlers.get('agent.save')?.({}, customAgent())
      expect(saved).toMatchObject({ id: 'agent-storyboard', source: 'user', enabled: true })

      const listed = (await handlers.get('agent.list')?.({}, { includeDisabled: false })) as AgentDefinition[]
      expect(listed.map((agent) => agent.id)).toEqual(['orchestrator', 'canvas', 'tooling', 'pm', 'agent-storyboard'])
      expect(listed.find((agent) => agent.id === 'orchestrator')).toMatchObject({ source: 'builtin', name: 'Orchestrator' })
    })
  })

  it('persists custom agent edits and reloads them from the repository', async () => {
    await withAgents(async ({ handlers, repo }) => {
      const saved = await handlers.get('agent.save')?.({}, customAgent({ name: 'Storyboard v1', maxTurns: 4 }))
      expect(saved).toMatchObject({ id: 'agent-storyboard', name: 'Storyboard v1', maxTurns: 4 })

      await handlers.get('agent.save')?.({}, customAgent({ name: 'Storyboard v2', maxTurns: 8, allowedTools: ['canvas.queryGraph'] }))
      const reloaded = repo.list({ includeDisabled: true })

      expect(reloaded).toHaveLength(1)
      expect(reloaded[0]).toMatchObject({
        id: 'agent-storyboard',
        source: 'user',
        name: 'Storyboard v2',
        allowedTools: ['canvas.queryGraph'],
        maxTurns: 8
      })
    })
  })

  it('protects built-in agents from edit and delete operations', async () => {
    await withAgents(async ({ handlers }) => {
      const editResult = await handlers.get('agent.save')?.({}, customAgent({ id: 'orchestrator', source: 'builtin', name: 'Mutated orchestrator' }))
      expect(editResult).toMatchObject({
        errorClass: 'agent_builtin_readonly',
        message: 'Built-in agents are read-only.'
      })

      const deleteResult = await handlers.get('agent.delete')?.({}, { agentId: 'orchestrator' })
      expect(deleteResult).toMatchObject({
        errorClass: 'agent_builtin_readonly',
        message: 'Built-in agents are read-only.'
      })
    })
  })

  it('deletes user agents without affecting built-ins', async () => {
    await withAgents(async ({ handlers }) => {
      await handlers.get('agent.save')?.({}, customAgent())

      expect(await handlers.get('agent.delete')?.({}, { agentId: 'agent-storyboard' })).toEqual({
        agentId: 'agent-storyboard',
        deleted: true
      })

      const listed = (await handlers.get('agent.list')?.({}, { includeDisabled: true })) as AgentDefinition[]
      expect(listed.map((agent) => agent.id)).toEqual(['orchestrator', 'canvas', 'tooling', 'pm'])
    })
  })
})
