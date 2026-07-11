import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import type { AgentDefinition } from '../shared/agents'
import { migrateDatabaseAtPath, openDatabaseAtPath } from '../desktop/src/main/db/migrate'
import { createAgentRepository } from '../desktop/src/main/db/repositories/agent.repo'
import { createAgentRegistry, type AgentRegistry } from '../desktop/src/main/agent/registry'
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
    triggerPolicy: { allowedTriggers: ['manual', 'mention'], defaultTrigger: 'manual', autoRun: false },
    maxTurns: 6,
    effort: 'medium',
    enabled: true,
    ...overrides
  }
}

const CANONICAL_ROLE_IDS = [
  'general-assistant',
  'pm-agent',
  'canvas-planner',
  'canvas-operator',
  'asset-media-agent',
  'workflow-runner',
  'tooling-agent',
  'qa-verifier'
] as const

async function withAgents(run: (dependencies: {
  handlers: Map<string, Handler>
  registry: AgentRegistry
  repo: ReturnType<typeof createAgentRepository>
}) => Promise<void> | void): Promise<void> {
  const tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-agents-'))
  const dbPath = join(tempDir, 'agents.sqlite')
  migrateDatabaseAtPath(dbPath)
  const db = openDatabaseAtPath(dbPath)

  try {
    const repo = createAgentRepository(db)
    const registry = createAgentRegistry({ agents: repo, clock: () => 1_782_920_000_000 })
    const { ipcMain, handlers } = createFakeIpcMain()
    registerAgentHandlers(ipcMain, { registry })
    await run({ handlers, registry, repo })
  } finally {
    db.close()
    rmSync(tempDir, { recursive: true, force: true })
  }
}

describe('local Agent role registry and settings IPC', () => {
  it('lists every canonical built-in role once with General Assistant first', async () => {
    await withAgents(async ({ handlers }) => {
      const listed = (await handlers.get('agent.list')?.({}, { includeDisabled: false })) as AgentDefinition[]
      const ids = listed.map((agent) => agent.id)

      expect(ids).toEqual(CANONICAL_ROLE_IDS)
      expect(new Set(ids)).toHaveProperty('size', CANONICAL_ROLE_IDS.length)
      expect(listed[0]).toMatchObject({
        id: 'general-assistant',
        source: 'builtin',
        name: 'General Assistant',
        allowedTools: ['canvas.queryGraph', 'fs.read', 'fs.glob', 'fs.grep', 'web.search', 'agent.spawnChild'],
        gatewayPolicy: { allowedChannels: ['text'] },
        permissionPolicy: { allowedPermissionKinds: ['canvas.read', 'file.read', 'diagnostics', 'network'], requireAskForDestructive: true },
        triggerPolicy: { allowedTriggers: ['manual', 'mention', 'canvasChat'], defaultTrigger: 'canvasChat', autoRun: false },
      })
      expect(listed.every((agent) => agent.instructions.length > 80)).toBe(true)
      expect(listed.every((agent) => agent.maxTurns > 0 && agent.maxTurns <= 8)).toBe(true)
    })
  })

  it('keeps canonical role capabilities explicit and least-privilege', async () => {
    await withAgents(({ registry }) => {
      const roles = registry.list({ includeDisabled: true })
      const byId = new Map(roles.map((role) => [role.id, role]))

      expect(roles.every((role) => role.allowedTools !== '*' && role.allowedSkills !== '*')).toBe(true)
      expect(byId.get('general-assistant')).toMatchObject({
        allowedTools: ['canvas.queryGraph', 'fs.read', 'fs.glob', 'fs.grep', 'web.search', 'agent.spawnChild'],
        permissionPolicy: {
          allowedPermissionKinds: ['canvas.read', 'file.read', 'diagnostics', 'network'],
          requireAskForDestructive: true
        }
      })
      expect(byId.get('pm-agent')?.permissionPolicy.allowedPermissionKinds).not.toContain('canvas.write')
      expect(byId.get('canvas-planner')).toMatchObject({
        allowedTools: ['canvas.queryGraph', 'canvas.proposePlan', 'canvas.validateGraph'],
        permissionPolicy: { allowedPermissionKinds: ['canvas.read'], requireAskForDestructive: true }
      })
      expect(byId.get('canvas-operator')).toMatchObject({
        permissionPolicy: { allowedPermissionKinds: ['canvas.read', 'canvas.write'], requireAskForDestructive: true },
        triggerPolicy: { autoRun: false }
      })
      expect(byId.get('canvas-operator')?.allowedTools).not.toContain('canvas.runNode')
      expect(byId.get('asset-media-agent')).toMatchObject({
        allowedTools: ['canvas.queryGraph', 'asset.ensureCloudUrl', 'canvas.runNode'],
        permissionPolicy: {
          allowedPermissionKinds: ['canvas.read', 'file.read', 'network', 'provider.spend'],
          requireAskForDestructive: true
        }
      })
      expect(byId.get('workflow-runner')?.allowedTools).toContain('canvas.runNode')
      expect(byId.get('qa-verifier')).toMatchObject({
        allowedTools: ['canvas.queryGraph', 'canvas.validateGraph'],
        permissionPolicy: { allowedPermissionKinds: ['canvas.read', 'diagnostics'], requireAskForDestructive: true }
      })
      expect(roles.filter((role) => role.allowedTools.includes('canvas.runNode')).every((role) => (
        role.permissionPolicy.allowedPermissionKinds.includes('provider.spend')
        && role.permissionPolicy.requireAskForDestructive
        && !role.triggerPolicy.autoRun
      ))).toBe(true)
      expect(roles.filter((role) => role.allowedTools.includes('agent.spawnChild')).map((role) => role.id)).toEqual([
        'general-assistant'
      ])
    })
  })

  it('resolves compatibility aliases without listing duplicate roles', async () => {
    await withAgents(({ registry }) => {
      const aliases = {
        'general-purpose': 'general-assistant',
        'canvas-orchestrator': 'canvas-planner',
        orchestrator: 'canvas-planner',
        canvas: 'canvas-operator',
        tooling: 'tooling-agent',
        pm: 'pm-agent'
      } as const

      for (const [alias, canonicalId] of Object.entries(aliases)) {
        expect(registry.get(alias)).toMatchObject({ id: canonicalId, source: 'builtin' })
        expect(registry.isBuiltin(alias)).toBe(true)
      }
      expect(registry.list({ includeDisabled: true }).map((agent) => agent.id)).toEqual(CANONICAL_ROLE_IDS)
    })
  })

  it('returns defensive deep clones for built-in roles and aliases', async () => {
    await withAgents(({ registry }) => {
      const returned = registry.list({ includeDisabled: true }).find((agent) => agent.id === 'canvas-planner')
      expect(returned).toBeDefined()

      if (!returned || returned.allowedTools === '*' || returned.allowedSkills === '*') {
        throw new Error('Expected the Canvas Planner built-in role with explicit capabilities.')
      }

      returned.allowedTools.push('canvas.runNode')
      returned.allowedSkills.push('mutated-skill')
      returned.gatewayPolicy.allowedChannels.push('video')
      returned.contextPolicy.includeCanvasGraph = false
      returned.permissionPolicy.allowedPermissionKinds.push('provider.spend')
      returned.triggerPolicy.allowedTriggers.push('workflowEvent')

      const expected = {
        id: 'canvas-planner',
        allowedTools: ['canvas.queryGraph', 'canvas.proposePlan', 'canvas.validateGraph'],
        allowedSkills: [],
        gatewayPolicy: { allowedChannels: ['text'] },
        contextPolicy: { includeCanvasGraph: true },
        permissionPolicy: { allowedPermissionKinds: ['canvas.read'] },
        triggerPolicy: { allowedTriggers: ['manual', 'mention', 'canvasChat'] }
      }

      expect(registry.get('canvas-planner')).toMatchObject(expected)
      expect(registry.get('canvas-orchestrator')).toMatchObject(expected)
      expect(registry.list({ includeDisabled: true }).find((agent) => agent.id === 'canvas-planner')).toMatchObject(expected)
    })
  })

  it('lists built-in agents alongside enabled custom agents', async () => {
    await withAgents(async ({ handlers }) => {
      const saved = await handlers.get('agent.save')?.({}, customAgent())
      expect(saved).toMatchObject({ id: 'agent-storyboard', source: 'user', enabled: true })

      const listed = (await handlers.get('agent.list')?.({}, { includeDisabled: false })) as AgentDefinition[]
      expect(listed.map((agent) => agent.id)).toEqual([...CANONICAL_ROLE_IDS, 'agent-storyboard'])
      expect(listed.find((agent) => agent.id === 'general-assistant')).toMatchObject({ source: 'builtin', name: 'General Assistant' })
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

  it('rejects malformed agent policy fields before persistence', async () => {
    await withAgents(async ({ handlers, repo }) => {
      const invalidTrigger = await handlers.get('agent.save')?.({}, customAgent({
        triggerPolicy: { allowedTriggers: ['manual'], defaultTrigger: 'workflowEvent', autoRun: false }
      }))
      expect(invalidTrigger).toMatchObject({
        errorClass: 'agent_policy_invalid',
        message: 'Agent configuration violates policy schema.'
      })

      const invalidPermission = await handlers.get('agent.save')?.({}, {
        ...customAgent(),
        permissionPolicy: { allowedPermissionKinds: ['canvas.read', 'root' as never], requireAskForDestructive: true }
      })
      expect(invalidPermission).toMatchObject({ errorClass: 'agent_policy_invalid' })

      const invalidContext = await handlers.get('agent.save')?.({}, customAgent({
        contextPolicy: {
          includeCanvasGraph: true,
          includeSelectedAssets: false,
          includeRecentMessages: true,
          includeKnowledge: false,
          maxContextTokens: 0
        }
      }))
      expect(invalidContext).toMatchObject({ errorClass: 'agent_policy_invalid' })
      expect(repo.list({ includeDisabled: true })).toEqual([])
    })
  })

  it('keeps canonical built-ins and compatibility aliases readonly', async () => {
    await withAgents(async ({ handlers, repo }) => {
      for (const agentId of ['canvas-planner', 'canvas-orchestrator']) {
        const editResult = await handlers.get('agent.save')?.({}, customAgent({ id: agentId, source: 'builtin' }))
        expect(editResult).toMatchObject({
          errorClass: 'agent_builtin_readonly',
          message: 'Built-in agents cannot be modified.'
        })

        const deleteResult = await handlers.get('agent.delete')?.({}, { agentId })
        expect(deleteResult).toMatchObject({
          errorClass: 'agent_builtin_readonly',
          message: 'Built-in agents cannot be deleted.'
        })
      }
      expect(repo.list({ includeDisabled: true })).toEqual([])
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
      expect(listed.map((agent) => agent.id)).toEqual(CANONICAL_ROLE_IDS)
    })
  })
})
