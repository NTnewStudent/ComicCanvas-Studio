/**
 * Built-in SkillRegistry — discovers skill metadata from approved roots.
 * @see docs/api-contracts/skills.md
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import type { SkillDefinition, SkillReference, SkillSource } from '../../../../shared/skills'
import type { SkillRepository } from '../db/repositories/skill.repo'
import { applySkillEnabledOverrides } from './skill.service'

export interface SkillRegistry {
  /** Lists registered skills (metadata only). */
  list(includeDisabled?: boolean): SkillDefinition[]
  /** Returns one skill definition or null. */
  get(skillId: string): SkillDefinition | null
  /** Loads instruction body for lazy context injection. */
  loadInstructions(skillId: string): string | null
  /** Reloads skill metadata from disk. */
  reload(): string[]
  /** Enables a skill and persists override when repository is configured. */
  enable(skillId: string): SkillDefinition | null
  /** Disables a skill and persists override when repository is configured. */
  disable(skillId: string): SkillDefinition | null
}

export interface SkillRootConfig {
  root: string
  source: SkillSource
  defaultEnabled: boolean
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

function skillIdFromFolder(folderName: string, source: SkillSource): string {
  if (source === 'plugin') {
    return `plugin:${folderName}`
  }
  if (source === 'user') {
    return `user:${folderName}`
  }
  return folderName
}

/**
 * Creates a filesystem-backed skill registry for built-in, user, and plugin skills.
 * @param options - Optional roots, repository, and clock overrides (tests).
 * @returns Skill registry API.
 */
export function createSkillRegistry(options?: {
  roots?: SkillRootConfig[]
  root?: string
  repo?: SkillRepository
  clock?: () => number
}): SkillRegistry {
  const roots: SkillRootConfig[] = options?.roots ?? [
    {
      root: options?.root ?? join(process.cwd(), '.claude/skills'),
      source: 'builtin',
      defaultEnabled: true
    }
  ]
  const repo = options?.repo
  const clock = options?.clock ?? Date.now
  let cache: SkillDefinition[] = []
  const instructionCache = new Map<string, string>()

  function scanRoot(config: SkillRootConfig): SkillDefinition[] {
    const { root, source, defaultEnabled } = config
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

      const id = skillIdFromFolder(folder, source)
      instructionCache.set(id, parsed.body)
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
        source,
        version: '1.0.0',
        name: parsed.name,
        description: parsed.description,
        entry: skillPath,
        references,
        requiredTools: [],
        requiredPermissions: [],
        enabled: defaultEnabled
      })
    }

    return skills
  }

  function scan(): SkillDefinition[] {
    const merged = new Map<string, SkillDefinition>()

    for (const config of roots) {
      for (const skill of scanRoot(config)) {
        merged.set(skill.id, skill)
      }
    }

    const skills = [...merged.values()].sort((left, right) => left.id.localeCompare(right.id))
    return repo ? applySkillEnabledOverrides(skills, repo) : skills
  }

  function ensureCache(): SkillDefinition[] {
    if (cache.length === 0) {
      cache = scan()
    }
    return cache
  }

  function updateSkillEnabled(skillId: string, enabled: boolean): SkillDefinition | null {
    const skill = ensureCache().find((entry) => entry.id === skillId)
    if (!skill) {
      return null
    }

    const updated = { ...skill, enabled }
    cache = cache.map((entry) => (entry.id === skillId ? updated : entry))
    repo?.setEnabled(updated, enabled, clock())
    return updated
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

      if (existsSync(skill.entry)) {
        const parsed = parseFrontmatter(readFileSync(skill.entry, 'utf8'))
        if (parsed?.body) {
          instructionCache.set(skillId, parsed.body)
          return parsed.body
        }
      }

      return instructionCache.get(skillId) ?? null
    },
    reload() {
      const previous = cache

      try {
        const next = scan()
        const anyRootExists = roots.some((config) => existsSync(config.root))

        if (previous.length > 0 && next.length === 0 && anyRootExists) {
          const hasSkillFolders = roots.some((config) => {
            if (!existsSync(config.root)) {
              return false
            }
            return readdirSync(config.root, { withFileTypes: true })
              .filter((entry) => entry.isDirectory())
              .some((entry) => existsSync(join(config.root, entry.name, 'SKILL.md')))
          })

          if (hasSkillFolders) {
            // Reload failed to parse any skill; keep the previous valid snapshot.
            return previous.map((skill) => skill.id)
          }
        }

        cache = next
        return cache.map((skill) => skill.id)
      } catch {
        // Filesystem errors during reload must not discard the last good snapshot.
        return previous.map((skill) => skill.id)
      }
    },
    enable(skillId) {
      return updateSkillEnabled(skillId, true)
    },
    disable(skillId) {
      return updateSkillEnabled(skillId, false)
    }
  }
}
