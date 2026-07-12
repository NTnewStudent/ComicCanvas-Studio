// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'

import { cleanup, render, screen } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { afterEach, describe, expect, it } from 'vitest'

import {
  NodeEditorProvider,
  activeNodeEditorId,
  useNodeEditorOpen,
} from '../desktop/src/renderer/src/canvas/components/NodeEditorContext'

function Probe({ nodeId }: { nodeId: string }): JSX.Element {
  return <div data-testid={nodeId}>{useNodeEditorOpen(nodeId) ? 'open' : 'closed'}</div>
}

afterEach(() => cleanup())

describe('canvas node editor lifecycle', () => {
  it('opens an editor only when exactly one node is selected', () => {
    expect(activeNodeEditorId([])).toBeNull()
    expect(activeNodeEditorId(['node-a'])).toBe('node-a')
    expect(activeNodeEditorId(['node-a', 'node-b'])).toBeNull()
  })

  it('shares one active editor ID without node-level store subscriptions', () => {
    render(
      <NodeEditorProvider selectedNodeIds={['node-a']}>
        <Probe nodeId="node-a" />
        <Probe nodeId="node-b" />
      </NodeEditorProvider>,
    )

    expect(screen.getByTestId('node-a')).toHaveTextContent('open')
    expect(screen.getByTestId('node-b')).toHaveTextContent('closed')
  })

  it('wires the provider around React Flow with memoized selected node IDs', () => {
    const source = readFileSync('desktop/src/renderer/src/canvas/CanvasPage.tsx', 'utf8')

    expect(source).toContain("from './components/NodeEditorContext'")
    expect(source).toContain('<NodeEditorProvider selectedNodeIds={selectedNodeIds}>')
    expect(source).toContain('</NodeEditorProvider>')
  })
})
