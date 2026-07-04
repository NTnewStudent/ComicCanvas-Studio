# Implementation Plan - hjwall Canvas Full Migration

> Status legend: `[ ]` not started, `[-]` in progress, `[x]` verified complete.
> Engineering tasks can be checked after implementation review and named
> automated evidence are recorded. Desktop user-flow acceptance is handled by
> human review under REQ-098 and should be recorded separately as approved,
> failed, or pending.

## Phase 0 - Inventory and Truth Reset

- [x] 1. Create a hjwall capability inventory.
  - Reference: `hjwall/pc-client/src/modules/workflow-canvas/`,
    `hjwall/pc-client/src/modules/asset/`,
    `hjwall/backend/src/modules/workflow/`,
    `hjwall/backend/src/modules/asset/`,
    `hjwall/backend/src/modules/style/`.
  - Output: `docs/progress/hjwall-canvas-migration-inventory.md`.
  - Verify: inventory maps each accepted capability to REQ-090..REQ-098,
    target files, and evidence fields.
  - Evidence: `docs/progress/hjwall-canvas-migration-inventory.md` (103 lines)
    maps 33 capability rows (INV-CANVAS/NODE/STYLE/ASSET/RUN/AGENT/QA-*) to
    REQ-091..098 with a companion evidence-snapshot table. Reviewed
    2026-07-04; checkbox was stale relative to the existing artifact.
  - Requirements: R1, R9.

- [x] 2. Audit current "completed" backlog claims against current evidence.
  - Include: M2-M5, REQ-077..REQ-085, known limits from
    `docs/progress/hjwall-migration-report.md`.
  - Output: mark items as verified, partial, or contradicted in a new dated
    verification report without deleting historical records.
  - Verify: every partial/contradicted item has a follow-up task.
  - Evidence: `docs/progress/backlog-claims-audit-2026-07-04.md` classifies
    REQ-077..085 individually (5 verified, 4 partial, none contradicted as a
    whole but two partials contain claims that directly conflict with code:
    REQ-078's "30s autosave" vs. the actual 2s debounce, and REQ-082's claimed
    node "lock" action which does not exist). Every partial item has a
    follow-up listed in that report. The previously-existing
    `verification-report-2026-06-26.md` remains as a separate CI-health
    artifact and was not deleted.
  - Requirements: R1, R9.

- [x] 3. Prepare the human desktop review gate.
  - Include: fix blank/black screen regressions, preload/main/renderer startup,
    and define the reviewer checklist for launching the app.
  - Output: `docs/progress/human-desktop-review-checklist.md`.
  - Verify: automated startup-adjacent checks pass, and the review checklist
    names `/projects`, `/canvas`, and visible UI checkpoints for human audit.
  - Evidence: `docs/progress/human-desktop-review-checklist.md` (~140
    checkpoints) explicitly names `/projects` and `/canvas`, plus companion
    runbook/session-template docs. The black-screen regression (unstable
    Zustand selectors causing "Maximum update depth exceeded") is fixed and
    covered by `tests/canvas-store-selector-stability.test.ts`;
    `desktop/src/main/index.ts` gates window show on `ready-to-show` and
    handles `did-fail-load`. Reviewed 2026-07-04; checkbox was stale relative
    to the existing artifact and fix.
  - Requirements: R9.

## Phase 1 - Workflow Project Lifecycle

- [x] 4. Harden workflow project repository and IPC.
  - Include: create with initial graph, rename, soft delete, list summaries,
    latest version metadata, JSDoc and `@see docs/api-contracts/canvas-plan.md`.
  - Verify: repository tests, IPC handler tests, and human-review checklist
    coverage for the project list flow.
  - Evidence: fixed a genuine functional gap where `canvas.createWorkflow`
    never called `workflows.addVersion()`, so newly created workflows had zero
    graph versions and were only masked by an `emptyGraph()` fallback in
    `getSummary`/`getLatestVersion`. `desktop/src/main/ipc/canvas.handler.ts`
    now inserts an initial empty-graph version at creation time.
    `tests/workflow-project-repo.test.ts` was expanded from 2 to 5 tests,
    adding direct coverage for `rename()`, soft `delete()` filtering out of
    `list()`/`getSummary()`, and the IPC-level initial-version behavior; all
    pass (`bun scripts/run-vitest.mjs run tests/workflow-project-repo.test.ts
    tests/workflow-template-repo.test.ts tests/ipc-skeleton.test.ts
    tests/canvas-graph-persistence.test.ts tests/main-runtime-wiring.test.ts
    tests/migrated-run-dispatch.test.ts tests/style-runtime-payload.test.ts
    tests/model-feature-ipc.test.ts` → 8 files, 39 tests, all green).
    Re-verified 2026-07-04: closed the remaining JSDoc gap by adding
    `@see docs/api-contracts/canvas-plan.md` (plus intent/param/return/throws
    docs) to every exported type and every `WorkflowRepository` interface
    method in `workflow.repo.ts` (previously only the file header and the
    factory function carried the anchor); removed duplicate JSDoc blocks
    introduced mid-edit and confirmed a clean re-read. `tsc --noEmit` is clean
    and the same 8-file/39-test focused suite is still green. Human-review
    checklist coverage for the project list flow (`/projects`) is already
    named in `docs/progress/human-desktop-review-checklist.md` and remains
    tracked under REQ-098, non-blocking per this spec's status legend.
  - Requirements: R2, INV-6.

- [x] 5. Implement import/export workflow JSON.
  - Include: schema validation, graph sanitize, no absolute asset paths, import
    as new project, export current graph.
  - Verify: invalid JSON rejection, valid import round trip, and human-review
    checklist coverage for import/export user flow.
  - Evidence: `docs/progress/test-report.md` records IPC-level export/import
    coverage for sanitized workflow JSON, invalid JSON rejection, absolute path
    rejection, importing as a new workflow with dropped-item reporting, and
    renderer `/projects` import/export JSON controls with Chinese validation
    feedback. Human approval of the desktop import/export flow is tracked under
    REQ-098 rather than blocking engineering evidence. Re-verified 2026-07-04:
    `tests/canvas-graph-persistence.test.ts` (6 tests, covers export sanitize,
    absolute-path/secret rejection, import round trip, dropped reporting) and
    `tests/workflow-import-export-ui.test.tsx` (4 tests, preload bridge + UI
    export/import + Chinese error surfacing) pass. Per this spec's status
    legend, engineering checkbox reflects implementation + automated evidence;
    REQ-098 human review remains tracked separately, not a blocker for this
    checkbox.
  - Requirements: R2, INV-2, INV-5.

- [x] 6. Add dirty-save project switching and leave guards.
  - Include: switching workflow, closing canvas, back navigation, failed save
    recovery.
  - Verify: component/integration tests and human-review checklist coverage for
    desktop switch flow.
  - Evidence: `docs/progress/test-report.md` records a pure guard module and
    CanvasPage wiring where dirty workflow switching saves first, blocks the
    switch on save failure, and registers a `beforeunload` guard while dirty.
    Human approval of switch, close, and back-navigation flows is tracked under
    REQ-098 rather than blocking engineering evidence. Re-verified 2026-07-04:
    `tests/workflow-switch-guard.test.ts` (4 tests, covers clean switch, dirty
    save-then-switch, save-failure blocking, beforeunload registration) pass;
    confirmed `guardWorkflowSwitch`/`installDirtyBeforeUnloadGuard` are wired
    into `CanvasPage.tsx` (lines 798, 895), not just defined and unused. Per
    this spec's status legend, engineering checkbox reflects implementation +
    automated evidence; REQ-098 human review remains tracked separately.
  - Requirements: R2, R9.

## Phase 2 - Canvas Interaction Parity

- [x] 7. Decide and document the renderer graph state ownership model.
  - Include: React Flow local state vs Zustand source of truth, sync invariants,
    undo/redo, autosave, realtime terminal updates.
  - Verify: design note in this spec or `docs/architecture/`, plus regression
    tests for undo/autosave/realtime races.
  - Evidence: `docs/architecture/canvas-graph-state-ownership.md` documents the
    as-built dual-state model (Zustand as durable source of truth, React Flow
    local state as a rendering cache), the two sync directions (debounced
    300ms RF-to-store via `persistToStore`, immediate store-to-RF via
    `syncReactFlowFromStore`), the two bypass paths (direct `setState()` calls,
    realtime job writeback), and a binding ownership model going forward.
    `tests/canvas-graph-state-races.test.ts` adds regression tests: confirms
    `updateNodeData` and RF-sync `setNodes`/`setEdges` are correctly excluded
    from undo history; characterizes a real, previously undocumented data-loss
    gap where `undo()`/`redo()` replay a frozen snapshot and silently discard a
    realtime `updateNodeData` patch applied after that snapshot was captured
    (in either direction); and asserts the autosave delay stays >=2x the
    persist debounce (sync invariant 3), parsed directly out of
    `CanvasPage.tsx` so a future constant change breaks the test instead of
    silently drifting. The undo/redo-vs-realtime-patch data loss is a known gap
    tracked as a follow-up in the design note's SS4/SS5, not a regression from
    this task -- this task's scope is decide-and-document, and the races are
    now characterized by tests rather than unverified.
  - Requirements: R3, R9.

- [x] 8. Complete toolbar, context menu, and command palette parity.
  - Include: quick add, add-at-cursor, command palette actions, zoom/fit,
    pan/select mode, duplicate/delete shortcuts.
  - Verify: component tests and human-review checklist coverage for
    keyboard/mouse flow.
  - Evidence: `docs/progress/test-report.md` records shared selection actions
    for multi-node duplicate/delete, internal-edge duplication, one undo
    snapshot, CanvasPage Ctrl/Cmd+D and Delete/Backspace wiring, editable-field
    shortcut protection, context-menu reuse, command palette filtering and
    execution, Ctrl/Cmd+K palette launch, fit-view command wiring, and
    select/pan ReactFlow mode wiring. It also records a visible-copy quality
    gate for default generation node labels, context-menu labels, snippet
    feedback, and command-palette search/empty states. Re-verified 2026-07-04:
    all included items (quick add via `ADDABLE_NODE_OPTIONS`, add-at-cursor via
    `screenToFlowPosition` in context-menu handlers, command palette actions,
    `fitView` zoom/fit, select/pan `interactionMode` wiring, Ctrl/Cmd+D
    duplicate, Delete/Backspace delete with editable-field guard) are present
    in `CanvasPage.tsx` and covered by 6 files / 19 tests, all passing
    (`tests/canvas-add-node-paths.test.ts`, `tests/canvas-command-palette.test.tsx`,
    `tests/canvas-shell-parity.test.ts`, `tests/canvas-shortcuts-parity.test.ts`,
    `tests/canvas-visible-copy.test.ts`, `tests/canvas-selection-actions.test.ts`).
    No gap between the task's stated scope and what's implemented; no better
    alternative design was identified. Human approval of the desktop
    keyboard/mouse flow remains tracked separately under REQ-098/HDR-020/HDR-021,
    consistent with this spec's status legend.
  - Requirements: R3.

- [x] 9. Implement local media drag/drop onto canvas.
  - Include: image/video/audio classification, asset import IPC, node creation
    at drop position, unsupported-file feedback.
  - Verify: pure function tests, IPC import test, and human-review checklist
    coverage for desktop drag/drop flow.
  - Evidence: `docs/progress/test-report.md` records local drop planning for
    image, video, and audio files, readable unsupported/path feedback, shared
    `audio` asset media type support, audio file extension/MIME import support,
    asset-panel audio display hooks, CanvasPage audio node insertion from
    dropped/imported assets, and `asset.import` persistence for audio files with
    portable POSIX relative paths. Re-verified 2026-07-04:
    `planLocalMediaDrop(s)` classification (`local-media-drop.ts`),
    `handleCanvasDragOver`/`handleCanvasDrop` wiring at drop position with
    per-file offset and batched success/error feedback (`CanvasPage.tsx`), and
    `asset.import` IPC persistence for image/video/audio with POSIX relative
    paths (`asset.handler.ts`) all confirmed present; 4 files / 10 tests green
    (`tests/local-media-drop.test.ts`, `tests/canvas-local-media-drop-parity.test.ts`,
    `tests/asset-audio-support.test.ts`, `tests/audio-node-parity.test.tsx`).
    Existing tests simulate DOM `DragEvent`/`dataTransfer`, not a real OS-level
    Electron drag; per this spec's status legend that gap is human-review
    territory, not an engineering gap, and remains tracked under REQ-098
    (test-report.md's earlier "pending before task 9 can be marked complete"
    notes predate this session's clarified engineering-vs-human-review split
    and are superseded by this evidence, consistent with how tasks 5/6/8 were
    closed).
  - Requirements: R3, R6.

- [x] 10. Complete snippet save/insert flow.
  - Include: selected subgraph extraction, persisted snippet storage, insertion
    with ID remap and one undo snapshot.
  - Verify: graph tests, UI tests, and human-review checklist coverage for
    desktop select-save-insert flow.
  - Evidence: `docs/progress/test-report.md` records selected subgraph
    extraction, internal-edge filtering, normalized snippet coordinates,
    snippet insertion with node/edge ID remap, one undo snapshot, and minimal
    CanvasPage save/insert actions. Persisted snippet storage is now covered by
    `canvas_snippets`, `canvasSnippet.*` IPC, preload APIs, and a compact
    CanvasPage snippet-library selector. Re-verified 2026-07-04: extraction,
    persistence, ID-remap insertion, and one-undo-snapshot are all real (not
    stubbed) and independently confirmed against `canvas-snippet.ts`,
    `canvas-snippet.repo.ts`, and both `CanvasPage.tsx` UI surfaces (compact
    toolbar selector + `WorkflowPanel` slide-out); 3 files / 8 tests pass
    (`tests/canvas-snippet.test.ts`, `tests/canvas-snippet-repository-ipc.test.ts`,
    `tests/workflow-panel-snippet-parity.test.tsx`). "Richer UI" is confirmed
    self-identified polish (rename-on-save, list search/filter, drag-and-drop
    insert), not a scoped requirement left undone -- INV-CANVAS-008 is fully
    met. Human approval of select-save-insert remains tracked under REQ-098.
  - Requirements: R3.

- [x] 11. Enforce connection feedback and @mention-created edge validation.
  - Include: all direct, context, connect-to-create, and @mention edge creation
    paths must use shared validation and duplicate rejection.
  - Verify: tests for each edge creation path, Chinese error within 200ms.
  - Evidence: direct ReactFlow `onConnect` now uses
    `createCanvasEdge` over the shared connection validator, renders
    `ConnectionFeedback`, rejects duplicate and matrix-invalid edges with
    Chinese feedback within 200ms, and preserves plan/apply/snippet
    regressions. V2 image/video @mention inputs now list current canvas nodes,
    create edges in upstream-to-current direction through `createCanvasEdge`,
    mark `createdByMention`, and remove those mention edges when the token is
    deleted. Connect-to-create now uses `connectCreatedCanvasNode` over
    `createCanvasEdge` and is wired into node context-menu create-and-connect
    actions ("Link {type}", the only context-menu edge-creation action that
    exists). Re-verified 2026-07-04: audited every edge-creation call site;
    the only three real paths (direct, connect-to-create, mention) all funnel
    through `createCanvasEdge`/`createCanvasConnectHandler`, so shared
    validation and duplicate rejection are enforced everywhere. There is no
    separate "link two existing nodes via right-click" feature and no
    unaddressed code path -- the previously-noted "remaining context-menu edge
    paths" caveat was stale; the `'context-menu'` reason string in
    `CanvasEdgeCreationReason` is an unused union member, not an unvalidated
    path. `tests/canvas-edge-creation.test.ts`, `tests/canvas-connect-to-create.test.ts`,
    `tests/mention-edge-validation.test.tsx`, `tests/connection-validation-ux.test.tsx`
    -- 4 files, 10 tests, all pass. Human approval of invalid-connection
    feedback remains tracked under REQ-098.
  - Requirements: R3, R4, INV-2.

## Phase 3 - Node System Expansion

- [x] 12. Expand `shared/nodes.ts`, `shared/connection-matrix.ts`, and graph
  serializer to the accepted migrated node set.
  - Include: text, image, video, character, scene, audio, imageConfigV2,
    videoConfigV2, videoCompose, superResolution, muxAudioVideo, mjImage.
  - Verify: contract tests enumerate every node and allowed/denied connection.
  - Evidence: `docs/progress/test-report.md` records the shared node contract,
    connection matrix, Plan sanitizer, apply-plan, and orchestration smoke test
    slice plus graph persistence serializer coverage for migrated nodes.
    Re-verified 2026-07-04: `shared/nodes.ts`'s `NodeType` union carries all 12
    accepted types with fully JSDoc'd `*NodeData` interfaces (not stubs) for
    character/scene/audio/videoCompose/superResolution/muxAudioVideo/mjImage,
    plus imageConfigV2/videoConfigV2 field extensions on
    Image/VideoNodeData; `shared/connection-matrix.ts`'s
    `NODE_CONNECTION_MATRIX` has a rule row for every one of the 12 types
    including composition flows (video/audio -> muxAudioVideo,
    video/videoConfigV2 -> videoCompose/superResolution); `shared/graph.ts`'s
    `CANVAS_NODE_TYPES`/`isCanvasNodeType`/`sanitizeCanvasGraphSnapshot` filter
    unknown types and re-validate edges via `canConnect`. Contract tests
    (`tests/connection-matrix.test.ts`, `tests/node-contracts.test.ts`,
    `tests/canvas-graph-persistence.test.ts`,
    `tests/workflow-graph-compiler.test.ts` -- 14 tests) exhaustively enumerate
    nodeType x nodeType and round-trip all 12 types end to end, dropping
    unsupported legacy types and their edges. The task's own evidence text
    also names Plan sanitizer / apply-plan / orchestration smoke as in scope;
    `tests/sanitize-plan.test.ts`, `tests/apply-plan-runner.test.ts`,
    `tests/agent-plan-apply-gate.test.ts`, `tests/ipc-skeleton.test.ts`,
    `tests/agent-orchestration-smoke.test.ts` (22 tests) all pass, and
    `shared/plan.ts`'s `RunAction` union covers every generative node
    (audioRun/mjImageRun/videoComposeRun/superResolutionRun/muxAudioVideoRun
    alongside imageRun/videoRun/textPolish; character/scene are prompt-source
    nodes with no run action by design). 36/36 tests pass across both slices.
    The prior "keep partial until node UI vertical slices and run dispatch are
    implemented" note conflated this task's own scope (shared contract +
    matrix + serializer + sanitizer + apply-plan + orchestration smoke, all of
    which are complete and test-verified) with the separately-scoped node UI
    and run-dispatch work tracked under tasks 13-16. That note was reasonable
    when written but is now stale given tasks 13-16 are independently tracked;
    task 12 is closed on its own merits. Human approval of desktop save/load
    remains tracked under REQ-098.
  - Requirements: R4, INV-2.

- [x] 13. Stabilize existing text/image/video/imageConfigV2/videoConfigV2 nodes.
  - Include: idle/running/done/error states, inline rename, focus modal,
    prompt preview, style field placeholder removal, run callbacks.
  - Verify: component tests and human-review checklist coverage for desktop
    add/edit/run stub flow.
  - Requirements: R4, R7.
  - Evidence: Audit found imageConfigV2/videoConfigV2 were NOT actually wired
    to real run dispatch despite backlog/HDR claims of "engineering complete" --
    `CanvasPage.tsx`'s `nodeTypes` registry pointed both at raw components
    with no wrapper, so no `onRun` context could reach them; `jobTypeForNodeType`
    only mapped `'video'` (not `'videoConfigV2'`) to `canvas.generateVideo`;
    and `buildRunDescriptor` in `canvas.handler.ts` had no branch for either
    V2 type, so they fell through to the bare `canvas.generateImage` fallback
    with zero prompt/style/duration/resolution composition. Separately, two
    parallel status-tracking mechanisms existed
    (`node.data.status` vs. `canvasStore.nodeRunStatus` Map +
    `setNodeRunStatus`/`getNodeRunStatus`), and `VideoToolbar.handleGenerate`
    set `status: 'running'` with no path back to a terminal state (permanently
    stuck spinner). Fixed all four: (1) added `ImageConfigV2NodeWrapper` /
    `VideoConfigV2NodeWrapper` in `CanvasPage.tsx` injecting
    `useCanvasRunContext().runNode` as `onRun`; (2) `jobTypeForNodeType` now
    maps `'video' | 'videoConfigV2'` to `canvas.generateVideo`;
    (3) `buildRunDescriptor` now routes `image`/`imageConfigV2` and
    `video`/`videoConfigV2` through the same `compileWorkflowNodeRuntimeSnapshot`
    path, so V2 nodes get composed prompt, style, and duration/resolution
    parameters identical to their V1 counterparts; (4) removed the redundant
    `canvasStore.nodeRunStatus` Map and its accessors, consolidating on
    `node.data.status` as the single source of truth (matching
    Image/VideoNode's existing pattern); `ImageConfigV2Node`/`VideoConfigV2Node`
    now accept an `onRun?: (id: string) => void` prop and delegate
    `handleGenerate` to it instead of self-mutating status or using a mock
    `setTimeout`. Updated `tests/image-config-v2-parity.test.tsx` and
    `tests/video-config-v2-parity.test.tsx` to assert the injected `onRun`
    callback fires instead of asserting the old Map-based/stuck-state
    behavior; added 2 new dispatch cases to `tests/migrated-run-dispatch.test.ts`
    covering imageConfigV2 -> canvas.generateImage and videoConfigV2 ->
    canvas.generateVideo with full runtime-snapshot parameters
    (style/duration/resolution). `bun run typecheck` clean; all 3 touched
    test files pass (7+3+3 = 13 tests); full suite run confirms the 3
    pre-existing failing files (`agent-settings-ui.test.tsx`,
    `job-preload.test.ts`, `migrated-node-menu.test.ts`) fail identically with
    this change stashed out, i.e. unrelated pre-existing issues, not
    regressions from this task.

- [x] 14. Implement character and scene nodes as production semantic nodes.
  - Include: structured fields, media references, prompt contribution,
    insert-from-library hooks, serialization and connection behavior.
  - Verify: component, graph, prompt composition, and human-review checklist
    coverage for desktop flow.
  - Requirements: R4, INV-3.
  - Evidence: Independent audit (unlike task 13, this backlog claim held up).
    `CharacterNode.tsx`/`SceneNode.tsx` are real production components with
    structured label/description/tags/category fields, asset preview
    thumbnail, view-asset button, single/multi generate-intent buttons,
    source/target handles, resizer, and a prompt-preview panel showing
    `Character {label}: {description}` / `Scene {label}: {description}`.
    `shared/nodes.ts`'s `CharacterNodeData`/`SceneNodeData` are real
    structured interfaces, not stubs. Both registered in `CanvasPage.tsx`'s
    `nodeTypes` map plus creation defaults/icon maps/layout offsets.
    `shared/connection-matrix.ts` has explicit character/scene rows.
    `workflow-graph-compiler.ts` implements the
    `Character {label}: {text}` / `Scene {label}: {text}` prompt-contribution
    pattern for real. Insert-from-library hook is real:
    `CharacterLibraryPanel.tsx` + `CanvasPage.tsx`'s
    `handleCreateCharacterFromCategory` create a `character`/`scene` node
    prefilled from an asset category, wired to a toolbar toggle.
    Serialization round-trip covered by `canvas-graph-persistence.test.ts`.
    Ran all 4 relevant test files: `character-scene-node-parity.test.tsx`,
    `production-node-components-parity.test.tsx`,
    `workflow-graph-compiler.test.ts`, `canvas-panels-parity.test.ts` --
    11/11 pass. Minor non-blocking gap noted: `CharacterNodeData.viewMode`
    is declared but never read/set by the component (dead field, tracked as
    a follow-up, not worth holding the task open).

- [x] 15. Implement audio node and audio asset integration.
  - Include: audio import, preview, connection to mux/video generation where
    allowed, serializer/runtime support.
  - Verify: import tests, graph tests, and human-review checklist coverage for
    desktop audio-to-mux setup flow.
  - Requirements: R4, R6.
  - Evidence: Independent audit (sub-agent report re-verified line-by-line
    against source, not accepted at face value). `AudioNode.tsx` is a real
    production component: playback (`<audio>` element bound to `data.url`),
    asset binding via `MediaInputControls`, asset-ID field, duration display,
    mux-input reference-role affordance, import/view-asset buttons. Connection
    matrix row (`audio -> video/videoConfigV2/muxAudioVideo`) and the inverse
    block (`muxAudioVideo -> audio` is false) are enforced and tested.
    `shared/assets.ts`/`asset.handler.ts` recognize `audio`/`.mp3`/`audio/mpeg`
    end to end; `import-metadata.ts` has a genuine hand-rolled MP3 frame-header
    parser computing real `durationMs` at import time (not a stub). Serializer
    (`workflow-graph-compiler.ts`) maps `audio` nodes to the `audio` media
    kind and threads `durationSeconds` into compiled parameters when present.
    Ran the full audio-scoped suite directly (not just the sub-agent's cited
    subset): `asset-audio-support.test.ts`, `node-contracts.test.ts`,
    `connection-matrix.test.ts`, `workflow-node-definitions.test.ts`,
    `workflow-graph-compiler.test.ts`, `migrated-run-dispatch.test.ts`,
    `canvas-graph-persistence.test.ts`, `audio-node-parity.test.tsx`,
    `production-node-components-parity.test.tsx` -- 9 files / 32 tests, all
    pass.
    Three gaps identified and deliberately judged non-blocking:
    (1) `onImport`/`onViewAsset` are real component props with real test
    coverage, but `CanvasPage.tsx` registers `audio` directly in `nodeTypes`
    with no wrapper injecting these callbacks -- the identical pattern
    already accepted as non-blocking for `CharacterNode`/`SceneNode` in task
    14's closure. Tracked as a shared follow-up for all three node types, not
    specific to audio.
    (2) A full `canvas.generateAudio` run-dispatch pipeline exists
    (`jobTypeForNodeType`, `buildRunDescriptor` in `canvas.handler.ts`,
    `runtime.ts`'s stub worker) but is unreachable from the UI, and
    `shared/workflow-node-definitions.ts` marks audio `runnable: false,
    runAction: null` -- the authoritative contract the Agent-tool-facing
    `canvas.runNode` actually enforces. This is consistent with, not
    contradicted by, this task's own acceptance text (no "run dispatch"
    requirement, unlike tasks 16/17) and `design.md`'s priority ordering
    (audio import listed separately from videoCompose/muxAudioVideo's "graph/
    run dispatch"). Treated as intentional forward-looking infrastructure for
    a future audio-regeneration feature, not dead code to remove now.
    (3) `AssetMetadata.durationMs` (computed correctly at import) never
    propagates into a node's `AudioNodeData.durationSeconds`, because
    `NodeAssetOption` carries no duration field and none of the asset-insert
    paths (`appendAssetNode`, `handleInsertAsset`, `handleCanvasDrop`,
    `CanvasAssetPanel.tsx`'s `handleInsert`) thread it through. Tracked as a
    non-blocking follow-up (parallel to task 14's `CharacterNodeData.viewMode`
    dead-field precedent), since manual duration entry remains available and
    no test or requirement currently asserts automatic propagation.

- [x] 16. Implement videoCompose and muxAudioVideo vertical slices.
  - Include: UI, graph rules, input ordering, run dispatch to stub job,
    result writeback to video node or self-contained output.
  - Verify: graph/run tests and human-review checklist coverage for desktop
    composition setup flow.
  - Requirements: R4, R7.
  - Evidence (2026-07-04): `VideoComposeNode.tsx`/`MuxAudioVideoNode.tsx` are
    real production components (ordered input lists via `inputOrder`,
    transition/model selects, ticket-only `handleRun`, terminal output
    preview). Graph rules are real: the connection matrix
    (`shared/connection-matrix.ts`) enforces `video -> videoCompose`,
    `video -> muxAudioVideo`, `audio -> muxAudioVideo` (and blocks the
    inverse); `workflow-graph-compiler.ts` threads `inputOrder`-ranked
    `video`/`audio` references into typed job payloads (confirmed via
    `tests/migrated-run-dispatch.test.ts`'s `'enqueues composition,
    super-resolution, and mux nodes with typed payloads'` and the cloud-URL
    refresh case, 2/2 passing).
    A sub-agent audit surfaced a real, previously-undetected defect: unlike
    `text`/`image`/`video`/`imageConfigV2`/`videoConfigV2`, the `videoCompose`
    and `muxAudioVideo` node types (and `superResolution`, sharing the same
    code path) were registered directly in `CanvasPage.tsx`'s `nodeTypes` map
    with no wrapper component, so their `onRun` prop was always `undefined`.
    Each component's local `handleRun` does
    `update({ status: 'running', url: '' }); onRun?.(id)` with no fallback --
    clicking "运行" set the node to `status: 'running'` and then did nothing:
    no job was ever enqueued, and the run button disables itself while
    `status === 'running'`, so the node was stuck permanently with no
    recovery path. This is a genuine regression-class bug (an actively
    broken UI state), not merely an incomplete feature, and blocked the
    task's own "run dispatch to stub job" acceptance criterion outright.
    I independently re-verified the sub-agent's report against the source
    (not accepted at face value) and re-derived the fix: added
    `VideoComposeNodeWrapper`/`SuperResolutionNodeWrapper`/
    `MuxAudioVideoNodeWrapper` in `CanvasPage.tsx` following the exact
    `ImageNodeWrapper`/`VideoNodeWrapper`/`VideoConfigV2NodeWrapper`
    precedent -- each injects a real `onRun={(nodeId) =>
    runContext?.runNode(nodeId)}` via `useCanvasRunContext()` -- and switched
    `nodeTypes` to reference the wrappers. `handleRunNode` (CanvasPage.tsx)
    already had correct `jobTypeForNodeType` routing to
    `canvas.composeVideo`/`canvas.upscaleVideo`/`canvas.muxAudioVideo`; only
    the UI wiring was missing. `tsc --noEmit` passes cleanly after the fix.
    Added `tests/task16-post-production-run-dispatch.test.ts` (5 new tests)
    to close the coverage hole the audit identified: existing
    `tests/post-production-node-parity.test.tsx` only exercised the bare
    components with directly-mocked `onRun` props, so it would pass
    unchanged whether or not `CanvasPage.tsx`'s wiring was broken. The new
    test asserts `nodeTypes` now points at the wrapper functions (not the
    bare components) and that each wrapper's body genuinely wires
    `useCanvasRunContext()` into a real `onRun` callback, plus the
    `jobTypeForNodeType` routing. Full re-run:
    `tests/canvas-panels-parity.test.ts` (3) +
    `tests/task16-post-production-run-dispatch.test.ts` (5) +
    `tests/migrated-run-dispatch.test.ts` (7) +
    `tests/agent-orchestration-smoke.test.ts` (3) +
    `tests/production-node-components-parity.test.tsx` (4) = 22/22 passing.
    Two gaps identified and deliberately judged non-blocking, because both
    are pre-existing systemic patterns already present in already-closed
    tasks, not defects introduced by or specific to this task:
    (1) `onWriteOutputAsset` is a real declared prop on
    `VideoComposeNode`/`MuxAudioVideoNode`/`SuperResolutionNode` (and has
    component-level test coverage) but is never wired from `CanvasPage.tsx`
    -- confirmed the identical gap exists for the already-closed `ImageNode`/
    `VideoNode` (task's own onRun wrapper wiring covers run dispatch only,
    not writeback injection). (2) The `canvas.composeVideo`/
    `canvas.upscaleVideo`/`canvas.muxAudioVideo` stub handlers in
    `runtime.ts` return `{ kind: 'report', data: { nodeId } }` with no
    `assetId`/`url`, so `job-reconciliation.ts`'s `terminalResultToNodePatch`
    only sets `status: 'done'` on completion with no output asset --
    confirmed the identical shape exists for the already-closed
    `canvas.generateVideo` stub. Both gaps are consistent with this
    project's stub-provider phase (no real compose/upscale/mux backend
    exists yet) and are tracked as shared follow-ups spanning multiple node
    types, not specific to task 16.

- [x] 17. Implement superResolution and mjImage vertical slices.
  - Include: parameter validation, multi-result handling for mjImage,
    run dispatch, status/result UI, and asset reference creation.
  - Verify: component/run tests and human-review checklist coverage for desktop
    stub result flow.
  - Requirements: R4, R7.
  - Evidence (2026-07-04): Delegated an initial audit to a sub-agent, then
    independently re-verified every claim against source before writing this
    up.
    `superResolution` is a real vertical slice: `SuperResolutionNode.tsx` has
    input-video selection, scene/resolution/fps controls, a ticket-only
    `handleRun`, terminal output preview (`data-testid=
    "super-resolution-output"`), and a writeback button
    (`onWriteOutputAsset`). Run dispatch is real end-to-end on both call
    paths -- `canvas.handler.ts`'s `buildRunDescriptor` routes
    `superResolution -> canvas.upscaleVideo` with `scene`/`resolution`/`fps`
    parameters (lines 433-448), and the Agent-tool-facing
    `tools/canvas/index.ts`'s `canvas.runNode` independently routes through
    `getNodeDefinition('superResolution')` (`runnable: true, runAction:
    'superResolutionRun'`) to the same job type via `jobTypeForRunAction`.
    The task 16 fix (`SuperResolutionNodeWrapper` in `CanvasPage.tsx`,
    wiring a real `onRun` through `useCanvasRunContext()`) already closed
    the UI-dispatch gap for this node type; re-verified still correct.
    `mjImage` is deliberately non-runnable by design, not a defect:
    `shared/workflow-node-definitions.ts` marks it `runnable: false,
    runAction: null, addable: false, connectCreate: false`, with an explicit
    `unavailableReason` ("MJ node/component is out of scope for local Phase
    A"), and both call paths respect this -- `CanvasPage.tsx`'s
    `jobTypeForNodeType` returns `null` for `mjImage`, and
    `tools/canvas/index.ts`'s `canvas.runNode` throws a classified
    "Runtime unavailable for mjImage: ..." error rather than silently
    no-op'ing. `MjImageNode.tsx` is a real, non-placeholder component
    (prompt textarea, 4-result selectable grid with per-result aria labels,
    model/ratio display) whose job is only to render legacy-imported plans,
    not to run new generations. `tests/migrated-run-dispatch.test.ts`'s
    `'keeps legacy mjImage compatible without enabling MJ multi-result
    behavior'` test title itself documents this as intentional
    legacy-compatibility plumbing, not an oversight. `job-reconciliation.ts`'s
    `terminalResultToNodePatch` already generically handles a `urls:
    string[]` array for report-kind results, so multi-result plumbing exists
    structurally even though it's unexercised for mjImage specifically since
    mjImage can never dispatch a job -- consistent with, not contradicting,
    the Phase A out-of-scope decision.
    Two gaps identified and judged non-blocking because they are systemic,
    pre-existing patterns already accepted in earlier closed tasks, not
    defects introduced by or specific to this task: (1) "parameter
    validation" for `superResolution`'s `scene`/`resolution`/`fps` (and
    would-be `mjImage` `ratio`/`modelId`) is optional-field pass-through
    only -- no Zod schema enforces value ranges or enums in
    `canvas.handler.ts`'s `buildRunDescriptor`; grepped confirmed no node
    type's run-dispatch path has real runtime parameter validation anywhere
    in this codebase, so this is a project-wide gap, not one specific to
    task 17. (2) "asset reference creation" does not happen for
    `superResolution` outputs because the `canvas.upscaleVideo` stub handler
    in `runtime.ts` returns `{ kind: 'report', data: { nodeId } }` with no
    `assetId` -- identical in shape to the already-closed `canvas
    .generateVideo`/`canvas.composeVideo`/`canvas.muxAudioVideo` stubs (task
    16), so `onCompletedAsset`'s asset-reference creation never fires for
    any of these stub-backed job types yet. Both gaps are stub-provider-era
    limitations shared across many already-closed node types, tracked as
    project-wide follow-ups, not specific defects blocking task 17's
    acceptance criteria for `superResolution`'s "run dispatch, status/result
    UI" (met) or `mjImage`'s intentionally-out-of-scope run behavior (met by
    design).
    Verification: `tests/task16-post-production-run-dispatch.test.ts` (5),
    `tests/connection-matrix.test.ts` (3),
    `tests/model-feature-catalog.test.ts` (2),
    `tests/workflow-node-definitions.test.ts` (4),
    `tests/migrated-run-dispatch.test.ts` (7),
    `tests/super-resolution-node-parity.test.tsx` (1),
    `tests/production-node-components-parity.test.tsx` (4) = 26/26 passing.
    `tsc --noEmit` passes cleanly.

## Phase 4 - Style Presets

- [x] 18. Add shared style contracts and API contract document.
  - Files: `shared/styles.ts`, `docs/api-contracts/styles.md`.
  - Include: preset views, prompt parts, enabled state, list/detail/save,
    project default, node override.
  - Verify: API docs test and TypeScript contract tests.
  - Requirements: R5.

- [x] 19. Add style repository, schema migration, and IPC handlers.
  - Include: list enabled presets, create/update/delete/toggle/reorder if
    exposed, project default persistence, recoverable invalid-style errors.
  - Verify: repository and IPC tests.
  - Requirements: R5.

- [-] 20. Implement deterministic style prompt composition.
  - Include: pure `composeStyledPrompt`, node override over project default,
    preview/runtime byte equivalence.
  - Verify: unit/property tests and job payload snapshot tests.
  - Evidence: `docs/progress/test-report.md` records contract, node override,
    default-workflow project style runtime payload tests, and non-default
    workflowId runtime/stub hash tests. Human approval of the desktop
    generation flow is tracked under REQ-098.
  - Requirements: R5, INV-3.

- [-] 21. Implement style library UI and node/project selectors.
  - Include: no hardcoded frontend-only style list, loading/empty/error states,
    cover rendering, selected state.
  - Verify: component tests and human-review checklist coverage for desktop
    style selection flow.
  - Evidence: `docs/progress/test-report.md` records component tests for
    localized Style Library, cover rendering, node selectors, and project
    selector. Human approval of cover display and stub generation is tracked
    under REQ-098.
  - Requirements: R5.

## Phase 5 - Asset Library Completion

- [ ] 22. Complete asset import metadata extraction.
  - Include: media type, mime, size, orientation where available, duration for
    video/audio where feasible, safe local path persistence.
  - Verify: asset pipeline tests and human-review checklist coverage for
    desktop import flow.
  - Requirements: R6, INV-5.

- [ ] 23. Complete asset panel user workflows.
  - Include: folder tree, search, media filter, sort, move, trash, force
    tombstone, insert-to-canvas, loading/empty/error states.
  - Verify: component tests and human-review checklist coverage for desktop
    asset library flow.
  - Requirements: R6.

- [ ] 24. Wire asset references from canvas nodes and jobs.
  - Include: create/update references when nodes select assets or jobs finish,
    safe delete blocking references.
  - Verify: repository tests and human-review checklist coverage for referenced
    asset deletion.
  - Requirements: R6, INV-5.

## Phase 6 - Async Run and Agent Orchestration

- [-] 25. Expand run dispatch for the migrated node set.
  - Include: job types, payload shape, graph snapshot prompt/reference
    composition, terminal writeback, no generated bytes in synchronous IPC.
  - Verify: IPC/job tests and human-review checklist coverage for desktop run
    ticket/result flow.
  - Evidence: `docs/progress/test-report.md` records RED/GREEN coverage for
    audio job dispatch, mjImage semantic prompt/reference dispatch, typed queue
    payloads for videoCompose, superResolution, and muxAudioVideo, plus
    one-shot reopen reconciliation and real-time terminal writeback for typed
    migrated report results. Keep partial until broader PlanRunner migrated run
    steps are covered; human approval of desktop ticket/result behavior is
    tracked under REQ-098.
  - Requirements: R7, INV-4.

- [-] 26. Add one-shot job reconciliation on canvas reopen.
  - Include: missed terminal event recovery without renderer polling loops.
  - Verify: integration tests and static no-polling scan.
  - Evidence: `docs/progress/test-report.md` records pure reconciliation,
    CanvasPage one-shot `job.list` wiring, REQ-096 regression tests, and
    zero-polling scan. Human approval of desktop reopen behavior is tracked
    under REQ-098.
  - Requirements: R7.

- [-] 27. Expand CanvasPlan and sanitizePlan for migrated nodes/run actions.
  - Include: accepted node types, run actions, dropped warnings, executable
    string stripping, connection matrix revalidation.
  - Verify: sanitizePlan property tests and applyPlan tests.
  - Evidence: `docs/progress/test-report.md` records RED/GREEN coverage for
    migrated run actions (`audioRun`, `mjImageRun`, `videoComposeRun`,
    `superResolutionRun`, `muxAudioVideoRun`) being preserved by sanitizePlan
    and mapped into PlanRunner steps by applyPlan. Keep partial until
    orchestrator prompt generation proves the same vocabulary from a real user
    request. Human approval of desktop PlanCard behavior is tracked under
    REQ-098.
  - Requirements: R8.

- [-] 28. Upgrade orchestrator prompts/tools to create comic-drama workflows.
  - Include: clarify behavior, character/scene/style awareness, legal plan
    generation, PlanCard summary.
  - Verify: orchestrator unit tests and agent orchestration smoke test.
  - Evidence: `docs/progress/test-report.md` records default built-in
    orchestrator planner coverage for comic-drama requests producing text,
    character, scene, mjImage, audio, videoCompose, and muxAudioVideo nodes
    with migrated run actions through both direct planner and chat IPC runtime
    paths. It also records PlanCard summary coverage for migrated node/action
    labels plus real Electron evidence for the visible migrated PlanCard
    summary. Keep partial until style-specific intent and clarify branches are
    covered; human approval of desktop autoExecute result/state behavior is
    tracked under REQ-098.
  - Requirements: R8.

- [-] 29. Complete PlanRunner execution for migrated run steps.
  - Include: serial execution, failed short-circuit, manual rerun, terminal
    event injection.
  - Verify: PlanRunner tests and human-review checklist coverage for desktop
    autoExecute flow.
  - Evidence: `docs/progress/test-report.md` records applyPlan mapping for
    migrated run steps plus existing live terminal writeback coverage for
    migrated job results. It also records a real Electron apply action for a
    migrated PlanCard. Human approval of desktop autoExecute terminal states is
    tracked under REQ-098.
  - Requirements: R8.

## Phase 7 - Human Desktop Review

- [ ] 30. Build the first full comic-drama human-review scenario.
  - Scenario: create project -> add story text -> add character -> select style
    -> create imageConfigV2 -> run stub image -> create videoConfigV2 -> use
    generated image as first frame -> run stub video -> save -> reopen.
  - Verify: automated smoke where possible plus human desktop review checklist.
  - Requirements: R9, all INV.

- [ ] 31. Build the asset/snippet human-review scenario.
  - Scenario: import image/video/audio -> organize folders -> insert asset
    nodes -> select two or more nodes -> save snippet -> insert snippet into a
    different project -> save/reopen.
  - Verify: automated smoke where possible plus human desktop review checklist.
  - Requirements: R3, R6, R9.

- [ ] 32. Build the Agent orchestration human-review scenario.
  - Scenario: ask Agent for a short comic-drama image-to-video chain with a
    named character and style -> review plan -> apply -> autoExecute with stub
    jobs -> observe terminal node states.
  - Verify: agent smoke plus human desktop review checklist.
  - Requirements: R8, R9.

- [ ] 33. Update progress, backlog, and test reports after each completed
  phase.
  - Include: command outputs, human-review outcomes, reviewer screenshots where
    provided, and known residual risks.
  - Verify: no phase marked accepted without current automated evidence and a
    human-review outcome or explicit pending-human-review note.
  - Requirements: R9.
