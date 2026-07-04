import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const CANVAS_PAGE = 'desktop/src/renderer/src/canvas/CanvasPage.tsx'

describe('Task 26 canvas panels parity', () => {
  it('wires workflow, asset, character, style, run, bottom input, and gated chat panels into CanvasPage', () => {
    const source = readFileSync(CANVAS_PAGE, 'utf8')

    expect(source).toContain("from './components/WorkflowPanel'")
    expect(source).toContain("from './components/CharacterLibraryPanel'")
    expect(source).toContain("from './components/StyleLibraryPanel'")
    expect(source).toContain("from './components/BottomInputPanel'")
    expect(source).toContain('<WorkflowPanel')
    expect(source).toContain('<CanvasAssetPanel')
    expect(source).toContain('<CharacterLibraryPanel')
    expect(source).toContain('<StyleLibraryPanel')
    expect(source).toContain('<CanvasJobPanel')
    expect(source).toContain('<BottomInputPanel')
    expect(source).toContain('<CanvasChatBox')
    expect(source).toContain('agentEnabled={false}')
  })

  it('keeps canvas panel toggles visible from the shell toolbar', () => {
    const source = readFileSync(CANVAS_PAGE, 'utf8')

    expect(source).toContain('setShowWorkflowPanel')
    expect(source).toContain('setShowAssetPanel')
    expect(source).toContain('setShowCharacterPanel')
    expect(source).toContain('setShowStylePanel')
    expect(source).toContain('setShowJobPanel')
    expect(source).toContain('setShowChatBox')
  })

  it('documents the Agent phase gate inside CanvasChatBox', () => {
    const source = readFileSync('desktop/src/renderer/src/canvas/components/CanvasChatBox.tsx', 'utf8')

    expect(source).toContain('agentEnabled')
    expect(source).toContain('Agent 自动编排将在后续阶段启用')
    expect(source).toContain('disabled={!agentEnabled')
  })
})
