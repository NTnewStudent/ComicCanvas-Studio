import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const CANVAS_PAGE = 'desktop/src/renderer/src/canvas/CanvasPage.tsx'

describe('Task 21 canvas add-node paths', () => {
  it('exposes add-node commands through the command palette', () => {
    const source = readFileSync(CANVAS_PAGE, 'utf8')

    expect(source).toContain('ADDABLE_NODE_OPTIONS')
    expect(source).toContain("id: `add-node-${option.type}`")
    expect(source).toContain("label: `Add ${option.label}`")
    expect(source).toContain("keywords: ['add', 'node', option.type, option.label]")
    expect(source).toContain('run: () => handleAddNode(option.type)')
  })

  it('filters connect-to-create menu items to allowed targets before creating nodes', () => {
    const source = readFileSync(CANVAS_PAGE, 'utf8')

    expect(source).toContain('getAllowedConnectCreateOptions')
    expect(source).toContain('getConnectCreateNodeDefinitions(sourceNode.type)')
    expect(source).toContain('NODE_OPTION_ICONS[definition.type]')
    expect(source).toContain('getAllowedConnectCreateOptions(contextMenu.nodeId).map')
    expect(source).not.toContain('key={`connect-${opt.type}`}')
  })

  it('keeps all manual add paths wired to the same node creation helper', () => {
    const source = readFileSync(CANVAS_PAGE, 'utf8')

    expect(source).toContain('handleAddNodeAtContextMenu')
    expect(source).toContain('handleCreateConnectedNodeAtContextMenu')
    expect(source).toContain('screenToFlowPosition({ x: contextMenu.x, y: contextMenu.y })')
    expect(source).toContain('screenToFlowPosition({ x: contextMenu.x + 260, y: contextMenu.y })')
    expect(source).toContain('onClick={() => { handleAddNode(tool.type); setIsAddMenuOpen(false) }}')
    expect(source).toContain('onClick={() => { handleAddNode(opt.type); setIsAddMenuOpen(false) }}')
  })
})
