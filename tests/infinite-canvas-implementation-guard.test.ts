import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

describe('infinite canvas implementation guard', () => {
  it('keeps proven React Flow settings, precise placement, and durable viewport persistence wired', () => {
    const canvasPage = readFileSync('desktop/src/renderer/src/canvas/CanvasPage.tsx', 'utf8')
    const largeGraphGate = readFileSync('desktop/src/main/smoke/large-graph-performance-gate.ts', 'utf8')

    expect(canvasPage).toContain('onlyRenderVisibleElements')
    expect(canvasPage).toContain('<MiniMap position="bottom-right" pannable zoomable />')
    expect(canvasPage).toContain('screenToFlowPosition({ x: event.clientX, y: event.clientY })')
    expect(canvasPage).toContain('screenToFlowPosition({ x: contextMenu.x, y: contextMenu.y })')
    expect(canvasPage).toContain('onMoveEnd={handleViewportMoveEnd}')
    expect(canvasPage).toContain('canvasStore.getState().setViewport({ x: viewport.x, y: viewport.y, zoom: viewport.zoom })')
    expect(canvasPage).toContain('snapGrid={[20, 20]}')
    expect(canvasPage).toContain('minZoom={0.15}')
    expect(canvasPage).toContain('maxZoom={2}')
    expect(largeGraphGate).toContain('visibleNodeIds')
    expect(largeGraphGate).toContain('dragNode')
    expect(largeGraphGate).toContain('desktopAcceptanceClaimed: false')
  })
})
