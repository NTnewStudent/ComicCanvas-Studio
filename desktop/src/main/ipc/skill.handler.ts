/**
 * Skill discovery and invocation IPC handlers.
 * @see docs/api-contracts/skills.md
 */

import type { AgentDefinition } from '../../../../shared/agents'
import type { SkillInvokeRequest, SkillListRequest } from '../../../../shared/skills'
import type { AgentRegistry } from '../agent/registry'
import type { SkillRegistry } from '../skills/registry'
import type { SkillService } from '../skills/skill.service'
import type { IpcRegistrar } from './types'

function skillId(request: unknown): string {
  return typeof request === 'object' && request !== null && 'skillId' in request
    ? String(request.skillId)
    : ''
}

function listRequest(request: unknown): SkillListRequest {
  if (typeof request !== 'object' || request === null) {
    return {}
  }
  const input = request as Record<string, unknown>
  const parsed: SkillListRequest = {}

  if (input.includeDisabled === true) {
    parsed.includeDisabled = true
  }

  if (input.source === 'builtin' || input.source === 'user' || input.source === 'plugin') {
    parsed.source = input.source
  }

  return parsed
}

function invokeRequest(request: unknown): SkillInvokeRequest | null {
  if (typeof request !== 'object' || request === null) {
    return null
  }
  const input = request as Record<string, unknown>
  if (typeof input.skillId !== 'string' || typeof input.agentRunId !== 'string') {
    return null
  }
  return {
    skillId: input.skillId,
    agentRunId: input.agentRunId,
    input: typeof input.input === 'object' && input.input !== null ? input.input as Record<string, unknown> : {},
    ...(Array.isArray(input.requiredReferences)
      ? { requiredReferences: input.requiredReferences.filter((value): value is string => typeof value === 'string') }
      : {})
  }
}

function defaultAgentPolicy(): Pick<AgentDefinition, 'allowedSkills' | 'permissionPolicy'> {
  return {
    allowedSkills: '*',
    permissionPolicy: {
      allowedPermissionKinds: ['canvas.read', 'canvas.write', 'file.read', 'file.write', 'network', 'provider.spend', 'destructive', 'diagnostics'],
      requireAskForDestructive: true
    }
  }
}

/**
 * Registers skill metadata IPC handlers.
 * @param ipcMain - Electron-compatible IPC registrar.
 * @param options - Skill registry and service dependencies.
 * @see docs/api-contracts/skills.md
 */
export function registerSkillHandlers(
  ipcMain: IpcRegistrar,
  options: {
    registry: SkillRegistry
    service?: SkillService
    agents?: AgentRegistry
  },
): void {
  ipcMain.handle('skill.list', (_event, request) => {
    const parsed = listRequest(request)
    const skills = options.registry.list(parsed.includeDisabled === true)
    return parsed.source ? skills.filter((skill) => skill.source === parsed.source) : skills
  })

  ipcMain.handle('skill.getMetadata', (_event, request) => {
    const metadata = options.registry.get(skillId(request))

    if (!metadata) {
      return {
        errorClass: 'skill_not_found',
        message: 'Skill was not found.',
        retryable: false
      }
    }

    return metadata
  })

  ipcMain.handle('skill.reload', () => ({
    reloadedSkillIds: options.registry.reload()
  }))

  ipcMain.handle('skill.enable', (_event, request) => {
    const enabled = options.registry.enable(skillId(request))
    if (!enabled) {
      return {
        errorClass: 'skill_not_found',
        message: 'Skill was not found.',
        retryable: false
      }
    }
    return enabled
  })

  ipcMain.handle('skill.disable', (_event, request) => {
    const disabled = options.registry.disable(skillId(request))
    if (!disabled) {
      return {
        errorClass: 'skill_not_found',
        message: 'Skill was not found.',
        retryable: false
      }
    }
    return disabled
  })

  ipcMain.handle('skill.invoke', (_event, request) => {
    if (!options.service) {
      return {
        errorClass: 'skill_not_found',
        message: 'Skill invocation service is unavailable.',
        retryable: false
      }
    }

    const parsed = invokeRequest(request)
    if (!parsed) {
      return {
        errorClass: 'skill_metadata_invalid',
        message: 'Skill invoke request was invalid.',
        retryable: false
      }
    }

    let agentPolicy = defaultAgentPolicy()
    if (options.agents) {
      const runAgentId = typeof request === 'object' && request !== null && 'agentId' in request
        ? String((request as { agentId?: unknown }).agentId ?? '')
        : ''
      const agent = runAgentId ? options.agents.get(runAgentId) : options.agents.get('canvas-orchestrator')
      if (agent) {
        agentPolicy = {
          allowedSkills: agent.allowedSkills,
          permissionPolicy: agent.permissionPolicy
        }
      }
    }

    return options.service.invoke(parsed, agentPolicy)
  })
}
