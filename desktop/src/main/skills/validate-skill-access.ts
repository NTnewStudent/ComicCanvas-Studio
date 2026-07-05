/**
 * Skill permission and policy checks before lazy instruction load.
 * @see docs/api-contracts/skills.md
 */

import type { AgentDefinition } from '../../../../shared/agents'
import type { SkillDefinition } from '../../../../shared/skills'
import type { ToolPermissionKind } from '../../../../shared/tools'

/**
 * Returns whether an agent policy allows invoking the given skill metadata.
 * @param agent - Agent whose `allowedSkills` list caps skill access.
 * @param skill - Skill definition to validate.
 * @returns True when the skill is enabled and allowed for the agent.
 */
export function isSkillAllowedForAgent(
  agent: Pick<AgentDefinition, 'allowedSkills'>,
  skill: SkillDefinition,
): boolean {
  if (!skill.enabled) {
    return false
  }

  if (agent.allowedSkills === '*') {
    return true
  }

  return agent.allowedSkills.includes(skill.id)
}

/**
 * Returns whether a skill's declared permissions fit within an allowed kind set.
 * @param skill - Skill metadata including required permissions.
 * @param allowedPermissionKinds - Permission kinds granted to the invoking agent.
 * @returns True when every required permission kind is allowed.
 */
export function skillPermissionsWithinPolicy(
  skill: SkillDefinition,
  allowedPermissionKinds: readonly ToolPermissionKind[],
): boolean {
  return skill.requiredPermissions.every((permission) => allowedPermissionKinds.includes(permission.kind))
}
