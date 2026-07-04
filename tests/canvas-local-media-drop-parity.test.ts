import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const CANVAS_PAGE = 'desktop/src/renderer/src/canvas/CanvasPage.tsx'

describe('Task 23 canvas local media drop parity', () => {
  it('uses the shared batch planner instead of a first-file-only drop path', () => {
    const source = readFileSync(CANVAS_PAGE, 'utf8')

    expect(source).toContain("import { planLocalMediaDrops } from './lib/local-media-drop'")
    expect(source).toContain('const batchPlan = planLocalMediaDrops(files)')
    expect(source).toContain('for (const [index, plan] of batchPlan.plans.entries())')
    expect(source).not.toContain('const firstFile = files[0]')
  })

  it('imports each accepted file, creates nodes near the cursor, and reports rejected files', () => {
    const source = readFileSync(CANVAS_PAGE, 'utf8')

    expect(source).toContain('window.comicCanvas.importAsset({')
    expect(source).toContain('sourcePath: plan.sourcePath')
    expect(source).toContain('mediaType: plan.mediaType')
    expect(source).toContain('{ x: basePosition.x + index * 36, y: basePosition.y + index * 36 }')
    expect(source).toContain('batchPlan.rejected.length + failedCount')
    expect(source).toContain('个文件未导入')
  })
})
