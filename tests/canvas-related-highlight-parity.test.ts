import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const CANVAS_PAGE = 'desktop/src/renderer/src/canvas/CanvasPage.tsx'

describe('Task 24 canvas related highlight parity', () => {
  it('wires direct graph neighbor highlighting into CanvasPage hover, selection, and drag release', () => {
    const source = readFileSync(CANVAS_PAGE, 'utf8')

    expect(source).toContain("from './lib/related-highlight'")
    expect(source).toContain('computeRelatedNodeIds(focusedNodeId, rfEdges)')
    expect(source).toContain("import { EMPTY_RELATED_NODE_IDS, projectDisplayNodes } from './lib/display-nodes'")
    expect(source).toContain('projectDisplayNodes(rfNodes, isDraggingNode ? EMPTY_RELATED_NODE_IDS : relatedNodeIds)')
    expect(source).toContain('const handleNodeMouseEnter')
    expect(source).toContain('const handleNodeMouseLeave')
    expect(source).toContain('setFocusedRelatedNodeId(node.id)')
    expect(source).toContain('nodes={displayNodes}')
    expect(source).toContain('onNodeMouseEnter={handleNodeMouseEnter}')
    expect(source).toContain('onNodeMouseLeave={handleNodeMouseLeave}')
  })
})
