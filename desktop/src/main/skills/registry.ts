/**
 * Built-in SkillRegistry — discovers `.claude/skills/{name}/SKILL.md` metadata and instructions.
 * @see docs/api-contracts/skills.md
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import type { SkillDefinition, SkillReference, SkillSource } from '../../../../shared/skills'

export interface SkillRegistry {
  /** Lists registered skills (metadata only). */
  list(includeDisabled?: boolean): SkillDefinition[]
  /** Returns one skill definition or null. */
  get(skillId: string): SkillDefinition | null
  /** Loads instruction body for lazy context injection. */
  loadInstructions(skillId: string): string | null
  /** Reloads skill metadata from disk. */
  reload(): string[]
}

interface ParsedSkillFile {
  name: string
  description: string
  body: string
}

function parseFrontmatter(content: string): ParsedSkillFile | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)

  if (!match) {
    return null
  }

  const metaBlock = match[1] ?? ''
  const body = (match[2] ?? '').trim()
  const meta: Record<string, string> = {}

  for (const line of metaBlock.split('\n')) {
    const separator = line.indexOf(':')
    if (separator <= 0) {
      continue
    }

    const key = line.slice(0, separator).trim()
    const value = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, '')
    meta[key] = value
  }

  if (!meta.name || !meta.description) {
    return null
  }

  return {
    name: meta.name,
    description: meta.description,
    body
  }
}

function skillIdFromFolder(folderName: string): string {
  return folderName
}

/**
 * Creates a filesystem-backed skill registry for built-in project skills.
 * @param options - Optional skill root override (tests).
 * @returns Skill registry API.
 */
export function createSkillRegistry(options?: { root?: string }): SkillRegistry {
  const root = options?.root ?? join(process.cwd(), '.claude/skills')
  let cache: SkillDefinition[] = []

  function scan(): SkillDefinition[] {
    if (!existsSync(root)) {
      return []
    }

    const folders = readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)

    const skills: SkillDefinition[] = []

    for (const folder of folders) {
      const skillPath = join(root, folder, 'SKILL.md')
      if (!existsSync(skillPath)) {
        continue
      }

      const parsed = parseFrontmatter(readFileSync(skillPath, 'utf8'))
      if (!parsed) {
        continue
      }

      const id = skillIdFromFolder(folder)
      const references: SkillReference[] = [
        {
          id: `${id}-entry`,
          path: skillPath,
          kind: 'instructions',
          required: true
        }
      ]

      skills.push({
        id,
        source: 'builtin' as SkillSource,
        version: '1.0.0',
        name: parsed.name,
        description: parsed.description,
        entry: skillPath,
        references,
        requiredTools: [],
        requiredPermissions: [],
        enabled: true
      })
    }

    return skills.sort((left, right) => left.id.localeCompare(right.id))
  }

  function ensureCache(): SkillDefinition[] {
    if (cache.length === 0) {
      cache = scan()
    }
    return cache
  }

  return {
    list(includeDisabled = false) {
      const skills = ensureCache()
      return includeDisabled ? skills : skills.filter((skill) => skill.enabled)
    },
    get(skillId) {
      return ensureCache().find((skill) => skill.id === skillId) ?? null
    },
    loadInstructions(skillId) {
      const skill = this.get(skillId)
      if (!skill) {
        return null
      }

      if (!existsSync(skill.entry)) {
        return null
      }

      const parsed = parseFrontmatter(readFileSync(skill.entry, 'utf8'))
      return parsed?.body ?? null
    },
    reload() {
      cache = scan()
      return cache.map((skill) => skill.id)
    }
  }
}
