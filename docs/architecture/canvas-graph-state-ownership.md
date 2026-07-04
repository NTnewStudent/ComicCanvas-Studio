# Canvas Renderer Graph State Ownership Model

> Status: design note fulfilling `specs/hjwall-canvas-full-migration/tasks.md`
> task 7 ("Decide and document the renderer graph state ownership model").
> Scope: reconciles the aspirational model in
> `docs/architecture/infinite-canvas-architecture.md` §"Graph State Ownership"
> with the actual dual-write implementation in
> `desktop/src/renderer/src/canvas/CanvasPage.tsx` and
> `desktop/src/renderer/src/canvas/store/canvas.store.ts` as of 2026-07-04.
> Requirements: R3, R9.

## 1. Current implementation (as-built)

There are two live copies of the graph in the renderer:

- **Zustand (`canvasStore`)** — the durable snapshot: `nodes`, `edges`,
  `viewport`, `past`/`future` undo history (capped at 50, `canvas.store.ts:81`),
  and `nodeRunStatus` (a `Map`, explicitly excluded from undo/redo,
  `canvas.store.ts:60-61`). Structural actions (`addNode`, `deleteNode`,
  `addEdge`, `deleteEdge`, `applyChange`) push one history entry each via
  `pushHistory` (`canvas.store.ts:95-100`). `updateNodeData` and the bulk
  `setNodes`/`setEdges` replacers do **not** push history.
- **React Flow local state (`rfNodes`/`rfEdges`)** — created by
  `useNodesState`/`useEdgesState` (`CanvasPage.tsx:514-515`), seeded once from
  the store on mount (`:506-513`). `onNodesChange`/`onEdgesChange` from these
  hooks are wired directly to `<ReactFlow>` (`:1717-1718`), so every drag,
  resize, and selection change mutates this copy first, not the store.

Sync between the two copies is bidirectional and both directions are
independently debounced/guarded:

- **RF → Zustand**: `persistToStore` (`:660-684`) is `debounce(..., 300ms)`,
  fired from a `useEffect` on `[rfNodes, rfEdges]` (`:686-690`). It calls
  `setNodes`/`setEdges`, which is a bulk replace with **no history entry** —
  by design, so that every keystroke/drag frame doesn't spam undo.
- **Zustand → RF**: `syncReactFlowFromStore` (`:539-544`) sets a
  `skipNextPersistRef` guard, then calls `setRfNodes`/`setRfEdges` from the
  store snapshot. The guard is checked once inside `persistToStore` (`:662`)
  to swallow the echo that would otherwise fire from the sync's own RF update.

Two mutation paths bypass this round trip entirely:

- **Direct store writes from CanvasPage**: `handleNodeDragStop` (`:963-981`),
  `handleAddNode` (`:1000-1046`), and `appendAssetNode` (`:1417-1425`) call
  `canvasStore.setState(...)` directly instead of the store's own `addNode`/
  `updateNodeData` actions, duplicating the store's history/clone logic inline
  in the component rather than reusing it.
- **Realtime job terminal writeback**: `onJobCompleted`/`onJobFailed`
  (`:717-744`) call `canvasStore.getState().updateNodeData(...)` directly, then
  call `syncReactFlowFromStore()` immediately — store first, RF second, with
  no debounce. This is the inverse order from user edits (RF first, store
  second after 300ms).

Autosave (`:803-814`) is a third, independent timer: a 2000ms `setTimeout`
reset on every `[rfNodes, rfEdges]` change, firing `handleSave()` only if
`isDirtyRef.current` is true. `isDirtyRef` is set on the `persistToStore`
effect and on viewport move, cleared after a successful save or fresh load.
`handleSave` reads `canvasStore.getState()` (not `rfNodes`/`rfEdges`) — so the
autosave *trigger* watches RF-local state but the *payload* is whatever the
store currently holds, which depends on the 300ms RF→store debounce having
already flushed.

`useCanvasRealtime()` (`use-canvas-realtime.ts`) is unrelated to graph state:
it only invalidates TanStack Query caches for asset/job list queries and never
touches `canvasStore` or RF-local state.

## 2. Ownership model (binding going forward)

This section is the decision, not a description of a future rewrite. New code
must follow it; existing deviations are tracked as gaps in §4.

- **Zustand (`canvasStore`) is the single source of durable truth.** Anything
  that must survive a reload, feed a save payload, appear in undo/redo, or be
  visible to another subsystem (Agent tools, job writeback, snippet insertion)
  must live in the store and be read from `canvasStore.getState()`, never
  inferred from `rfNodes`/`rfEdges`.
- **React Flow local state is a rendering cache, not a second model.** It may
  lag the store by up to one debounce cycle. No code may treat `rfNodes`/
  `rfEdges` as authoritative for anything other than the immediate frame being
  painted (drag preview, live selection box, in-progress connection line).
- **All durable mutations enter through one of three doors**: the store's own
  actions (`addNode`/`deleteNode`/`updateNodeData`/`addEdge`/`deleteEdge`/
  `applyChange`), shared graph actions in `shared/canvas-actions.ts` (used by
  Tool/Agent paths), or the debounced RF→store sync. Component code must not
  call `canvasStore.setState(...)` directly — that bypasses `pushHistory` and
  risks writing a shape the store's own actions would have normalized.
- **Undo/redo covers structural changes only, by design.** Node/edge add,
  delete, connect, and full-snapshot apply are undo-visible; per-field data
  edits (`updateNodeData`, including job-driven status/asset patches) and
  bulk RF-sync replacement (`setNodes`/`setEdges`) are not. This matches user
  expectation that typing in a text node or a background job finishing should
  not eat an undo slot for an unrelated structural action, but it means a
  user can't undo "job finished and overwrote my placeholder" — accepted as
  intentional for this phase.
- **Realtime job writeback must go store-first, then reconcile RF**, exactly
  as `onJobCompleted`/`onJobFailed` already do — this ordering is correct and
  should be the template for any new realtime-driven mutation, precisely
  because RF is a rendering cache of the store and not vice versa.
- **Autosave must always save the store snapshot**, never `rfNodes`/`rfEdges`
  directly, since only the store applies the shared graph-action
  normalization. The dirty flag may watch RF-local changes as a cheap "did
  anything change" signal, but the save payload must come from
  `canvasStore.getState()`.

## 3. Sync invariants

1. A RF-local change is reflected in the store within one `persistToStore`
   debounce window (300ms) unless it is the echo of a store→RF sync (guarded
   by `skipNextPersistRef`).
2. A store change driven by realtime job writeback, undo/redo, or an Agent
   tool call is reflected in RF-local state synchronously via
   `syncReactFlowFromStore`, with no debounce, so the canvas never visibly
   lags a job completing or an undo firing.
3. Autosave must only read the store after invariant (1) has had a chance to
   flush: the autosave timer's 2000ms is intentionally longer than the
   persist debounce's 300ms so a save started at the timer boundary reads a
   store snapshot that already reflects the triggering edit. Any change that
   shortens the autosave delay below ~2x the persist debounce should be
   treated as a regression risk to this invariant, not just a UX tweak.
4. `nodeRunStatus` and undo history are store-local concerns; RF never reads
   or writes them directly.

## 4. Known gaps (tracked, not fixed by this note)

- `handleNodeDragStop`, `handleAddNode`, and `appendAssetNode` write to the
  store via `canvasStore.setState(...)` instead of the store's public
  actions. This works today but duplicates `pushHistory`/clone logic in
  `CanvasPage.tsx` and will drift if the store's internal snapshot shape
  changes. Follow-up: refactor these three call sites onto the store's own
  actions (or add the missing action, e.g. a `moveNode` action for drag-stop).
- `skipNextPersistRef` is a single boolean with no queue. Two
  `syncReactFlowFromStore()` calls in quick succession (e.g. undo immediately
  followed by a job terminal event) before the 300ms debounce fires could in
  principle have the second sync's guard consumed by the debounce meant for
  the first. Both syncs push the *current* store snapshot, so the likely
  practical effect is benign (RF ends up matching the latest store state
  either way), but this is untested and should not be assumed safe under
  future changes that make `syncReactFlowFromStore` payload-dependent.
- No test exercises interleaved races: "autosave fires while an undo is in
  flight," or "a realtime job update arrives mid-undo." `tests/canvas-store.
  test.ts` and `tests/canvas-job-reconciliation.test.ts` test undo and job
  reconciliation in isolation; `tests/canvas-realtime-invalidation.test.ts`
  only covers query-cache invalidation, not graph mutation ordering.
- The autosave delay (2000ms) and RF→store persist delay (300ms) are two
  independent, uncoordinated timers. If the autosave delay were ever reduced
  below roughly 2x the persist debounce, a save could race ahead of the RF
  edit that triggered it. There is currently no assertion that ties these two
  constants together.

## 5. Follow-up tasks

- Add regression tests for the interleavings in §4 (undo-during-autosave,
  realtime-update-during-undo) once a maintainer decides whether the current
  "likely benign" behavior should be locked in or hardened further.
- Refactor `handleNodeDragStop`/`handleAddNode`/`appendAssetNode` onto store
  actions to remove the direct `canvasStore.setState()` calls from
  `CanvasPage.tsx`.
- Consider a named constant (not two independent magic numbers) linking the
  autosave delay to the persist debounce so future changes can't silently
  violate invariant 3 above.
