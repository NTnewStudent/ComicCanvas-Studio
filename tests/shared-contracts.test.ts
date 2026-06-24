import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const requiredSharedContracts = [
  'jobs.ts',
  'assets.ts',
  'gateway.ts',
  'tools.ts',
  'agents.ts',
  'skills.ts',
  'knowledge.ts'
]

describe('shared platform contracts', () => {
  it('splits platform domains into focused shared contract files', () => {
    for (const fileName of requiredSharedContracts) {
      const filePath = join('shared', fileName)

      expect(existsSync(filePath), `${fileName} should exist`).toBe(true)
    }
  })

  it('does not keep the legacy tools-agents file as an authoritative contract', () => {
    const legacyPath = join('shared', 'tools-agents.ts')

    if (!existsSync(legacyPath)) {
      return
    }

    const content = readFileSync(legacyPath, 'utf8')

    expect(content).toContain('Deprecated')
    expect(content).toContain('./tools')
    expect(content).toContain('./agents')
  })
})
