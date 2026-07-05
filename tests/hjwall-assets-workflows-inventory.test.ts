import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

interface InventoryRow {
  id: string
  owner: string
  requirement: string
  task: string
  automatedEvidence: string
  humanReview: string
}

function parseInventoryRows(markdown: string): InventoryRow[] {
  return markdown
    .split('\n')
    .filter((line) => line.startsWith('| INV-AW-'))
    .map((line) => {
      const cells = line.split('|').map((cell) => cell.trim())

      return {
        id: cells[1] ?? '',
        owner: cells[4] ?? '',
        requirement: cells[6] ?? '',
        task: cells[7] ?? '',
        automatedEvidence: cells[8] ?? '',
        humanReview: cells[9] ?? ''
      }
    })
}

describe('hjwall assets/workflows migration inventory', () => {
  it('maps every accepted capability to owners, requirements, tasks, tests, and human review rows', () => {
    const inventory = readFileSync('docs/progress/hjwall-assets-workflows-gap-analysis.md', 'utf8')
    const review = readFileSync('docs/progress/human-desktop-review-checklist.md', 'utf8')
    const rows = parseInventoryRows(inventory)

    expect(rows.length).toBeGreaterThanOrEqual(25)
    expect(new Set(rows.map((row) => row.id)).size).toBe(rows.length)

    for (const row of rows) {
      expect(row.id).toMatch(/^INV-AW-\d{3}$/u)
      expect(row.owner, `${row.id} owner`).toMatch(/agent/u)
      expect(row.requirement, `${row.id} requirement`).toMatch(/R\d+/u)
      expect(row.task, `${row.id} task`).toMatch(/T\d+/u)
      expect(row.automatedEvidence, `${row.id} automated evidence`).toMatch(/\.(test|spec)\.(ts|tsx)|test\.ts|test\.tsx/u)
      expect(row.humanReview, `${row.id} human review`).toMatch(/^HDR-/u)
      expect(review, `${row.id} review row`).toContain(`| ${row.humanReview} |`)
    }
  })

  it('records Phase A order and ToolRuntime audit as completed Phase 0 tasks', () => {
    const tasks = readFileSync('specs/hjwall-assets-workflows-100-migration/tasks.md', 'utf8')
    const backlog = readFileSync('docs/progress/backlog.md', 'utf8')

    expect(tasks).toContain('- [x] 1. Create the full hjwall assets/workflows capability inventory.')
    expect(tasks).toContain('- [x] 2. Freeze migration order and Agent boundary.')
    expect(tasks).toContain('- [x] 3a. Audit current ToolRuntime and canvas tool coverage.')
    expect(backlog).toContain('机器可读的 `INV-AW-*` 能力清单')
  })
})
