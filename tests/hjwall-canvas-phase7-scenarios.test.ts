import { existsSync, readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

describe('hjwall canvas Phase 7 human review scenarios', () => {
  const path = 'docs/progress/hjwall-canvas-phase7-human-review-scenarios.md'

  it('documents comic-drama, asset/snippet, and Agent scenarios for tasks 30-32', () => {
    expect(existsSync(path)).toBe(true)
    const doc = readFileSync(path, 'utf8')

    expect(doc).toContain('Scenario A')
    expect(doc).toContain('imageConfigV2')
    expect(doc).toContain('videoConfigV2')
    expect(doc).toContain('Scenario B')
    expect(doc).toContain('snippet')
    expect(doc).toContain('Scenario C')
    expect(doc).toContain('HDR-050')
    expect(doc).toContain('HDR-PHASEA-001')
    expect(doc).toContain('REQ-098')
  })
})
