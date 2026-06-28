import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const CANVAS_PAGE = 'desktop/src/renderer/src/canvas/CanvasPage.tsx'

describe('Task 26 canvas panels parity', () => {
  it('wires workflow, asset, character, style, run, and enabled chat panels into CanvasPage', () => {
    const source = readFileSync(CANVAS_PAGE, 'utf8')

    expect(source).toContain("from './components/WorkflowPanel'")
    expect(source).toContain("from './components/CharacterLibraryPanel'")
    expect(source).toContain("from './components/StyleLibraryPanel'")
    expect(source).not.toContain("from './components/BottomInputPanel'")
    expect(source).toContain('<WorkflowPanel')
    expect(source).toContain('<CanvasAssetPanel')
    expect(source).toContain('<CharacterLibraryPanel')
    expect(source).toContain('<StyleLibraryPanel')
    expect(source).toContain('<CanvasJobPanel')
    expect(source).not.toContain('<BottomInputPanel')
    expect(source).toContain('<CanvasChatBox')
    expect(source).not.toContain('agentEnabled={false}')
  })

  it('opens library panels as centered canvas modals instead of left-side drawers', () => {
    for (const panelFile of [
      'desktop/src/renderer/src/canvas/components/WorkflowPanel.tsx',
      'desktop/src/renderer/src/canvas/components/CharacterLibraryPanel.tsx',
      'desktop/src/renderer/src/canvas/components/StyleLibraryPanel.tsx',
    ]) {
      const source = readFileSync(panelFile, 'utf8')

      expect(source).toContain("from './CenteredCanvasPanel'")
      expect(source).toContain('<CenteredCanvasPanel')
      expect(source).not.toContain('left-[72px] top-4')
    }

    const shell = readFileSync('desktop/src/renderer/src/canvas/components/CenteredCanvasPanel.tsx', 'utf8')
    expect(shell).toContain('fixed inset-0')
    expect(shell).toContain('items-center justify-center')
    expect(shell).toContain('aria-modal="true"')
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

  it('keeps Agent routing available inside CanvasChatBox', () => {
    const source = readFileSync('desktop/src/renderer/src/canvas/components/CanvasChatBox.tsx', 'utf8')

    expect(source).toContain('agentEnabled')
    expect(source).toContain('AgentMentionPopover')
    expect(source).toContain('listAgents')
    expect(source).toContain('agentId: selectedAgent?.id')
    expect(source).toContain('disabled={!agentEnabled')
  })
})
