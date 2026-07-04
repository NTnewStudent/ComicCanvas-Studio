/**
 * Lazy skill instruction injection for Agent context packs.
 * @see docs/api-contracts/skills.md
 */

import type { AgentDefinition } from '../../../../shared/agents'
import type { SkillRegistry } from '../skills/registry'

/**
 * Renders allowed skill instructions into a bounded context block.
 * @param agent - Agent whose `allowedSkills` policy caps loaded skills.
 * @param registry - Skill registry providing metadata and instruction bodies.
 * @param tokenBudget - Approximate token budget for skill text.
 * @returns Markdown skill section or empty string when nothing is allowed.
 */
export function buildSkillContext(
  agent: AgentDefinition,
  registry: Pick<SkillRegistry, 'list' | 'get' | 'loadInstructions'>,
  tokenBudget = 1500,
): string {
  const skillIds = agent.allowedSkills === '*'
    ? registry.list().map((skill) => skill.id)
    : agent.allowedSkills

  const sections: string[] = []
  let tokens = 0

  for (const skillId of skillIds) {
    const definition = registry.get(skillId)
    if (!definition?.enabled) {
      continue
    }

    const instructions = registry.loadInstructions(skillId)
    if (!instructions) {
      continue
    }

    const section = `### Skill: ${definition.name}\n${instructions}`
    const estimate = Math.max(1, Math.ceil(section.length / 4))

    if (tokens + estimate > tokenBudget) {
      break
    }

    sections.push(section)
    tokens += estimate
  }

  if (sections.length === 0) {
    return ''
  }

  return `## Loaded Skills\n${sections.join('\n\n')}`
}
