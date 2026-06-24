import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const requiredContractDocs = [
  'canvas-plan.md',
  'jobs.md',
  'assets-files.md',
  'gateway-providers.md',
  'tools-plugins.md',
  'agents.md',
  'skills.md',
  'knowledge-context.md',
  'audit-observability.md'
]

const requiredSections = [
  '## Owner',
  '## Scope',
  '## Request/Response Contracts',
  '## Errors',
  '## Permissions',
  '## Tests'
]

describe('foundation API contract docs', () => {
  it('provides the full M0 contract set with required sections', () => {
    for (const docName of requiredContractDocs) {
      const filePath = join('docs', 'api-contracts', docName)

      expect(existsSync(filePath), `${docName} should exist`).toBe(true)

      const content = readFileSync(filePath, 'utf8')

      for (const section of requiredSections) {
        expect(content, `${docName} should include ${section}`).toContain(section)
      }
    }
  })
})
