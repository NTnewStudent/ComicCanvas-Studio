/**
 * Agent registry for built-in and custom user agents.
 * @see docs/api-contracts/agents.md
 */

import type { AgentDefinition } from '../../../../shared/agents'
import type { AgentRepository } from '../db/repositories/agent.repo'

export interface AgentRegistryOptions {
  agents: AgentRepository
  clock?: () => number
}

export interface AgentRegistry {
  list(options?: { includeDisabled?: boolean }): AgentDefinition[]
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
    id: 'orchestrator',
    source: 'builtin',
    name: 'Orchestrator',
    description: 'Turns natural language into declarative CanvasPlan JSON.',
    instructions: 'Analyze the user request and produce safe ComicCanvas plans.',
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
    permissionPolicy: { allowedPermissionKinds: ['canvas.read', 'canvas.write', 'provider.spend'], requireAskForDestructive: true },
    maxTurns: 8,
    effort: 'high',
    enabled: true
  },
  {
    id: 'canvas',
    source: 'builtin',
    name: 'Canvas',
    description: 'Handles canvas nodes, edges, and graph edits.',
    instructions: 'Use shared canvas contracts and never bypass connection matrix rules.',
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
    maxTurns: 6,
    effort: 'high',
    enabled: true
  },
  {
    id: 'tooling',
    source: 'builtin',
    name: 'Tooling',
    description: 'Coordinates tools, providers, jobs, and persistence.',
    instructions: 'Route all side effects through typed ToolRuntime and repository boundaries.',
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
    maxTurns: 6,
    effort: 'high',
    enabled: true
  },
  {
    id: 'pm',
    source: 'builtin',
    name: 'PM',
    description: 'Keeps requirements, contracts, progress, and tests aligned.',
    instructions: 'Maintain specs, backlog, and acceptance criteria before implementation.',
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
    maxTurns: 6,
    effort: 'high',
    enabled: true
  }
]

function registryError(errorClass: AgentRegistryError['errorClass'], message: string): AgentRegistryError {
  return { errorClass, message, retryable: false }
}

function isValidUserAgent(agent: AgentDefinition): boolean {
  return agent.source === 'user' && agent.name.trim().length > 0 && agent.instructions.trim().length > 0 && agent.maxTurns > 0
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

  return {
    list(listOptions = {}) {
      const customAgents = options.agents.list(listOptions)
      const enabledBuiltins = builtinAgents.filter((agent) => listOptions.includeDisabled || agent.enabled)
      return [...enabledBuiltins, ...customAgents]
    },
    save(agent) {
      if (builtinsById.has(agent.id) || agent.source === 'builtin') {
        return registryError('agent_builtin_readonly', 'Built-in agents are read-only.')
      }

      if (!isValidUserAgent(agent)) {
        return registryError('agent_policy_invalid', 'Agent configuration violates policy schema.')
      }

      return options.agents.upsert({ ...agent, source: 'user' }, clock())
    },
    delete(agentId) {
      if (builtinsById.has(agentId)) {
        return registryError('agent_builtin_readonly', 'Built-in agents are read-only.')
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
