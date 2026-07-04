import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const CANVAS_PAGE = 'desktop/src/renderer/src/canvas/CanvasPage.tsx'

describe('Task 20 canvas shell parity', () => {
  it('wires hjwall-style top bar actions into CanvasPage', () => {
    const source = readFileSync(CANVAS_PAGE, 'utf8')

    expect(source).toContain('data-testid="canvas-topbar"')
    expect(source).toContain('aria-label="Back to projects"')
    expect(source).toContain('aria-label="Import workflow JSON"')
    expect(source).toContain('aria-label="Export workflow JSON"')
    expect(source).toContain('aria-label="Save workflow"')
    expect(source).toContain('aria-label="Toggle job status"')
    expect(source).toContain('aria-label="Toggle theme"')
    expect(source).toContain('ProjectStyleSelector')
  })

  it('wires hjwall-style left toolbar panels and help affordances into CanvasPage', () => {
    const source = readFileSync(CANVAS_PAGE, 'utf8')

    expect(source).toContain('data-testid="canvas-left-toolbar"')
    expect(source).toContain('aria-label={isAddMenuOpen ? \'Close add menu\' : \'Add node\'}')
    expect(source).toContain('aria-label="Toggle asset library"')
    expect(source).toContain('aria-label="Toggle chat panel"')
    expect(source).toContain('aria-label="Toggle shortcut help"')
    expect(source).toContain('Canvas shortcuts')
    expect(source).toContain('Save workflow')
    expect(source).toContain('Command palette')
  })

  it('keeps viewport controls separate from creation tools', () => {
    const source = readFileSync(CANVAS_PAGE, 'utf8')

    expect(source).toContain('data-testid="canvas-viewport-toolbar"')
    expect(source).toContain('aria-label="Fit view"')
    expect(source).toContain('aria-label="Zoom out"')
    expect(source).toContain('aria-label="Zoom in"')
    expect(source).toContain('zoomIn()')
    expect(source).toContain('zoomOut()')
  })

  it('surfaces one-shot generation recovery feedback without polling', () => {
    const source = readFileSync(CANVAS_PAGE, 'utf8')

    expect(source).toContain('buildGenerationTaskStatusList(restoredNodes, jobs)')
    expect(source).toContain('setGenerationRecoveryFeedback')
    expect(source).toContain('data-testid="generation-recovery-feedback"')
    expect(source).not.toContain('setInterval')
  })
})
