/**
 * Skill invocation service with lazy load and permission checks.
 * @see docs/api-contracts/skills.md
 */

import { randomUUID } from 'node:crypto'

import type { AgentDefinition } from '../../../../shared/agents'
import type { SkillDefinition, SkillInvokeRequest, SkillInvocationRecord } from '../../../../shared/skills'
import type { ToolPermissionKind } from '../../../../shared/tools'
import type { SkillRepository } from '../db/repositories/skill.repo'
import type { SkillRegistry } from './registry'
import { isSkillAllowedForAgent, skillPermissionsWithinPolicy } from './validate-skill-access'

export interface SkillInvokeError {
  errorClass: 'skill_not_found' | 'skill_permission_denied' | 'skill_reference_missing'
  message: string
  retryable: false
}

export interface SkillService {
  invoke(request: SkillInvokeRequest, agent: Pick<AgentDefinition, 'allowedSkills' | 'permissionPolicy'>): SkillInvocationRecord | SkillInvokeError
}

/**
 * Creates the skill invocation service.
 * @param options - Registry, repository, and clock dependencies.
 * @returns Skill service API.
 */
export function createSkillService(options: {
  registry: SkillRegistry
  repo: SkillRepository
  clock?: () => number
  idFactory?: () => string
}): SkillService {
  const clock = options.clock ?? Date.now
  const idFactory = options.idFactory ?? (() => randomUUID())

  return {
    invoke(request, agent) {
      const skill = options.registry.get(request.skillId)

      if (!skill?.enabled) {
        return {
          errorClass: 'skill_not_found',
          message: 'Skill was not found or is disabled.',
          retryable: false
        }
      }

      if (!isSkillAllowedForAgent(agent, skill)) {
        return {
          errorClass: 'skill_permission_denied',
          message: 'Skill is not allowed for this agent.',
          retryable: false
        }
      }

      const allowedKinds: ToolPermissionKind[] = agent.permissionPolicy.allowedPermissionKinds
      if (!skillPermissionsWithinPolicy(skill, allowedKinds)) {
        return {
          errorClass: 'skill_permission_denied',
          message: 'Skill required permissions exceed agent policy.',
          retryable: false
        }
      }

      const instructions = options.registry.loadInstructions(skill.id)
      if (!instructions) {
        return {
          errorClass: 'skill_reference_missing',
          message: 'Required skill instructions are missing.',
          retryable: false
        }
      }

      const loadedReferences = skill.references.filter((reference) => {
        if (!request.requiredReferences || request.requiredReferences.length === 0) {
          return reference.required
        }
        return request.requiredReferences.includes(reference.id)
      })

      const record: SkillInvocationRecord = {
        id: idFactory(),
        skillId: skill.id,
        version: skill.version,
        agentRunId: request.agentRunId,
        loadedReferences,
        requiredPermissionKinds: skill.requiredPermissions.map((permission) => permission.kind),
        status: 'completed'
      }

      options.repo.recordInvocation(record, clock())
      return record
    }
  }
}

/**
 * Applies persisted enabled overrides onto scanned skill definitions.
 * @param skills - Freshly scanned skill metadata.
 * @param repo - Skill repository with enabled overrides.
 * @returns Skills with DB overrides applied.
 */
export function applySkillEnabledOverrides(
  skills: SkillDefinition[],
  repo: Pick<SkillRepository, 'getEnabledOverride'>,
): SkillDefinition[] {
  return skills.map((skill) => {
    const override = repo.getEnabledOverride(skill.id)
    if (override === null) {
      return skill
    }
    return { ...skill, enabled: override }
  })
}
