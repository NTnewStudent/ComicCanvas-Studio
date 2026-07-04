import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const CANVAS_PAGE = 'desktop/src/renderer/src/canvas/CanvasPage.tsx'

describe('Task 25 semantic edge component parity', () => {
  it('registers semantic React Flow edge components and maps stored edge data to renderer types', () => {
    const source = readFileSync(CANVAS_PAGE, 'utf8')

    expect(source).toContain("from './edges/PromptOrderEdge'")
    expect(source).toContain("from './edges/ImageOrderEdge'")
    expect(source).toContain("from './edges/ImageRoleEdge'")
    expect(source).toContain("from './edges/DeletableBezierEdge'")
    expect(source).toContain('const edgeTypes')
    expect(source).toContain('promptOrder: PromptOrderEdge')
    expect(source).toContain('imageOrder: ImageOrderEdge')
    expect(source).toContain('imageRole: ImageRoleEdge')
    expect(source).toContain('outputLink: DeletableBezierEdge')
    expect(source).toContain('reference: DeletableBezierEdge')
    expect(source).toContain('type: edgeTypeForRenderer(e.data)')
    expect(source).toContain('edgeTypes={edgeTypes}')
  })

  it('keeps renderer edge components deletable through the shared canvas store', () => {
    const edgeFiles = [
      'desktop/src/renderer/src/canvas/edges/PromptOrderEdge.tsx',
      'desktop/src/renderer/src/canvas/edges/ImageOrderEdge.tsx',
      'desktop/src/renderer/src/canvas/edges/ImageRoleEdge.tsx',
      'desktop/src/renderer/src/canvas/edges/DeletableBezierEdge.tsx',
    ]

    for (const file of edgeFiles) {
      const source = readFileSync(file, 'utf8')
      expect(source).toContain('EdgeDeleteButton')
    }

    const sharedEdgeUi = readFileSync('desktop/src/renderer/src/canvas/edges/edge-ui.tsx', 'utf8')
    expect(sharedEdgeUi).toContain("from '../store/canvas.store'")
    expect(sharedEdgeUi).toContain('canvasStore.getState().deleteEdge(edgeId)')
  })
})
