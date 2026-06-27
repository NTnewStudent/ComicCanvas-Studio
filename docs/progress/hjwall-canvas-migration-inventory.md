# hjwall Canvas Migration Inventory

Date: 2026-06-26

Canonical spec: `specs/hjwall-canvas-full-migration/`

This inventory records user-visible hjwall canvas capabilities that must be
re-implemented or explicitly adapted in ComicCanvas. It is intentionally
evidence-based: historical backlog rows marked complete are not treated as
completion proof until current implementation, tests, and real desktop flow
evidence agree.

## Reference Boundaries

Reference-only modules:

| Area | hjwall Reference |
| :--- | :--- |
| Canvas shell and interactions | `hjwall/pc-client/src/modules/workflow-canvas/WorkflowCanvasPage.tsx` |
| Canvas project pages | `hjwall/pc-client/src/modules/workflow-canvas/views/` |
| Canvas store and graph serialization | `hjwall/pc-client/src/modules/workflow-canvas/store.ts`, `lib/graph.ts` |
| Connection rules | `hjwall/pc-client/src/modules/workflow-canvas/lib/connectRules.ts`, `backend/src/modules/workflow/workflow.constants.ts` |
| Asset library | `hjwall/pc-client/src/modules/asset/`, `workflow-canvas/components/AssetLibraryPanel.tsx` |
| Style library | `hjwall/backend/src/modules/style/`, `workflow-canvas/components/StyleLibraryPanel.tsx` |
| Async generation status | `hjwall/pc-client/src/modules/workflow-canvas/hooks/useGenerationTasks.ts`, `backend/src/modules/workflow/*generation*` |
| Agent orchestration | `hjwall/backend/src/modules/workflow/workflow-chat.service.ts`, `pc-client/src/modules/workflow-canvas/lib/plan-applier.ts`, `lib/plan-runner.ts` |

No source files from `hjwall/` are to be copied into ComicCanvas.

## Current ComicCanvas Evidence Snapshot

| Evidence | Current Finding | Migration Impact |
| :--- | :--- | :--- |
| `shared/nodes.ts` | Current node union includes `text`, `image`, `video`, `imageConfigV2`, `videoConfigV2`. | Missing production semantic nodes: character, scene, audio, videoCompose, superResolution, muxAudioVideo, mjImage. |
| `shared/connection-matrix.ts` | Matrix only covers current narrow node set. | Must expand before migrated node UI/runtime can be truthful. |
| `desktop/src/renderer/src/canvas/CanvasPage.tsx` | Has toolbar, context menu, asset panel, chat box, save/load, and project manager wiring. | Needs revalidation in real desktop and missing drag/drop/snippet/command-palette parity. |
| `desktop/src/renderer/src/canvas/nodes/` | Has text/image/video plus image/video config V2 components. | Existing V2 nodes include frontend-only style stub behavior that must be replaced by real style contracts. |
| `desktop/src/main/db/schema.ts` | Has workflows, workflow_versions, assets, asset_folders, asset_references, jobs, chat_messages. | Good foundation; style preset table/contract is missing. |
| `desktop/src/main/ipc/canvas.handler.ts` | Has save/load/applyPlan/runPlan/list/create/rename/delete workflow handlers. | Needs project lifecycle hardening, import/export, run dispatch expansion, and complete JSDoc/contract audit. |
| `desktop/src/main/ipc/asset.handler.ts` | Has import/list/move/trash/folder handlers. | Needs metadata extraction, reference wiring, desktop insert flow verification. |
| Tests under `tests/` | Broad M1-M5 unit/component coverage exists. | Passing isolated tests is not enough; real desktop flows still required. |
| `docs/progress/hjwall-migration-report.md` | Records known limits: stub ChatBox, @mention edge validation gap, fixed autosave interval, native module ABI issue. | These are follow-up tasks, not completed migration evidence. |

## Capability Inventory

| ID | hjwall Capability | ComicCanvas Status | Gap / Adaptation | Target REQ |
| :--- | :--- | :--- | :--- | :--- |
| INV-CANVAS-001 | Project list with local user projects and template entry points. | Partial: project manager exists inside canvas; project list page exists separately. | Need one verified desktop flow: create project from list, open canvas, save/reopen, delete. | REQ-091 |
| INV-CANVAS-002 | Workflow graph save/load with dirty state and leave guard. | Partial: save/load and autosave exist in renderer/main. | Need conflict/dirty guard proof and invalid-edge load warnings. | REQ-091 |
| INV-CANVAS-003 | Import/export workflow JSON. | Not verified in current Electron implementation. | Add IPC/UI if absent; validate graph and asset path safety. | REQ-091 |
| INV-CANVAS-004 | Toolbar quick-add and add menu. | Partial: toolbar quick tools exist. | Need command palette parity and desktop shortcut verification. | REQ-092 |
| INV-CANVAS-005 | Canvas right-click add node and node operation menu. | Partial: pane/node context menu exists. | Need duplicate/delete tests and add-at-cursor desktop verification. | REQ-092 |
| INV-CANVAS-006 | Connect-to-create and semantic edge inference. | Partial in hjwall reference; not complete in current ComicCanvas. | Add or explicitly defer connect-to-create; all paths must use shared matrix. | REQ-092 |
| INV-CANVAS-007 | Local media drag/drop to canvas. | Missing in current observed ComicCanvas canvas. | Implement import-through-asset-pipeline and node creation at drop point. | REQ-092, REQ-095 |
| INV-CANVAS-008 | Selection action bar and save selected nodes as reusable snippet. | Missing or not verified in current ComicCanvas. | Add snippet storage, ID remap insertion, and undo snapshot. | REQ-092 |
| INV-CANVAS-009 | Command palette for canvas actions. | Missing in current ComicCanvas. | Re-implement with ComicCanvas node/actions and keyboard shortcut. | REQ-092 |
| INV-CANVAS-010 | Keyboard shortcuts: undo, redo, save, duplicate, delete, fit, pan/select, command palette. | Partial: undo/redo/save and context actions exist. | Centralize and test shortcut behavior. | REQ-092 |
| INV-NODE-001 | Text node with prompt contribution, focus editing, inline rename, polish state. | Partial: text node and tests exist. | Add/verify polish state and prompt contribution parity. | REQ-093 |
| INV-NODE-002 | Image and video asset nodes with safe preview. | Partial: image/video nodes exist. | Verify asset ID/safe URL writeback and desktop preview. | REQ-093, REQ-095 |
| INV-NODE-003 | ImageConfigV2 self-contained image generation node. | Partial: component exists. | Remove frontend-only style presets; wire real style, run, status, and asset reference. | REQ-093, REQ-094, REQ-096 |
| INV-NODE-004 | VideoConfigV2 self-contained video generation node. | Partial: component exists. | Complete style selection, frame/reference asset picking, run/status/result flow. | REQ-093, REQ-094, REQ-096 |
| INV-NODE-005 | Character node and character library insertion. | Missing from shared node contract. | Add contract, UI, prompt/reference semantics, asset insertion. | REQ-093 |
| INV-NODE-006 | Scene node and scene reference workflow. | Missing from shared node contract. | Add contract, UI, prompt/reference semantics. | REQ-093 |
| INV-NODE-007 | Audio node and audio asset support. | Missing from shared node contract. | Add import/preview/connection support. | REQ-093, REQ-095 |
| INV-NODE-008 | Video compose node. | Missing from shared node contract. | Add graph/run dispatch and stub output. | REQ-093, REQ-096 |
| INV-NODE-009 | Super resolution node. | Missing from shared node contract. | Add parameters, graph/run dispatch, and stub output. | REQ-093, REQ-096 |
| INV-NODE-010 | Mux audio/video node. | Missing from shared node contract. | Add graph rules, audio+video inputs, run dispatch, output. | REQ-093, REQ-096 |
| INV-NODE-011 | MJ multi-image generation node. | Missing from shared node contract. | Add multi-result UI and asset writeback policy if accepted. | REQ-093, REQ-096 |
| INV-STYLE-001 | Style preset list/detail with cover and enabled state. | Missing real ComicCanvas style contract/repo. | Add `shared/styles.ts`, `docs/api-contracts/styles.md`, schema/repo/IPC/UI. | REQ-094 |
| INV-STYLE-002 | Project default style and node override. | Partial data field exists on V2 nodes only. | Persist default style on workflow/project and resolve inheritance in runtime. | REQ-094 |
| INV-STYLE-003 | Deterministic style prompt injection. | Missing current shared/main function evidence. | Implement pure composeStyledPrompt and byte-equivalence tests. | REQ-094 |
| INV-ASSET-001 | Asset folders, search, filter, sort. | Partial: asset folder UI/repo work exists. | Verify with desktop and fill missing loading/error/insert states. | REQ-095 |
| INV-ASSET-002 | Asset import with metadata and safe URLs. | Partial: import handler exists; metadata extraction limited. | Add orientation/duration extraction where feasible and user-visible import errors. | REQ-095 |
| INV-ASSET-003 | Asset reference integrity. | Partial: asset_references table/repo concepts exist. | Wire node/job references and deletion blocking/tombstone UI. | REQ-095 |
| INV-RUN-001 | Enqueue-only generation and terminal event writeback. | Partial: jobs and tests exist for current node set. | Expand to migrated node set and desktop verify no blocking UI. | REQ-096 |
| INV-RUN-002 | One-shot job reconciliation after reopen. | Partial: event-driven hooks exist; full flow not verified. | Add explicit reconciliation tests for missed events. | REQ-096 |
| INV-AGENT-001 | Natural language to full comic-drama CanvasPlan. | Partial: orchestrator and Plan flow exist for narrow nodes. | Expand plan vocabulary and clarify behavior for migrated nodes/style/assets. | REQ-097 |
| INV-AGENT-002 | Plan apply and serial run over migrated nodes. | Partial: applyPlan and PlanRunner exist. | Expand run-step mapping and dropped warnings. | REQ-097 |
| INV-QA-001 | Real desktop acceptance for full comic-drama path. | Not completed in current evidence. | Launch app, verify project/canvas/asset/style/agent flows from user perspective. | REQ-098 |

## Immediate Execution Order

1. Reverify desktop startup and fix black/blank screen if present.
2. Run current automated gates to establish a fresh baseline.
3. Implement the first missing user-critical slice: media drag/drop plus asset
   insert-to-canvas, because it exercises canvas, assets, IPC, and real user
   workflow without needing real gateway calls.
4. Implement style preset contracts before expanding V2 generation node style
   UI, because current frontend-only preset lists would otherwise harden a demo
   behavior.
5. Expand shared node/connection contracts only in vertical slices, with tests
   before enabling UI affordances.

## Known Risks

- Current backlog contains historical "complete" labels that may be stronger
  than current runtime evidence.
- Existing docs have mixed encodings in older files; new specs should remain
  UTF-8 and canonical.
- Renderer startup must be verified before claiming any UI migration complete.
- Reference projects in the workspace must remain excluded from commits.
