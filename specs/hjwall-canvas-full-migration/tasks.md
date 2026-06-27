# Implementation Plan - hjwall Canvas Full Migration

> Status legend: `[ ]` not started, `[-]` in progress, `[x]` verified complete.
> Engineering tasks can be checked after implementation review and named
> automated evidence are recorded. Desktop user-flow acceptance is handled by
> human review under REQ-098 and should be recorded separately as approved,
> failed, or pending.

## Phase 0 - Inventory and Truth Reset

- [ ] 1. Create a hjwall capability inventory.
  - Reference: `hjwall/pc-client/src/modules/workflow-canvas/`,
    `hjwall/pc-client/src/modules/asset/`,
    `hjwall/backend/src/modules/workflow/`,
    `hjwall/backend/src/modules/asset/`,
    `hjwall/backend/src/modules/style/`.
  - Output: `docs/progress/hjwall-canvas-migration-inventory.md`.
  - Verify: inventory maps each accepted capability to REQ-090..REQ-098,
    target files, and evidence fields.
  - Requirements: R1, R9.

- [ ] 2. Audit current "completed" backlog claims against current evidence.
  - Include: M2-M5, REQ-077..REQ-085, known limits from
    `docs/progress/hjwall-migration-report.md`.
  - Output: mark items as verified, partial, or contradicted in a new dated
    verification report without deleting historical records.
  - Verify: every partial/contradicted item has a follow-up task.
  - Requirements: R1, R9.

- [ ] 3. Prepare the human desktop review gate.
  - Include: fix blank/black screen regressions, preload/main/renderer startup,
    and define the reviewer checklist for launching the app.
  - Output: `docs/progress/human-desktop-review-checklist.md`.
  - Verify: automated startup-adjacent checks pass, and the review checklist
    names `/projects`, `/canvas`, and visible UI checkpoints for human audit.
  - Requirements: R9.

## Phase 1 - Workflow Project Lifecycle

- [ ] 4. Harden workflow project repository and IPC.
  - Include: create with initial graph, rename, soft delete, list summaries,
    latest version metadata, JSDoc and `@see docs/api-contracts/canvas-plan.md`.
  - Verify: repository tests, IPC handler tests, and human-review checklist
    coverage for the project list flow.
  - Requirements: R2, INV-6.

- [-] 5. Implement import/export workflow JSON.
  - Include: schema validation, graph sanitize, no absolute asset paths, import
    as new project, export current graph.
  - Verify: invalid JSON rejection, valid import round trip, and human-review
    checklist coverage for import/export user flow.
  - Evidence: `docs/progress/test-report.md` records IPC-level export/import
    coverage for sanitized workflow JSON, invalid JSON rejection, absolute path
    rejection, importing as a new workflow with dropped-item reporting, and
    renderer `/projects` import/export JSON controls with Chinese validation
    feedback. Human approval of the desktop import/export flow is tracked under
    REQ-098 rather than blocking engineering evidence.
  - Requirements: R2, INV-2, INV-5.

- [-] 6. Add dirty-save project switching and leave guards.
  - Include: switching workflow, closing canvas, back navigation, failed save
    recovery.
  - Verify: component/integration tests and human-review checklist coverage for
    desktop switch flow.
  - Evidence: `docs/progress/test-report.md` records a pure guard module and
    CanvasPage wiring where dirty workflow switching saves first, blocks the
    switch on save failure, and registers a `beforeunload` guard while dirty.
    Human approval of switch, close, and back-navigation flows is tracked under
    REQ-098 rather than blocking engineering evidence.
  - Requirements: R2, R9.

## Phase 2 - Canvas Interaction Parity

- [ ] 7. Decide and document the renderer graph state ownership model.
  - Include: React Flow local state vs Zustand source of truth, sync invariants,
    undo/redo, autosave, realtime terminal updates.
  - Verify: design note in this spec or `docs/architecture/`, plus regression
    tests for undo/autosave/realtime races.
  - Requirements: R3, R9.

- [-] 8. Complete toolbar, context menu, and command palette parity.
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
    feedback, and command-palette search/empty states. Human approval of the
    desktop keyboard/mouse flow is tracked under REQ-098.
  - Requirements: R3.

- [-] 9. Implement local media drag/drop onto canvas.
  - Include: image/video/audio classification, asset import IPC, node creation
    at drop position, unsupported-file feedback.
  - Verify: pure function tests, IPC import test, and human-review checklist
    coverage for desktop drag/drop flow.
  - Evidence: `docs/progress/test-report.md` records local drop planning for
    image, video, and audio files, readable unsupported/path feedback, shared
    `audio` asset media type support, audio file extension/MIME import support,
    asset-panel audio display hooks, CanvasPage audio node insertion from
    dropped/imported assets, and `asset.import` persistence for audio files with
    portable POSIX relative paths. Human approval of desktop drag/drop is
    tracked under REQ-098.
  - Requirements: R3, R6.

- [-] 10. Complete snippet save/insert flow.
  - Include: selected subgraph extraction, persisted snippet storage, insertion
    with ID remap and one undo snapshot.
  - Verify: graph tests, UI tests, and human-review checklist coverage for
    desktop select-save-insert flow.
  - Evidence: `docs/progress/test-report.md` records selected subgraph
    extraction, internal-edge filtering, normalized snippet coordinates,
    snippet insertion with node/edge ID remap, one undo snapshot, and minimal
    CanvasPage save/insert actions. Persisted snippet storage is now covered by
    `canvas_snippets`, `canvasSnippet.*` IPC, preload APIs, and a compact
    CanvasPage snippet-library selector. Richer UI remains an engineering
    follow-up; human approval of select-save-insert is tracked under REQ-098.
  - Requirements: R3.

- [-] 11. Enforce connection feedback and @mention-created edge validation.
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
    actions. Remaining context-menu edge paths are engineering follow-up work;
    human approval of invalid-connection feedback is tracked under REQ-098.
  - Requirements: R3, R4, INV-2.

## Phase 3 - Node System Expansion

- [-] 12. Expand `shared/nodes.ts`, `shared/connection-matrix.ts`, and graph
  serializer to the accepted migrated node set.
  - Include: text, image, video, character, scene, audio, imageConfigV2,
    videoConfigV2, videoCompose, superResolution, muxAudioVideo, mjImage.
  - Verify: contract tests enumerate every node and allowed/denied connection.
  - Evidence: `docs/progress/test-report.md` records the shared node contract,
    connection matrix, Plan sanitizer, apply-plan, and orchestration smoke test
    slice plus graph persistence serializer coverage for migrated nodes. Keep
    partial until node UI vertical slices and run dispatch are implemented;
    human approval of desktop save/load is tracked under REQ-098.
  - Requirements: R4, INV-2.

- [ ] 13. Stabilize existing text/image/video/imageConfigV2/videoConfigV2 nodes.
  - Include: idle/running/done/error states, inline rename, focus modal,
    prompt preview, style field placeholder removal, run callbacks.
  - Verify: component tests and human-review checklist coverage for desktop
    add/edit/run stub flow.
  - Requirements: R4, R7.

- [ ] 14. Implement character and scene nodes as production semantic nodes.
  - Include: structured fields, media references, prompt contribution,
    insert-from-library hooks, serialization and connection behavior.
  - Verify: component, graph, prompt composition, and human-review checklist
    coverage for desktop flow.
  - Requirements: R4, INV-3.

- [ ] 15. Implement audio node and audio asset integration.
  - Include: audio import, preview, connection to mux/video generation where
    allowed, serializer/runtime support.
  - Verify: import tests, graph tests, and human-review checklist coverage for
    desktop audio-to-mux setup flow.
  - Requirements: R4, R6.

- [ ] 16. Implement videoCompose and muxAudioVideo vertical slices.
  - Include: UI, graph rules, input ordering, run dispatch to stub job,
    result writeback to video node or self-contained output.
  - Verify: graph/run tests and human-review checklist coverage for desktop
    composition setup flow.
  - Requirements: R4, R7.

- [ ] 17. Implement superResolution and mjImage vertical slices.
  - Include: parameter validation, multi-result handling for mjImage,
    run dispatch, status/result UI, and asset reference creation.
  - Verify: component/run tests and human-review checklist coverage for desktop
    stub result flow.
  - Requirements: R4, R7.

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
