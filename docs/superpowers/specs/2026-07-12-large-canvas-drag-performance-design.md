# Large Canvas Drag Performance Design

## Goal

Keep 2,000-node canvas drags responsive by ensuring a pointer-move update only
changes the dragged React Flow node and deferring non-visual work until drag
completion.

## Evidence

The canvas already uses React Flow visible-only rendering, but `displayNodes`
clones every node whenever related-node highlighting is active. During a drag,
that defeats React memoization for all visible nodes. The same drag also causes
the debounced React Flow-to-store persistence path to schedule work on every
position update even though the final drag-stop handler persists the result.

## Design

1. Extract a pure display-node projection that preserves each node object when
   its related highlight class is unchanged. A pointer move then changes only
   React Flow's dragged node object.
2. Track drag lifecycle separately from node data. While dragging, do not queue
   durable graph synchronization; on drag stop, write the final coordinates and
   invalidate exactly one pending renderer-to-store synchronization cycle.
3. Reduce drag-time auxiliary work: freeze related highlighting while the pointer
   is down and avoid rendering the interactive MiniMap during the drag. Restore
   both after drag stop.
4. Add a pure 2,000-node projection regression test proving unchanged nodes
   retain reference equality, plus shell-contract tests for drag-phase behavior.

## Non-goals

- Replacing React Flow or changing persisted graph schema.
- Dropping node data, edges, undo behavior, zoom behavior, or autosave.
- Creating a second canvas state store.
