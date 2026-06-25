# Test Report

## 2026-06-25 - M0 Foundation Gate

### M0-2 API Contract Docs

Scope:

- Added required `docs/api-contracts/` module contracts for canvas plans, jobs, assets/files, gateway providers, tools/plugins, agents, skills, knowledge/context, and audit/observability.
- Added `tests/api-contract-docs.test.ts` to prevent missing contract docs or missing required sections.

Verification:

```bash
bun run test
```

Result:

- RED before implementation: failed because `docs/api-contracts/canvas-plan.md` and the rest of the required split docs were missing.

```bash
bunx vitest run tests/api-contract-docs.test.ts
```

Result:

- PASS: `tests/api-contract-docs.test.ts` passed, 1 test.

### M0-3 Shared Platform Contracts

Scope:

- Split legacy combined tool/agent contract into focused shared contracts:
  `shared/jobs.ts`, `shared/assets.ts`, `shared/gateway.ts`, `shared/tools.ts`,
  `shared/agents.ts`, `shared/skills.ts`, and `shared/knowledge.ts`.
- Rebuilt `shared/ipc.ts` around domain/action channel groups, request maps,
  response maps, and event maps linked to the new contract docs.
- Converted `shared/tools-agents.ts` into a deprecated compatibility barrel.
- Extended `scripts/verify-repo.mjs` so CI rejects missing M0 contract files.

Verification:

```bash
bunx vitest run tests/shared-contracts.test.ts
```

Result:

- RED before implementation: failed because `shared/jobs.ts` and the other focused contracts were missing, and `shared/tools-agents.ts` was still authoritative.
- PASS after implementation: `tests/shared-contracts.test.ts` passed, 2 tests.

```bash
bun run typecheck
```

Result:

- PASS: TypeScript strict compile completed with exit code 0.

### M0-4 Backlog Reconciliation

Scope:

- Added `tests/progress-backlog.test.ts` so evidence-backed M0 progress cannot drift from `docs/progress/backlog.md`.
- Reconciled `REQ-008` from existing `shared/composed-prompt.ts` plus `tests/composed-prompt.test.ts`.
- Reconciled `REQ-009` from `ltm/bin/ltm.py selftest`.
- Reconciled `REQ-019` from the new split `docs/api-contracts/*.md` set and `tests/api-contract-docs.test.ts`.
- Kept `REQ-018` in progress because `specs/core-platform-foundation/tasks.md` still has tasks 18-34 open.

Verification:

```bash
bunx vitest run tests/progress-backlog.test.ts
```

Result:

- RED before update: failed because `REQ-008`, `REQ-009`, `REQ-019`, and milestone M0 task 4 were stale.
- Pending rerun after backlog update in the next verification block.

```bash
bunx vitest run tests/progress-backlog.test.ts
```

Result:

- PASS after update: `tests/progress-backlog.test.ts` passed, 2 tests.

### M0-5 Foundation Readiness And No-Demo Gate

Scope:

- Added `docs/architecture/core-platform-implementation-readiness.md`.
- Added DB schema draft, repository ownership boundaries, migration policy,
  runtime skeleton plans, settings/admin surfaces, initial built-in tools,
  initial built-in skills, and default agent handoff rules.
- Added `docs/progress/no-demo-acceptance-review.md`.
- Fixed an obsolete `.claude/specs/...` canonical link in `docs/architecture/01-system-architecture.md`.

Verification:

```bash
bunx vitest run tests/foundation-readiness.test.ts
```

Result:

- RED before implementation: failed because readiness and no-demo review docs were missing.
- PASS after implementation: `tests/foundation-readiness.test.ts` passed, 2 tests.

```bash
rg -n "TBD|TODO|FIXME|\\.claude/specs|\\.codex/specs" specs docs/api-contracts docs/architecture .codex .agents AGENTS.md
```

Result:

- PASS after fix: no obsolete canonical spec links or unresolved placeholder markers were found in the checked foundation sources.

### M0 Final Verification

Verification:

```bash
bun run test
```

Result:

- PASS: 6 test files passed, 10 tests passed.

```bash
bun run ci
```

Result:

- PASS: lint, typecheck, test, build, and repository hygiene completed with exit code 0.

```bash
python ltm/bin/ltm.py selftest
```

Result:

- PASS: LTM structure intact.

Decision:

- M0 Foundation Gate is accepted.
- Next implementation entry is M1 task 5: Electron/Vite/React skeleton.

## 2026-06-25 - M1 Runnable Skeleton

### M1-5 Electron/Vite/React Skeleton

Scope:

- Added `desktop` as a Bun workspace.
- Added Electron main process, sandboxed preload bridge, React renderer, Electron Vite config, and desktop package scripts.
- Updated root `dev` and `build` scripts to use Bun workspace filtering.
- Extended ESLint ignores to exclude nested build outputs such as `desktop/out/**`.

Verification:

```bash
bunx vitest run tests/electron-skeleton.test.ts
```

Result:

- RED before implementation: failed because `desktop` workspace and Electron entry files were missing.
- PASS after implementation: `tests/electron-skeleton.test.ts` passed, 3 tests.

```bash
bun run --filter @comic-canvas/desktop build
```

Result:

- PASS: Electron Vite built main, preload, and renderer bundles.

```bash
bun run ci
```

Result:

- PASS: lint, typecheck, 7 test files / 13 tests, desktop build, shared build, and repository hygiene completed with exit code 0.

### M1-6 Electron Renderer Security

Scope:

- Added static security tests for BrowserWindow isolation defaults.
- Enforced typed preload wrapper usage through `invokeMain`.
- Added renderer import scan to prevent direct Electron/Node imports or raw `ipcRenderer` use.

Verification:

```bash
bunx vitest run tests/electron-security.test.ts
```

Result:

- RED before implementation: failed because preload did not use the typed `invokeMain` wrapper.
- PASS after implementation: `tests/electron-security.test.ts` passed, 3 tests.

```bash
bun run ci
```

Result:

- PASS: lint, typecheck, 8 test files / 16 tests, desktop build, shared build, and repository hygiene completed with exit code 0.

### M1-7 DB Schema And Migration Baseline

Scope:

- Added Drizzle SQLite schema declarations for jobs, assets, asset folders,
  asset references, workflows, workflow versions, chat messages, gateways,
  tools, tool audit, agents, agent runs, skills, skill invocations, knowledge
  documents, knowledge chunks, and context packs.
- Added `0001_initial_core_platform.sql`.
- Added an app-controlled migration runner that records applied migrations in
  `__comiccanvas_migrations`.
- Added `better-sqlite3`, `drizzle-orm`, `drizzle-kit`, and type dependencies to
  the `desktop` workspace.

Verification:

```bash
bunx vitest run tests/db-schema.test.ts
```

Result:

- RED before implementation: failed because `better-sqlite3` and DB modules were missing.
- PASS after implementation: `tests/db-schema.test.ts` passed, 2 tests.

```bash
bun run ci
```

Result:

- PASS: lint, typecheck, 9 test files / 18 tests, desktop build, shared build, and repository hygiene completed with exit code 0.

### M1-8 Repository Boundaries

Scope:

- Added repository modules for jobs, assets, workflows, chat messages, gateways,
  tools, agents, skills, and knowledge records under `desktop/src/main/db/repositories/`.
- Added JSON serialization helpers for repository-owned persisted JSON fields.
- Added a static boundary test to keep raw Drizzle and SQL access inside DB modules.
- Added a migration-backed write/read test through repository APIs.

Verification:

```bash
bunx vitest run tests/repository-boundaries.test.ts
```

Result:

- RED before implementation: failed because repository files and repository APIs were missing.
- PASS after implementation: `tests/repository-boundaries.test.ts` passed, 3 tests.

```bash
bun run ci
```

Result:

- PASS: lint, typecheck, 10 test files / 21 tests, desktop build, shared build, and repository hygiene completed with exit code 0.

### M1-9 JobRuntime Skeleton

Scope:

- Added `JobQueue` to persist pending jobs before returning ticket-only responses.
- Added repository-owned job state transitions for claim, complete, fail, and startup requeue.
- Added `JobWorker` to claim one pending job, run a registered handler, persist terminal state, and emit exactly one terminal event.
- Added `JobEventBus` and startup recovery for abandoned processing jobs.

Verification:

```bash
bunx vitest run tests/job-runtime.test.ts
```

Result:

- RED before implementation: failed because `desktop/src/main/jobs/events` and the rest of the JobRuntime modules were missing.
- PASS after implementation: `tests/job-runtime.test.ts` passed, 4 tests.

### M1-10 Stub Gateway Provider

Scope:

- Added deterministic `stub` provider for text, image, and video channels.
- Added provider registry with gateway lookup and channel/model preflight.
- Ensured provider invocation returns normalized `GatewayResult` envelopes without provider-specific response fields.

Verification:

```bash
bunx vitest run tests/stub-provider.test.ts
```

Result:

- RED before implementation: failed because `desktop/src/main/providers/registry` and `stub.provider` were missing.
- PASS after implementation: `tests/stub-provider.test.ts` passed, 3 tests.

### M1-11 AssetService Baseline

Scope:

- Added generated asset byte pipeline with content-hash based relative storage paths.
- Added orientation classification and invalid metadata rejection.
- Added `cc-asset://asset/<assetId>` safe URL records and safe protocol path resolution.
- Persisted asset `sizeBytes` metadata through the SQLite baseline.

Verification:

```bash
bunx vitest run tests/asset-service.test.ts
```

Result:

- RED before implementation: failed because `desktop/src/main/assets/pipeline` and `protocol` were missing.
- PASS after implementation: `tests/asset-service.test.ts` passed, 9 tests.

### M1-12 IPC Skeleton

Scope:

- Added canvas, job, asset, and gateway IPC handler skeleton modules.
- Added safe IPC error envelope helper that redacts internal errors.
- Added handler registration tests and response deep scan for generated bytes, data URLs, absolute paths, and provider-specific fields.

Verification:

```bash
bunx vitest run tests/ipc-skeleton.test.ts
```

Result:

- RED before implementation: failed because `desktop/src/main/ipc/*` handler modules were missing.
- PASS after implementation: `tests/ipc-skeleton.test.ts` passed, 4 tests.

### M1-13 Smoke Path

Scope:

- Added M1 smoke glue for image-node generation through JobQueue, JobWorker,
  stub Gateway provider, AssetPipeline, and terminal job events.
- Verified ticket-only enqueue response, completed job state, persisted asset
  metadata, safe asset URL, relative asset path, and exactly one terminal event.

Verification:

```bash
bunx vitest run tests/m1-smoke-path.test.ts
```

Result:

- RED before implementation: failed because `desktop/src/main/smoke/m1-smoke` was missing.
- PASS after implementation: `tests/m1-smoke-path.test.ts` passed, 1 test.

## 2026-06-25 - M2 Complete Canvas

### M2-14 Canvas Store

Scope:

- Read `hjwall/pc-client/src/modules/workflow-canvas/store.ts` and related store tests before implementation.
- Added a vanilla Zustand canvas store for nodes, edges, viewport, undo/redo, `applyChange`, add/delete node/edge, duplicate rejection, and shared connection matrix validation.
- Added deterministic defaults for text, image, and video node data using current `shared/nodes.ts` contracts.

Verification:

```bash
bunx vitest run tests/canvas-store.test.ts
```

Result:

- RED before implementation: failed because `desktop/src/renderer/src/canvas/store/canvas.store` was missing.
- PASS after implementation: `tests/canvas-store.test.ts` passed, 5 tests.

### M2-15 Text Node

Scope:

- Read `hjwall/pc-client/src/modules/workflow-canvas/nodes/TextNode.tsx` and related tests before implementation.
- Added renderer `TextNode` with collapsed label/preview, expanded textarea editing, outside-click collapse, scrollable preview/editing area, and inline rename.
- Added TSX component testing support through Testing Library, jsdom, React DOM compiler settings, and root React type dependencies.
- Tokenized Text node styling against the ComicCanvas `--cc-*` design system variables for node card, selected state, input, and focus states.

Verification:

```bash
bunx vitest run tests/text-node.test.tsx
```

Result:

- RED before fix: failed because previous jsdom renders were not cleaned up between tests, causing duplicate `Text 1` buttons.
- RED for new acceptance test: outside-click collapse failed because expanded textarea stayed mounted after `mousedown(document.body)`.
- PASS after implementation: `tests/text-node.test.tsx` passed, 4 tests.

```bash
bun run typecheck
```

Result:

- RED before dependency fix: failed because root TSX tests lacked React type declarations.
- PASS after adding root `@types/react` and `@types/react-dom`.

### M2 Tailwind Renderer Foundation Correction

Scope:

- Rechecked `hjwall/pc-client` renderer styling architecture after user feedback that canvas UI should reuse existing implementation patterns.
- Added Tailwind v3, PostCSS, Autoprefixer, `clsx`, and `tailwind-merge` to the desktop workspace.
- Added `desktop/tailwind.config.ts`, `desktop/postcss.config.js`, and renderer `cn` helper matching the `pc-client` reuse pattern.
- Converted renderer stylesheet to Tailwind layers plus current ComicCanvas `global/design/DESIGN.md` token values.
- Migrated the M2 Text node and desktop shell from hand-written component CSS to Tailwind utility classes.

Verification:

```bash
bunx vitest run tests/tailwind-renderer.test.ts
```

Result:

- RED before implementation: failed because desktop Tailwind/PostCSS config, Tailwind stylesheet layers, and renderer `cn` helper were missing.
- PASS after implementation: `tests/tailwind-renderer.test.ts` passed, 2 tests.

```bash
bun run --filter @comic-canvas/desktop build
```

Result:

- PASS: Electron Vite processed Tailwind CSS in the renderer build.

```bash
bun run lint
bun run typecheck
```

Result:

- RED before `tsconfig.json` update: lint failed because `desktop/tailwind.config.ts` was not included in the TypeScript project service.
- PASS after adding the Tailwind config to root TypeScript include.

### M2-16 Image Node

Scope:

- Used `hjwall/pc-client` canvas node patterns as the renderer reference while keeping ComicCanvas contracts and `global/design/DESIGN.md` tokens authoritative.
- Added renderer `ImageNode` with idle, expanded, pending, running, done, and error states.
- Added prompt override, model selection, orientation selection, async generate callback, and safe `cc-asset://` preview rendering.
- Kept the node renderer-only: no main-process imports, no direct file access, no synchronous generated bytes, and no polling.

Verification:

```bash
bunx vitest run tests/image-node.test.tsx
```

Result:

- RED before implementation: failed because `desktop/src/renderer/src/canvas/nodes/ImageNode` did not exist.
- PASS after implementation: `tests/image-node.test.tsx` passed, 4 tests.

```bash
bunx vitest run tests/image-node.test.tsx tests/text-node.test.tsx tests/tailwind-renderer.test.ts
```

Result:

- PASS: 3 test files passed, 10 tests passed.

```bash
bun run lint
bun run typecheck
bun run --filter @comic-canvas/desktop build
bun run ci
```

Result:

- PASS: lint completed with exit code 0.
- RED before test helper fix: typecheck failed because `Partial<ImageNodeProps>` did not allow partial `data` overrides.
- PASS after the test helper type was narrowed for partial `ImageNodeData` overrides.
- PASS: Electron Vite desktop build completed with exit code 0.
- PASS: full CI completed with 19 test files and 57 tests passing, then lint, typecheck, desktop/shared build, and repository verification completed with exit code 0.

### M2-17 Video Node

Scope:

- Read `hjwall/pc-client/src/modules/workflow-canvas/nodes/VideoNode.tsx`, `VideoGenerationNode.tsx`, `VideoConfigNode.tsx`, and `RunStatusBadge.tsx` before implementation.
- Added renderer `VideoNode` with idle, expanded, pending, running, done, and error states.
- Added prompt override, model selection, orientation selection, duration selection, first/last frame image selection, async generate callback, and safe `cc-asset://` video preview rendering.
- Kept the node renderer-only: no main-process imports, no direct file access, no synchronous generated bytes, and no polling.

Verification:

```bash
bunx vitest run tests/video-node.test.tsx
```

Result:

- RED before implementation: failed because `desktop/src/renderer/src/canvas/nodes/VideoNode` did not exist.
- PASS after implementation: `tests/video-node.test.tsx` passed, 4 tests.

```bash
bunx vitest run tests/video-node.test.tsx tests/image-node.test.tsx tests/text-node.test.tsx tests/tailwind-renderer.test.ts
```

Result:

- PASS: 4 test files passed, 14 tests passed.

```bash
bun run lint
bun run typecheck
bun run --filter @comic-canvas/desktop build
bun run ci
```

Result:

- PASS: lint completed with exit code 0.
- PASS: TypeScript strict compile completed with exit code 0.
- PASS: Electron Vite desktop build completed with exit code 0.
- PASS: full CI completed with 20 test files and 61 tests passing, then lint, typecheck, desktop/shared build, and repository verification completed with exit code 0.

### M2-18 Connection Validation UX

Scope:

- Read `hjwall/pc-client/src/modules/workflow-canvas/lib/connection-toast.ts`, `store.ts`, and connection-rule tests before implementation.
- Added renderer `createCanvasConnectHandler` so future React Flow `onConnect` calls go through the canonical canvas store instead of duplicating matrix rules.
- Added `ConnectionFeedback` to render accessible Chinese connection failure feedback for invalid and duplicate connections.
- Preserved the shared matrix as the rule source: the handler delegates to `CanvasStoreState.addEdge`, which consumes `shared/connection-matrix.ts`.

Verification:

```bash
bunx vitest run tests/connection-validation-ux.test.tsx
```

Result:

- RED before implementation: failed because `desktop/src/renderer/src/canvas/components/ConnectionFeedback` and `canvas/lib/connection-validation` did not exist.
- PASS after implementation: `tests/connection-validation-ux.test.tsx` passed, 3 tests.

```bash
bunx vitest run tests/connection-validation-ux.test.tsx tests/connection-matrix.test.ts tests/canvas-store.test.ts tests/video-node.test.tsx tests/image-node.test.tsx tests/text-node.test.tsx tests/tailwind-renderer.test.ts
```

Result:

- PASS: 7 test files passed, 24 tests passed.

```bash
bun run lint
bun run typecheck
bun run --filter @comic-canvas/desktop build
bun run ci
```

Result:

- PASS: lint completed with exit code 0.
- PASS: TypeScript strict compile completed with exit code 0.
- PASS: Electron Vite desktop build completed with exit code 0.
- PASS: full CI completed with 21 test files and 64 tests passing, then lint, typecheck, desktop/shared build, and repository verification completed with exit code 0.

### M2-19 Connected Inputs Panel

Scope:

- Read `hjwall/pc-client/src/modules/workflow-canvas/components/ConnectedInputsPanel.tsx` and `lib/composed-prompt.ts` before implementation.
- Added a pure renderer `buildConnectedInputsView` adapter that projects the canvas store graph into the shared `composeFinalPrompt` contract instead of duplicating prompt composition.
- Added `ConnectedInputsPanel` with Tailwind + `cn`, ordered upstream text items, reference-image count, and a final prompt preview that is byte-equivalent to `shared/composed-prompt.ts`.
- Mounted the panel in Image and Video node expanded configuration areas above `Prompt override`; zero upstream text nodes still render no panel.
- Added store-subscription behavior through Zustand selectors while preserving controlled graph props for tests and alternate canvas instances.

Verification:

```bash
bunx vitest run tests/connected-inputs-panel.test.tsx
```

Result:

- RED before implementation: failed because `desktop/src/renderer/src/canvas/components/ConnectedInputsPanel` and `canvas/lib/connected-inputs` did not exist.
- RED for live updates: failed when graph props were omitted because the component did not subscribe to the canvas store.
- PASS after implementation: `tests/connected-inputs-panel.test.tsx` passed, 4 tests.

```bash
bunx vitest run tests/connected-inputs-panel.test.tsx tests/composed-prompt.test.ts tests/canvas-store.test.ts tests/text-node.test.tsx tests/image-node.test.tsx tests/video-node.test.tsx tests/tailwind-renderer.test.ts
```

Result:

- PASS: 7 test files passed, 24 tests passed.

```bash
bunx vitest run tests/connected-inputs-panel.test.tsx tests/image-node.test.tsx tests/video-node.test.tsx tests/composed-prompt.test.ts tests/canvas-store.test.ts tests/tailwind-renderer.test.ts
bun run lint
bun run typecheck
bun run ci
```

Result:

- PASS: integrated Image/Video node regression completed with 6 test files and 20 tests passing.
- PASS: lint completed with exit code 0.
- PASS: TypeScript strict compile completed with exit code 0.
- PASS: full CI completed with 22 test files and 68 tests passing, then lint, typecheck, desktop/shared build, and repository verification completed with exit code 0.

### M2-20 Node Sizing And Inline Rename Primitives

Scope:

- Read `hjwall/pc-client/src/modules/workflow-canvas/nodes/TextNode.tsx`, `ImageGenerationNode.tsx`, and orientation component tests before implementation.
- Installed `@xyflow/react` with Bun and integrated real `NodeResizer` into Text, Image, and Video nodes.
- Added shared `node-sizing` primitives for orientation aspect ratios, preview width, node minimum sizes, and NodeResizer Tailwind classes.
- Added reusable `useInlineRename` hook and migrated `TextNode` inline rename behavior to the shared hook.
- Kept Image and Video preview frames width-stable with orientation-driven `aspect-ratio`, and kept media `object-fit: contain`.

Verification:

```bash
bunx vitest run tests/node-sizing.test.ts tests/inline-rename-hook.test.tsx tests/node-resizer-integration.test.ts
```

Result:

- RED before implementation: failed because `canvas/lib/node-sizing`, `canvas/hooks/use-inline-rename`, and NodeResizer integration did not exist.
- PASS after implementation: 3 test files passed, 5 tests passed.

```bash
bunx vitest run tests/text-node.test.tsx tests/image-node.test.tsx tests/video-node.test.tsx tests/tailwind-renderer.test.ts
bun run lint
bun run typecheck
bun run ci
```

Result:

- PASS: node regression completed with 4 test files and 14 tests passing.
- PASS: lint completed with exit code 0.
- PASS: TypeScript strict compile completed with exit code 0.
- PASS: full CI completed with 25 test files and 73 tests passing, then lint, typecheck, desktop/shared build, and repository verification completed with exit code 0.

### M2-21 Graph Save And Load

Scope:

- Added `shared/graph.ts` as the persisted canvas graph contract with nodes, positions, edges, and viewport.
- Added `canvas.saveGraph` and `canvas.loadGraph` IPC handlers backed by `WorkflowRepository`.
- Persisted graph saves now run through a repository transaction that inserts a graph version and refreshes the workflow timestamp together.
- Revalidated saved edges through `shared/connection-matrix.ts`, dropping missing-node or illegal edges before persistence.
- Documented save/load request, response, error, permission, and test rules in `docs/api-contracts/canvas-plan.md`.

Verification:

```bash
bun run typecheck
```

Result:

- RED before graph position support: TypeScript failed because `CanvasGraphNode` did not accept `position`, and an older repository test still used a graph without `viewport`.
- PASS after implementation: TypeScript strict compile completed with exit code 0.

```bash
bunx vitest run tests/canvas-graph-persistence.test.ts
```

Result:

- PASS: graph save/load integration passed, covering latest-version load after handler recreation, node positions, viewport, legal-edge preservation, illegal-edge drop, and workflow timestamp refresh.

```bash
bunx vitest run tests/ipc-skeleton.test.ts tests/repository-boundaries.test.ts
```

Result:

- PASS: IPC registration and repository boundary regressions passed, 2 test files and 7 tests.

```bash
bun run lint
bun run typecheck
bun run test
bun run build
bun run ci
```

Result:

- PASS: lint completed with exit code 0.
- PASS: TypeScript strict compile completed with exit code 0.
- PASS: full test suite completed with 26 test files and 74 tests passing.
- PASS: desktop/shared build completed with exit code 0.
- PASS: full CI completed with lint, typecheck, tests, build, and repository verification all passing.

### M2-22 Renderer Zero Polling

Scope:

- Read `hjwall/pc-client/src/modules/workflow-canvas/__tests__/no-polling.static.spec.ts` and `hooks/useWorkflowTaskRealtime.ts` before implementation.
- Installed `@tanstack/react-query` with Bun and wrapped the renderer root in `QueryClientProvider`.
- Added a typed preload event bridge for `job.completed`, `job.failed`, and `asset.changed`, returning unsubscribe callbacks without exposing raw `ipcRenderer`.
- Added `createIpcJobEventBus` so worker terminal events can fan out to live renderer windows over Electron IPC while preserving duplicate-terminal-event rejection.
- Added `useCanvasRealtime` and `registerCanvasRealtimeInvalidation` so job and asset terminal events invalidate job/asset queries instead of relying on renderer polling.
- Added a renderer static guard that fails on `setInterval`, `refetchInterval`, or asset/job polling-loop literals in production renderer source.

Verification:

```bash
bunx vitest run tests/renderer-zero-polling.test.ts
bunx vitest run tests/canvas-realtime-invalidation.test.ts
bunx vitest run tests/job-ipc-fanout.test.ts
```

Result:

- RED before implementation: zero-polling test failed because preload lacked `subscribeMain`/typed event helpers.
- RED before implementation: realtime invalidation test failed because `canvas/hooks/use-canvas-realtime` did not exist.
- RED before implementation: job IPC fanout test failed because `desktop/src/main/jobs/ipc-fanout.ts` did not exist.
- PASS after implementation: 3 test files passed, 4 tests passed.

```bash
bun run lint
bun run typecheck
bun run test
bun run build
bun run ci
```

Result:

- PASS: lint completed with exit code 0.
- PASS: TypeScript strict compile completed with exit code 0.
- PASS: full test suite completed with 29 test files and 78 tests passing.
- PASS: desktop/shared build completed with exit code 0.
- PASS: full CI completed with lint, typecheck, tests, build, and repository verification all passing.

### M3-23 OpenAI-Compatible Provider

Scope:

- Added `createOpenAICompatibleProvider` implementing the existing `GatewayProvider` interface.
- Supported OpenAI-compatible `/images/generations` and `/chat/completions` requests through normalized `GatewayRequest`.
- Normalized image `b64_json` and temporary image URL responses into provider-independent `assetBytes` results.
- Normalized chat completion content and token usage into provider-independent `text` results.
- Rejected unsupported video requests before remote submission and redacted API keys from provider errors.

Verification:

```bash
bunx vitest run tests/openai-compatible-provider.test.ts
```

Result:

- RED before implementation: failed because `desktop/src/main/providers/openai-compatible.provider.ts` did not exist.
- PASS after implementation: OpenAI-compatible provider tests passed, 1 test file and 4 tests.

```bash
bun run lint
bun run typecheck
bun run test
bun run build
bun run ci
```

Result:

- PASS: lint completed with exit code 0.
- PASS: TypeScript strict compile completed with exit code 0.
- PASS: full test suite completed with 30 test files and 82 tests passing.
- PASS: desktop/shared build completed with exit code 0.
- PASS: full CI completed with lint, typecheck, tests, build, and repository verification all passing.

### Frontend UI Baseline Alignment

Scope:

- Promoted the renderer UI route from an M2-only canvas note to a global M2-M5 baseline.
- Required all renderer UI tasks to use Tailwind CSS, the shared `cn` helper, `global/design/DESIGN.md` tokens, and the closest `hjwall/pc-client` module before introducing new local UI patterns.
- Added explicit `pc-client` reference paths for gateway settings, Chat/Plan UI, agent settings, tool management, asset library, skill management, and plugin management tasks.
- Updated backlog current frontend route so it matches the canonical milestone spec.

Verification:

```bash
bunx vitest run tests/tailwind-renderer.test.ts
git diff --check
```

Result:

- PASS: Tailwind renderer baseline tests passed, 1 test file and 3 tests.
- PASS: `git diff --check` completed with exit code 0.

### M3-24 Async Media Task Adapter

Scope:

- Added `pollWithBackoff` for provider-side async task polling with exponential backoff, timeout handling, progress callbacks, and worker-side cancellation checks.
- Added `createAsyncMediaProvider` for common submit/poll/fetch media task protocols.
- Normalized completed async image/video outputs from base64 or temporary media URLs into `assetBytes` results.
- Added `provider_canceled` to the shared gateway error contract so worker cancellation is distinct from remote provider failure.
- Extended `GatewayProvider.invoke` with an optional context carrying `isCanceled` and `onProgress`.
- Extended the job event bus and IPC fanout adapter to broadcast `job.progress` events without treating them as terminal events.

Verification:

```bash
bunx vitest run tests/polling-strategy.test.ts tests/async-media-provider.test.ts
bunx vitest run tests/job-ipc-fanout.test.ts
```

Result:

- RED before implementation: async media tests failed because `desktop/src/main/providers/async-media.provider.ts` did not exist.
- RED before implementation: polling strategy tests failed because `desktop/src/main/providers/polling-strategy.ts` did not exist.
- RED before implementation: progress fanout test failed because `events.emitProgress` did not exist.
- PASS after implementation: polling, async media provider, and job IPC fanout tests passed, 3 test files and 10 tests.

```bash
bun run lint
bun run typecheck
bun run test
bun run build
bun run ci
```

Result:

- PASS: lint completed with exit code 0.
- PASS: TypeScript strict compile completed with exit code 0.
- PASS: full test suite completed with 32 test files and 92 tests passing.
- PASS: desktop/shared build completed with exit code 0.
- PASS: full CI completed with lint, typecheck, tests, build, and repository verification all passing.

### M3-25 Gateway Settings UI

Scope:

- Read `global/design/DESIGN.md` before UI work and used the existing Tailwind + `cn` renderer pipeline.
- Referenced `hjwall/pc-client/src/modules/project/components/` and `hjwall/pc-client/src/components/common/` form/dialog patterns before implementing ComicCanvas-specific components.
- Added `GatewayList` and `GatewayForm` renderer components for add/edit/delete/test, enabled switch, masked key display, capability selection, and text/image/video model mapping.
- Added typed preload methods for `gateway.list`, `gateway.save`, `gateway.delete`, and `gateway.test`.
- Extended the gateway IPC skeleton to register list/save/delete/test handlers, while leaving real encrypted vault behavior to M3-26 and hot reload to M3-27.
- Mounted the gateway settings panel in the current renderer shell so the UI is reachable in the app.

Verification:

```bash
bunx vitest run tests/gateway-settings-ui.test.tsx tests/gateway-preload.test.ts
bunx vitest run tests/ipc-skeleton.test.ts tests/electron-security.test.ts
bun run typecheck
bun run lint
```

Result:

- RED before implementation: gateway settings UI tests failed because `GatewayForm` and `GatewayList` did not exist.
- RED before implementation: gateway preload test failed because typed gateway methods were not exposed.
- PASS after implementation: gateway settings/preload/security/IPC tests passed, 4 test files and 13 tests.
- PASS: TypeScript strict compile completed with exit code 0.
- PASS: lint completed with exit code 0.

```bash
bun run lint
bun run typecheck
bun run test
bun run build
bun run ci
```

Result:

- PASS: lint completed with exit code 0.
- PASS: TypeScript strict compile completed with exit code 0.
- PASS: full test suite completed with 34 test files and 98 tests passing.
- PASS: desktop/shared build completed with exit code 0.
- PASS: full CI completed with lint, typecheck, tests, build, and repository verification all passing.

### M3-26 Encrypted Key Vault

Scope:

- Added `createKeyVault` under `desktop/src/main/security/key-vault.ts`.
- Implemented a safeStorage-compatible adapter boundary with `isEncryptionAvailable`, `encryptString`, and `decryptString`.
- Stored encrypted provider secrets as base64 ciphertext with stable `gateway:<providerId>` key refs.
- Added refusal paths for unavailable encryption and decrypt/encrypt failures using `gateway_secret_unavailable`.
- Ensured native storage failures do not echo plaintext secrets through thrown messages.

Verification:

```bash
bunx vitest run tests/key-vault.test.ts
bun run typecheck
bun run lint
```

Result:

- RED before implementation: key vault tests failed because `desktop/src/main/security/key-vault.ts` did not exist.
- PASS after implementation: key vault tests passed, 1 test file and 4 tests.
- PASS: TypeScript strict compile completed with exit code 0.
- PASS: lint completed with exit code 0.

```bash
bun run lint
bun run typecheck
bun run test
bun run build
bun run ci
```

Result:

- PASS: lint completed with exit code 0.
- PASS: TypeScript strict compile completed with exit code 0.
- PASS: full test suite completed with 35 test files and 102 tests passing.
- PASS: desktop/shared build completed with exit code 0.
- PASS: full CI completed with lint, typecheck, tests, build, and repository verification all passing.

### Frontend Governance Follow-up

Scope:

- Confirmed the desktop renderer already uses Tailwind CSS v3, PostCSS, the shared `cn` helper, and `global/design/DESIGN.md` tokens.
- Added the Tailwind + `cn` + `global/design/DESIGN.md` + closest `hjwall/pc-client` reference requirement to the PM agent governance rules so future renderer UI tasks carry the same baseline during planning.
- Extended the renderer Tailwind foundation test to protect the PM agent governance text as well as the milestone specs.

Verification:

```bash
bunx vitest run tests/tailwind-renderer.test.ts
```

Result:

- PASS: Tailwind renderer foundation tests passed, 1 test file and 3 tests.

### M3-27 Provider Hot Reload And Model Map

Scope:

- Added `GatewayRegistry.reload` and model-key fallback so requests that omit `modelKey` resolve from the current provider's per-channel model map.
- Preserved in-flight invocation behavior by capturing the provider handle at invoke time; reload replaces future registry handles without mutating already-running provider calls.
- Added `createGatewayConfigReloader` to rebuild stub, OpenAI-compatible, and async media providers from enabled gateway config views.
- Extended stub provider construction to preserve configured gateway IDs and model maps during reload.
- Registered `gateway.reload` in the gateway IPC handler and exposed typed `reloadGateways` through preload.
- Documented `gateway.reload` request/response and reload invariants in `docs/api-contracts/gateway-providers.md`.

Verification:

```bash
bunx vitest run tests/gateway-hot-reload.test.ts tests/gateway-preload.test.ts
bunx vitest run tests/gateway-hot-reload.test.ts tests/gateway-preload.test.ts tests/ipc-skeleton.test.ts tests/stub-provider.test.ts
bunx vitest run tests/openai-compatible-provider.test.ts tests/async-media-provider.test.ts tests/gateway-settings-ui.test.tsx tests/gateway-preload.test.ts tests/gateway-hot-reload.test.ts
bun run typecheck
bun run lint
```

Result:

- RED before implementation: hot reload tests failed because `GatewayRegistry.reload` did not exist.
- RED before implementation: gateway handler did not trigger reload on save and did not register `gateway.reload`.
- RED before implementation: preload did not expose `reloadGateways`.
- RED before stub reload fix: config reload returned provider ID `stub` instead of the configured gateway ID `stub-main`.
- PASS after implementation: hot reload, preload, IPC skeleton, and stub provider tests passed, 4 test files and 10 tests.
- PASS: gateway provider/settings regression tests passed, 5 test files and 16 tests.
- PASS: TypeScript strict compile completed with exit code 0.
- PASS: lint completed with exit code 0.

```bash
bun run test
bun run build
bun run ci
```

Result:

- PASS: full test suite completed with 36 test files and 106 tests passing.
- PASS: desktop/shared build completed with exit code 0.
- PASS: full CI completed with lint, typecheck, tests, build, and repository verification all passing.

## 2026-06-25 - M4 Agent Orchestration

### M4-28 Orchestrator AsyncGenerator Run

Scope:

- Read `cc-haha-main/src/query.ts`, `QueryEngine.ts`, and `query/deps.ts` as conceptual references for an AsyncGenerator-driven loop and dependency injection, without copying source.
- Added `desktop/src/main/agent/orchestrator.ts` with `runOrchestrator` as a `while (true)` AsyncGenerator state machine that streams progress and returns a declarative `CanvasPlan`.
- Added `createOrchestratorRuntime` so `canvas.chatSend` enqueues an `agent.run` job and returns a pending ticket before planner/model work starts.
- Added main-process IPC handlers for `canvas.chatSend` and `canvas.chatGetPlan`, plus typed preload APIs `sendCanvasChat` and `getCanvasPlan`.
- Documented the chat-to-plan IPC contracts in `docs/api-contracts/canvas-plan.md`.

Verification:

```bash
bun x vitest run tests/gateway-preload.test.ts
```

Result:

- RED before preload implementation: failed because `desktop/src/preload/index.ts` did not expose `sendCanvasChat`.

```bash
bun x vitest run tests/gateway-preload.test.ts tests/ipc-skeleton.test.ts tests/orchestrator-runtime.test.ts
bun run typecheck
bun run lint
```

Result:

- PASS after implementation: preload, IPC skeleton, and orchestrator runtime tests passed, 3 test files and 8 tests.
- PASS: TypeScript strict compile completed with exit code 0.
- PASS: lint completed with exit code 0.

```bash
bun run test
bun run build
bun run ci
```

Result:

- PASS: full test suite completed with 37 test files and 109 tests passing.
- PASS: desktop/shared build completed with exit code 0.
- PASS: full CI completed with lint, typecheck, tests, build, and repository verification all passing.

### M4-29 ToolRuntime And Canvas Tools

Scope:

- Read `cc-haha-main/src/Tool.ts` and representative read/write tools for the reusable shape: schema-backed tool definitions, permission checks, read/write concurrency, and optional progress streaming.
- Added `desktop/src/main/tools/runtime.ts` with `defineTool`, `createToolRuntime`, schema validation, safe invocation records, permission policy hooks, read-only parallel execution, and serial write execution.
- Added `desktop/src/main/tools/canvas/index.ts` with built-in canvas tools: `queryGraph`, `proposePlan`, `createNode`, `connectNodes`, `updateNodeData`, `deleteNode`, and `runNode`.
- Ensured `connectNodes` uses `shared/connection-matrix.ts` and `runNode` only enqueues a local job ticket without waiting for generated assets.
- Added `zod` as the schema validation dependency for ToolRuntime and future plugin/custom tool contracts.

Verification:

```bash
bun x vitest run tests/tool-runtime.test.ts tests/canvas-tools.test.ts
```

Result:

- RED before implementation: failed because `desktop/src/main/tools/canvas` did not exist and `zod` was not available to the test/runtime boundary.
- PASS after implementation: ToolRuntime and canvas tools tests passed, 2 test files and 6 tests.

```bash
bun run typecheck
bun run lint
```

Result:

- PASS: TypeScript strict compile completed with exit code 0.
- PASS: lint completed with exit code 0.

```bash
bun run ci
```

Result:

- PASS: full CI completed with lint, typecheck, 39 test files / 115 tests, build, and repository verification all passing.

### M4-30 sanitizePlan

Scope:

- Added `desktop/src/main/agent/sanitize-plan.ts` as the main-process safety gate for untrusted CanvasPlan output.
- Sanitizer enforces the shared node whitelist, edge type whitelist, `shared/connection-matrix.ts`, run action whitelist, and nested executable-string stripping.
- Dropped records are preserved and merged into `plan.dropped` for audit.
- Connected `runOrchestrator` to sanitize planner output before yielding/storing the final Plan.

Verification:

```bash
bun x vitest run tests/sanitize-plan.test.ts
```

Result:

- RED before implementation: failed because `desktop/src/main/agent/sanitize-plan.ts` did not exist.
- PASS after implementation: sanitizePlan tests passed, 1 test file and 5 tests.
- PASS: property/injection coverage generated 120 cases and verified no executable strings survived sanitized output.

```bash
bun x vitest run tests/orchestrator-runtime.test.ts tests/sanitize-plan.test.ts
bun x tsc --noEmit --pretty false
bun x eslint . --max-warnings=0
```

Result:

- PASS: orchestrator runtime and sanitizePlan regression tests passed, 2 test files and 7 tests.
- PASS: TypeScript strict compile completed with exit code 0.
- PASS: lint completed with exit code 0.

```bash
bun run ci
```

Result:

- PASS: full CI completed with lint, typecheck, 40 test files / 120 tests, build, and repository verification all passing.

### M4-31 Chat Plan IPC

Scope:

- Extended `chat-message.repo.ts` with message lookup and plan/apply-status update APIs so chat persistence stays behind the repository boundary.
- Added `CanvasPlanEventBus` plus Electron `canvas.planReady` fanout for async Plan completion notification.
- Updated `createOrchestratorRuntime` to persist the user chat message on `chatSend`, keep the synchronous response plan-free, store sanitized Plan JSON after the agent job completes, and emit `canvas.planReady`.
- Exposed `onCanvasPlanReady` through the sandboxed preload bridge.

Verification:

```bash
bun x vitest run tests/chat-plan-ipc.test.ts
```

Result:

- RED before implementation: failed because `desktop/src/main/agent/plan-events.ts` did not exist.
- PASS after implementation: chat plan IPC tests passed, 1 test file and 3 tests.

```bash
bun x vitest run tests/chat-plan-ipc.test.ts tests/orchestrator-runtime.test.ts tests/repository-boundaries.test.ts tests/gateway-preload.test.ts
bun x eslint . --max-warnings=0
bun x tsc --noEmit --pretty false
```

Result:

- PASS: chat plan IPC, orchestrator runtime, repository boundary, and preload regression tests passed, 4 test files and 9 tests.
- PASS: lint completed with exit code 0.
- PASS: TypeScript strict compile completed with exit code 0.

```bash
bun run ci
```

Result:

- PASS: full CI completed with lint, typecheck, 41 test files / 123 tests, build, and repository verification all passing.

### M4-32 applyPlan And PlanRunner

Scope:

- Read `global/design/DESIGN.md` before renderer work and used `hjwall/pc-client/src/modules/workflow-canvas/lib/plan-applier.ts` plus `plan-runner.ts` as conceptual references.
- Added `desktop/src/renderer/src/canvas/lib/apply-plan.ts` to apply CanvasPlan nodes/edges through the renderer store as a single undoable snapshot.
- applyPlan locally revalidates node types, edge types, shared connection matrix rules, image roles, and run action whitelist before mapping refs to canvas node IDs.
- Added `desktop/src/renderer/src/canvas/lib/plan-runner.ts` as a pure serial runSteps state machine with failure short-circuit.

Verification:

```bash
bun x vitest run tests/apply-plan-runner.test.ts
```

Result:

- RED before implementation: failed because `desktop/src/renderer/src/canvas/lib/apply-plan.ts` did not exist.
- PASS after implementation: applyPlan and PlanRunner tests passed, 1 test file and 4 tests.

```bash
bun x vitest run tests/apply-plan-runner.test.ts tests/canvas-store.test.ts tests/connection-matrix.test.ts tests/sanitize-plan.test.ts
bun x eslint . --max-warnings=0
bun x tsc --noEmit --pretty false
```

Result:

- PASS: renderer applyPlan/PlanRunner and canvas contract regression tests passed, 4 test files and 16 tests.
- PASS: lint completed with exit code 0.
- PASS: TypeScript strict compile completed with exit code 0.

```bash
bun run ci
```

Result:

- PASS: full CI completed with lint, typecheck, 42 test files / 127 tests, build, and repository verification all passing.

### M4-33 Chat UI

Scope:

- Read `global/design/DESIGN.md` before renderer UI work and used the existing Tailwind + `cn` renderer pipeline.
- Referenced `hjwall/pc-client/src/modules/workflow-canvas/components/CanvasChatBox.tsx`, `BottomInputPanel.tsx`, `MentionTextarea.tsx`, and `CommandPalette.tsx` for chat composer, auto-execute, keyboard, and command affordance patterns.
- Added `desktop/src/renderer/src/chat/ChatPanel.tsx` for async canvas chat send, `canvas.planReady` subscription, plan fetch, message history, Enter/Shift+Enter behavior, and auto-execute state.
- Added `desktop/src/renderer/src/chat/PlanCard.tsx` for sanitized Plan summary, node/edge/run-step counts, dropped warnings, clarify display, and apply controls.
- Mounted `ChatPanel` in `App.tsx` and wired Apply Plan to `applyCanvasPlan(plan, canvasStore)`.

Verification:

```bash
bun x vitest run tests/chat-ui.test.tsx
```

Result:

- RED before implementation: failed because `desktop/src/renderer/src/chat/ChatPanel.tsx` did not exist.
- PASS after implementation: ChatPanel and PlanCard component tests passed, 1 test file and 5 tests.

```bash
bun x vitest run tests/chat-ui.test.tsx tests/apply-plan-runner.test.ts tests/tailwind-renderer.test.ts
bun x tsc --noEmit --pretty false
bun x eslint . --max-warnings=0
```

Result:

- PASS: Chat UI, applyPlan/PlanRunner, and Tailwind renderer baseline tests passed, 3 test files and 12 tests.
- PASS: TypeScript strict compile completed with exit code 0.
- PASS: lint completed with exit code 0.

```bash
bun run ci
```

Result:

- PASS: full CI completed with lint, typecheck, 43 test files / 132 tests, build, and repository verification all passing.

### M4-34 Agent Orchestration Smoke Path

Scope:

- Added renderer `createCanvasPlanExecutionController` to bridge `applyPlan`, `PlanRunner`, `canvas.runNode`, and job terminal events.
- Wired `App.tsx` so Chat `autoExecute` starts runSteps and job completed/failed events update planned nodes to done/error.
- Exposed `runCanvasNode` through the sandboxed preload bridge.
- Updated `canvas.runNode` IPC to enqueue through an injected durable queue when available instead of only returning a placeholder ticket.
- Added `createMainProcessRuntime` and installed it from the Electron main entrypoint so real app startup registers canvas/job/asset/gateway/chat handlers, repositories, queue, worker, stub gateway, asset pipeline, and plan/job IPC fanout.
- Added runtime auto-drain after durable queue enqueue so real Electron IPC calls process agent/runNode jobs without manual test-only worker calls.
- Tightened `sanitizePlan` to drop event-handler style keys such as `onRun` and global-object executable strings such as `window.*`.

Verification:

```bash
bun x vitest run tests/agent-orchestration-smoke.test.ts
```

Result:

- RED before implementation: failed because `desktop/src/renderer/src/canvas/lib/canvas-plan-execution.ts` did not exist.
- RED before sanitizer hardening: failed because injected `onRun: "window.evil()"` did not produce a dropped record.
- RED before App/preload wiring: failed because the renderer App did not use the Plan execution controller and preload did not expose `canvas.runNode`.
- PASS after implementation: agent orchestration smoke tests passed, 1 test file and 2 tests.

```bash
bun x vitest run tests/main-runtime-wiring.test.ts
```

Result:

- RED before implementation: failed because `desktop/src/main/runtime.ts` did not exist.
- RED before entrypoint install: failed because `desktop/src/main/index.ts` did not call `createMainProcessRuntime`.
- PASS after implementation: main runtime wiring tests passed, 1 test file and 2 tests.

```bash
bun x vitest run tests/main-runtime-wiring.test.ts tests/agent-orchestration-smoke.test.ts tests/ipc-skeleton.test.ts tests/job-ipc-fanout.test.ts tests/chat-plan-ipc.test.ts
bun x tsc --noEmit --pretty false
```

Result:

- PASS: runtime wiring, M4 smoke, IPC skeleton, job fanout, and chat plan IPC tests passed, 5 test files and 15 tests.
- PASS: TypeScript strict compile completed with exit code 0.

```bash
bun run ci
```

Result:

- PASS: full CI completed with lint, typecheck, 45 test files / 137 tests, build, and repository verification all passing.

## 2026-06-25 - M5 Advanced Platform

### M5-35 spawnSubAgent

Scope:

- Read `docs/api-contracts/agents.md`, `shared/agents.ts`, and current M4 agent/tool runtime before implementation.
- Referenced `cc-haha-main` agent notes conceptually for isolated child runs, per-child tool pools, max-turn boundaries, and traceable task execution without copying source.
- Added `desktop/src/main/agent/spawn-sub-agent.ts` with parent/child permission intersection, depth enforcement through `MAX_SPAWN_DEPTH`, child-run dependency injection, safe error classes, and independent child trace metadata.
- Extended `shared/agents.ts`, the compatibility `shared/tools-agents.ts` barrel, `docs/api-contracts/agents.md`, and legacy `docs/api-contracts/tools-agents.md` so `SpawnSubAgentResult` carries `droppedSkills` and an auditable `trace`.

Verification:

```bash
bun x vitest run tests/spawn-sub-agent.test.ts
```

Result:

- RED before implementation: failed because `desktop/src/main/agent/spawn-sub-agent.ts` did not exist.
- PASS after implementation: spawnSubAgent tests passed, 1 test file and 3 tests.

```bash
bun x tsc --noEmit --pretty false
```

Result:

- RED before exact optional property fix: failed because optional `modelId` was passed as explicit `undefined`.
- PASS after narrowing optional child-run fields: TypeScript strict compile completed with exit code 0.

```bash
bun run ci
```

Result:

- PASS: full CI completed with lint, typecheck, 46 test files / 140 tests, build, and repository verification all passing.

### M5-36 Sub-Agent Isolation And Merge

Scope:

- Read `desktop/src/main/tools/canvas/index.ts`, `desktop/src/main/db/repositories/workflow.repo.ts`, `shared/graph.ts`, `shared/plan.ts`, and current canvas graph persistence tests before implementation.
- Added `desktop/src/main/agent/sub-agent-isolation.ts` with `createIsolatedSubAgentDraft` and `applySubAgentResult`.
- Reused the existing `CanvasGraphStore` contract so child canvas tools write only to a cloned draft graph until the parent explicitly merges.
- Added `desktop/src/main/agent/sanitize-graph.ts` to strip executable strings from child draft graph node data and drop unsupported values before persistence.
- Updated agents and canvas-plan contracts to state that sub-agent draft writes do not persist before parent merge and that merge revalidates edges through the shared connection matrix.

Verification:

```bash
bun x vitest run tests/sub-agent-isolation.test.ts
```

Result:

- RED before implementation: failed because `desktop/src/main/agent/sub-agent-isolation.ts` did not exist.
- PASS after implementation: sub-agent isolation and merge tests passed, 1 test file and 2 tests.

```bash
bun x tsc --noEmit --pretty false
bun x eslint . --max-warnings=0
```

Result:

- PASS: TypeScript strict compile completed with exit code 0.
- PASS: lint completed with exit code 0.

```bash
bun run ci
```

Result:

- PASS: full CI completed with lint, typecheck, 47 test files / 142 tests, build, and repository verification all passing.
