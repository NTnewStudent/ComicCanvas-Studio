import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { createCanvasStore } from '../desktop/src/renderer/src/canvas/store/canvas.store'

/**
 * Regression tests for `specs/hjwall-canvas-full-migration/tasks.md` task 7
 * ("Decide and document the renderer graph state ownership model").
 * @see docs/architecture/canvas-graph-state-ownership.md
 */

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

describe('canvas graph state ownership regressions', () => {
  it('does not push undo history for updateNodeData or bulk setNodes/setEdges (RF-sync) mutations', () => {
    const store = createStore()
    const id = store.getState().addNode('text', { x: 0, y: 0 })
    const pastAfterAdd = store.getState().past.length

    store.getState().updateNodeData(id, { content: 'edited by user' })
    expect(store.getState().past).toHaveLength(pastAfterAdd)

    // setNodes/setEdges simulate the debounced React-Flow -> store persist
    // sync (CanvasPage.tsx `persistToStore`), which intentionally must not
    // spam an undo entry per drag/keystroke frame.
    store.getState().setNodes(
      store.getState().nodes.map((node) => ({ ...node, position: { x: 999, y: 999 } })),
    )
    expect(store.getState().past).toHaveLength(pastAfterAdd)

    store.getState().setEdges([])
    expect(store.getState().past).toHaveLength(pastAfterAdd)
  })

  it('KNOWN GAP: redo() replays a frozen future snapshot and silently discards a realtime updateNodeData patch made after undo()', () => {
    // Documents docs/architecture/canvas-graph-state-ownership.md §4: realtime
    // job writeback calls updateNodeData() directly, which does not touch
    // past/future. If a realtime patch lands on a node between undo() and a
    // later redo(), redo() overwrites that node with the pre-patch value
    // captured in the frozen `future` snapshot -- the realtime patch is lost.
    // This test characterizes today's actual (lossy) behavior so any future
    // fix to undo/redo semantics is a deliberate, visible change to this test.
    const store = createStore()
    const nodeA = store.getState().addNode('text', { x: 0, y: 0 })
    store.getState().addNode('text', { x: 100, y: 0 })

    store.getState().undo() // removes the second node, freezes it into `future`

    // Simulate a realtime job terminal update landing on node A while a
    // redo entry is pending, exactly as CanvasPage's onJobCompleted/onJobFailed
    // handlers call canvasStore.getState().updateNodeData(...) directly.
    store.getState().updateNodeData(nodeA, { content: 'status: done' })
    expect(store.getState().nodes.find((node) => node.id === nodeA)?.data).toMatchObject({
      content: 'status: done',
    })

    store.getState().redo()

    // The realtime patch to node A is gone: redo() restored the frozen
    // snapshot taken before the patch existed.
    const restoredNodeA = store.getState().nodes.find((node) => node.id === nodeA)
    expect(restoredNodeA?.data).toMatchObject({ content: '' })
    expect(restoredNodeA?.data).not.toMatchObject({ content: 'status: done' })
  })

  it('KNOWN GAP: undo() replays a frozen past snapshot and silently discards a realtime updateNodeData patch made after the snapshot was taken', () => {
    // Same class of gap in the other direction: any node present in the
    // *target* snapshot of an undo()/redo() call loses realtime patches that
    // happened after that snapshot was captured, regardless of undo vs redo.
    const store = createStore()
    const nodeA = store.getState().addNode('text', { x: 0, y: 0 })
    store.getState().addNode('text', { x: 100, y: 0 }) // snapshot with nodeA (content: '') pushed to `past`

    store.getState().updateNodeData(nodeA, { content: 'status: done' })
    expect(store.getState().nodes.find((node) => node.id === nodeA)?.data).toMatchObject({
      content: 'status: done',
    })

    store.getState().undo()

    const restoredNodeA = store.getState().nodes.find((node) => node.id === nodeA)
    expect(restoredNodeA?.data).toMatchObject({ content: '' })
    expect(restoredNodeA?.data).not.toMatchObject({ content: 'status: done' })
  })

  it('keeps the autosave delay at least 2x the React-Flow -> store persist debounce (sync invariant 3)', () => {
    // docs/architecture/canvas-graph-state-ownership.md §3 invariant 3:
    // the autosave timer must stay meaningfully longer than the RF->store
    // persist debounce so a save reads a store snapshot that already
    // reflects the edit that triggered the save. This test parses both
    // constants out of CanvasPage.tsx so a future edit to either number is
    // caught if it breaks the >=2x relationship, without hardcoding both
    // values redundantly in the assertion itself.
    const source = readFileSync('desktop/src/renderer/src/canvas/CanvasPage.tsx', 'utf8')

    const persistDebounceMatch = source.match(/\}, 300\),\s*\n\s*\[\],\s*\n\s*\)/u)
    expect(persistDebounceMatch, 'expected to find the 300ms persistToStore debounce call').not.toBeNull()

    const autoSaveDelayMatch = source.match(/autoSaveTimerRef\.current = setTimeout\(\(\) => \{[\s\S]*?\}, (\d+)\)/u)
    expect(autoSaveDelayMatch, 'expected to find the autosave setTimeout delay').not.toBeNull()

    const persistDebounceMs = 300
    const autoSaveDelayMs = Number(autoSaveDelayMatch?.[1])

    expect(autoSaveDelayMs).toBeGreaterThanOrEqual(persistDebounceMs * 2)
  })
})
