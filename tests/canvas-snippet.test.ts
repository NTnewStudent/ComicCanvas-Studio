import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { createCanvasStore } from '../desktop/src/renderer/src/canvas/store/canvas.store'
import { extractCanvasSnippet, insertCanvasSnippet } from '../desktop/src/renderer/src/canvas/lib/canvas-snippet'
import type { CanvasStoreState } from '../desktop/src/renderer/src/canvas/store/canvas.store'

function createStore(): ReturnType<typeof createCanvasStore> {
  return createCanvasStore({
    idFactory: (() => {
      let index = 0
      return () => `node-${++index}`
    })(),
    edgeIdFactory: (source, target) => `edge-${source}-${target}`,
    clock: () => 1_782_700_000_000,
  })
}

function snapshotCounts(state: CanvasStoreState): { nodes: number; edges: number; past: number; future: number } {
  return {
    nodes: state.nodes.length,
    edges: state.edges.length,
    past: state.past.length,
    future: state.future.length,
  }
}

describe('REQ-092 canvas snippets', () => {
  it('extracts only the selected internal subgraph with normalized positions', () => {
    const store = createStore()
    const text = store.getState().addNode('text', { x: 100, y: 120 }, { content: 'Panel prompt' })
    const image = store.getState().addNode('image', { x: 420, y: 160 }, { promptOverride: 'Rainy alley' })
    const video = store.getState().addNode('video', { x: 780, y: 160 })
    store.getState().addEdge(text, image)
    store.getState().addEdge(image, video)

    const snippet = extractCanvasSnippet({
      name: 'Rainy panel',
      graph: store.getState(),
      selectedNodeIds: [text, image],
      createdAt: 1_782_700_000_001,
    })

    expect(snippet).toMatchObject({
      schemaVersion: 1,
      name: 'Rainy panel',
      createdAt: 1_782_700_000_001,
    })
    expect(snippet.nodes.map((node) => node.id)).toEqual([text, image])
    expect(snippet.edges.map((edge) => edge.id)).toEqual([`edge-${text}-${image}`])
    expect(snippet.nodes.map((node) => node.position)).toEqual([
      { x: 0, y: 0 },
      { x: 320, y: 40 },
    ])
  })

  it('rejects snippet extraction unless at least two nodes are selected', () => {
    const store = createStore()
    const text = store.getState().addNode('text', { x: 0, y: 0 })

    expect(() =>
      extractCanvasSnippet({
        name: 'Too small',
        graph: store.getState(),
        selectedNodeIds: [text],
        createdAt: 1,
      })
    ).toThrow('snippet_requires_at_least_two_nodes')
  })

  it('inserts a snippet with remapped IDs and one undo snapshot', () => {
    const store = createStore()
    const text = store.getState().addNode('text', { x: 100, y: 120 }, { content: 'Panel prompt' })
    const image = store.getState().addNode('image', { x: 420, y: 160 }, { promptOverride: 'Rainy alley' })
    store.getState().addEdge(text, image)
    const snippet = extractCanvasSnippet({
      name: 'Rainy panel',
      graph: store.getState(),
      selectedNodeIds: [text, image],
      createdAt: 1,
    })
    const before = snapshotCounts(store.getState())

    const inserted = insertCanvasSnippet(snippet, store, {
      origin: { x: 900, y: 500 },
      nodeIdFactory: (node, index) => `snippet-node-${index}-${node.id}`,
      edgeIdFactory: (edge, index) => `snippet-edge-${index}-${edge.id}`,
    })

    expect(inserted.nodeIds).toEqual([`snippet-node-0-${text}`, `snippet-node-1-${image}`])
    expect(inserted.edgeIds).toEqual([`snippet-edge-0-edge-${text}-${image}`])
    expect(snapshotCounts(store.getState())).toEqual({
      nodes: before.nodes + 2,
      edges: before.edges + 1,
      past: before.past + 1,
      future: 0,
    })
    expect(store.getState().nodes.slice(-2).map((node) => node.position)).toEqual([
      { x: 900, y: 500 },
      { x: 1220, y: 540 },
    ])
    expect(store.getState().edges.at(-1)).toMatchObject({
      id: `snippet-edge-0-edge-${text}-${image}`,
      source: `snippet-node-0-${text}`,
      target: `snippet-node-1-${image}`,
    })

    store.getState().undo()
    expect(snapshotCounts(store.getState())).toEqual({
      ...before,
      future: before.future + 1,
    })
  })

  it('wires snippet save and insert actions into the canvas page', () => {
    const source = readFileSync('desktop/src/renderer/src/canvas/CanvasPage.tsx', 'utf8')

    expect(source).toContain("from './lib/canvas-snippet'")
    expect(source).toContain('listCanvasSnippets')
    expect(source).toContain('saveCanvasSnippet')
    expect(source).toContain('extractCanvasSnippet({')
    expect(source).toContain('selectedNodeIds')
    expect(source).toContain('insertCanvasSnippet(')
    expect(source).toContain('aria-label="片段库"')
    expect(source).toContain('保存片段')
    expect(source).toContain('插入片段')
  })
})
