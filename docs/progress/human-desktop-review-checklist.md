# Human Desktop Review Checklist

Date created: 2026-06-27

Canonical spec: `specs/hjwall-canvas-full-migration/`

Manual runbook: `docs/progress/phase-a-human-review-runbook.md`

Session template: `docs/progress/phase-a-human-review-session-template.md`

This checklist replaces agent-captured real desktop acceptance evidence. Codex
is responsible for implementation review, automated tests, and keeping this
checklist current. A human reviewer is responsible for final desktop user-flow
approval.

## Result Legend

| Result | Meaning |
| :--- | :--- |
| Pending | Not reviewed by a human yet. |
| Pass | Human reviewer completed the flow without blocking issues. |
| Fail | Human reviewer found a blocking issue. A follow-up task is required. |
| N/A | Flow is not applicable to the current slice. |

## Review Protocol

For each flow, record:

- Reviewer and date.
- App build or commit.
- Result: Pending, Pass, Fail, or N/A.
- Notes, including screenshots only when the reviewer chooses to provide them.
- Follow-up issue or task when the result is Fail.

Engineering completion may proceed when implementation review and automated
evidence pass. Final product acceptance requires the relevant human desktop
review rows to be Pass or explicitly deferred by product decision.

## Product Deferral (2026-07-05)

Product owner deferred batched human desktop acceptance until engineering tasks
in the current RUEPE queue complete. Until the batch review session:

- `HDR-PHASEA-001` and related HDR rows remain **Pending** in this checklist.
- Engineering tasks gated on Phase A (for example assets-workflows task 60) may
  close on automated evidence when implementation is complete.
- Final product sign-off requires a later human session using
  `docs/progress/hjwall-canvas-phase7-human-review-scenarios.md` and
  `docs/progress/phase-a-human-review-runbook.md`.

## Batch Acceptance Ready (2026-07-05)

M5 engineering queue is complete (milestone-execution-plan 47/47). Human reviewer
should follow `docs/progress/batch-human-acceptance-runbook-2026-07-05.md` to
execute Phase 7 scenarios and fill Pass/Fail rows below. HDR rows remain Pending
until a human completes the session.

## Human Phase A Acceptance Matrix

Phase A human acceptance covers assets and custom image categories,
project/templates and snippets, canvas shell and migrated non-MJ nodes, and
runtime, styles, models, and tool equivalence.

Agent automation remains out of scope for Phase A and should not be used as
acceptance evidence here.

MJ node/component actions are excluded from manual Phase A acceptance; legacy
MJ graphs may be opened only to confirm unsupported/unavailable behavior remains
readable.

Follow `docs/progress/phase-a-human-review-runbook.md` for the desktop review
order, R2 secret-handling rules, explicit product deferral format, and Task 60
gate.

| Area | Required Review Rows | Acceptance Note |
| :--- | :--- | :--- |
| Assets and categories | HDR-042, HDR-043, HDR-ASSET-001 through HDR-ASSET-009 | Covers local import, R2/SQLite storage behavior, user-defined image categories, safe references, and canvas insertion. |
| Workflows and snippets | HDR-WF-001 through HDR-WF-006, HDR-024 | Covers project lifecycle, import/export, public template copy, snippet insert/delete, validation, and remapped IDs. |
| Canvas and node UI | HDR-CANVAS-001 through HDR-CANVAS-005, HDR-NODE-001, HDR-NODE-002 | Covers shell layout, panels, local drop, edges, migrated non-MJ production nodes, editing modals, and prompt/reference controls. |
| Runtime and tools | HDR-RUNTIME-001, HDR-RUNTIME-002, HDR-TOOLS-001 | Covers node definitions, async recovery, run history, URL refresh, styles/models, structured errors, and Agent-ready tool vocabulary without enabling Agent automation. |
| Final pass | HDR-PHASEA-001 | Accepted only after all required rows are Pass or explicitly deferred by product decision. |

## Startup And Navigation

| ID | Flow | Result | Reviewer / Date | Notes |
| :--- | :--- | :--- | :--- | :--- |
| HDR-001 | Launch the Electron app and confirm the project list is visible. | Pending |  |  |
| HDR-002 | Open a project and confirm the canvas renders visible nodes, toolbar, and panels. | Pending |  |  |
| HDR-003 | Navigate between `/projects` and `/canvas` without a blank or inaccessible screen. | Pending |  |  |

## Workflow Project Lifecycle

| ID | Flow | Result | Reviewer / Date | Notes |
| :--- | :--- | :--- | :--- | :--- |
| HDR-010 | Create a project from the project list and open it on the canvas. | Pending |  |  |
| HDR-011 | Rename, switch, and soft-delete a project. | Pending |  |  |
| HDR-012 | Import a valid workflow JSON as a new project. | Pending |  |  |
| HDR-013 | Export the current workflow JSON and re-import it. | Pending |  |  |
| HDR-014 | Attempt invalid workflow JSON import and confirm readable failure feedback. | Pending |  |  |
| HDR-015 | Trigger dirty switching, close, and back navigation guards. | Pending |  |  |
| HDR-WF-001 | Review hjwall-parity my/public workflow project tabs, cards, create, import, copy, and delete. | Pending |  | Engineering slice has my/public tabs, create/import/delete, public template metadata cards, and public template copy wired to draft creation; final visual acceptance is manual. |
| HDR-WF-002 | Confirm workflow cards show cover, node/edge count, update time, run status, and archive/private/public state. | Pending |  | Engineering slice shows cover, node/edge count, update time, run status, archived state, and warning count; final visual acceptance is manual. |
| HDR-WF-003 | Copy a public template into a private draft and open it. | Pending |  | Engineering slice persists template metadata/scope/published/visibility status, lists public/my/all scopes, copies latest graph version to a private draft, and has strict-validation publish gating for local admin-like use. |
| HDR-WF-004 | Import/export workflow JSON and confirm dropped warnings are visible. | Pending |  | Engineering slice rejects invalid schema, secrets, and absolute paths; sanitizes imported graph content; imports as private draft; navigates to the imported canvas; and surfaces dropped warnings. Final product acceptance is manual desktop review. |
| HDR-WF-005 | Review version/debug metadata and strict-vs-lenient validation feedback. | Pending |  | Engineering slice lists immutable graph versions with created time, creator, checksum, node/edge counts, warning summary, restore source, restore-as-new-version behavior, lenient draft-save warnings, persisted validation warning summaries, and strict run/validate blocking errors. Final visual/product acceptance is manual desktop review. |
| HDR-WF-006 | List, inspect, delete, and insert snippet/templates with remapped IDs. | Snippet/template engineering complete; manual review pending |  | Task 48 covers snippet public/my scopes, metadata, detail fragments, owned delete protection, WorkflowPanel metadata/delete UI, and insert with remapped IDs plus one undo snapshot. Task 49 covers template metadata, public/my/all list scopes, copy-to-draft, imported-as-draft safety, and strict publish validation. |

## Canvas Interaction

| ID | Flow | Result | Reviewer / Date | Notes |
| :--- | :--- | :--- | :--- | :--- |
| HDR-020 | Add nodes from toolbar, context menu, and command palette. | Pending | Task 21 engineering-complete: toolbar quick tools, plus menu, pane context menu, command palette add commands, and connect-to-create allowed-target filtering are covered by automated tests. Manual desktop review still needs to confirm placement and interaction feel. |  |
| HDR-021 | Use duplicate, delete, fit view, pan/select mode, and command palette shortcuts. | Pending | Task 22 engineering-complete: unified keyboard handler covers save, undo/redo, duplicate/delete, fit view, select/pan modes, command palette, editable-field protection, and Mac-only Backspace delete behavior. Manual desktop review still needs to confirm OS keyboard feel. |  |
| HDR-022 | Drag image, video, and audio files onto the canvas and confirm node creation. | Pending | Task 23 engineering-complete: local batch drop planning covers image/video/audio classification, unsupported-file feedback, asset import, and cursor-near node creation. Manual desktop review still needs to confirm drag/drop feel and native file behavior. |  |
| HDR-023 | Try invalid and duplicate connections and confirm Chinese feedback appears quickly. | Pending | Task 24 engineering-complete: duplicate and invalid edge paths use shared validation and render Chinese feedback. Manual desktop review still needs to confirm timing and visual placement. |  |
| HDR-024 | Save a selected subgraph as a snippet and insert it into another project. | Pending |  |  |
| HDR-CANVAS-001 | Review top bar, left toolbar, save/import/export, style default, job status, plus menu, theme, and shortcut affordances. | Pending | Task 19 ownership cleanup, Task 20 shell parity, Task 21 add-node paths, and Task 22 shortcut parity are engineering-complete. Automated coverage checks top bar import/export/save/job/theme/default-style controls, left toolbar affordances, shortcut help, separate viewport controls, command-palette node creation, connect-to-create candidate filtering, and shortcut handling. Final visual acceptance remains manual desktop review. |  |
| HDR-CANVAS-002 | Drop local image/video/audio files and confirm import plus node placement at cursor. | Pending | Task 23 engineering-complete: multi-file drops import supported media, report rejected/failed items, and create staggered canvas nodes near the drop point. Final acceptance remains manual desktop review. |  |
| HDR-CANVAS-003 | Hover/select related nodes and confirm invalid/duplicate connection feedback across all creation paths. | Pending | Task 24 engineering-complete: direct neighbors highlight on hover, single selection, and drag release; invalid/duplicate connection feedback is covered by automated tests. Manual desktop review still needs to confirm visual clarity across real canvas flows. |  |
| HDR-CANVAS-004 | Review semantic edge rendering for prompt order, image order, image role, output links, references, and deletion. | Pending | Task 25 engineering-complete: semantic edge components render prompt/image order labels, image role labels, output/reference labels, and shared delete controls through the canvas store. Manual desktop review still needs to confirm visual clarity and deletion feel on a real canvas. |  |
| HDR-CANVAS-005 | Review workflow, snippet, asset, category, style, run, bottom input, and gated chat panels. | Pending | Task 26 engineering-complete: WorkflowPanel, CanvasAssetPanel, CharacterLibraryPanel, StyleLibraryPanel, CanvasJobPanel, BottomInputPanel, and gated CanvasChatBox are wired into CanvasPage with toolbar entries. Task 50 replaces the style placeholder with a real style list/default panel. Manual desktop review still needs to confirm layout, panel stacking, and real interaction feel. |  |

## Node And Run Flows

| ID | Flow | Result | Reviewer / Date | Notes |
| :--- | :--- | :--- | :--- | :--- |
| HDR-030 | Edit text, image, video, imageConfigV2, and videoConfigV2 nodes. | Text/image/video/imageConfigV2/videoConfigV2 engineering complete; manual review pending |  | Tasks 28-31 cover TextNode plus ImageNode/VideoNode safe preview, picker, edit entry, run/status, writeback, ImageConfigV2 prompt/model/style/ratio controls, upstream image references, async run, result selection, and writeback, and VideoConfigV2 prompt/model/style/duration/ratio/resolution controls, first/last frame/reference assets, async run, and writeback. Task 13 (2026-07-04) fixed a real dispatch bug found during stabilization: imageConfigV2/videoConfigV2 previously fell through to bare/no-op run paths (missing `jobTypeForNodeType` case, missing `CanvasPage` run-context wrapper, and `buildRunDescriptor` skipping `compileWorkflowNodeRuntimeSnapshot`), and both nodes had a duplicate `canvasStore.nodeRunStatus` Map-based status mechanism running alongside `node.data.status` where VideoConfigV2's generate button set `status: 'running'` with no way to ever leave it. All three are now fixed: nodes carry a real `onRun` callback wired through `CanvasPage`'s run context to `handleRunNode`/`window.comicCanvas.runCanvasNode`, `buildRunDescriptor` routes both types through the runtime-snapshot compiler for prompt/style/duration/resolution composition, and the Map-based status store was removed in favor of `node.data.status` as the single source of truth. |
| HDR-031 | Add character and scene nodes when available. | Character/scene engineering complete and independently verified; manual review pending |  | Task 14 (2026-07-04) independently audited character/scene: real structured components, shared contracts, connection-matrix rows, prompt-contribution compiler logic, insert-from-library hook, and serialization round-trip, with 11/11 tests re-run and passing across `character-scene-node-parity.test.tsx`, `production-node-components-parity.test.tsx`, `workflow-graph-compiler.test.ts`, and `canvas-panels-parity.test.ts`. |
| HDR-031B | Add audio, videoCompose, muxAudioVideo, and superResolution nodes when available. | Audio: engineering complete and independently verified (task 15, 2026-07-04); videoCompose/muxAudioVideo/superResolution: engineering complete and independently verified (tasks 16-17, 2026-07-04); mjImage: intentionally non-runnable by design (task 17, 2026-07-04) |  | Task 15 independently audited audio node/asset integration: real playback/binding/import-metadata-parsing/matrix/serializer support, 9 test files / 32 tests re-run and passing. Three non-blocking gaps tracked (dead onImport/onViewAsset wiring shared with character/scene precedent, forward-looking-but-unreachable canvas.generateAudio pipeline, duration not propagated from asset metadata to node data) — see task 15 evidence in tasks.md. Task 16 (2026-07-04) audited videoCompose/muxAudioVideo/superResolution and found a real, previously-undetected regression: these three node types were registered as bare components (no `CanvasPage.tsx` wrapper), so their `onRun` prop was always `undefined` — clicking "运行" set `status: 'running'` and then did nothing, with no recovery path (the run button self-disables while running). Fixed by adding `VideoComposeNodeWrapper`/`SuperResolutionNodeWrapper`/`MuxAudioVideoNodeWrapper` following the existing `ImageNodeWrapper`/`VideoConfigV2NodeWrapper` precedent; added `tests/task16-post-production-run-dispatch.test.ts` (5 tests) to close the coverage hole; 22/22 tests re-run passing, `tsc --noEmit` clean. Task 17 (2026-07-04) confirmed superResolution's run dispatch is now correct end-to-end (both the CanvasPage UI path and the independent Agent-tool `canvas.runNode` path), and confirmed mjImage's non-runnability is an intentional, multiply-enforced design decision per R4.7 (`workflow-node-definitions.ts`'s `runnable: false`/`unavailableReason`, `CanvasPage.tsx`'s `jobTypeForNodeType` returning `null`, and the Agent-tool layer throwing a classified "Runtime unavailable" error) rather than a defect; 26/26 tests re-run passing. Two non-blocking gaps tracked for both tasks (parameter validation is pass-through only project-wide; stub job handlers don't create asset references, matching the already-accepted pattern from earlier closed tasks) — see task 16/17 evidence in tasks.md. |
| HDR-032 | Run stub image/video/composition jobs and confirm ticket-first behavior with terminal UI state. | Pending |  |  |
| HDR-033 | Reopen a canvas after completed jobs and confirm one-shot reconciliation without visible polling behavior. | Pending |  |  |
| HDR-NODE-001 | Review production node UI for the migrated non-MJ node set and confirm placeholder behavior is gone. | Engineering complete; manual review pending |  | Task 27 concrete components registered; Tasks 28-35 cover current local deep parity. MJ node/component is out of scope for the local Phase A pass. |
| HDR-NODE-002 | Review image editor, inpaint gate, asset picker, media controls, connected inputs, and mention textarea flows. | Image editor, inpaint gate, media input controls, connected inputs, and mention textarea engineering complete; broader manual review pending |  | Tasks 37-41 cover ImageNode editor modal with crop percentages, rotation, orientation/aspect preview, node/asset apply target, structured ImageEditIntent payload, explicit local inpaint unavailable gate with safe preview, image/video/audio picker support, shared select/clear controls, compact mode, external URL gate, prompt/image order chips, reference asset chips, final prompt preview convergence, and MentionTextarea token chips, caret dropdown, IME guard, atomic deletion, and six non-MJ usage points. |

## Style And Asset Library

| ID | Flow | Result | Reviewer / Date | Notes |
| :--- | :--- | :--- | :--- | :--- |
| HDR-040 | Select a project default style and confirm the selected state is visible. | Style engineering complete; manual review pending |  | Task 50 covers toolbar project selector plus canvas StyleLibraryPanel list/default actions, cover/tags/default marker rendering, and clearing deleted project defaults. |
| HDR-041 | Select a node-level style override and run a stub generation. | Runtime engineering complete; manual review pending |  | Task 50 covers node override over project default, deterministic styled prompt and negative prompt injection, and disabled-style strict validation blocking enqueue. |
| HDR-042 | Import assets, move them between folders, search/filter/sort, and insert into canvas. | Pending |  |  |
| HDR-043 | Attempt to delete a referenced asset and confirm safe-delete behavior. | Pending |  |  |
| HDR-ASSET-001 | Open `/assets` and confirm tabs, counts, search, sort, filters, loading, empty, and error states. | Asset shell engineering complete; manual review pending |  | Task 7 covers URL-synced media tabs/search/sort/date filters, counted type tabs, upload entry, responsive grid/list shells, folder/category sidebars, skeleton loading, error feedback, and empty states. |
| HDR-ASSET-002 | Upload multiple files and confirm per-file progress, current filename, success refresh, and readable failures. | Upload card engineering complete; manual review pending |  | Task 8 covers busy disabled upload entry, file index/count/current filename, percent complete, successful import list refresh, and mixed-batch failure feedback with the failed filename. |
| HDR-ASSET-003 | Preview, rename, delete, select, and batch delete assets with reset after exit. | Asset card/preview engineering complete; manual review pending |  | Task 9 covers thumbnails/fallbacks, preview metadata, image/video/fallback previews, display rename without URL/path changes, single safe delete feedback, and batch select/delete reset. |
| HDR-ASSET-004 | Confirm built-in role/scene/prop/creature image categories and create a custom category. | Pending |  |  |
| HDR-ASSET-005 | Assign image assets to categories/tags and filter by category, tag, keyword, sort, and media type. | Pending |  |  |
| HDR-ASSET-006 | Insert one categorized image as image, character, scene, and reference input where the canvas context allows it. | Pending |  |  |
| HDR-ASSET-007 | Import image/video/audio assets and confirm safe metadata display without absolute local paths. | Pending |  |  |
| HDR-ASSET-008 | Attempt to trash a categorized referenced asset and confirm block or tombstone behavior. | Pending |  |  |
| HDR-ASSET-009 | Configure the verified `wenyi` R2 storage profile from SQLite, upload, query, and delete a test object, then confirm secrets are not visible in renderer UI or logs. | R2/SQLite storage engineering complete; manual review pending |  | Phase A storage review covers `storage_configs`, encrypted secret persistence, default verified `wenyi` profile behavior, R2 HeadBucket/query/upload/delete smoke behavior, and renderer secret redaction. Reviewers must use local configuration and must not write credentials into the repository or notes. |
| HDR-RUNTIME-001 | Run node-definition filtering, generation/polish recovery, run history, and asset URL refresh flows with prompt/reference snapshots visible where applicable. | Node definition, graph compiler, non-MJ generation recovery, text polish async recovery, run history, and safe URL refresh engineering complete; manual review pending |  | Tasks 42-47 cover shared node definitions with capabilities, allowed inputs/outputs, addable/connect-create/runnable flags, Canvas add-menu filtering, connect-to-create filtering, ToolRuntime unavailable runtime rejection for MJ, deterministic runtime snapshots with styled prompt, prompt parts, ordered references, image roles, model keys, run action, parameters, non-MJ generation task lists, one-shot reopen reconciliation, terminal asset/report writeback, failed-job message writeback, TextNode AI polish ticket enqueue, `canvas.polishText` realtime content/html/polishStatus writeback, failed polish error recovery, CanvasPage recovery summary without polling, CanvasJobPanel run list/detail, output summaries, failed/canceled detail states, manual rerun through `canvas.runNode`, and workflow asset URL resolution with local `cc-asset://` fallback, configured cloud `query(s3Key)` refresh/re-sign, and storage host guard. MJ URL refresh remains out of scope. |
| HDR-RUNTIME-002 | Review style/model/feature flag loading, disabled markers, and deterministic project/node style behavior. | Style/model/feature engineering complete; manual review pending |  | Task 50 covers style disabled markers, cover/tags, project default set/clear, node override runtime precedence, deleted default cleanup, and disabled-style run blocking. Task 51 covers renderer-safe model catalog, text/image/video/tool model lists, capability flags, live Canvas unavailable-model validation, and feature-flag disabled node filtering. |
| HDR-TOOLS-001 | Compare manual UI actions and tool/service-backed effects for durable graph, asset, workflow, snippet, style, and job operations. | ToolRuntime expansion and Agent-ready vocabulary engineering complete; manual review pending |  | Task 52 covers graph validation, node duplicate/rename/position, edge delete/update, connect-to-create, selection extract/duplicate/delete, deterministic selection layout, and a documented service-backed equivalence table for save/load/version/import/export, snippets, workflow project/template, style resolution, job recovery, media drop/edit, and asset category/reference operations. Task 53 covers permission descriptors, structured `ToolError.code/details`, `invalid_edge`, retryable `job_enqueue_failed`, and documented validation/asset/style/model/job codes for Agent recovery. Task 54 covers shared durable graph semantics through `shared/canvas-actions.ts` for renderer store/manual flows and Canvas ToolRuntime create/connect/default-data/duplicate/delete behavior. Task 55 documents the Agent-ready vocabulary in `docs/api-contracts/tools-agents.md`, generated from current `createCanvasTools` descriptors, including the permission model, unsupported/manual-only actions, and future plan-apply examples. Agent automation is still not enabled in Phase A. Transient viewport/hover/drag preview states remain UI-only. MJ node/component actions are excluded from Phase A. |
| HDR-PHASEA-001 | Perform final Phase A pass across assets, workflows, canvas shell, nodes, runtime, snippets, styles, and tool equivalence. | Pending |  | Verify the Human Phase A Acceptance Matrix row by row. Final acceptance requires required rows to be Pass or explicitly deferred by product decision, with failures linked to follow-up tasks. This row does not include Agent automation, infinite canvas performance work, Seedance/live-person systems, or MJ node/component implementation. |

## Agent Orchestration

| ID | Flow | Result | Reviewer / Date | Notes |
| :--- | :--- | :--- | :--- | :--- |
| HDR-050 | Ask Agent for a short comic-drama image-to-video chain with named character and style. | Pending |  | Task 60 is blocked while `HDR-PHASEA-001` is Pending; this review row must not be executed as Agent automation until Phase A is passed or explicitly deferred. |
| HDR-051 | Review PlanCard migrated node/action summary and apply the plan. | Pending |  | Task 60 is blocked while `HDR-PHASEA-001` is Pending; migrated PlanCard apply/run remains disabled until Phase A is passed or explicitly deferred. |
| HDR-052 | AutoExecute the plan and confirm migrated run steps reach visible terminal states in serial order. | Pending |  |  |
