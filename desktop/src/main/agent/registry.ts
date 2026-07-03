/**
 * Agent registry for built-in and custom user agents.
 * @see docs/api-contracts/agents.md
 */

import type { AgentDefinition, AgentEffort, AgentTriggerKind } from '../../../../shared/agents'
import type { ToolPermissionKind } from '../../../../shared/tools'
import type { AgentRepository } from '../db/repositories/agent.repo'
import { CANVAS_ORCHESTRATOR_PROMPT, CANVAS_PROMPT, GENERAL_PURPOSE_PROMPT, PM_PROMPT, TOOLING_PROMPT } from './prompts'

export interface AgentRegistryOptions {
  agents: AgentRepository
  clock?: () => number
}

export interface AgentRegistry {
  list(options?: { includeDisabled?: boolean }): AgentDefinition[]
  get(agentId: string): AgentDefinition | null
  save(agent: AgentDefinition): AgentDefinition | AgentRegistryError
  delete(agentId: string): { agentId: string; deleted: true } | AgentRegistryError
  isBuiltin(agentId: string): boolean
}

export interface AgentRegistryError {
  errorClass: 'agent_builtin_readonly' | 'agent_policy_invalid' | 'agent_not_found'
  message: string
  retryable: false
}

const builtinAgents: AgentDefinition[] = [
  {
    id: 'general-purpose',
    source: 'builtin',
    name: 'General Purpose',
    description: 'Understands the user, answers directly, reads/searches the project, and delegates canvas work.',
    instructions: GENERAL_PURPOSE_PROMPT,
    allowedTools: ['canvas.queryGraph', 'fs.read', 'fs.glob', 'fs.grep'],
    allowedSkills: '*',
    gatewayPolicy: { allowedChannels: ['text'] },
    contextPolicy: {
      includeCanvasGraph: true,
      includeSelectedAssets: true,
      includeRecentMessages: true,
      includeKnowledge: false,
      maxContextTokens: 8000
    },
    permissionPolicy: { allowedPermissionKinds: ['canvas.read', 'file.read', 'diagnostics'], requireAskForDestructive: true },
    triggerPolicy: { allowedTriggers: ['manual', 'mention', 'canvasChat'], defaultTrigger: 'canvasChat', autoRun: false },
    maxTurns: 8,
    effort: 'high',
    enabled: true
  },
  {
    id: 'canvas-orchestrator',
    source: 'builtin',
    name: 'Canvas Orchestrator',
    description: 'Turns explicit canvas orchestration requirements into declarative CanvasPlan JSON.',
    instructions: CANVAS_ORCHESTRATOR_PROMPT,
    allowedTools: '*',
    allowedSkills: '*',
    gatewayPolicy: { allowedChannels: ['text', 'image', 'video'] },
    contextPolicy: {
      includeCanvasGraph: true,
      includeSelectedAssets: true,
      includeRecentMessages: true,
      includeKnowledge: false,
      maxContextTokens: 8000
    },
    permissionPolicy: { allowedPermissionKinds: ['canvas.read', 'canvas.write', 'file.read', 'network', 'provider.spend'], requireAskForDestructive: true },
    triggerPolicy: { allowedTriggers: ['manual', 'mention', 'canvasChat'], defaultTrigger: 'canvasChat', autoRun: false },
    maxTurns: 8,
    effort: 'high',
    enabled: true
  },
  {
    id: 'orchestrator',
    source: 'builtin',
    name: 'Orchestrator',
    description: 'Compatibility alias for Canvas Orchestrator.',
    instructions: CANVAS_ORCHESTRATOR_PROMPT,
    allowedTools: '*',
    allowedSkills: '*',
    gatewayPolicy: { allowedChannels: ['text', 'image', 'video'] },
    contextPolicy: {
      includeCanvasGraph: true,
      includeSelectedAssets: true,
      includeRecentMessages: true,
      includeKnowledge: false,
      maxContextTokens: 8000
    },
    permissionPolicy: { allowedPermissionKinds: ['canvas.read', 'canvas.write', 'file.read', 'network', 'provider.spend'], requireAskForDestructive: true },
    triggerPolicy: { allowedTriggers: ['manual', 'mention', 'canvasChat'], defaultTrigger: 'canvasChat', autoRun: false },
    maxTurns: 8,
    effort: 'high',
    enabled: true
  },
  {
    id: 'canvas',
    source: 'builtin',
    name: 'Canvas',
    description: 'Handles canvas nodes, edges, and graph edits.',
    instructions: CANVAS_PROMPT,
    allowedTools: ['canvas.queryGraph', 'canvas.proposePlan', 'canvas.createNode', 'canvas.connectNodes', 'canvas.updateNodeData'],
    allowedSkills: ['canvas-node-designer'],
    gatewayPolicy: { allowedChannels: ['text'] },
    contextPolicy: {
      includeCanvasGraph: true,
      includeSelectedAssets: true,
      includeRecentMessages: false,
      includeKnowledge: false,
      maxContextTokens: 6000
    },
    permissionPolicy: { allowedPermissionKinds: ['canvas.read', 'canvas.write'], requireAskForDestructive: true },
    triggerPolicy: { allowedTriggers: ['manual', 'mention'], defaultTrigger: 'mention', autoRun: false },
    maxTurns: 6,
    effort: 'high',
    enabled: true
  },
  {
    id: 'tooling',
    source: 'builtin',
    name: 'Tooling',
    description: 'Coordinates tools, providers, jobs, and persistence.',
    instructions: TOOLING_PROMPT,
    allowedTools: ['canvas.queryGraph', 'canvas.runNode'],
    allowedSkills: ['systematic-debugging'],
    gatewayPolicy: { allowedChannels: ['text'] },
    contextPolicy: {
      includeCanvasGraph: true,
      includeSelectedAssets: false,
      includeRecentMessages: true,
      includeKnowledge: false,
      maxContextTokens: 6000
    },
    permissionPolicy: { allowedPermissionKinds: ['canvas.read', 'provider.spend', 'diagnostics'], requireAskForDestructive: true },
    triggerPolicy: { allowedTriggers: ['manual', 'mention', 'workflowEvent'], defaultTrigger: 'manual', autoRun: false },
    maxTurns: 6,
    effort: 'high',
    enabled: true
  },
  {
    id: 'pm',
    source: 'builtin',
    name: 'PM',
    description: 'Keeps requirements, contracts, progress, and tests aligned.',
    instructions: PM_PROMPT,
    allowedTools: ['canvas.queryGraph'],
    allowedSkills: ['pm-req-planner'],
    gatewayPolicy: { allowedChannels: ['text'] },
    contextPolicy: {
      includeCanvasGraph: false,
      includeSelectedAssets: false,
      includeRecentMessages: true,
      includeKnowledge: true,
      maxContextTokens: 6000
    },
    permissionPolicy: { allowedPermissionKinds: ['diagnostics'], requireAskForDestructive: true },
    triggerPolicy: { allowedTriggers: ['manual', 'mention'], defaultTrigger: 'manual', autoRun: false },
    maxTurns: 6,
    effort: 'high',
    enabled: true
  }
]

const agentEfforts = new Set<AgentEffort>(['low', 'medium', 'high'])
const agentTriggers = new Set<AgentTriggerKind>(['manual', 'mention', 'canvasChat', 'workflowEvent'])
const gatewayChannels = new Set<AgentDefinition['gatewayPolicy']['allowedChannels'][number]>(['text', 'image', 'video'])
const toolPermissionKinds = new Set<ToolPermissionKind>(['canvas.read', 'canvas.write', 'file.read', 'file.write', 'network', 'provider.spend', 'destructive', 'diagnostics'])

function registryError(errorClass: AgentRegistryError['errorClass'], message: string): AgentRegistryError {
  return { errorClass, message, retryable: false }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(isNonEmptyString)
}

function isWildcardOrStringArray(value: unknown): value is string[] | '*' {
  return value === '*' || isStringArray(value)
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean'
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

function isValidGatewayPolicy(value: unknown): boolean {
  if (!isRecord(value) || !Array.isArray(value.allowedChannels) || value.allowedChannels.length === 0) {
    return false
  }

  return value.allowedChannels.every((channel) => typeof channel === 'string' && gatewayChannels.has(channel as AgentDefinition['gatewayPolicy']['allowedChannels'][number]))
    && (!('gatewayId' in value) || typeof value.gatewayId === 'string')
    && (!('modelId' in value) || typeof value.modelId === 'string')
}

function isValidContextPolicy(value: unknown): boolean {
  return isRecord(value)
    && isBoolean(value.includeCanvasGraph)
    && isBoolean(value.includeSelectedAssets)
    && isBoolean(value.includeRecentMessages)
    && isBoolean(value.includeKnowledge)
    && isPositiveInteger(value.maxContextTokens)
}

function isValidPermissionPolicy(value: unknown): boolean {
  if (!isRecord(value) || !Array.isArray(value.allowedPermissionKinds) || !isBoolean(value.requireAskForDestructive)) {
    return false
  }

  return value.allowedPermissionKinds.every((kind) => typeof kind === 'string' && toolPermissionKinds.has(kind as ToolPermissionKind))
}

function isValidTriggerPolicy(value: unknown): boolean {
  if (!isRecord(value) || !Array.isArray(value.allowedTriggers) || value.allowedTriggers.length === 0 || typeof value.defaultTrigger !== 'string' || !isBoolean(value.autoRun)) {
    return false
  }

  return value.allowedTriggers.every((trigger) => typeof trigger === 'string' && agentTriggers.has(trigger as AgentTriggerKind))
    && value.allowedTriggers.includes(value.defaultTrigger)
}

function isValidUserAgent(agent: AgentDefinition): boolean {
  const value = agent as unknown

  return isRecord(value)
    && isNonEmptyString(value.id)
    && isNonEmptyString(value.name)
    && typeof value.description === 'string'
    && isNonEmptyString(value.instructions)
    && (value.source === 'builtin' || value.source === 'user')
    && isWildcardOrStringArray(value.allowedTools)
    && isWildcardOrStringArray(value.allowedSkills)
    && isValidGatewayPolicy(value.gatewayPolicy)
    && isValidContextPolicy(value.contextPolicy)
    && isValidPermissionPolicy(value.permissionPolicy)
    && isValidTriggerPolicy(value.triggerPolicy)
    && isPositiveInteger(value.maxTurns)
    && typeof value.effort === 'string'
    && agentEfforts.has(value.effort as AgentEffort)
    && isBoolean(value.enabled)
}

function mergeBuiltinOverride(base: AgentDefinition, override?: AgentDefinition): AgentDefinition {
  if (!override) {
    return base
  }

  return {
    ...base,
    ...override,
    id: base.id,
    source: 'builtin'
  }
}

/**
 * Creates an agent registry over built-in agents and persisted custom agents.
 * @param options - Agent repository and deterministic clock.
 * @returns Agent registry facade.
 * @throws Error never intentionally during construction; repository errors propagate from method calls.
 * @see docs/api-contracts/agents.md
 */
export function createAgentRegistry(options: AgentRegistryOptions): AgentRegistry {
  const clock = options.clock ?? Date.now
  const builtinsById = new Map(builtinAgents.map((agent) => [agent.id, agent]))

  function listAgents(listOptions: { includeDisabled?: boolean } = {}): AgentDefinition[] {
    const persistedAgents = options.agents.list({ includeDisabled: true })
    const persistedById = new Map(persistedAgents.map((agent) => [agent.id, agent]))
    const builtins = builtinAgents
      .map((agent) => mergeBuiltinOverride(agent, persistedById.get(agent.id)))
      .filter((agent) => listOptions.includeDisabled || agent.enabled)
    const customAgents = persistedAgents
      .filter((agent) => !builtinsById.has(agent.id))
      .filter((agent) => listOptions.includeDisabled || agent.enabled)
    return [...builtins, ...customAgents]
  }

  return {
    list(listOptions = {}) {
      return listAgents(listOptions)
    },
    get(agentId) {
      return listAgents({ includeDisabled: true }).find((agent) => agent.id === agentId) ?? null
    },
    save(agent) {
      if (!isValidUserAgent(agent)) {
        return registryError('agent_policy_invalid', 'Agent configuration violates policy schema.')
      }

      const source = builtinsById.has(agent.id) ? 'builtin' : 'user'
      return options.agents.upsert({ ...agent, source }, clock())
    },
    delete(agentId) {
      if (builtinsById.has(agentId)) {
        return registryError('agent_builtin_readonly', 'Built-in agents cannot be deleted.')
      }

      if (!options.agents.delete(agentId)) {
        return registryError('agent_not_found', 'Agent ID does not exist or is disabled.')
      }

      return { agentId, deleted: true }
    },
    isBuiltin(agentId) {
      return builtinsById.has(agentId)
    }
  }
}
