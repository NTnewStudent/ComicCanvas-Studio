# Implementation Plan - Milestone Execution Plan

> Canonical execution tasks migrated from historical `task/M0-M5` and extended with missing platform work from `specs/core-platform-foundation/`. Do not execute from `task/`; use this file plus the module contracts in `docs/api-contracts/`.

## M0 - Foundation Closeout

- [x] 1. Mark `task/` as historical reference.
  - Create `task/README.md` stating `task/M0-M5` is not an execution source of truth.
  - Verify: `rg -n "source of truth|canonical" task/README.md`.
  - Covers: R1, INV-1.

- [x] 2. Complete foundation API contract docs.
  - Required docs: `canvas-plan.md`, `jobs.md`, `assets-files.md`, `gateway-providers.md`, `tools-plugins.md`, `agents.md`, `skills.md`, `knowledge-context.md`, `audit-observability.md`.
  - Verify: each doc includes request/response, errors, permissions, tests, and owner.
  - Covers: R1, INV-2.

- [x] 3. Split shared platform contracts.
  - Create or update: `shared/jobs.ts`, `shared/assets.ts`, `shared/gateway.ts`, `shared/tools.ts`, `shared/agents.ts`, `shared/skills.ts`, `shared/knowledge.ts`, `shared/ipc.ts`.
  - Verify: TypeScript strict compile; no duplicate authoritative definitions.
  - Covers: R1.

- [x] 4. Reconcile M0 backlog status.
  - Check actual files/tests for REQ-001..009 instead of trusting historical task status.
  - Verify: backlog status reflects current repo evidence.
  - Covers: R1.

## M1 - Runnable Electron Skeleton

- [x] 5. Create Electron/Vite/React skeleton.
  - Files: `desktop/src/main/`, `desktop/src/preload/`, `desktop/src/renderer/`, `electron.vite.config.ts`, `tsconfig.json`.
  - Verify: `bun run dev` opens BrowserWindow; `bun run build` compiles.
  - Covers: R2.

- [x] 6. Enforce Electron renderer security.
  - BrowserWindow: `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`.
  - Preload: typed `contextBridge.exposeInMainWorld` APIs only.
  - Verify: static test checks BrowserWindow config and preload has no raw `ipcRenderer` exposure.
  - Covers: R2, INV-5.

- [x] 7. Implement DB schema and migration baseline.
  - Tables: jobs, assets, asset_folders, asset_references, workflow/project/version, chat_message, gateways, tools, agents, skills, knowledge, context/audit tables.
  - Verify: migration runs against local SQLite test DB.
  - Covers: R2.

- [x] 8. Implement repository boundaries.
  - Files: `desktop/src/main/db/repositories/job.repo.ts`, `asset.repo.ts`, `workflow.repo.ts`, `chat-message.repo.ts`, plus gateway/tool/agent/skill/knowledge repos as stubs if needed.
  - Verify: service/IPC layers do not contain raw SQL/Drizzle queries.
  - Covers: R2.

- [x] 9. Implement JobRuntime skeleton.
  - Files: `desktop/src/main/jobs/queue.ts`, `worker.ts`, `recovery.ts`, `events.ts`.
  - Behavior: enqueue writes pending row and returns ticket; worker consumes pending; startup reconciles processing jobs.
  - Verify: unit test pending -> processing -> completed/failed with exactly one terminal event.
  - Covers: R2, INV-3.

- [x] 10. Implement stub Gateway/provider.
  - Files: `desktop/src/main/providers/stub.provider.ts`, `registry.ts`.
  - Behavior: returns deterministic image bytes and metadata within test timeout.
  - Verify: unit test stable result envelope and no provider-specific leak into renderer response.
  - Covers: R2.

- [x] 11. Implement AssetService baseline.
  - Files: `desktop/src/main/assets/pipeline.ts`, `protocol.ts`.
  - Behavior: save bytes by hash, classify orientation, expose safe asset protocol, reject traversal.
  - Verify: orientation property tests and traversal rejection tests.
  - Covers: R2, INV-3.

- [x] 12. Implement IPC skeleton.
  - Files: `desktop/src/main/ipc/canvas.handler.ts`, `job.handler.ts`, `asset.handler.ts`, `gateway.handler.ts`.
  - Behavior: Zod/schema validation, safe error envelopes, contract anchors.
  - Verify: handler contract tests and sync response deep-scan for bytes/paths.
  - Covers: R2, INV-2, INV-3.

- [x] 13. Run M1 smoke path.
  - Flow: create image node -> `canvas.runNode` -> enqueue -> stub provider -> asset save -> terminal event -> renderer node update.
  - Verify: DB job completed, asset has relative path/orientation, renderer shows safe URL, no polling.
  - Covers: R2, INV-3, INV-5.

## M2 - Complete Canvas

Renderer UI tasks in M2 must use the desktop Tailwind pipeline, the shared `cn` helper, and `hjwall/pc-client` canvas component patterns as the primary reference before adapting the implementation to ComicCanvas contracts and `global/design/DESIGN.md`.

- [x] 14. Implement canvas store.
  - File: `desktop/src/renderer/src/canvas/store/canvas.store.ts`.
  - Include: nodes, edges, viewport, undo/redo, `applyChange`, add/delete node/edge, snapshot folding.
  - Verify: addNode -> deleteNode -> undo restores state.
  - Covers: R3.

- [x] 15. Implement Text node.
  - File: `desktop/src/renderer/src/canvas/nodes/TextNode.tsx`.
  - Include: collapsed label, expanded textarea, outside-click collapse, internal scroll, inline rename hook.
  - Verify: component test click -> expand -> input -> blur -> collapse.
  - Covers: R3.

- [x] 16. Implement Image node.
  - File: `desktop/src/renderer/src/canvas/nodes/ImageNode.tsx`.
  - Include: idle/expanded/pending/running/done/error states, prompt/model/orientation controls, generate button, safe image preview.
  - Verify: four-state rendering tests and run button invokes `canvas.runNode`.
  - Covers: R3.

- [x] 17. Implement Video node.
  - File: `desktop/src/renderer/src/canvas/nodes/VideoNode.tsx`.
  - Include: prompt/model/orientation/duration controls, first/last frame selector, safe video preview.
  - Verify: state rendering tests and upstream image selection test.
  - Covers: R3.

- [x] 18. Implement connection validation UX.
  - Include: `onConnect` uses `shared/connection-matrix.ts`, duplicate edge rejection, toast reason within 200ms.
  - Verify: 3x3 connection matrix tests and duplicate rejection test.
  - Covers: R3.

- [x] 19. Implement Connected Inputs Panel.
  - Component: `ConnectedInputsPanel`.
  - Include: ordered upstream text list, final prompt preview using shared `composeFinalPrompt`, live updates from store selectors.
  - Verify: two upstream text nodes produce byte-equivalent preview.
  - Covers: R3.

- [x] 20. Implement node sizing and inline rename primitives.
  - Files: orientation-size constants, `useInlineRename`, NodeResizer integration.
  - Verify: Enter saves, Escape cancels, empty value rejected; skeleton size matches final media ratio.
  - Covers: R3.

- [x] 21. Implement graph save/load.
  - IPC: `canvas.saveGraph`, `canvas.loadGraph`.
  - Behavior: repository transaction, reload latest graph, revalidate edges.
  - Verify: save -> app restart/load simulation -> nodes/edges/viewport match.
  - Covers: R3.

- [x] 22. Enforce zero polling in renderer.
  - Verify: static scan for asset status `setInterval`/polling loops; e2e confirms updates via IPC/query invalidation.
  - Covers: R3, INV-5.

## M3 - Gateway System

- [ ] 23. Implement OpenAI-compatible provider adapter.
  - File: `desktop/src/main/providers/openai-compatible.provider.ts`.
  - Include: request schema, response schema, base64 and URL result handling, normalized GatewayResult.
  - Verify: mock fetch tests and key redaction assertions.
  - Covers: R4.

- [ ] 24. Implement async media task adapter.
  - Files: `async-media.provider.ts`, `polling-strategy.ts`.
  - Include: submit, poll with backoff, timeout, worker-side cancellation checks, progress events.
  - Verify: mock polling tests for completed, failed, timeout, and cancellation.
  - Covers: R4.

- [ ] 25. Implement Gateway settings UI.
  - Files: `desktop/src/renderer/settings/GatewayList.tsx`, `GatewayForm.tsx`.
  - Include: add/edit/delete/test, enabled switch, masked key display, model mapping fields.
  - Verify: component tests for save/delete/test IPC calls.
  - Covers: R4.

- [ ] 26. Implement encrypted key vault.
  - File: `desktop/src/main/security/key-vault.ts`.
  - Include: safeStorage availability check, encrypt/decrypt, refusal path when unavailable.
  - Verify: roundtrip test and grep/log assertions for no plaintext key.
  - Covers: R4.

- [ ] 27. Implement provider hot reload and model map.
  - Include: `GatewayRegistry.set`, `gateway.reload`, in-flight jobs keep original provider, future jobs use new provider.
  - Verify: integration test switch provider -> new job uses new provider; old job completes with original.
  - Covers: R4.

## M4 - Agent Orchestration

- [ ] 28. Implement orchestrator AsyncGenerator run.
  - File: `desktop/src/main/agent/orchestrator.ts`.
  - Behavior: `canvas.chatSend` returns ticket within one second; orchestration job emits completion event.
  - Verify: mock model test for pending response and async Plan availability.
  - Covers: R5.

- [ ] 29. Implement ToolRuntime and canvas tools.
  - Files: `desktop/src/main/tools/`, `desktop/src/main/tools/canvas/`.
  - Tools: queryGraph/getGraph, proposePlan, createNode/addNode, connectNodes/addEdge, updateNodeData, deleteNode, runNode.
  - Verify: schema validation, permission rejection, read parallel/write serial behavior.
  - Covers: R5.

- [ ] 30. Implement sanitizePlan.
  - File: `desktop/src/main/agent/sanitize-plan.ts`.
  - Include: node whitelist, connection matrix, run action whitelist, executable-string stripping, dropped records.
  - Verify: property/injection tests with at least 100 generated cases.
  - Covers: R5.

- [ ] 31. Implement chat plan IPC.
  - IPC: `canvas.chatSend`, `canvas.chatGetPlan`, `canvas.planReady` or documented equivalent.
  - Persist: `chat_message` rows with plan JSON and apply status.
  - Verify: synchronous response has no Plan; completion event allows plan fetch.
  - Covers: R5.

- [ ] 32. Implement applyPlan and PlanRunner.
  - Files: `desktop/src/renderer/src/canvas/lib/apply-plan.ts`, `plan-runner.ts`.
  - Include: revalidation, layered layout, one undo snapshot, serial runSteps, failure short-circuit.
  - Verify: unit tests for legal/illegal Plan, three-step serial run, step two failure.
  - Covers: R5.

- [ ] 33. Implement Chat UI.
  - Files: `desktop/src/renderer/src/chat/ChatPanel.tsx`, `PlanCard.tsx`.
  - Include: history, Plan summary, dropped warning, apply button, autoExecute, Enter/Shift+Enter.
  - Verify: component tests for PlanCard and apply flow.
  - Covers: R5.

- [ ] 34. Run agent orchestration smoke path.
  - Flow: "生成一个图片节点，内容是：宇宙飞船" -> Plan -> applyPlan -> runNode -> stub asset -> done node.
  - Verify: no synchronous wait, no asset polling, sanitize injection case records dropped item.
  - Covers: R5.

## M5 - Advanced Platform

- [ ] 35. Implement spawnSubAgent.
  - File: `desktop/src/main/agent/spawn-sub-agent.ts`.
  - Include: child permission subset, depth limit, independent run trace, result return to parent.
  - Verify: superset tools rejected, depth exceeded rejected, normal child result accepted.
  - Covers: R6, INV-4.

- [ ] 36. Implement sub-agent isolation and merge.
  - Include: draft graph/context copy, no DB write before parent merge, `applySubAgentResult` sanitization.
  - Verify: child write does not change persisted graph before merge.
  - Covers: R6.

- [ ] 37. Implement custom Agent settings.
  - Files: `AgentList.tsx`, `AgentForm.tsx`; IPC/domain APIs from `docs/api-contracts/agents.md`.
  - Include: create/edit/delete user agents, built-in read-only protection, allowed tool/skill selection.
  - Verify: form validation and IPC tests.
  - Covers: R6.

- [ ] 38. Implement @mention Agent selector.
  - Files: `AgentMentionPopover.tsx`, `useMentionTrigger`.
  - Include: keyboard navigation, insert mention, send `agentId`, route to selected agent.
  - Verify: component and routing integration tests.
  - Covers: R6.

- [ ] 39. Implement Tool management UI.
  - File: `desktop/src/renderer/settings/ToolList.tsx`.
  - Include: tool list, read/write/concurrency badges, enable/disable, permission integration.
  - Verify: disabling tool causes ToolRuntime permission rejection.
  - Covers: R6.

- [ ] 40. Implement asset library folders.
  - File: `desktop/src/renderer/assets/AssetPanel.tsx`.
  - Include: nested folder tree, move assets, delete folder with reference-safe behavior, tombstones.
  - Verify: create -> move -> delete parent -> references remain valid or tombstoned.
  - Covers: R6.

- [ ] 41. Implement SkillRegistry and skill management.
  - Include: built-in/user/plugin skill discovery, metadata-first list, lazy reference load, permission checks, reload consistency.
  - UI: skill list/detail and enable/disable if supported by contract.
  - Verify: failed reload keeps previous valid skill; permission overreach rejected.
  - Covers: R6, INV-4.

- [ ] 42. Implement PluginLoader and plugin tool management.
  - Include: local manifest validation, plugin permissions, tool schema validation, register/disable/unload, quarantine diagnostics.
  - Verify: invalid manifest quarantined; disabled plugin tool cannot be invoked; running invocation policy tested.
  - Covers: R6, INV-4.

- [ ] 43. Implement KnowledgeStore and ContextBuilder.
  - Include: ingest local files/docs/assets metadata, chunk, retrieve, delete, rebuild, citation metadata, scoped Context Pack inclusion.
  - Verify: retrieval respects project/user scope; deleted docs excluded after rebuild/mark-stale.
  - Covers: R6, INV-4.

- [ ] 44. Implement audit, tracing, health, and redaction.
  - Include: audit entries for permissioned actions, trace IDs across jobs/tools/agents, health checks, safe error envelopes, log/LTM redaction.
  - Verify: redaction tests for API keys/auth headers/hidden prompts/absolute paths.
  - Covers: R6.

- [ ] 45. Run M5 integration suite.
  - Include: spawnSubAgent parallel + merge, depth exceed e2e, @mention routing, asset folder CRUD, skill invocation, plugin quarantine, RAG scoped retrieval, audit redaction.
  - Verify: all integration paths pass with `tsc --noEmit`.
  - Covers: R6.

## Final Verification

- [ ] 46. Run task/spec consistency scan.
  - Verify: every historical `task/M0-M5` REQ is represented here, superseded by foundation, or documented in `docs/progress/task-spec-gap-analysis.md`.

- [ ] 47. Run no-demo gate.
  - Verify: every milestone has contracts, tests, failure behavior, permissions, and recovery/observability notes before implementation starts.
