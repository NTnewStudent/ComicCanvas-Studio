/**
 * Deterministic registry for canonical built-in roles and custom user agents.
 * @see docs/api-contracts/agents.md
 */

import {
  CANONICAL_AGENT_ROLE_IDS,
  type AgentDefinition,
  type AgentEffort,
  type AgentTriggerKind,
  type CanonicalAgentRoleId
} from '../../../../shared/agents'
import type { ToolPermissionKind } from '../../../../shared/tools'
import type { AgentRepository } from '../db/repositories/agent.repo'
import {
  ASSET_MEDIA_AGENT_PROMPT,
  CANVAS_OPERATOR_PROMPT,
  CANVAS_PLANNER_PROMPT,
  GENERAL_ASSISTANT_PROMPT,
  PM_AGENT_PROMPT,
  QA_VERIFIER_PROMPT,
  TOOLING_AGENT_PROMPT,
  WORKFLOW_RUNNER_PROMPT
} from './prompts'

/** Canonical built-in role IDs in stable user-facing list order. */
export { CANONICAL_AGENT_ROLE_IDS }
export type { CanonicalAgentRoleId }

/** Dependencies for an Agent role registry. */
export interface AgentRegistryOptions {
  agents: AgentRepository
  clock?: () => number
}

/** Read and settings operations for built-in roles and custom agents. */
export interface AgentRoleRegistry {
  list(options?: { includeDisabled?: boolean }): AgentDefinition[]
  get(agentId: string): AgentDefinition | null
  save(agent: AgentDefinition): AgentDefinition | AgentRegistryError
  delete(agentId: string): { agentId: string; deleted: true } | AgentRegistryError
  isBuiltin(agentId: string): boolean
}

/** Compatibility type retained for existing runtime dependencies. */
export type AgentRegistry = AgentRoleRegistry

/** Stable registry error returned by settings operations. */
export interface AgentRegistryError {
  errorClass: 'agent_builtin_readonly' | 'agent_policy_invalid' | 'agent_not_found'
  message: string
  retryable: false
}

const builtinAgents: AgentDefinition[] = [
  {
    id: 'general-assistant',
    source: 'builtin',
    name: 'General Assistant',
    description: 'Default conversation role for answers, local discovery, and safe specialist handoff.',
    instructions: GENERAL_ASSISTANT_PROMPT,
    allowedTools: ['canvas.queryGraph', 'fs.read', 'fs.glob', 'fs.grep', 'web.search', 'agent.spawnChild'],
    allowedSkills: [],
    gatewayPolicy: { allowedChannels: ['text'] },
    contextPolicy: {
      includeCanvasGraph: true,
      includeSelectedAssets: true,
      includeRecentMessages: true,
      includeKnowledge: true,
      maxContextTokens: 8000
    },
    permissionPolicy: { allowedPermissionKinds: ['canvas.read', 'file.read', 'diagnostics', 'network'], requireAskForDestructive: true },
    triggerPolicy: { allowedTriggers: ['manual', 'mention', 'canvasChat'], defaultTrigger: 'canvasChat', autoRun: false },
    maxTurns: 8,
    effort: 'high',
    enabled: true
  },
  {
    id: 'pm-agent',
    source: 'builtin',
    name: 'PM Agent',
    description: 'Turns product intent into requirements, acceptance criteria, contracts, and scoped tasks.',
    instructions: PM_AGENT_PROMPT,
    allowedTools: ['fs.read', 'fs.glob', 'fs.grep'],
    allowedSkills: ['pm-req-planner'],
    gatewayPolicy: { allowedChannels: ['text'] },
    contextPolicy: {
      includeCanvasGraph: false,
      includeSelectedAssets: false,
      includeRecentMessages: true,
      includeKnowledge: true,
      maxContextTokens: 7000
    },
    permissionPolicy: { allowedPermissionKinds: ['file.read', 'diagnostics'], requireAskForDestructive: true },
    triggerPolicy: { allowedTriggers: ['manual', 'mention'], defaultTrigger: 'manual', autoRun: false },
    maxTurns: 7,
    effort: 'high',
    enabled: true
  },
  {
    id: 'canvas-planner',
    source: 'builtin',
    name: 'Canvas Planner',
    description: 'Produces validated declarative CanvasPlan drafts without mutating or running the graph.',
    instructions: CANVAS_PLANNER_PROMPT,
    allowedTools: ['canvas.queryGraph', 'canvas.proposePlan', 'canvas.validateGraph'],
    allowedSkills: [],
    gatewayPolicy: { allowedChannels: ['text'] },
    contextPolicy: {
      includeCanvasGraph: true,
      includeSelectedAssets: true,
      includeRecentMessages: true,
      includeKnowledge: false,
      maxContextTokens: 8000
    },
    permissionPolicy: { allowedPermissionKinds: ['canvas.read'], requireAskForDestructive: true },
    triggerPolicy: { allowedTriggers: ['manual', 'mention', 'canvasChat'], defaultTrigger: 'mention', autoRun: false },
    maxTurns: 8,
    effort: 'high',
    enabled: true
  },
  {
    id: 'canvas-operator',
    source: 'builtin',
    name: 'Canvas Operator',
    description: 'Applies approved node and edge changes without running provider-backed work.',
    instructions: CANVAS_OPERATOR_PROMPT,
    allowedTools: [
      'canvas.queryGraph',
      'canvas.createNode',
      'canvas.duplicateNode',
      'canvas.renameNode',
      'canvas.setNodePosition',
      'canvas.connectNodes',
      'canvas.connectToCreate',
      'canvas.updateNodeData',
      'canvas.extractSelection',
      'canvas.layoutSelection'
    ],
    allowedSkills: [],
    gatewayPolicy: { allowedChannels: ['text'] },
    contextPolicy: {
      includeCanvasGraph: true,
      includeSelectedAssets: true,
      includeRecentMessages: false,
      includeKnowledge: false,
      maxContextTokens: 6000
    },
    permissionPolicy: { allowedPermissionKinds: ['canvas.read', 'canvas.write'], requireAskForDestructive: true },
    triggerPolicy: { allowedTriggers: ['manual', 'mention'], defaultTrigger: 'manual', autoRun: false },
    maxTurns: 6,
    effort: 'medium',
    enabled: true
  },
  {
    id: 'asset-media-agent',
    source: 'builtin',
    name: 'Asset and Media Agent',
    description: 'Prepares asset references and starts approved persistent media generation jobs.',
    instructions: ASSET_MEDIA_AGENT_PROMPT,
    allowedTools: ['canvas.queryGraph', 'asset.ensureCloudUrl', 'canvas.runNode'],
    allowedSkills: [],
    gatewayPolicy: { allowedChannels: ['text'] },
    contextPolicy: {
      includeCanvasGraph: true,
      includeSelectedAssets: true,
      includeRecentMessages: false,
      includeKnowledge: false,
      maxContextTokens: 6000
    },
    permissionPolicy: { allowedPermissionKinds: ['canvas.read', 'file.read', 'network', 'provider.spend'], requireAskForDestructive: true },
    triggerPolicy: { allowedTriggers: ['manual', 'mention'], defaultTrigger: 'manual', autoRun: false },
    maxTurns: 6,
    effort: 'medium',
    enabled: true
  },
  {
    id: 'workflow-runner',
    source: 'builtin',
    name: 'Workflow Runner',
    description: 'Validates and starts approved workflow nodes through the persistent job queue.',
    instructions: WORKFLOW_RUNNER_PROMPT,
    allowedTools: ['canvas.queryGraph', 'canvas.validateGraph', 'canvas.runNode'],
    allowedSkills: [],
    gatewayPolicy: { allowedChannels: ['text'] },
    contextPolicy: {
      includeCanvasGraph: true,
      includeSelectedAssets: false,
      includeRecentMessages: false,
      includeKnowledge: false,
      maxContextTokens: 6000
    },
    permissionPolicy: { allowedPermissionKinds: ['canvas.read', 'provider.spend', 'diagnostics'], requireAskForDestructive: true },
    triggerPolicy: { allowedTriggers: ['manual', 'workflowEvent'], defaultTrigger: 'manual', autoRun: false },
    maxTurns: 6,
    effort: 'medium',
    enabled: true
  },
  {
    id: 'tooling-agent',
    source: 'builtin',
    name: 'Tooling Agent',
    description: 'Inspects local tools, providers, jobs, persistence, and diagnostics without side effects.',
    instructions: TOOLING_AGENT_PROMPT,
    allowedTools: ['fs.read', 'fs.glob', 'fs.grep', 'canvas.queryGraph'],
    allowedSkills: [],
    gatewayPolicy: { allowedChannels: ['text'] },
    contextPolicy: {
      includeCanvasGraph: true,
      includeSelectedAssets: false,
      includeRecentMessages: true,
      includeKnowledge: true,
      maxContextTokens: 7000
    },
    permissionPolicy: { allowedPermissionKinds: ['canvas.read', 'file.read', 'diagnostics'], requireAskForDestructive: true },
    triggerPolicy: { allowedTriggers: ['manual', 'mention'], defaultTrigger: 'manual', autoRun: false },
    maxTurns: 7,
    effort: 'high',
    enabled: true
  },
  {
    id: 'qa-verifier',
    source: 'builtin',
    name: 'QA Verifier',
    description: 'Independently validates graph correctness and reports evidence without repairing it.',
    instructions: QA_VERIFIER_PROMPT,
    allowedTools: ['canvas.queryGraph', 'canvas.validateGraph'],
    allowedSkills: [],
    gatewayPolicy: { allowedChannels: ['text'] },
    contextPolicy: {
      includeCanvasGraph: true,
      includeSelectedAssets: true,
      includeRecentMessages: false,
      includeKnowledge: true,
      maxContextTokens: 6000
    },
    permissionPolicy: { allowedPermissionKinds: ['canvas.read', 'diagnostics'], requireAskForDestructive: true },
    triggerPolicy: { allowedTriggers: ['manual', 'mention', 'workflowEvent'], defaultTrigger: 'manual', autoRun: false },
    maxTurns: 6,
    effort: 'high',
    enabled: true
  }
]

const compatibilityAliases: Readonly<Record<string, CanonicalAgentRoleId>> = {
  'general-purpose': 'general-assistant',
  'canvas-orchestrator': 'canvas-planner',
  orchestrator: 'canvas-planner',
  canvas: 'canvas-operator',
  tooling: 'tooling-agent',
  pm: 'pm-agent'
}

const agentEfforts = new Set<AgentEffort>(['low', 'medium', 'high'])
const agentTriggers = new Set<AgentTriggerKind>(['manual', 'mention', 'canvasChat', 'workflowEvent'])
const gatewayChannels = new Set<AgentDefinition['gatewayPolicy']['allowedChannels'][number]>(['text', 'image', 'video'])
const toolPermissionKinds = new Set<ToolPermissionKind>(['canvas.read', 'canvas.write', 'file.read', 'file.write', 'network', 'provider.spend', 'destructive', 'diagnostics'])

function registryError(errorClass: AgentRegistryError['errorClass'], message: string): AgentRegistryError {
  return { errorClass, message, retryable: false }
}

function cloneAgentDefinition(agent: AgentDefinition): AgentDefinition {
  return {
    ...agent,
    allowedTools: agent.allowedTools === '*' ? '*' : [...agent.allowedTools],
    allowedSkills: agent.allowedSkills === '*' ? '*' : [...agent.allowedSkills],
    gatewayPolicy: {
      ...agent.gatewayPolicy,
      allowedChannels: [...agent.gatewayPolicy.allowedChannels]
    },
    contextPolicy: { ...agent.contextPolicy },
    permissionPolicy: {
      ...agent.permissionPolicy,
      allowedPermissionKinds: [...agent.permissionPolicy.allowedPermissionKinds]
    },
    triggerPolicy: {
      ...agent.triggerPolicy,
      allowedTriggers: [...agent.triggerPolicy.allowedTriggers]
    }
  }
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

/**
 * Creates a deterministic registry of readonly built-in roles and persisted custom agents.
 * @param options - Agent repository and deterministic clock.
 * @returns Agent role registry facade.
 * @see docs/api-contracts/agents.md
 */
export function createAgentRoleRegistry(options: AgentRegistryOptions): AgentRoleRegistry {
  const clock = options.clock ?? Date.now
  const builtinsById = new Map(builtinAgents.map((agent) => [agent.id, agent]))
  const protectedIds = new Set([...builtinsById.keys(), ...Object.keys(compatibilityAliases)])

  function canonicalId(agentId: string): string {
    return compatibilityAliases[agentId] ?? agentId
  }

  function listAgents(listOptions: { includeDisabled?: boolean } = {}): AgentDefinition[] {
    const customAgents = options.agents.list({ includeDisabled: true })
      .filter((agent) => !protectedIds.has(agent.id))
      .filter((agent) => listOptions.includeDisabled || agent.enabled)
    const builtins = builtinAgents.filter((agent) => listOptions.includeDisabled || agent.enabled)
    return [...builtins, ...customAgents].map(cloneAgentDefinition)
  }

  return {
    list(listOptions = {}) {
      return listAgents(listOptions)
    },
    get(agentId) {
      const builtin = builtinsById.get(canonicalId(agentId))
      if (builtin) {
        return cloneAgentDefinition(builtin)
      }
      const customAgent = options.agents.list({ includeDisabled: true }).find((agent) => agent.id === agentId)
      return customAgent ? cloneAgentDefinition(customAgent) : null
    },
    save(agent) {
      if (protectedIds.has(agent.id)) {
        return registryError('agent_builtin_readonly', 'Built-in agents cannot be modified.')
      }
      if (!isValidUserAgent(agent)) {
        return registryError('agent_policy_invalid', 'Agent configuration violates policy schema.')
      }
      return options.agents.upsert({ ...agent, source: 'user' }, clock())
    },
    delete(agentId) {
      if (protectedIds.has(agentId)) {
        return registryError('agent_builtin_readonly', 'Built-in agents cannot be deleted.')
      }
      if (!options.agents.delete(agentId)) {
        return registryError('agent_not_found', 'Agent ID does not exist or is disabled.')
      }
      return { agentId, deleted: true }
    },
    isBuiltin(agentId) {
      return protectedIds.has(agentId)
    }
  }
}

/**
 * Compatibility factory retained for existing runtime and IPC wiring.
 * @param options - Agent repository and deterministic clock.
 * @returns Agent role registry facade.
 */
export function createAgentRegistry(options: AgentRegistryOptions): AgentRegistry {
  return createAgentRoleRegistry(options)
}
