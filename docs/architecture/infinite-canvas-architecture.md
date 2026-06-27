# Infinite Canvas Architecture

Task 61 records the architecture constraints for evolving the completed manual
workflow editor into an infinite canvas. This is an architecture note, not an
implementation switch. The Phase A acceptance gate still applies: infinite
canvas implementation and performance claims wait until manual assets/workflows
parity is accepted or explicitly deferred.

## Graph State Ownership

Zustand owns the durable graph snapshot: nodes, edges, viewport, undo/redo
history, save payloads, snippet insertion, and Agent/tool graph mutations.
React Flow owns transient viewport gestures, pending connection gestures, drag
previews, hover state, temporary selection presentation, and fit-view animation.

Durable graph mutations must enter through shared graph actions, ToolRuntime, or
service/repository calls. Renderer-only state may drive presentation, but it
must not become the source of persisted truth. Realtime job writeback and
autosave must patch the Zustand graph once, then let React Flow reconcile from
the store to avoid duplicate history entries and autosave races.

## Viewport Math

Viewport coordinates are stored as `{ x, y, zoom }` in the persisted graph. All
drop, context-menu, connect-to-create, snippet insertion, and Agent insertion
positions must be resolved with React Flow `screenToFlowPosition` or an
equivalent tested transform. The transform must account for zoom, pan offset,
device pixel ratio assumptions, and the current canvas container bounds.

Fit-view and animated pan are transient UI operations. Saving a graph stores the
resulting viewport only after the durable store accepts it; hover or animation
intermediate values are not graph versions.

## Virtualization Strategy

The first implementation should keep React Flow as the renderer and use its
visible-node rendering options where possible. A later virtualization layer may
skip expensive node internals outside the viewport, but it must preserve edge
anchors, handles, selection boxes, keyboard navigation, and minimap summaries.

Node components must have stable dimensions. Status badges, thumbnails, loading
states, hover menus, labels, and validation messages must not resize nodes in a
way that shifts graph layout. Expensive previews should degrade to lightweight
shells outside the visible-node query.

## Spatial Indexing

Large graph operations need a graph-domain spatial index owned outside React
component render. The index should support a visible-node query, nearest-anchor
placement, marquee selection, collision-aware insertion, minimap bounds, and
deterministic layout checks.

The initial index can be rebuilt from graph snapshots after durable changes.
If graph patches become frequent, the index should move to incremental updates
keyed by node ID and node bounding box.

## Selection Model

Selection has two layers. React Flow may own transient pointer selection during
drag or marquee gestures. Zustand owns durable selected IDs only when the
selection is used by commands such as duplicate, delete, extract snippet,
layout, Agent context, or reference highlighting.

Selection commands must operate on explicit node IDs and edge IDs. They must not
read DOM state or visual classes as truth. Undo/redo should restore graph
content, while transient hover and focus can reset safely.

## Minimap

The minimap is a navigation summary, not a second graph store. It should consume
the same graph snapshot and spatial bounds as the canvas. For large graphs, the
minimap may render simplified rectangles by node type/status and defer
thumbnails.

Minimap clicks and drags update viewport intent through the same viewport math
path used by fit-view and pan controls. Minimap interaction must not mutate node
positions or graph versions.

## Persistence And Autosave Invariants

Workflow persistence stores nodes, edges, viewport, graph version, validation
warnings, and restore metadata. Autosave must debounce durable graph changes,
coalesce rapid edits, and avoid saving transient hover, drag preview, or
animation-only states.

Large graph saves should eventually use graph patches or background
serialization so UI interactions are not blocked. Until then, save/load tests
must prove that persisted graphs restore node positions, edge semantics,
viewport, warning summaries, asset references, and job terminal writeback.

## Performance Gates

Task 62 should add 100, 500, and 1000 node gates where feasible. Gates should
cover render smoke, pan/zoom responsiveness, drag/selection behavior, fit-view,
save/load, snippet insertion, Agent/tool insertion layout, and memory-sensitive
preview degradation.

The current engineering gate is `large-graph-performance-gate.ts` with
`large-graph-performance-gates.test.ts`. It exercises 100, 500, and 1000 node
graphs, visible-node query stability, a drag mutation, a pan/zoom viewport,
and SQLite save/load reopen counts. It intentionally sets
`desktopAcceptanceClaimed` to false.

Performance tests may begin as deterministic smoke checks, then grow into
browser-based timing checks after the Phase A acceptance gate. Passing unit
tests alone must not be used as proof of real desktop infinite-canvas
acceptance.
