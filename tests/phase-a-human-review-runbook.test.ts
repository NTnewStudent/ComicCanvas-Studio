import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

describe('Phase A human review runbook', () => {
  it('documents the manual acceptance gate, MJ exclusion, and required review rows', () => {
    const runbook = readFileSync('docs/progress/phase-a-human-review-runbook.md', 'utf8')
    const checklist = readFileSync('docs/progress/human-desktop-review-checklist.md', 'utf8')
    const template = readFileSync('docs/progress/phase-a-human-review-session-template.md', 'utf8')

    const requiredRows = [
      'HDR-ASSET-001',
      'HDR-ASSET-009',
      'HDR-WF-006',
      'HDR-CANVAS-005',
      'HDR-NODE-001',
      'HDR-NODE-002',
      'HDR-RUNTIME-001',
      'HDR-RUNTIME-002',
      'HDR-TOOLS-001',
      'HDR-PHASEA-001'
    ]

    for (const rowId of requiredRows) {
      expect(runbook, `${rowId} runbook coverage`).toContain(rowId)
      expect(checklist, `${rowId} checklist row`).toContain(`| ${rowId} |`)
      expect(template, `${rowId} session template row`).toContain(`| ${rowId} | Pending |`)
    }

    expect(runbook).toContain('Do not review Agent automation as Phase A acceptance evidence.')
    expect(runbook).toContain('MJ node/component implementation is out of scope.')
    expect(runbook).toContain('no MJ parity')
    expect(runbook).toContain('multi-result')
    expect(runbook).toContain('URL refresh')
    expect(runbook).toContain('run recovery')
    expect(runbook).toContain('provider integration is required')
    expect(runbook).toContain('Do not paste secrets')
    expect(runbook).toContain('screenshots, logs, commits')
    expect(runbook).toContain('or this repository.')
    expect(runbook).toContain('Task 60 may start only after one of these is true:')
    expect(runbook).toContain('explicit product deferral for Phase A acceptance is recorded')
    expect(runbook).toContain('HDR-050')
    expect(runbook).toContain('HDR-051')
    expect(checklist).toContain('Manual runbook: `docs/progress/phase-a-human-review-runbook.md`')
    expect(checklist).toContain('Session template: `docs/progress/phase-a-human-review-session-template.md`')
    expect(runbook).toContain('Session template: `docs/progress/phase-a-human-review-session-template.md`')
    expect(runbook).toContain('Copy `docs/progress/phase-a-human-review-session-template.md`')
    expect(template).toContain('Do not paste R2, gateway, or local machine secrets.')
    expect(template).toContain('Do not use Agent automation rows `HDR-050` or `HDR-051` as Phase A evidence.')
    expect(template).toContain('Do not include MJ parity')
    expect(template).toContain('Product Deferral Records')
    expect(template).toContain('Deferrals must also be copied into')
    expect(template).toContain('Task 60 gate:')
  })
})
