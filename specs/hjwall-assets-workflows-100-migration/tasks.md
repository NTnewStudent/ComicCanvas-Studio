# Tasks - hjwall Assets + Workflows 100% Migration

> Status legend: `[ ]` not started, `[-]` in progress, `[x]` complete.
> Each task should cite relevant hjwall files/tasks in implementation notes.
> Engineering completion requires code review and automated tests. Product
> acceptance requires human desktop review where UI is involved.

## Phase 0 - Audit and Task System

- [x] 1. Create the full hjwall assets/workflows capability inventory.
  - Reference: `hjwall/pc-client/src/modules/asset/**`,
    `hjwall/pc-client/src/modules/workflow-canvas/**`,
    `hjwall/backend/src/modules/asset/**`,
    `hjwall/backend/src/modules/workflow/**`,
    `hjwall/task/task-list.md`.
  - Output: `docs/progress/hjwall-assets-workflows-gap-analysis.md`.
  - Include: capability ID, hjwall files, hjwall task refs, ComicCanvas owner,
    current status, required tests, human review row.
  - Requirements: R1.

- [x] 2. Freeze migration order and Agent boundary.
  - Include: mark assets/workflows as Phase A, Agent as Phase B, infinite canvas
    as Phase C.
  - Output: update `docs/progress/backlog.md` and `specs/README.md`.
  - Requirements: R1, R14, R16.

- [x] 3. Add static coverage test for migration inventory.
  - Include: test that every inventory row maps to a requirement/task and no
    accepted row is missing an owner.
  - Requirements: R1.

- [x] 3a. Audit current ToolRuntime and canvas tool coverage.
  - Include: document current `canvas.queryGraph`, `canvas.proposePlan`,
    `canvas.createNode`, `canvas.connectNodes`, `canvas.updateNodeData`,
    `canvas.deleteNode`, and `canvas.runNode` behavior, schemas,
    permissions, gaps, and renderer-only canvas actions.
  - Files: `desktop/src/main/tools/canvas/index.ts`, `shared/tools.ts`,
    `docs/api-contracts/tools-plugins.md`.
  - Requirements: R15.

## Phase 1 - Asset Module Parity

- [x] 4. Define asset category contracts and IPC.
  - Include: upload/canvas asset kinds, image category/tag metadata, built-in
    starter categories for role/scene/prop/creature, user-defined category CRUD,
    category assignment, upload progress, reference blocks.
  - Files: `shared/assets.ts`, `shared/ipc.ts`,
    `docs/api-contracts/assets-files.md`.
  - Reference: `hjwall/backend/src/modules/asset/dto/*`,
    `hjwall/pc-client/src/modules/asset/types/*`.
  - Evidence: `tests/asset-categories-repo.test.ts`,
    `tests/asset-categories-ipc.test.ts`, `tests/asset-preload.test.ts`,
    `tests/api-contract-docs.test.ts`.
  - Requirements: R3, R4.

- [x] 5. Extend asset repository and migrations.
  - Include: category table, asset-category join table, tag metadata, reference
    rows for nodes/jobs/categories, indexes for category/search/filter/sort.
  - Verify: repository tests for create/list/detail/reference/delete.
  - Evidence: `tests/db-schema.test.ts`,
    `tests/asset-categories-repo.test.ts`, `tests/asset-folders-repo.test.ts`,
    `tests/asset-reference-sync.test.ts`.
  - Requirements: R3, R4.

- [x] 6. Complete asset import metadata extraction.
  - Include: image dimensions/orientation, video/audio duration where feasible,
    mime/size/hash, supported extension errors, safe relative path.
  - Verify: asset pipeline tests.
  - Evidence: `tests/asset-service.test.ts`,
    `tests/asset-folders-ipc.test.ts`, `tests/api-contract-docs.test.ts`.
  - Requirements: R4.

- [x] 7. Rebuild `/assets` page shell to hjwall parity.
  - Include: URL-synced type tabs, counts, search, sort, date filters, upload
    entry, loading/error/empty states, responsive grid/list.
  - Reference: `AssetPage.tsx`, `AssetFilterBar.tsx`, `AssetGrid.tsx`,
    `AssetTypeTabs.tsx`.
  - Verify: component tests and human review HDR asset rows.
  - Evidence: `tests/asset-panel-ui.test.tsx`,
    `docs/progress/human-desktop-review-checklist.md#hdr-asset-001`.
  - Requirements: R2.

- [x] 8. Implement upload card and multi-file progress parity.
  - Include: file index/count, current filename, progress percent, busy states,
    success invalidation, failure message.
  - Reference: `AssetUploadCard.tsx`.
  - Evidence: `tests/asset-panel-ui.test.tsx`,
    `docs/progress/human-desktop-review-checklist.md#hdr-asset-002`.
  - Requirements: R2.

- [x] 9. Implement asset card, preview, rename, delete, and batch mode parity.
  - Include: media thumbnail/fallback, metadata display, preview modal, rename,
    single delete, batch select/delete confirm, selection reset.
  - Reference: `AssetCard.tsx`, `AssetPreviewModal.tsx`.
  - Evidence: `tests/asset-panel-ui.test.tsx`,
    `tests/asset-folders-ipc.test.ts`, `tests/asset-rename-repo.test.ts`,
    `docs/progress/human-desktop-review-checklist.md#hdr-asset-003`.
  - Requirements: R2, R4.

- [x] 10. Implement custom image category UI.
  - Include: built-in starter categories for role/scene/prop/creature,
    user-created categories, category color/icon, category filters, category
    assignment/removal for image assets, and category delete behavior.
  - Reference: hjwall `Character*.tsx` only as visual inspiration; do not copy
    hjwall character entity semantics.
  - Requirements: R3.

- [x] 11. Implement categorized image insertion flow.
  - Include: insert selected categorized image as image node, character node,
    scene node, or reference input based on canvas context; preserve the same
    underlying asset record.
  - Reference: hjwall character/asset library panels as UI inspiration.
  - Requirements: R3.

- [x] 12. Wire asset references from canvas selections and job outputs.
  - Include: node selects asset, generated result writes asset reference,
    snippets/templates preserve safe references, safe delete blocks referenced
    assets.
  - Requirements: R4, R10, R11.

## Phase 2 - Workflow Project and Template Parity

- [x] 13. Expand workflow project contracts and repository.
  - Include: cover, edge count, latest run status, default style, archived
    status, version checksum, warning summary.
  - Files: `shared/ipc.ts`, `workflow.repo.ts`, migrations.
  - Reference: `WorkflowProject` types and controller in hjwall.
  - Requirements: R5, R6.

- [x] 14. Rebuild project list UI to hjwall parity.
  - Include: my/public tabs, project cards, empty states, create dialog, import
    JSON button, public copy button, delete confirmation.
  - Reference: `WorkflowProjectsPage.tsx`.
  - Requirements: R5.

- [x] 15. Implement public template listing/copying.
  - Include: template scope, published/private status, copy to draft, open
    copied project, errors.
  - Reference: `workflow-template.service.ts`, `WorkflowAdminController`
    where useful for data model only.
  - Requirements: R5, R12.

- [x] 16. Harden import/export workflow JSON.
  - Include: schema validation, graph sanitize, no secrets, no absolute paths,
    dropped warnings, imported-as-draft flow.
  - Requirements: R5, R12.

- [x] 17. Implement version list and restore/debug metadata.
  - Include: immutable graph versions, checksum, createdAt, warning summary,
    latest restore path if product accepts restore.
  - Requirements: R6.

- [x] 18. Implement lenient draft save and strict run validation.
  - Include: unavailable model/style/asset warnings on save, strict errors for
    run/validate/template publish, warning persistence.
  - Reference: `hjwall/task/REQ-083`.
  - Requirements: R6.

## Phase 3 - Canvas Shell and Interaction Parity

- [x] 19. Clean and stabilize current CanvasPage ownership model.
  - Include: remove mojibake comments, document React Flow local state vs store
    ownership, stop double-state races, preserve autosave/realtime invariants.
  - Requirements: R7, R15.

- [x] 20. Rebuild canvas top bar and left toolbar to hjwall parity.
  - Include: back, save, import/export, theme, default style, task/job status,
    quick tools, plus menu, tooltip/accessibility.
  - Reference: `WorkflowCanvasPage.tsx` top and toolbar sections.
  - Requirements: R7.

- [x] 21. Complete add-node paths.
  - Include: toolbar add, plus menu, context-menu add-at-cursor, command
    palette, connect-to-create with allowed targets.
  - Requirements: R7, R8.

- [x] 22. Complete shortcuts and selection actions.
  - Include: undo/redo/save/duplicate/delete/fit/pan/select/command palette,
    editable-field protection, Mac Delete behavior.
  - Reference: hjwall `REQ-107`, `REQ-110`.
  - Requirements: R7.

- [x] 23. Complete local media drag/drop.
  - Include: image/video/audio classification, import, node creation at cursor,
    unsupported feedback.
  - Reference: `drop-media.ts`, `tests/drop-media.test.ts`.
  - Requirements: R7, R4.

- [x] 24. Implement related-node highlight and connection feedback parity.
  - Include: hover/selection related highlight, invalid duplicate connection
    feedback, Chinese messages.
  - Reference: `related-highlight.ts`, `connection-toast.ts`.
  - Requirements: R7, R8.

- [x] 25. Implement edge components and semantic edge data parity.
  - Include: PromptOrderEdge, ImageOrderEdge, ImageRoleEdge, DeletableBezierEdge,
    outputLink/reference rendering and deletion.
  - Files: `shared/nodes.ts`, `shared/connection-matrix.ts`, renderer edges.
  - Requirements: R8.

- [x] 26. Complete canvas panels.
  - Include: WorkflowPanel/snippet panel, AssetLibraryPanel, CharacterLibraryPanel,
    StyleLibraryPanel, RunPanel/CanvasJobPanel, BottomInputPanel, CanvasChatBox
    gated for later Agent phase.
  - Requirements: R7, R10, R12, R13, R14.

## Phase 4 - Production Node UI Parity

- [x] 27. Replace generic migrated node placeholders with production components.
  - Include: remove placeholder behavior for character, scene, audio,
    videoCompose, superResolution, muxAudioVideo. MJ node is registered only as
    a local out-of-scope placeholder and is not part of Phase A parity.
  - Requirements: R9.

- [x] 28. Stabilize TextNode parity.
  - Include: inline edit, focus modal, rich text toolbar where needed, AI polish
    status, mention chips, deterministic prompt contribution.
  - Reference: `TextNode.tsx`, `TextFocusModal.tsx`, `REQ-098`, `REQ-102`,
    `REQ-104`, `REQ-105`.
  - Requirements: R9, R10, R11.

- [x] 29. Implement image/video asset node parity.
  - Include: safe previews, orientation/aspect behavior, asset picker, edit
    modal entry, output writeback, run status.
  - Requirements: R9, R10.

- [x] 30. Implement imageConfig and imageConfigV2 parity.
  - Include: prompt, model, style, ratio, upstream image references, async run
    button, result selection/writeback.
  - Scope note: MJ component deep parity is explicitly out of scope for the
    local Phase A pass per product direction.
  - Evidence: `tests/image-config-v2-parity.test.tsx`.
  - Requirements: R9, R11, R13.

- [x] 31. Implement videoConfig and videoConfigV2 parity.
  - Include: prompt, model, style, duration, ratio, resolution, first/last frame,
    reference assets, run button, result writeback.
  - Reference: `VideoConfigV2Node.tsx`, `REQ-055`, `REQ-096`.
  - Evidence: `tests/video-config-v2-parity.test.tsx`.
  - Requirements: R9, R11, R13.

- [x] 32. Implement character and scene node parity.
  - Include: structured fields, view assets, single/multi view generation,
    library insertion, prompt contribution, reference edges.
  - Reference: `CharacterNode.tsx`, `SceneNode.tsx`, `REQ-099`, `REQ-100`.
  - Evidence: `tests/character-scene-node-parity.test.tsx`.
  - Scope note: local Phase A treats characters/scenes as image assets with
    custom categories; Seedance/live-person flows are out of scope.
  - Requirements: R3, R9, R11.

- [x] 33. Implement audio node parity.
  - Include: import/playback, duration display, mux input, reference semantics.
  - Evidence: `tests/audio-node-parity.test.tsx`.
  - Requirements: R9, R11.

- [x] 34. Implement videoCompose and muxAudioVideo nodes.
  - Include: ordered inputs, transition/model options, ticket-only run, terminal
    output, asset writeback.
  - Reference: `REQ-112`.
  - Evidence: `tests/post-production-node-parity.test.tsx`.
  - Requirements: R9, R11.

- [x] 35. Implement superResolution node.
  - Include: scene, resolution, fps, input video, run ticket, terminal output.
  - Reference: `workflow-super-resolution.service.ts`, `REQ-077`.
  - Evidence: `tests/super-resolution-node-parity.test.tsx`.
  - Requirements: R9, R11.

- [x] 36. Skip mjImage node implementation.
  - Include: no MJ parity work, no multi-result UI, no URL refresh/re-sign
    policy, no asset registration, no downstream reference implementation.
  - Scope note: MJ node/component is explicitly out of scope and not required
    for the local Phase A pass per product direction.
  - Requirements: R9, R11.

## Phase 5 - Media Editing and Prompt Controls

- [x] 37. Implement image editor modal parity.
  - Include: crop, rotate, aspect/orientation preview, apply to node/asset.
  - Reference: `ImageEditorModal.tsx`.
  - Evidence: `tests/image-editor-modal-parity.test.tsx`.
  - Requirements: R10.

- [x] 38. Implement or explicitly gate image inpaint modal.
  - Include: mask/inpaint affordance if supported, otherwise clear unavailable
    state and hidden add paths.
  - Reference: `ImageInpaintModal.tsx`.
  - Evidence: `tests/image-inpaint-gate-parity.test.tsx`.
  - Scope note: local Phase A explicitly gates inpaint until `media.inpaint`,
    mask data, and a supporting image gateway exist.
  - Requirements: R10.

- [x] 39. Implement node asset picker and media input controls.
  - Include: image/video/audio picker, clear/select, external URL handling
    policy, compact mode.
  - Reference: `NodeAssetPickerModal.tsx`, `MediaInputControls.tsx`.
  - Evidence: `tests/media-input-controls-parity.test.tsx`.
  - Requirements: R10.

- [x] 40. Complete ConnectedInputsPanel parity.
  - Include: compact chips, prompt order/image order display, deterministic
    prompt preview, convergence tests.
  - Evidence: `tests/connected-inputs-panel.test.tsx`.
  - Requirements: R10, R13.

- [x] 41. Complete MentionTextarea parity.
  - Include: character/image chips, storage format preservation, caret dropdown,
    IME, atomic deletion, six usage points.
  - Reference: hjwall `REQ-102`, `REQ-104`.
  - Evidence: `tests/mention-textarea.test.tsx`.
  - Requirements: R10.

## Phase 6 - Runtime and Async Parity

- [x] 42. Implement workflow node definitions service.
  - Include: node capabilities, allowed inputs/outputs, unavailable runtime
    flags, add-menu filtering.
  - Evidence: `tests/workflow-node-definitions.test.ts`,
    `tests/canvas-tools.test.ts`, `tests/canvas-add-node-paths.test.ts`.
  - Requirements: R9, R13.

- [x] 43. Implement graph compiler and prompt/reference snapshot.
  - Include: text/character/scene/style/reference composition, prompt order,
    image order, image roles, runtime payload snapshot tests.
  - Evidence: `tests/workflow-graph-compiler.test.ts`,
    `tests/style-runtime-payload.test.ts`, `tests/migrated-run-dispatch.test.ts`.
  - Requirements: R8, R11, R13.

- [x] 44. Implement generation task status recovery.
  - Include: image/video/scene/character/compose/mux/super-resolution task
    list, one-shot reopen reconciliation, terminal writeback.
  - Evidence: `tests/canvas-job-reconciliation.test.ts`,
    `tests/canvas-shell-parity.test.ts`, `tests/canvas-job-panel.test.tsx`.
  - Reference: `useGenerationTasks.ts`, `workflow-generation-status.service.ts`.
  - Requirements: R11.

- [x] 45. Implement text polish async recovery.
  - Include: polish ticket, status query, realtime update, reopen apply, error
    handling.
  - Evidence: `tests/canvas-tools.test.ts`, `tests/migrated-run-dispatch.test.ts`,
    `tests/canvas-job-reconciliation.test.ts`, `tests/text-node.test.tsx`,
    `tests/apply-plan-runner.test.ts`, `tests/main-runtime-wiring.test.ts`.
  - Reference: `workflow-text-polish.service.ts`.
  - Requirements: R11.

- [x] 46. Implement run history and RunPanel parity.
  - Include: run list/detail, per-node status, outputs, errors, cancelled/failed
    states, manual rerun where applicable.
  - Evidence: `tests/canvas-job-panel.test.tsx`.
  - Requirements: R11.

- [x] 47. Implement safe URL refresh/re-sign policy.
  - Include: local `cc-asset://` path, cloud URL refresh if configured, host
    guard. MJ URL refresh is out of scope for Phase A.
  - Evidence: `tests/workflow-asset-resolver.test.ts`,
    `tests/migrated-run-dispatch.test.ts`,
    `docs/api-contracts/assets-files.md`, `docs/api-contracts/jobs.md`.
  - Reference: `workflow-asset-resolver.service.ts`, `REQ-106`.
  - Requirements: R4, R11.

## Phase 7 - Snippets, Templates, Style, Models

- [x] 48. Complete snippet template list/detail/delete parity.
  - Include: public/my scopes, metadata, detail fragment, delete owned, insert
    with remap and one undo.
  - Evidence: `tests/canvas-snippet-repository-ipc.test.ts`,
    `tests/canvas-snippet.test.ts`, `tests/workflow-panel-snippet-parity.test.tsx`,
    `docs/api-contracts/canvas-plan.md`.
  - Reference: `workflow-snippet.service.ts`.
  - Requirements: R12.

- [x] 49. Complete template import/copy/list parity.
  - Include: template metadata, public/private scopes, copy public, validate
    before publish if admin-like flow is needed locally.
  - Evidence: `tests/workflow-template-repo.test.ts`,
    `tests/workflow-project-ui.test.tsx`, `tests/ipc-skeleton.test.ts`,
    `docs/api-contracts/canvas-plan.md`.
  - Requirements: R5, R12.

- [x] 50. Complete style library and project/node style runtime parity.
  - Include: project default, node override, cover display, disabled/deleted
    style handling, deterministic injection.
  - Evidence: `tests/style-contracts.test.ts`,
    `tests/style-repository-ipc.test.ts`, `tests/project-style-selector.test.tsx`,
    `tests/style-library-panel.test.tsx`, `tests/style-runtime-payload.test.ts`.
  - Reference: hjwall `REQ-070`.
  - Requirements: R13.

- [x] 51. Complete model and feature flag loading.
  - Include: text/image/video/tool model lists, capability flags, disabled node
    filtering, unavailable markers.
  - Evidence: `tests/model-feature-catalog.test.ts`,
    `tests/model-feature-ipc.test.ts`, `tests/workflow-node-definitions.test.ts`,
    `tests/canvas-add-node-paths.test.ts`, `tests/ipc-skeleton.test.ts`.
  - Reference: `workflow-node-definition.service.ts`, `REQ-040`.
  - Requirements: R13.

## Phase 8 - Tool/UI Equivalence Gate

- [x] 52. Expand Canvas ToolRuntime coverage for migrated manual actions.
  - Include: graph validate/save/load/version/import/export, node duplicate/
    rename/position/batch, edge delete/update/connect-to-create, selection,
    layout, snippet insert/save, workflow project/template, style resolution,
    job recovery, media drop/edit, and asset category/reference operations.
  - Verify: each durable renderer action has a service/tool equivalent or a
    documented reason it is transient UI-only.
  - Requirements: R15, INV-8.

- [x] 53. Add tool descriptor, permission, and structured-error coverage.
  - Include: `canvas.read`, `canvas.write`, `destructive`, `provider.spend`,
    `file.write` where applicable; structured recoverable error codes for
    validation, missing assets, stale styles, invalid edges, and job failures.
  - Verify: ToolRuntime descriptor/schema tests.
  - Requirements: R15.

- [x] 54. Make manual UI flows delegate to shared tool/service semantics.
  - Include: renderer keeps transient menus/hover/viewport animation, while
    durable graph mutations reuse the same validation/default/layout/reference
    behavior as tools.
  - Verify: UI/tool equivalence tests for create/connect/update/delete/run,
    snippet insert, asset insert, workflow import/export, and job terminal
    writeback.
  - Requirements: R15, INV-8.

- [x] 55. Document Agent-ready tool vocabulary.
  - Include: generated tool inventory, supported schemas, permission model,
    unsupported/manual-only actions, and examples for future Agent plan apply.
  - File: `docs/api-contracts/tools-agents.md`.
  - Requirements: R14, R15.

## Phase 9 - Human Review and Acceptance

- [x] 56. Expand human desktop review checklist for this migration.
  - Include: assets, custom image categories, categorized insertion,
    project/templates, canvas shell, nodes, editing modals, runtime, snippets,
    styles.
  - File: `docs/progress/human-desktop-review-checklist.md`.
  - Evidence: `tests/human-desktop-review-checklist.test.ts`.
  - Requirements: R1, R15, INV-6, INV-8.

- [x] 57. Build automated smoke flows for assets/workflows.
  - Include: project create -> canvas -> add nodes -> save -> reopen;
    upload/import asset -> insert into canvas -> safe delete blocked;
    snippet save/insert; run stub node -> terminal state.
  - Evidence: `tests/phase-a-assets-workflows-smoke.test.ts`,
    `desktop/src/main/smoke/phase-a-assets-workflows-smoke.ts`.
  - Requirements: R2-R13, R15.

- [x] 58. Mark Phase A accepted only after human review pass or explicit product
  deferral.
  - Include: update backlog, gap analysis, and test report.
  - Decision: Phase A is not accepted until `HDR-PHASEA-001` has a human
    review pass or explicit product deferral.
  - Evidence: `tests/phase-a-acceptance-gate.test.ts`,
    `docs/progress/backlog.md`,
    `docs/progress/hjwall-assets-workflows-gap-analysis.md`,
    `docs/progress/test-report.md`.
  - Requirements: R1.

## Phase 10 - Agent After Manual Parity

- [x] 59. Reopen Agent orchestration requirements after manual parity.
  - Include: CanvasPlan vocabulary equals production node/edge set, clarify
    branches, dropped warnings.
  - Scope note: requirements/design/tasks are refreshed only; Agent plan
    apply/run implementation remains Task 60 and is blocked by the Phase A
    acceptance gate until `HDR-PHASEA-001` has a human review pass or explicit
    product deferral.
  - Evidence: `tests/agent-orchestration-requirements-refresh.test.ts`,
    `specs/canvas-agent-orchestration/requirements.md`,
    `specs/canvas-agent-orchestration/design.md`,
    `specs/canvas-agent-orchestration/tasks.md`.
  - Requirements: R14, R15.

- [x] 60. Implement Agent plan apply/run over completed workflow vocabulary.
  - Include: same validation as manual UI, same style/assets/templates/snippets,
    serial run terminal state.
  - Evidence (2026-07-05): `shared/agent-plan-apply.ts`,
    `apply-agent-plan-on-ready.ts`, `canvas-plan-execution.ts`, `CanvasPage.tsx`
    wiring; `tests/agent-plan-apply-run.test.ts` + `canvas-plan-execution` 8/8.
    Product deferral for `HDR-PHASEA-001` recorded in
    `docs/progress/human-desktop-review-checklist.md` and
    `docs/progress/test-report.md` (engineering closure; human acceptance batched).
  - Requirements: R14, R15.

## Phase 11 - Infinite Canvas Evolution

- [x] 61. Write infinite canvas architecture note.
  - Include: graph state ownership, virtualization, viewport math, spatial
    indexing, selection model, minimap, persistence and autosave invariants.
  - Evidence: `docs/architecture/infinite-canvas-architecture.md`,
    `tests/infinite-canvas-architecture-note.test.ts`.
  - Requirements: R16.

- [x] 62. Add large-graph performance gates.
  - Include: 100/500/1000 node render tests where feasible, selector stability,
    visible-only rendering, drag/pan responsiveness checks.
  - Evidence: `desktop/src/main/smoke/large-graph-performance-gate.ts`,
    `tests/large-graph-performance-gates.test.ts`.
  - Scope note: current gate is deterministic smoke coverage for large graph
    operations and persistence; real desktop performance acceptance remains a
    later manual/browser gate.
  - Requirements: R16.

- [x] 63. Implement infinite canvas improvements.
  - Include: virtualized rendering or proven React Flow settings, stable
    dimensions, precise drop/context positioning, large graph save strategy.
  - Evidence: `tests/infinite-canvas-implementation-guard.test.ts`,
    `tests/large-graph-performance-gates.test.ts`,
    `desktop/src/renderer/src/canvas/CanvasPage.tsx`,
    `desktop/src/main/smoke/large-graph-performance-gate.ts`.
  - Scope note: implementation uses proven React Flow settings
    (`onlyRenderVisibleElements`, MiniMap, snap grid, min/max zoom), precise
    `screenToFlowPosition` drop/context placement, durable viewport
    persistence on move end, and deterministic large graph save/load smoke
    gates. Deeper custom virtualization remains a later optimization after
    desktop performance review.
  - Requirements: R16.
