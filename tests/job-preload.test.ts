import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

describe('REQ-096 job preload bridge', () => {
  it('exposes typed job.list without raw ipcRenderer access', () => {
    const source = readFileSync('desktop/src/preload/index.ts', 'utf8')

    expect(source).toContain('listJobs')
    expect(source).toContain("invokeMain('job.list'")
    expect(source).toContain("function invokeMain<TChannel extends 'job.list'>")
  })

  it('wires the canvas page to the job list panel instead of leaving jobs developer-only', () => {
    const source = readFileSync('desktop/src/renderer/src/canvas/CanvasPage.tsx', 'utf8')

    expect(source).toContain("import { CanvasJobPanel }")
    expect(source).toContain('showJobPanel')
    expect(source).toContain('<CanvasJobPanel')
    expect(source).toContain('运行任务')
  })
  it('performs one-shot job reconciliation after loading a workflow without renderer polling', () => {
    const source = readFileSync('desktop/src/renderer/src/canvas/CanvasPage.tsx', 'utf8')

    expect(source).toContain("import { reconcileCanvasNodesWithJobs }")
    expect(source).toContain('window.comicCanvas.listJobs({ limit: 100 })')
    expect(source).toContain('reconcileCanvasNodesWithJobs(restoredNodes, jobs)')
    expect(source).not.toContain('setInterval(')
  })
})
