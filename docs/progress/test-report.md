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


### M5-37 Custom Agent Settings

Scope:

- Added `desktop/src/main/agent/registry.ts` and `desktop/src/main/ipc/agent.handler.ts` so built-in agents and persisted custom agents share one registry boundary.
- Completed `desktop/src/main/db/repositories/agent.repo.ts` CRUD persistence for user agents through `agents.policy_json`.
- Exposed typed preload APIs: `listAgents`, `saveAgent`, and `deleteAgent`, and registered the AgentRegistry in the real main-process runtime.
- Added Tailwind + `cn` renderer settings UI in `AgentList.tsx` and `AgentForm.tsx`, following the existing Gateway settings style and `hjwall/pc-client` dense settings/confirm-dialog interaction patterns without copying reference source.
- Mounted Agent settings in `App.tsx` and kept built-in agents read-only while user agents can be created, edited, and deleted.
- Updated `docs/api-contracts/agents.md`, the canonical milestone tasks, and backlog status for REQ-053.

Verification:

```bash
bun x vitest run tests/agent-settings-ipc.test.ts tests/agent-settings-ui.test.tsx
```

Result:

- RED before implementation: backend failed because `desktop/src/main/agent/registry.ts` was missing; UI failed because `AgentForm` and `AgentList` were missing.
- PASS after implementation: custom Agent settings IPC and UI tests passed, 2 test files and 8 tests.

```bash
bun x vitest run tests/agent-settings-ipc.test.ts tests/agent-settings-ui.test.tsx tests/gateway-preload.test.ts tests/ipc-skeleton.test.ts tests/main-runtime-wiring.test.ts
bun x tsc --noEmit --pretty false
bun x eslint . --max-warnings=0
```

Result:

- PASS: targeted M5-37, preload, IPC skeleton, and main runtime wiring tests passed, 5 test files and 17 tests.
- PASS: TypeScript strict compile completed with exit code 0.
- PASS: lint completed with exit code 0.

```bash
bun run ci
```

Result:

- PASS: full CI completed with lint, typecheck, 49 test files / 150 tests, desktop/shared build, and repository verification all passing.

### M5-38 @mention Agent Selector

Scope:

- Read `global/design/DESIGN.md` baseline already enforced for renderer work and referenced `hjwall/pc-client/src/modules/workflow-canvas/components/MentionTextarea.tsx`, `CommandPalette.tsx`, `CanvasChatBox.tsx`, and `BottomInputPanel.tsx` for mention, keyboard, and dense composer patterns.
- Added `desktop/src/renderer/src/chat/useMentionTrigger.ts` for trailing `@query` detection around the textarea caret.
- Added `desktop/src/renderer/src/chat/AgentMentionPopover.tsx` with Tailwind + `cn` listbox rendering, active item state, mouse hover, click selection, and accessible option labels.
- Updated `ChatPanel.tsx` to load `agent.list`, default to the built-in orchestrator, open the popover while typing `@`, support ArrowUp/ArrowDown/Enter/Escape, show the selected agent chip, strip the visible mention prefix, and route `canvas.chatSend.agentId` to the selected agent.

Verification:

```bash
bun x vitest run tests/chat-ui.test.tsx --reporter=dot
```

Result:

- RED before implementation: the new routing test failed because no `Agent mention selector` listbox existed.
- PASS after implementation: Chat UI tests passed, 1 test file and 6 tests.

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

- PASS: full CI completed with lint, typecheck, 49 test files / 151 tests, desktop/shared build, and repository verification all passing.

### M5-39 Tool Management UI

Scope:

- Extended `desktop/src/main/tools/runtime.ts` with `enable` and `disable`, descriptor cloning, disabled-tool listing, and disabled invocation rejection through the existing `tool_not_found` safe error path.
- Added `desktop/src/main/ipc/tool.handler.ts` for `tool.list`, `tool.invoke`, `tool.enable`, and `tool.disable`.
- Wired the real main-process runtime to `createToolRuntime`, built-in canvas tools, and `registerToolHandlers`.
- Exposed typed preload methods: `listTools`, `enableTool`, `disableTool`, and `invokeTool`.
- Added Tailwind + `cn` renderer settings UI in `desktop/src/renderer/src/settings/ToolList.tsx`, following the existing Gateway/Agent settings card patterns and `hjwall/pc-client` dense settings references without copying source.
- Mounted Tool settings in `App.tsx` and updated M5 progress/backlog status.

Verification:

```bash
bun x vitest run tests/tool-runtime.test.ts tests/tool-management-ipc.test.ts tests/tool-settings-ui.test.tsx tests/gateway-preload.test.ts tests/ipc-skeleton.test.ts --reporter=dot
```

Result:

- RED before implementation: failed because `runtime.disable` was missing, `desktop/src/main/ipc/tool.handler.ts` was missing, preload did not expose tool actions, and `ToolList` did not exist.
- PASS after implementation: Tool runtime, tool IPC, preload, IPC skeleton, and Tool settings UI tests passed, 5 test files and 15 tests.

```bash
bun x vitest run tests/tool-runtime.test.ts tests/tool-management-ipc.test.ts tests/tool-settings-ui.test.tsx tests/gateway-preload.test.ts tests/ipc-skeleton.test.ts tests/main-runtime-wiring.test.ts --reporter=dot
bun run typecheck
bun run lint
```

Result:

- PASS: targeted M5-39 plus main runtime wiring tests passed, 6 test files and 17 tests.
- PASS: TypeScript strict compile completed with exit code 0.
- PASS: lint completed with exit code 0.

```bash
bun run ci
```

Result:

- PASS: full CI completed with lint, typecheck, 51 test files / 156 tests, desktop/shared build, and repository verification all passing.

### M5-40 Asset Library Folders

Scope:

- Added nested asset folder contracts for `asset.getFolders`, `asset.createFolder`, and `asset.deleteFolder` in `shared/assets.ts`, `shared/ipc.ts`, and `docs/api-contracts/assets-files.md`.
- Extended `AssetRepository` with folder CRUD, asset listing by folder/media type, asset moves, reference records, safe trash rejection, and force-tombstone folder deletion.
- Wired asset IPC handlers and preload methods for list/move/trash/folder create/folder delete, with runtime repository injection.
- Added Tailwind + `cn` renderer UI in `desktop/src/renderer/src/assets/AssetPanel.tsx`, mounted in `App.tsx`, adapting `hjwall/pc-client` asset-library patterns without copying source.
- Updated IPC skeleton coverage for the expanded asset channel set.

Verification:

```bash
bun x vitest run tests/asset-folders-repo.test.ts tests/asset-folders-ipc.test.ts tests/asset-preload.test.ts tests/asset-panel-ui.test.tsx --reporter=dot
```

Result:

- RED before implementation: failed because `createFolder`, expanded asset IPC handlers, preload asset methods, and `AssetPanel` were missing.
- PASS after implementation: asset folder repository, IPC, preload, and renderer UI tests passed, 4 test files and 5 tests.

```bash
bun run typecheck
bun run lint
bun run test -- --reporter=dot
```

Result:

- PASS: TypeScript strict compile completed with exit code 0.
- PASS: lint completed with exit code 0.
- PASS: full test suite passed, 55 test files and 161 tests.

```bash
bun run ci
```

Result:

- PASS: full CI completed with lint, typecheck, 55 test files / 161 tests, desktop/shared build, and repository verification all passing.

## 2026-06-26 - CI/CD Bun Hardening

Scope:

- Kept Bun as the package manager and task runner while replacing fragile Windows `.bin` shim calls with explicit Bun script entrypoints for ESLint, TypeScript, Vitest, and native rebuild.
- Added `@electron/rebuild` and `rebuild:native` so `better-sqlite3` is rebuilt for Electron's ABI before production desktop builds.
- Added `eslint-plugin-react-hooks` to match existing renderer lint directives and prevent missing-rule failures.
- Updated GitHub Actions CI/release jobs to install Node 24 alongside Bun for tools that require modern Node compatibility.
- Fixed current lint blockers in renderer and IPC code: explicit fire-and-forget Promise handling, safe Zustand method selectors, unused imports/types, and navigation Promise handling.

Verification:

```bash
bun run lint
bun run typecheck
bun run test -- --reporter=dot
bun run build
bun run verify:repo
bun run ci
```

Result:

- PASS: lint completed with exit code 0.
- PASS: TypeScript strict compile completed with exit code 0.
- PASS: Vitest entrypoint ran successfully through Bun.
- PASS: Electron native rebuild completed and desktop build completed with exit code 0.
- PASS: repository verification passed.
- PASS: full CI gate completed with lint, typecheck, test, build, and repository verification all passing.

Operational note:

- On Windows, `rebuild:native` must run while Electron is closed; an active Electron process can lock `better_sqlite3.node` and cause `EPERM` during rebuild.

## 2026-06-26 - REQ-092 Local Media Drop Slice

Scope:

- Added `desktop/src/renderer/src/canvas/lib/local-media-drop.ts` to classify local dropped files before mutating the canvas.
- Image and video drops now plan `asset.import` requests and create image/video canvas nodes at the drop position after the main process returns a safe asset record.
- The sandboxed preload bridge now exposes typed `importAsset`, mapped only to the existing `asset.import` IPC contract.
- Canvas asset insertion and local file drop now share the same node creation path, including `assetId`, `url`, and `status: done` so imported media can render through safe URLs.
- Audio drops are explicitly rejected with a Chinese user-facing message until the shared audio node contract lands.

Verification:

```bash
bun node_modules/typescript/bin/tsc --noEmit --pretty false
bun node_modules/eslint/bin/eslint.js desktop/src/renderer/src/canvas/lib/local-media-drop.ts desktop/src/renderer/src/canvas/CanvasPage.tsx desktop/src/preload/index.ts tests/local-media-drop.test.ts --max-warnings=0
& 'C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' node_modules\vitest\vitest.mjs run tests/local-media-drop.test.ts --reporter=verbose
```

Result:

- PASS: TypeScript strict compile completed with exit code 0.
- PASS: targeted ESLint completed with exit code 0.
- PASS: local media drop tests passed, 1 test file and 3 tests.

Current blockers:

- `bun node_modules/vitest/vitest.mjs run tests/local-media-drop.test.ts` fails before test collection on Windows with `TypeError: File URL path must be an absolute path`.
- `bun x vitest ...` currently fails with Bun bin remap error: `could not create process`.
- Full suite through Codex bundled Node reaches tests, but many repository/runtime tests fail because `better-sqlite3` is compiled for NODE_MODULE_VERSION 130 while bundled Node requires 137. This is an environment/ABI mismatch, not evidence that REQ-092 is complete.
- Full desktop drag/drop user-flow evidence is still pending, so REQ-092 remains partial.

## 2026-06-26 - Windows Bun/Node/Electron ABI Follow-up

Scope:

- Root-caused the black-screen/closed-app symptom to `better-sqlite3` being compiled for Node ABI 137 after test setup while Electron 33 requires ABI 130.
- Changed root `dev` so desktop startup runs `rebuild:native` first, preventing a previous Node/Vitest run from leaving Electron with the wrong native module ABI.
- Added `scripts/run-vitest.mjs` so `bun run test` remains the task entrypoint while Vitest executes in a real Node process. This avoids the Windows Bun runtime Vitest startup failure (`File URL path must be an absolute path`).
- Updated stale contract tests to match the current router/canvas architecture, expanded IPC channels, Chinese-localized AssetPanel UI, and current `canvas.runNode` reference payload.
- Rewired `CanvasPage` to use `createCanvasPlanExecutionController`, preserving the real Plan auto-execution path from `applyPlan` to `runCanvasNode` and job terminal event updates.

Verification:

```bash
& 'C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' node_modules\vitest\vitest.mjs run tests\electron-skeleton.test.ts tests\ipc-skeleton.test.ts tests\asset-panel-ui.test.tsx tests\agent-orchestration-smoke.test.ts --reporter=dot
bun run typecheck
bun run lint
& 'C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' node_modules\vitest\vitest.mjs run tests\local-media-drop.test.ts tests\db-schema.test.ts --reporter=verbose
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun run test -- tests\electron-skeleton.test.ts tests\ipc-skeleton.test.ts tests\asset-panel-ui.test.tsx tests\agent-orchestration-smoke.test.ts tests\local-media-drop.test.ts tests\db-schema.test.ts --reporter=dot
bun run rebuild:native
Start-Process -FilePath bun -ArgumentList @('run','dev') -WorkingDirectory 'D:\draw\hjw' -WindowStyle Hidden -PassThru
Invoke-WebRequest -UseBasicParsing http://localhost:5173/
```

Result:

- PASS: updated IPC/electron/asset/orchestration focused tests passed, 4 files and 12 tests.
- PASS: TypeScript strict compile completed with exit code 0.
- PASS: ESLint completed with exit code 0.
- PASS: local media drop plus DB schema tests passed, 2 files and 5 tests.
- PASS: `bun run test` wrapper executed Vitest via Node with `NODE_BINARY`, 6 files and 17 tests.
- PASS: Electron native rebuild completed and the desktop dev process started; Vite renderer returned HTTP 200 from `http://localhost:5173/`.

Operational note:

- CI already installs Node 24, so `bun run test` can resolve `node` there. In local Codex shells where `node` is not on PATH, set `NODE_BINARY` to a Node 20+ executable before running tests.
- Running Node/Vitest and Electron dev in the same workspace requires ABI switching: tests need Node ABI; desktop dev/build needs `bun run rebuild:native` for Electron ABI.

## 2026-06-26 - REQ-094 Style Contract And Prompt Composition Slice

Scope:

- Read hjwall style references: `backend/src/modules/style/style-prompt.util.ts`, its unit tests, `style-preset.entity.ts`, and `StyleLibraryPanel.tsx`.
- Added `shared/styles.ts` as the ComicCanvas shared truth for style preset views, save inputs, project default requests, effective style resolution, and deterministic prompt composition.
- Added `docs/api-contracts/styles.md` for style list/save/delete/project-default channels and prompt composition invariants.
- Added typed shared IPC entries for `style.list`, `style.save`, `style.delete`, `style.setProjectDefault`, and `style.changed`.
- Preserved the hjwall-compatible prompt rule: `promptBefore + content + promptAfter` with empty parts skipped, and legacy `legacyPromptPreset` fallback only when before/after are empty.

Verification:

```bash
& 'C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' node_modules\vitest\vitest.mjs run tests\style-contracts.test.ts --reporter=verbose
bun run typecheck
bun run lint
```

Result:

- RED first: `tests/style-contracts.test.ts` failed because `../shared/styles` did not exist.
- RED after adding type-level IPC assertions: `bun run typecheck` failed because `StyleIpcChannel` and style request/response map entries were missing.
- PASS after implementation: style contract tests passed, 1 file and 6 tests.
- PASS: TypeScript strict compile completed with exit code 0.
- PASS: ESLint completed with exit code 0.

Remaining REQ-094 gaps:

- No style repository/schema migration yet.
- No main-process style IPC handler is registered yet.
- No renderer style library or project/node selector UI is wired yet.
- No generation job payload test proves style injection is used by runtime image/video jobs yet.

## 2026-06-26 - REQ-094 Style Repository And IPC Slice

Scope:

- Added SQLite migration `0003_style_presets` with `style_presets` and `workflows.default_style_preset_id`.
- Added Drizzle schema declarations for `style_presets` and workflow default style.
- Added `StyleRepository` for style save/list/soft-delete and workflow project default style persistence.
- Added `registerStyleHandlers` for `style.list`, `style.save`, `style.delete`, and `style.setProjectDefault`.
- Registered Style IPC in the main-process runtime and IPC skeleton coverage.

Verification:

```bash
& 'C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' node_modules\vitest\vitest.mjs run tests\style-repository-ipc.test.ts --reporter=verbose
& 'C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' node_modules\vitest\vitest.mjs run tests\style-repository-ipc.test.ts tests\style-contracts.test.ts tests\ipc-skeleton.test.ts tests\db-schema.test.ts --reporter=dot
bun run typecheck
bun run lint
```

Result:

- RED first: test failed because `desktop/src/main/db/repositories/style.repo` did not exist.
- RED after initial implementation: Node/Vitest was blocked by Electron ABI for `better-sqlite3`; restored Node ABI with `bun install --force`.
- RED after reaching assertions: project default style did not persist because the test had not created the workflow row; fixed the test to exercise the real same-database workflow precondition.
- PASS: Style repository/IPC tests passed, 1 file and 3 tests.
- PASS: Style contracts, style repository/IPC, IPC skeleton, and DB schema tests passed, 4 files and 17 tests.
- PASS: TypeScript strict compile completed with exit code 0.
- PASS: ESLint completed with exit code 0.

Remaining REQ-094 gaps:

- No renderer style library UI yet.
- No project-level or node-level style selector wiring yet.
- No generation job payload test proves runtime image/video jobs call `composeStyledPrompt`.
- No desktop user flow evidence yet for selecting a style and running a stub generation with that style.

## 2026-06-26 - REQ-094 Runtime Style Payload Slice

Scope:

- Added runtime job payload composition in `canvas.runNode` and `canvas.runPlan` from the persisted graph snapshot.
- Runtime payload now includes composed prompt, model key, generation parameters, references, and style negative prompt when an enabled style is selected.
- Node-level `stylePresetId` overrides workflow project default style during job enqueue.
- Wired the main-process runtime to pass the real `StyleRepository` into canvas IPC handlers.

Verification:

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/style-runtime-payload.test.ts
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/main-runtime-wiring.test.ts
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/style-runtime-payload.test.ts tests/style-contracts.test.ts tests/style-repository-ipc.test.ts tests/ipc-skeleton.test.ts tests/main-runtime-wiring.test.ts tests/m1-smoke-path.test.ts
bun run typecheck
bun run lint
```

Result:

- RED first: `tests/style-runtime-payload.test.ts` failed because `canvas.runNode` enqueued only `{ nodeId, references }` and omitted `prompt`, `modelKey`, and `parameters`.
- RED after adding a runtime-level hash assertion: `tests/main-runtime-wiring.test.ts` failed because persisted project styles were not passed into `registerCanvasHandlers`.
- PASS: style runtime payload test passed, 1 file and 1 test.
- PASS: main runtime wiring tests passed, 1 file and 3 tests.
- PASS: focused style/runtime/smoke group passed, 6 files and 20 tests.
- PASS: TypeScript strict compile completed with exit code 0.
- PASS: ESLint completed with exit code 0.

Remaining REQ-094 gaps:

- No renderer style library UI yet.
- No project-level or node-level style selector wiring yet.
- No desktop user flow evidence yet for selecting a style and running a stub generation with that style.

## 2026-06-26 - Canvas Blank Screen / Maximum Update Depth Fix

Scope:

- Reproduced the desktop "black screen" report by opening the default project canvas in Electron.
- The actual visible failure was React's route error overlay: `Maximum update depth exceeded`.
- Root cause found in canvas renderer Zustand selectors that returned freshly-created functions from `useStore(canvasStore, selector)`, causing unstable external-store snapshots.
- Replaced those selectors with stable store action selectors and annotated `CanvasStoreState` actions with `this: void` so lint permits safe method extraction.
- Added a regression test that rejects newly-created function selectors in canvas renderer files.

Verification:

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/canvas-store-selector-stability.test.ts
bun run lint
bun run typecheck
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/canvas-store-selector-stability.test.ts tests/agent-orchestration-smoke.test.ts tests/style-runtime-payload.test.ts tests/main-runtime-wiring.test.ts
```

Result:

- RED first: `tests/canvas-store-selector-stability.test.ts` failed on `CanvasPage.tsx` and `ImageConfigV2Node.tsx`.
- PASS: selector stability regression test passed, 1 file and 1 test.
- PASS: focused canvas/agent/style/runtime group passed, 4 files and 7 tests.
- PASS: TypeScript strict compile completed with exit code 0.
- PASS: ESLint completed with exit code 0.

Desktop observation:

- Before fix: Electron project list rendered, but opening `Default workspace` showed React's `Maximum update depth exceeded` route error overlay.
- Post-fix desktop verification still requires rebuilding native modules for Electron ABI and relaunching the app.

## 2026-06-26 - REQ-094 Renderer Style Selector Slice

Scope:

- Exposed typed preload style APIs: `listStyles`, `saveStyle`, `deleteStyle`, and `setProjectDefaultStyle`.
- Removed the hardcoded frontend-only image style preset list from `ImageConfigV2Node`.
- Wired image and video V2 node style chips to load enabled style presets through `window.comicCanvas.listStyles({ includeDisabled: false })`.
- Added loading/unavailable labels and kept node-level `stylePresetId` updates on selection.

Verification:

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/style-renderer-ui.test.tsx
bun run typecheck
bun run lint
bun install --force
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/style-renderer-ui.test.tsx tests/style-contracts.test.ts tests/ipc-skeleton.test.ts tests/canvas-store-selector-stability.test.ts tests/style-runtime-payload.test.ts tests/main-runtime-wiring.test.ts tests/style-repository-ipc.test.ts
```

Result:

- RED first: `tests/style-renderer-ui.test.tsx` failed because image node style selector never called `listStyles`.
- RED second: the added video node style selector test failed because the video toolbar still had a non-functional style chip and made zero `listStyles` calls.
- PASS: style renderer UI tests passed, 1 file and 2 tests.
- PASS: focused style/runtime/repository/IPC/canvas regression group passed, 7 files and 22 tests.
- PASS: TypeScript strict compile completed with exit code 0.
- PASS: ESLint completed with exit code 0.

Operational note:

- The first focused runtime group hit `better-sqlite3` ABI mismatch because Electron ABI 130 was still installed while Node/Vitest needed ABI 137. Stopping residual Electron/electron-vite/esbuild processes and running `bun install --force` restored the Node test ABI.

Remaining REQ-094 gaps:

- No renderer style library CRUD UI yet.
- No project-level default style selector UI yet.
- No desktop style selection and stub generation flow evidence yet.

## 2026-06-26 - REQ-094 Style Library And Project Selector Desktop Slice

Scope:

- Added `style.getProjectDefault` to the shared IPC contract, main-process style handler, preload bridge, and style API contract documentation.
- Added `StyleLibrary` in Settings > Style for list/create/edit/delete/toggle style preset workflows.
- Added `ProjectStyleSelector` to the canvas toolbar so a workflow can load, show, clear, and persist its default style.
- Kept image/video node style selectors backed by `style.list` instead of hardcoded frontend-only style options.

Verification:

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/style-contracts.test.ts tests/style-repository-ipc.test.ts tests/style-settings-ui.test.tsx tests/project-style-selector.test.tsx tests/ipc-skeleton.test.ts tests/style-renderer-ui.test.tsx
bun run typecheck
bun run lint
bun run dev
Invoke-WebRequest -UseBasicParsing http://localhost:5173/
```

Result:

- RED first: `tests/style-contracts.test.ts` and `tests/style-repository-ipc.test.ts` failed because `style.getProjectDefault` was missing from the IPC contract and handler.
- RED first: `tests/style-settings-ui.test.tsx` failed because `StyleLibrary` did not exist.
- RED first: `tests/project-style-selector.test.tsx` failed because `ProjectStyleSelector` did not exist.
- PASS: focused style UI/IPC/renderer tests passed, 6 files and 21 tests.
- PASS: TypeScript strict compile completed with exit code 0.
- PASS: ESLint completed with exit code 0.
- PASS: Electron native rebuild completed through `bun run dev`; Vite renderer returned HTTP 200 from `http://localhost:5173/`.

Desktop observation:

- Electron window `ComicCanvas Studio` rendered the project list with `Default workspace`; opening it rendered the canvas instead of the previous `Maximum update depth exceeded` route error.
- Canvas toolbar rendered `Project style: None`, and the selector opened with `No project style`.
- Settings > Style rendered the style library panel. Creating `Industrial Ink` with prompt-before, prompt-after, description, and tags saved successfully and immediately appeared in the list.
- Returning to the canvas showed `Industrial Ink` in the project style menu. Selecting it persisted and updated the toolbar to `Project style: Industrial Ink`.

Remaining REQ-094 gaps:

- Style preset cover thumbnail rendering is not implemented yet.
- Style Library and ProjectStyleSelector UI copy is still partly English and needs the product localization pass.
- Full desktop stub generation evidence with selected project style and node override still needs to be captured before REQ-094 is marked complete.

## 2026-06-26 - REQ-094 Style Cover, Localization, And Project Payload Slice

Scope:

- Added Style Library cover thumbnail rendering from `StylePresetView.coverUrl`.
- Added `coverAssetId` editing in the Style Library form so saved presets can reference an existing safe asset URL.
- Localized the Style Library, Settings style tab, ProjectStyleSelector, and image/video V2 node style picker states to Chinese.
- Updated runtime generation payload composition so `canvas.runNode` and `canvas.runPlan` use the request workflow ID when resolving the workflow project default style.
- Added a project-default runtime test proving an image node without a node-level style override receives `promptBefore`, `promptAfter`, and `negativePrompt` from the workflow default style.

Verification:

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/style-settings-ui.test.tsx tests/style-runtime-payload.test.ts --reporter=verbose
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/style-contracts.test.ts tests/style-repository-ipc.test.ts tests/style-runtime-payload.test.ts tests/style-renderer-ui.test.tsx tests/style-settings-ui.test.tsx tests/project-style-selector.test.tsx tests/ipc-skeleton.test.ts tests/main-runtime-wiring.test.ts --reporter=dot
bun run typecheck
bun run lint
bun run dev
Invoke-WebRequest -UseBasicParsing http://localhost:5173/
```

Result:

- RED first: `tests/style-settings-ui.test.tsx` failed because Style Library still used English copy, had no cover thumbnail, and did not save `coverAssetId`.
- RED first: `tests/style-runtime-payload.test.ts` failed because `canvas.runNode` resolved workflow defaults against `default` instead of the request `workflowId`.
- PASS after implementation: focused Style Library and runtime payload tests passed, 2 files and 5 tests.
- PASS after implementation: style/IPC/runtime/renderer regression group passed, 8 files and 27 tests.
- PASS: TypeScript strict compile completed with exit code 0.
- PASS: ESLint completed with exit code 0.
- PASS: Electron native rebuild completed through `bun run dev`; Vite renderer returned HTTP 200 from `http://localhost:5173/`.

Operational note:

- Running the full style repository/runtime group initially failed because `better-sqlite3` was still compiled for Electron ABI 130 while Node/Vitest required ABI 137. Stopping Electron dev processes and running `bun install --force` restored the Node test ABI.
- The final attempt to capture the Electron window through Windows automation timed out on app approval, so fresh desktop screenshot evidence for the localized Style UI is still pending.

Remaining REQ-094 gaps:

- Fresh desktop user-flow evidence for localized style cover display and a stub generation run using project default style is still pending.
- The runtime now has automated payload evidence for project default and node override precedence, but the same behavior still needs to be observed from the desktop flow before REQ-094 is marked complete.

## 2026-06-26 - REQ-094 Renderer Workflow ID Run Wiring

Scope:

- Extended the shared `canvas.runNode` request contract with optional `workflowId`.
- Kept `canvas.runPlan` compatible with workflow-scoped style resolution by allowing optional `workflowId` on the run-plan request.
- Updated the renderer Plan auto-execution path in `CanvasPage` so `window.comicCanvas.runCanvasNode` receives the current workflow ID as well as the node ID.
- Added wiring coverage so future renderer changes cannot silently drop `currentWorkflowId` from generation requests.

Verification:

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/agent-orchestration-smoke.test.ts tests/style-runtime-payload.test.ts tests/style-contracts.test.ts --reporter=dot
bun run typecheck
bun run lint
```

Result:

- PASS: renderer orchestration smoke, style runtime payload, and style contract tests passed, 3 files and 10 tests.
- PASS: TypeScript strict compile completed with exit code 0.
- PASS: ESLint completed with exit code 0.

Remaining REQ-094 gaps:

- Desktop acceptance still needs a captured run from the canvas UI showing a selected project default style reaching the queued generation job and resulting stub asset.

## 2026-06-26 - REQ-094 Workflow-Scoped Runtime Style Run

Scope:

- Added runtime coverage for the real `createMainProcessRuntime` path when
  `canvas.runNode` receives a non-default `workflowId`.
- Updated the main-process `CanvasGraphStore` contract so graph reads and
  writes can be scoped by workflow ID while preserving default-workflow callers.
- Updated `canvas.runNode` and `canvas.runPlan` payload construction so
  reference resolution and prompt/style composition read the requested
  workflow graph, not always the `default` graph.
- Verified that a non-default workflow's project default style changes the
  queued stub generation output hash through the same runtime path used by
  desktop IPC.

Verification:

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/main-runtime-wiring.test.ts --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/main-runtime-wiring.test.ts tests/style-runtime-payload.test.ts tests/style-contracts.test.ts tests/canvas-tools.test.ts tests/agent-orchestration-smoke.test.ts --reporter=dot
bun run typecheck
```

Result:

- RED first: the new non-default workflow test failed because the queued stub
  output hash was generated from the wrong graph prompt, proving `workflowId`
  was not applied to graph lookup.
- PASS after implementation: `tests/main-runtime-wiring.test.ts` passed, 1
  file and 4 tests.
- PASS after implementation: focused style/runtime/tool/agent regression group
  passed, 5 files and 17 tests.
- PASS: TypeScript strict compile completed with exit code 0.

Remaining REQ-094 gaps:

- Desktop acceptance still needs a captured UI run showing a selected project
  default style reaching the queued generation job and resulting stub asset.

## 2026-06-26 - REQ-096 Real Job State IPC Slice

Scope:

- Replaced the main-runtime `job.get`, `job.list`, and `job.recover` skeleton
  path with real `JobRepository` reads when the runtime injects durable job
  dependencies.
- Added `JobRepository.list` with status/type/target filters and a bounded
  limit so renderer job panels can observe persisted queue state without fake
  rows.
- Wired `createMainProcessRuntime` to pass the real durable queue, job
  repository, and clock into `registerJobHandlers`.
- Preserved skeleton fallbacks for early registration tests that intentionally
  instantiate handlers without full runtime dependencies.
- Added a runtime test proving a `canvas.runNode` ticket can be queried through
  `job.get` before terminal completion with the persisted target ID, prompt
  payload, parameters, and again after completion with the asset result.

Verification:

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/main-runtime-wiring.test.ts --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/main-runtime-wiring.test.ts tests/job-runtime.test.ts tests/ipc-skeleton.test.ts tests/repository-boundaries.test.ts --reporter=dot
bun run typecheck
```

Result:

- RED first after restoring Node/Vitest ABI: the new job observability test
  failed because `job.get` returned the skeleton row without the persisted
  `targetId` or payload.
- PASS after implementation: `tests/main-runtime-wiring.test.ts` passed, 1
  file and 5 tests.
- PASS: runtime/job/IPC/repository regression group passed, 4 files and 18
  tests.
- PASS: TypeScript strict compile completed with exit code 0.

Remaining REQ-096 gaps:

- Migrated video/audio/compose node job dispatch and terminal writeback remain
  incomplete.
- Desktop acceptance still needs a captured run from the real Electron canvas
  showing queued job details, terminal event update, and resulting asset.

## 2026-06-26 - REQ-096 Canvas Reopen Job Reconciliation Slice

Scope:

- Added a pure renderer reconciliation helper for persisted canvas jobs that
  finished while the canvas page was closed.
- Reconciles only jobs with a current `targetId` on the loaded graph and only
  canvas image/video job types.
- Restores node state from the newest job per target: completed asset jobs set
  `status: done` and `assetId`, failed jobs set `status: error`, and
  pending/processing jobs set `status: pending` with a cleared result asset.
- Wired `CanvasPage` graph loading and workflow switching through a single
  restore path that calls `job.list` once after load and falls back to the
  saved graph if job reconciliation is unavailable.
- Added a static guard proving the canvas page uses the one-shot reconciliation
  helper and does not add renderer polling.

Verification:

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/canvas-job-reconciliation.test.ts --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/canvas-job-reconciliation.test.ts tests/job-preload.test.ts tests/canvas-job-panel.test.tsx --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/canvas-job-reconciliation.test.ts tests/job-preload.test.ts tests/canvas-job-panel.test.tsx tests/job-runtime.test.ts tests/main-runtime-wiring.test.ts tests/job-ipc-fanout.test.ts tests/renderer-zero-polling.test.ts tests/electron-security.test.ts --reporter=dot
bun run typecheck
```

Result:

- RED first: `tests/canvas-job-reconciliation.test.ts` failed because
  `desktop/src/renderer/src/canvas/lib/job-reconciliation.ts` did not exist.
- PASS after implementation: reconciliation, preload wiring, and job panel
  tests passed, 3 files and 8 tests.
- Initial wide regression exposed the known native ABI mismatch after running
  Electron (`better-sqlite3` compiled for Electron ABI 130 while Node/Vitest
  required ABI 137). Stopping Electron/Bun dev processes and running
  `bun install --force` restored the Node test ABI.
- PASS after ABI restoration: REQ-096 job/runtime/preload/UI/security
  regression group passed, 8 files and 26 tests.
- PASS: TypeScript strict compile completed with exit code 0.

Remaining REQ-096 gaps:

- Migrated video/audio/compose node job dispatch and terminal writeback remain
  incomplete.
- Desktop acceptance still needs a captured reopen flow proving a missed
  terminal job updates the loaded canvas node from persisted job state.

## 2026-06-26 - REQ-096 Canvas Job Panel Slice

Scope:

- Exposed `listJobs` from the sandboxed preload bridge as a typed wrapper over
  `job.list`.
- Added `CanvasJobPanel` as a compact canvas overlay for recent local jobs,
  showing job ID, localized status, type, target node, progress, failure
  message, and manual refresh.
- Wired the panel into `CanvasPage` through top toolbar and left tool rail
  "运行任务" controls so job state is visible to users, not only tests or
  developer tools.
- Subscribed the panel to `job.completed` and `job.failed` terminal events to
  refresh the list without renderer polling loops.

Verification:

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/job-preload.test.ts tests/canvas-job-panel.test.tsx --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/job-preload.test.ts tests/canvas-job-panel.test.tsx tests/job-runtime.test.ts tests/main-runtime-wiring.test.ts tests/job-ipc-fanout.test.ts tests/renderer-zero-polling.test.ts tests/electron-security.test.ts --reporter=dot
bun run typecheck
```

Result:

- RED first: preload test failed because `listJobs` and `job.list` wrapper
  were missing.
- RED first: component test failed because `CanvasJobPanel` did not exist.
- PASS after implementation: job preload and panel tests passed, 2 files and 4
  tests.
- PASS: REQ-096 UI/job/preload/security regression group passed, 7 files and
  21 tests.
- PASS: TypeScript strict compile completed with exit code 0.

Remaining REQ-096 gaps:

- One-shot job reconciliation is covered by the later
  "Canvas Reopen Job Reconciliation Slice"; desktop reopen evidence remains
  pending there.
- Migrated video/audio/compose node job dispatch and terminal writeback remain
  incomplete.
- Desktop acceptance still needs a captured run from the real Electron canvas
  showing queued job details, terminal event update, and resulting asset.

## 2026-06-26 - REQ-096 Job List Filter Contract Slice

Scope:

- Added focused repository coverage for `JobRepository.list` status, type,
  target ID, and newest-first limit behavior.
- Defined `limit <= 0` as an empty result so renderer job panels can disable a
  query or request an empty page without accidentally receiving one persisted
  job.
- Added main-runtime IPC coverage proving `job.list` returns persisted
  `canvas.runNode` jobs through type, target, and limit filters.
- Adjusted the IPC test away from pending-state assumptions because the real
  main runtime auto-drains jobs and can move a queued job to `processing` or
  `completed` before the renderer reads the list.

Verification:

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/job-runtime.test.ts tests/main-runtime-wiring.test.ts --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/job-runtime.test.ts tests/main-runtime-wiring.test.ts tests/ipc-skeleton.test.ts tests/repository-boundaries.test.ts tests/job-ipc-fanout.test.ts --reporter=dot
bun run typecheck
```

Result:

- RED first: the new repository test failed because `limit: 0` was clamped to
  one row instead of returning an empty list.
- RED first: the initial IPC test also exposed an invalid assumption that both
  jobs would remain `pending` despite auto-drain.
- PASS after implementation/test correction: `tests/job-runtime.test.ts` and
  `tests/main-runtime-wiring.test.ts` passed, 2 files and 11 tests.
- PASS: REQ-096 job/runtime/IPC regression group passed, 5 files and 22 tests.
- PASS: TypeScript strict compile completed with exit code 0.

Remaining REQ-096 gaps:

- Renderer UI consumption of `job.list` is covered by the earlier Canvas Job
  Panel slice.
- One-shot job reconciliation is covered by the later
  "Canvas Reopen Job Reconciliation Slice"; desktop reopen evidence remains
  pending there.
- Migrated video/audio/compose node job dispatch and terminal writeback remain
  incomplete.
- Desktop acceptance still needs a captured run from the real Electron canvas
  showing queued job details, terminal event update, and resulting asset.

## 2026-06-26 - REQ-093 Shared Node Contract And Matrix Slice

Scope:

- Expanded the shared canvas node vocabulary to the accepted migrated set:
  text, image, video, character, scene, audio, imageConfigV2, videoConfigV2,
  videoCompose, superResolution, muxAudioVideo, and mjImage.
- Expanded the shared connection matrix for semantic, media, config,
  composition, upscale, mux, and mjImage flows while preserving existing
  image-to-video and imageConfigV2-to-video compatibility.
- Updated CanvasPlan sanitization, apply-plan node filtering/default data,
  canvas tool schemas, and connection-validation labels for the migrated
  vocabulary.
- Kept this as a shared contract slice only. Renderer node components,
  graph serializer evidence, migrated run dispatch, terminal writeback, and
  desktop acceptance remain follow-up work in tasks 13 through 17 and 25.

Verification:

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/node-contracts.test.ts --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/node-contracts.test.ts tests/connection-matrix.test.ts tests/sanitize-plan.test.ts tests/apply-plan-runner.test.ts tests/agent-orchestration-smoke.test.ts --reporter=dot
bun run typecheck
```

Result:

- RED first: `tests/node-contracts.test.ts` failed because the matrix still
  exposed only the old node vocabulary and rejected migrated semantic flows
  such as text-to-character.
- PASS after implementation: REQ-093 contract/matrix/sanitizer/apply-plan
  regression group passed, 5 files and 18 tests.
- PASS: TypeScript strict compile completed with exit code 0 through
  `bun run typecheck`.

Remaining REQ-093 gaps:

- Graph serializer coverage for the expanded node union still needs explicit
  tests and desktop save/load evidence.
- Character, scene, audio, videoCompose, superResolution, muxAudioVideo, and
  mjImage still need production renderer components and user-facing vertical
  slices.
- Migrated node run dispatch, job terminal writeback, and real desktop
  acceptance evidence remain incomplete.

## 2026-06-26 - REQ-093 Graph Persistence Serializer Slice

Scope:

- Added graph persistence coverage proving all accepted migrated hjwall canvas
  node types can round trip through `canvas.saveGraph` and `canvas.loadGraph`.
- Added a negative persistence case for an unknown `legacyNode`, requiring the
  graph sanitizer to remove unsupported nodes and any edges connected to them.
- Moved graph persistence sanitization into the shared graph contract through
  `sanitizeCanvasGraphSnapshot` and `isCanvasNodeType`, so IPC and future
  graph handoff paths can reuse the same node whitelist and edge validation.

Verification:

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/canvas-graph-persistence.test.ts --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/node-contracts.test.ts tests/connection-matrix.test.ts tests/canvas-graph-persistence.test.ts tests/sanitize-plan.test.ts tests/apply-plan-runner.test.ts tests/agent-orchestration-smoke.test.ts --reporter=dot
bun run typecheck
```

Result:

- RED first: the migrated graph persistence test failed because
  `canvas.saveGraph` persisted an unsupported `legacyNode`.
- PASS after implementation: `tests/canvas-graph-persistence.test.ts` passed,
  1 file and 2 tests.
- PASS: REQ-093 graph/contract/orchestration regression group passed, 6 files
  and 20 tests.
- PASS: TypeScript strict compile completed with exit code 0 through
  `bun run typecheck`.

Remaining REQ-093 gaps:

- Desktop save/load evidence for the expanded migrated graph still needs to be
  captured from the real Electron canvas.
- New migrated node UI components, user-facing creation flows, run dispatch,
  and terminal writeback remain incomplete.

## 2026-06-26 - REQ-093 Renderer Default Data Readiness Slice

Scope:

- Added renderer store coverage proving newly accepted migrated node types do
  not fall through to video-node default data when created from the canvas
  store.
- Added explicit default data for character, scene, audio, videoCompose,
  superResolution, muxAudioVideo, and mjImage in the canvas store.
- Synchronized `CanvasPage`'s direct node creation default data with the store
  so future visible create-menu entries produce the same persisted payloads as
  store-level creation.

Verification:

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/canvas-store.test.ts --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/canvas-store.test.ts tests/apply-plan-runner.test.ts tests/canvas-graph-persistence.test.ts tests/node-contracts.test.ts tests/connection-matrix.test.ts tests/agent-orchestration-smoke.test.ts --reporter=dot
bun run typecheck
```

Result:

- RED first: the new canvas-store test failed because `character` creation
  produced `Video 1` data with video fields.
- PASS after implementation: `tests/canvas-store.test.ts` passed, 1 file and
  6 tests.
- PASS: REQ-093 store/plan/graph/contract regression group passed, 6 files and
  20 tests.
- PASS: TypeScript strict compile completed with exit code 0 through
  `bun run typecheck`.

Remaining REQ-093 gaps:

- The migrated node types are not yet exposed as production UI components in
  the canvas create menus.
- Character, scene, audio, videoCompose, superResolution, muxAudioVideo, and
  mjImage still need dedicated renderer nodes or an intentional generic node
  strategy, plus desktop creation/save/load evidence.
- Run dispatch and terminal writeback for migrated node types remain pending.

## 2026-06-26 - REQ-093 Generic Migrated Node UI Slice

Scope:

- Added a generic `MigratedNode` renderer for accepted hjwall semantic/tool
  node types that do not yet have specialized production components:
  character, scene, audio, videoCompose, superResolution, muxAudioVideo, and
  mjImage.
- The generic node renders a stable type label, node label, status when present,
  and basic editable fields such as description, prompt, model, category, and
  asset ID depending on node type.
- Registered the migrated node types in React Flow `nodeTypes` and exposed them
  in canvas context/expanded add menus so users can create and persist them.
- Kept this deliberately as a generic UI bridge. It makes the nodes visible and
  editable, but it does not claim full specialized hjwall parity for each node.

Verification:

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/migrated-node.test.tsx tests/migrated-node-menu.test.ts --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/migrated-node.test.tsx tests/migrated-node-menu.test.ts tests/canvas-store.test.ts tests/apply-plan-runner.test.ts tests/canvas-graph-persistence.test.ts tests/node-contracts.test.ts tests/connection-matrix.test.ts --reporter=dot
bun run typecheck
bun run dev
```

Result:

- RED first: `tests/migrated-node.test.tsx` initially failed because
  `MigratedNode` did not exist.
- RED first: `tests/migrated-node-menu.test.ts` failed because the migrated
  node types were not exposed through canvas add menus.
- PASS after implementation: migrated node component/menu tests passed, 2 files
  and 4 tests.
- PASS: REQ-093 UI/store/plan/graph/contract regression group passed, 7 files
  and 22 tests.
- PASS: TypeScript strict compile completed with exit code 0 through
  `bun run typecheck`.
- DESKTOP PARTIAL: `bun run dev` rebuilt Electron native modules and launched
  the desktop app; the real Electron project page rendered and was not black.
  The follow-up canvas add-menu screenshot was interrupted by user window input,
  so it is not counted as completion evidence.

Remaining REQ-093 gaps:

- Capture real Electron desktop evidence for creating, editing, saving, and
  reloading migrated generic nodes from the add menu.
- Replace generic UI with specialized production components where hjwall parity
  requires richer controls, previews, ordering, or result handling.
- Run dispatch and terminal writeback for migrated node types remain pending.

## 2026-06-26 - REQ-093/REQ-096 Semantic Context Prompt Composition Slice

Scope:

- Extended shared `composeFinalPrompt` so migrated semantic/context nodes are
  no longer decorative graph nodes only.
- Character and scene nodes now contribute deterministic prompt lines using
  their label and description when connected upstream of a generation node.
- Character, scene, and mjImage nodes with `assetId` now contribute image
  references to the same shared result consumed by renderer preview and main
  runtime generation payload composition.
- mjImage nodes now contribute their prompt text to downstream generation
  prompts while preserving existing text/image/video behavior.

Verification:

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/composed-prompt.test.ts --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/composed-prompt.test.ts tests/connected-inputs-panel.test.tsx tests/style-runtime-payload.test.ts tests/main-runtime-wiring.test.ts tests/canvas-store.test.ts tests/canvas-graph-persistence.test.ts --reporter=dot
bun run typecheck
```

Result:

- RED first: the new composer test failed because character, scene, and
  mjImage upstream nodes were ignored and only text plus target prompt override
  appeared.
- PASS after implementation: `tests/composed-prompt.test.ts` passed, 1 file
  and 2 tests.
- PASS: prompt preview/runtime payload/graph regression group passed, 6 files
  and 22 tests.
- PASS: TypeScript strict compile completed with exit code 0 through
  `bun run typecheck`.

Remaining gaps:

- Audio, videoCompose, superResolution, and muxAudioVideo still need run-time
  snapshot semantics appropriate to their job type.
- Desktop evidence still needs to prove a real canvas graph with character,
  scene, and mjImage nodes affects the visible final prompt preview and queued
  job payload.

## 2026-06-26 - REQ-096 Migrated Run Dispatch Slice

Scope:

- Added typed queue dispatch for migrated runtime nodes instead of sending every
  `canvas.runNode` call as `canvas.generateImage`.
- `mjImage` now enqueues as an image job with `nodeType: "mjImage"`,
  multi-result parameters, semantic character/scene context, its own prompt, and
  image references from upstream semantic nodes.
- `videoCompose`, `superResolution`, and `muxAudioVideo` now enqueue as
  `canvas.composeVideo`, `canvas.upscaleVideo`, and `canvas.muxAudioVideo`
  with structured input refs and parameters.
- Main runtime registers local stub report handlers for video generation,
  composition, upscale, and mux jobs so the durable worker does not fail typed
  migrated jobs merely because real gateway execution is intentionally out of
  scope.

Verification:

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/migrated-run-dispatch.test.ts --reporter=dot
bun run typecheck
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/migrated-run-dispatch.test.ts tests/style-runtime-payload.test.ts tests/ipc-skeleton.test.ts tests/main-runtime-wiring.test.ts tests/job-runtime.test.ts tests/composed-prompt.test.ts --reporter=dot
```

Result:

- RED first: `tests/migrated-run-dispatch.test.ts` initially failed because
  `mjImage` lacked runtime prompt/reference payload and video composition nodes
  were still enqueued as `canvas.generateImage`.
- PASS after implementation: migrated run dispatch focused test passed, 1 file
  and 2 tests.
- PASS: TypeScript strict compile completed with exit code 0 through
  `bun run typecheck`.
- PASS: runtime/IPC/style/prompt/job regression group passed, 6 files and 23
  tests.

Remaining gaps:

- Audio node enqueue semantics still need a dedicated vertical slice.
- Terminal writeback for the newly typed migrated job results is still stub-only
  and needs canvas node status/result reconciliation evidence.
- Desktop evidence still needs to prove users can run these migrated nodes from
  the canvas and observe job tickets/results from the real app window.

## 2026-06-26 - REQ-096 Typed Migrated Reopen Reconciliation Slice

Scope:

- Extended renderer one-shot job reconciliation so completed typed migrated
  jobs are not ignored when a workflow is reopened.
- `canvas.composeVideo`, `canvas.upscaleVideo`, and `canvas.muxAudioVideo`
  are now treated as runnable canvas jobs for persisted job restoration.
- Completed `report` results can write `status: "done"` plus optional
  `assetId`, `url`, `urls`, and `selectedIndex` back into migrated node data.
- Existing completed asset jobs, failed jobs, and pending/processing job
  behavior remain unchanged.

Verification:

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/canvas-job-reconciliation.test.ts --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/canvas-job-reconciliation.test.ts tests/migrated-run-dispatch.test.ts tests/job-preload.test.ts tests/canvas-job-panel.test.tsx tests/job-runtime.test.ts tests/main-runtime-wiring.test.ts tests/apply-plan-runner.test.ts --reporter=dot
bun run typecheck
```

Result:

- RED first: the new reconciliation test failed because typed migrated jobs
  were filtered out and completed report metadata left nodes pending.
- PASS after implementation: `tests/canvas-job-reconciliation.test.ts` passed,
  1 file and 4 tests.
- PASS: job/reconciliation/dispatch/PlanRunner regression group passed, 7
  files and 26 tests.
- PASS: TypeScript strict compile completed with exit code 0 through
  `bun run typecheck`.

Remaining gaps:

- Real-time terminal events still need the same typed migrated result mapping
  while the canvas is open.
- Audio node enqueue semantics still need a dedicated vertical slice.
- Desktop reopen evidence still needs to prove the real Electron canvas reloads
  typed migrated job state into visible node status/result fields.

## 2026-06-26 - REQ-096 Typed Migrated Real-Time Writeback Slice

Scope:

- Reused the same terminal-result-to-node-data mapping for both one-shot reopen
  reconciliation and live PlanRunner terminal events.
- Completed `report` events can now update a running migrated node with
  `status: "done"` plus optional `assetId`, `url`, `urls`, and
  `selectedIndex` while the canvas is open.
- Fixed a real-time race where synchronous `runNode` tickets were registered
  only in a microtask, allowing a fast terminal event to arrive before
  `jobId -> runStep` was stored.
- Existing asset-result writeback for image/video nodes remains covered by the
  orchestration smoke path.

Verification:

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/agent-orchestration-smoke.test.ts --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/agent-orchestration-smoke.test.ts tests/apply-plan-runner.test.ts tests/canvas-job-reconciliation.test.ts tests/migrated-run-dispatch.test.ts tests/job-runtime.test.ts tests/main-runtime-wiring.test.ts --reporter=dot
bun run typecheck
```

Result:

- RED first: the new smoke test failed because completed migrated `report`
  results left a running videoCompose node in `pending` state.
- RED follow-up: after wiring result mapping, the same test exposed a
  synchronous ticket registration race; the terminal event could arrive before
  the job-to-step map was populated.
- PASS after implementation: `tests/agent-orchestration-smoke.test.ts` passed,
  1 file and 3 tests.
- PASS: PlanRunner/reconciliation/dispatch/runtime regression group passed, 6
  files and 24 tests.
- PASS: TypeScript strict compile completed with exit code 0 through
  `bun run typecheck`.

Remaining gaps:

- Audio node enqueue semantics still need a dedicated vertical slice.
- PlanRunner still needs broader migrated run-step coverage beyond the
  videoCompose report writeback case.
- Desktop evidence still needs to prove the real Electron canvas displays the
  live migrated job result without requiring a reload.

## 2026-06-26 - REQ-096 Audio Run Dispatch Slice

Scope:

- Added `canvas.generateAudio` as a first-class durable job type.
- `canvas.runNode` now enqueues audio nodes as typed audio jobs instead of
  falling through to `canvas.generateImage`.
- Audio run payloads include the audio node input reference and duration
  metadata, so imported/generated audio can participate in the same async
  runtime model as image/video/composition nodes.
- Main runtime registers a local stub report handler for audio jobs because
  real gateway request execution is intentionally outside this migration scope.
- Reopen reconciliation now treats `canvas.generateAudio` as a runnable canvas
  job and restores completed audio report metadata into audio node data.

Verification:

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/migrated-run-dispatch.test.ts --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/migrated-run-dispatch.test.ts tests/canvas-job-reconciliation.test.ts --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/migrated-run-dispatch.test.ts tests/canvas-job-reconciliation.test.ts tests/agent-orchestration-smoke.test.ts tests/apply-plan-runner.test.ts tests/job-runtime.test.ts tests/main-runtime-wiring.test.ts tests/ipc-skeleton.test.ts --reporter=dot
bun run typecheck
```

Result:

- RED first: the audio dispatch test failed because audio nodes were still
  enqueued as `canvas.generateImage` with only empty references.
- PASS after implementation: `tests/migrated-run-dispatch.test.ts` passed, 1
  file and 3 tests.
- PASS: audio dispatch plus reconciliation focused tests passed, 2 files and 8
  tests.
- PASS: REQ-096 runtime/IPC/PlanRunner regression group passed, 7 files and 32
  tests.
- PASS: TypeScript strict compile completed with exit code 0 through
  `bun run typecheck`.

Remaining gaps:

- PlanRunner still needs broader migrated run-step coverage beyond audio and
  videoCompose report result cases.
- Desktop evidence still needs to prove users can run audio and downstream
  mux/composition flows from the real Electron canvas.

## 2026-06-26 - REQ-097 Migrated Plan Run Actions Slice

Scope:

- Expanded the shared CanvasPlan run action vocabulary to include migrated
  runtime actions: `audioRun`, `mjImageRun`, `videoComposeRun`,
  `superResolutionRun`, and `muxAudioVideoRun`.
- Updated main-process `sanitizePlan` so these actions are preserved instead
  of being dropped as `unsupported_action`.
- Updated renderer `applyCanvasPlan` so migrated run actions map into
  PlanRunner run steps with the resolved node IDs.
- Kept the slice focused on plan validation and run-step mapping. Natural
  language orchestrator prompt generation, PlanCard summary copy, and real
  desktop autoExecute evidence remain follow-up work.

Verification:

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/sanitize-plan.test.ts tests/apply-plan-runner.test.ts --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/sanitize-plan.test.ts tests/apply-plan-runner.test.ts tests/agent-orchestration-smoke.test.ts tests/migrated-run-dispatch.test.ts tests/canvas-job-reconciliation.test.ts tests/main-runtime-wiring.test.ts --reporter=dot
bun run typecheck
```

Result:

- RED first: the new sanitizer/applyPlan tests failed because migrated run
  actions were dropped as `unsupported_action`.
- PASS after implementation: focused Plan action tests passed, 2 files and 11
  tests.
- PASS: REQ-096/REQ-097 plan/runtime regression group passed, 6 files and 28
  tests.
- PASS: TypeScript strict compile completed with exit code 0 through
  `bun run typecheck`.

Remaining REQ-097 gaps:

- Orchestrator prompts/tools still need to intentionally generate comic-drama
  workflows using character, scene, style, asset, and migrated run vocabulary.
- Desktop PlanCard evidence still needs to prove a real user prompt can apply
  and autoExecute migrated run steps in serial order.

## 2026-06-26 - REQ-097 Built-In Comic-Drama Planner Slice

Scope:

- Promoted the main-runtime default planner into
  `createDefaultOrchestratorPlanner` so the built-in orchestrator behavior is
  testable outside Electron startup.
- Replaced the old one-image fallback for comic-drama requests with a
  deterministic migrated workflow: story text, character, scene, mjImage,
  audio, videoCompose, and muxAudioVideo nodes.
- The built-in planner now emits migrated run actions for the generated chain:
  `mjImageRun`, `audioRun`, `videoComposeRun`, and `muxAudioVideoRun`.
- Added main-runtime IPC coverage proving `canvas.chatSend` and
  `canvas.chatGetPlan` use this built-in comic-drama planner when no external
  model-backed planner is injected.

Verification:

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/orchestrator-runtime.test.ts --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/orchestrator-runtime.test.ts tests/main-runtime-wiring.test.ts --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/orchestrator-runtime.test.ts tests/main-runtime-wiring.test.ts tests/sanitize-plan.test.ts tests/apply-plan-runner.test.ts tests/agent-orchestration-smoke.test.ts tests/migrated-run-dispatch.test.ts tests/canvas-job-reconciliation.test.ts --reporter=dot
bun run typecheck
```

Result:

- RED first: the new default-planner test failed because
  `createDefaultOrchestratorPlanner` did not exist and the old default planner
  lived privately in `runtime.ts`.
- PASS after implementation: orchestrator runtime focused tests passed, 1 file
  and 3 tests.
- PASS: direct planner plus main-runtime chat IPC tests passed, 2 files and 10
  tests.
- PASS: REQ-096/REQ-097 plan/runtime regression group passed, 7 files and 32
  tests.
- PASS: TypeScript strict compile completed with exit code 0 through
  `bun run typecheck`.

Remaining REQ-097 gaps:

- Clarify behavior and style-specific intent still need richer tests and
  implementation.
- Desktop PlanCard evidence still needs to prove a real user prompt applies and
  autoExecutes the migrated chain in serial order.

## 2026-06-26 - REQ-097 PlanCard Migrated Summary Slice

Scope:

- Added PlanCard coverage for migrated comic-drama plans so users can see the
  actual node/action vocabulary before applying a plan.
- PlanCard now renders deduplicated summary tags for migrated nodes and run
  actions, including character, scene, MJ image generation, audio generation,
  video composition, and audio/video muxing.
- The summary keeps existing plan counts, dropped warnings, autoExecute switch,
  and apply action behavior unchanged.

Verification:

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/chat-ui.test.tsx --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/chat-ui.test.tsx tests/orchestrator-runtime.test.ts tests/main-runtime-wiring.test.ts tests/sanitize-plan.test.ts tests/apply-plan-runner.test.ts tests/agent-orchestration-smoke.test.ts --reporter=dot
bun run typecheck
```

Result:

- RED first: the new Chat UI test failed because PlanCard only displayed plan
  counts and did not show migrated node/action semantics.
- RED follow-up: initial label rendering duplicated labels such as `MJ 出图`
  and triggered React key warnings.
- PASS after implementation: Chat UI focused tests passed, 1 file and 7 tests.
- PASS: REQ-097 UI/planner/runtime regression group passed, 6 files and 31
  tests.
- PASS: TypeScript strict compile completed with exit code 0 through
  `bun run typecheck`.

Remaining REQ-097 gaps:

- Desktop PlanCard evidence still needs to prove the visible migrated summary
  appears in the real Electron chat panel and autoExecutes migrated run steps.
- Clarify behavior and style-specific plan intent remain partial.

## 2026-06-26 - REQ-097 Real Electron PlanCard Evidence Slice

Scope:

- Started the desktop application through `bun run dev`.
- Verified the real Electron window, not only the browser preview, renders the
  project page and default workflow canvas without a black screen.
- From the real Electron canvas chat panel, submitted a comic-drama request:
  `做一个雨夜侦探漫画短剧，包含角色、场景、图片、配音、视频合成和音视频合成`.
- Observed the PlanCard summary in the Electron window with migrated labels:
  text, character, scene, MJ image, audio, video composition, audio/video mux,
  and audio generation.
- Toggled autoExecute and applied the plan from the real PlanCard. The canvas
  remained rendered after applying, and the minimap indicated additional
  applied nodes outside the current viewport.

Evidence artifacts:

- `C:\Users\ZYCD\AppData\Local\Temp\comiccanvas-electron-window.png`:
  project page rendered in Electron.
- `C:\Users\ZYCD\AppData\Local\Temp\comiccanvas-electron-after-click.png`:
  workflow canvas rendered in Electron.
- `C:\Users\ZYCD\AppData\Local\Temp\comiccanvas-electron-plancard.png`:
  real PlanCard with migrated summary labels.
- `C:\Users\ZYCD\AppData\Local\Temp\comiccanvas-electron-after-apply-plan.png`:
  canvas remained usable after applying the plan.

Verification:

```bash
bun run dev
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/chat-ui.test.tsx tests/orchestrator-runtime.test.ts tests/main-runtime-wiring.test.ts tests/sanitize-plan.test.ts tests/apply-plan-runner.test.ts tests/agent-orchestration-smoke.test.ts tests/migrated-run-dispatch.test.ts tests/canvas-job-reconciliation.test.ts --reporter=dot
```

Result:

- DESKTOP PASS: Electron project page and workflow canvas were not black.
- DESKTOP PASS: real PlanCard showed migrated node/action labels and sanitizer
  dropped-warning UI.
- DESKTOP PARTIAL: applying the plan from the real PlanCard kept the canvas
  usable and appeared to add nodes, but visible terminal-state proof for every
  migrated run step still needs a more controlled desktop acceptance flow.
- AUTOMATED CHECK BLOCKED AFTER DESKTOP START: the post-desktop Vitest command
  failed for DB-backed tests because `better-sqlite3` was compiled for Electron
  ABI 130 while the bundled Node runner requires ABI 137. Non-DB tests in that
  command still passed. Close Electron and run `bun install --force` before the
  next Node/Vitest regression pass.

Remaining REQ-097 gaps:

- Capture a controlled desktop autoExecute flow where each migrated run step
  visibly reaches a terminal node/job state in order.
- Clarify behavior and style-specific plan intent remain partial.

## 2026-06-26 - REQ-091 Workflow JSON Import/Export IPC Slice

Scope:

- Added shared IPC contracts for `canvas.exportWorkflow` and
  `canvas.importWorkflow`.
- Added workflow repository `getSummary` support so exports preserve the
  workflow display name.
- `canvas.exportWorkflow` returns schema version 1, workflow name, and the
  latest graph sanitized through the shared graph contract.
- `canvas.importWorkflow` accepts workflow JSON, rejects invalid JSON, rejects
  absolute local paths and `file://` URLs, sanitizes unsupported nodes/invalid
  edges, reports dropped records, creates a new workflow, and persists the first
  graph version.

Verification:

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/canvas-graph-persistence.test.ts --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/canvas-graph-persistence.test.ts tests/ipc-skeleton.test.ts --reporter=dot
bun run typecheck
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/canvas-graph-persistence.test.ts tests/ipc-skeleton.test.ts tests/main-runtime-wiring.test.ts tests/orchestrator-runtime.test.ts tests/agent-orchestration-smoke.test.ts --reporter=dot
```

Result:

- RED first: workflow export returned `undefined` because the IPC handlers did
  not exist.
- PASS after implementation: graph persistence/import/export focused tests
  passed, 1 file and 3 tests.
- PASS: IPC registration plus graph import/export tests passed, 2 files and 9
  tests.
- PASS: TypeScript strict compile completed with exit code 0 through
  `bun run typecheck`.
- PASS: workflow/runtime/orchestrator regression group passed, 5 files and 22
  tests.

Remaining REQ-091 gaps:

- Renderer import/export controls and desktop user-flow evidence are still
  pending.
- Dirty-save switching and leave guards remain separate REQ-091 work.

## 2026-06-26 - REQ-091 Workflow JSON Import/Export Renderer UI Slice

Scope:

- Exposed `exportWorkflow` and `importWorkflow` through the sandboxed preload
  bridge, mapped to `canvas.exportWorkflow` and `canvas.importWorkflow`.
- Added `/projects` workflow JSON controls:
  - top-level import panel,
  - card-level workflow export action,
  - formatted export JSON preview,
  - optional import name,
  - dropped-record success feedback,
  - Chinese error feedback for unsafe or invalid imports.
- Added root TypeScript and Vitest resolution for `react-router-dom` from the
  desktop workspace dependency path, matching the existing Bun workspace
  layout.

Verification:

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/workflow-import-export-ui.test.tsx --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/workflow-import-export-ui.test.tsx tests/canvas-graph-persistence.test.ts tests/ipc-skeleton.test.ts --reporter=dot
bun run typecheck
```

Result:

- RED first: preload did not expose workflow import/export and `/projects`
  lacked import/export controls.
- PASS after implementation: renderer import/export focused tests passed, 1
  file and 4 tests.
- PASS: renderer plus IPC/graph persistence regression passed, 3 files and 13
  tests.
- PASS: TypeScript strict compile completed with exit code 0 through
  `bun run typecheck`.

Remaining REQ-091 gaps:

- Desktop user-flow evidence for import/export is still pending.
- Dirty-save switching and leave guards remain separate REQ-091 work.

## 2026-06-26 - REQ-091 Dirty-Save Workflow Switch Guard Slice

Scope:

- Added a focused workflow switch guard module for dirty canvas transitions.
- Dirty workflow switching now attempts to save the current graph first.
- If the save fails, the workflow switch is blocked and the canvas remains on
  the current workflow instead of silently continuing.
- Manual save and autosave still surface save error state without unhandled
  promise rejections.
- CanvasPage registers a `beforeunload` guard while dirty, so window close or
  browser refresh can warn about unsaved graph changes.

Verification:

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/workflow-switch-guard.test.ts --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/workflow-switch-guard.test.ts tests/workflow-import-export-ui.test.tsx tests/job-preload.test.ts tests/canvas-graph-persistence.test.ts tests/ipc-skeleton.test.ts --reporter=dot
bun run typecheck
```

Result:

- RED first: guard module did not exist and dirty-save switch behavior had no
  isolated coverage.
- PASS after implementation: dirty-save guard focused tests passed, 1 file and
  4 tests.
- PASS: REQ-091/CanvasPage-adjacent regression passed, 5 files and 20 tests.
- PASS: TypeScript strict compile completed with exit code 0 through
  `bun run typecheck`.

Remaining REQ-091 gaps:

- Desktop user-flow evidence for import/export, dirty workflow switching,
  window close, and back-navigation remains pending.

## 2026-06-26 - REQ-092 Canvas Snippet Core Slice

Scope:

- Added renderer graph helpers for canvas snippets.
- `extractCanvasSnippet`:
  - requires at least two selected nodes,
  - keeps only selected nodes,
  - keeps only internal edges between selected nodes,
  - normalizes snippet node coordinates to the selected subgraph origin.
- `insertCanvasSnippet`:
  - remaps node IDs,
  - remaps edge IDs and edge endpoints,
  - inserts the snippet at a caller-provided origin,
  - applies the insertion through one canvas store `applyChange` snapshot, so
    one undo removes the inserted snippet.
- Added minimal CanvasPage actions:
  - `保存片段` is enabled when two or more nodes are selected,
  - `插入片段` inserts the latest in-memory snippet,
  - status feedback reports save/insert outcomes.

Verification:

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/canvas-snippet.test.ts --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/canvas-snippet.test.ts tests/canvas-store.test.ts --reporter=dot
bun run typecheck
```

Result:

- RED first: snippet module did not exist.
- RED follow-up: CanvasPage did not expose snippet save/insert actions.
- PASS after implementation: canvas snippet focused tests passed, 1 file and 4
  tests.
- PASS: snippet plus canvas store regression passed, 2 files and 10 tests.
- PASS: TypeScript strict compile completed with exit code 0 through
  `bun run typecheck`.

Remaining REQ-092 snippet gaps:

- Richer snippet management UI is still pending.
- Desktop select-save-insert and cross-project save/reopen evidence remains
  pending.

## 2026-06-27 - REQ-092 Audio Asset Import IPC Persistence Slice

Scope:

- Added IPC-level coverage for importing a local audio file through
  `asset.import` with the real SQLite asset repository.
- Verified audio imports persist as `mediaType: audio`, use
  `metadata.mimeType: audio/mpeg`, record file size, return a renderer-safe
  `cc-asset://` URL, and can be listed by `mediaType: audio`.
- Fixed imported asset `relativePath` generation to use POSIX separators
  (`imported/audio/...`) instead of Windows backslashes, preserving portable
  workflow/export records across operating systems while still copying files
  through native filesystem paths.
- Restored Node/Vitest native ABI with `bun install --force` after the previous
  Electron dev run had rebuilt `better-sqlite3` for Electron.

Verification:

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/asset-folders-ipc.test.ts --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/asset-folders-ipc.test.ts tests/local-media-drop.test.ts tests/asset-audio-support.test.ts --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/asset-folders-ipc.test.ts tests/local-media-drop.test.ts tests/asset-audio-support.test.ts tests/canvas-visible-copy.test.ts tests/canvas-connect-to-create.test.ts tests/canvas-command-palette.test.tsx tests/canvas-selection-actions.test.ts tests/mention-edge-validation.test.tsx tests/canvas-edge-creation.test.ts tests/connection-validation-ux.test.tsx tests/canvas-snippet.test.ts tests/canvas-store.test.ts --reporter=dot
bun run typecheck
```

Result:

- RED first: the DB-backed asset IPC test initially failed due to native ABI
  mismatch from Electron rebuild; after `bun install --force`, the new audio
  import assertion failed because `relativePath` used Windows backslashes.
- PASS after implementation: asset folder/audio IPC tests passed, 1 file and 3
  tests.
- PASS: local media/audio support regression passed, 3 files and 8 tests.
- PASS: REQ-092 interaction regression group passed, 12 files and 36 tests.
- PASS: TypeScript strict compile completed with exit code 0 through
  `bun run typecheck`.

Remaining REQ-092 local media gaps:

- Real desktop drag/drop evidence is still pending before task 9 can be marked
  complete.
- Because `bun install --force` restored Node/Vitest ABI, the Electron dev app
  is currently stopped and will need a fresh `bun run dev` before desktop
  verification.

## 2026-06-27 - REQ-092 Local Audio Media Drop Slice

Scope:

- Extended local media drop planning from image/video-only to image, video, and
  audio files.
- `planLocalMediaDrop` now accepts audio MIME types and common audio
  extensions (`.mp3`, `.wav`, `.m4a`, `.aac`, `.flac`, `.ogg`) and returns an
  `audio` node creation plan.
- Kept unsupported-file and missing-local-path feedback readable in Chinese.
- Added `audio` to shared asset media contracts and main-process asset import
  parsing, including extension and MIME inference.
- Extended CanvasPage asset insertion so dropped/imported audio assets create
  `audio` canvas nodes with the imported asset ID and safe URL.
- Added asset-panel audio display hooks so the broader asset UI recognizes
  audio assets instead of falling through an incomplete media-type map.

Verification:

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/local-media-drop.test.ts --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/local-media-drop.test.ts tests/asset-audio-support.test.ts --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/local-media-drop.test.ts tests/asset-audio-support.test.ts tests/canvas-visible-copy.test.ts tests/canvas-connect-to-create.test.ts tests/canvas-command-palette.test.tsx tests/canvas-selection-actions.test.ts tests/mention-edge-validation.test.tsx tests/canvas-edge-creation.test.ts tests/connection-validation-ux.test.tsx tests/canvas-snippet.test.ts tests/canvas-store.test.ts --reporter=dot
bun run typecheck
```

Result:

- RED first: `tests/local-media-drop.test.ts` failed because dropped audio
  files were rejected with "current canvas does not support audio nodes".
- PASS after implementation: local media drop focused tests passed, 1 file and
  3 tests.
- PASS: audio asset support focused tests passed, 2 files and 5 tests.
- PASS: REQ-092 interaction regression group passed, 11 files and 33 tests.
- PASS: TypeScript strict compile completed with exit code 0 through
  `bun run typecheck`.

Remaining REQ-092 local media gaps:

- IPC import tests should explicitly cover audio file import persistence.
- Desktop drag/drop evidence is still pending before task 9 can be marked
  complete.

## 2026-06-27 - REQ-092 Canvas Visible Copy Quality Slice

Scope:

- Added a visible-copy quality gate for canvas user-facing labels.
- Replaced mojibake default labels for V2 generation nodes with readable
  `Image Generation` and `Video Generation` labels.
- Replaced mojibake context-menu labels for migrated post-processing nodes with
  `Video Compose`, `Super Resolution`, and `Mux Audio Video`.
- Replaced mojibake snippet error feedback and context-menu section/action
  labels with readable copy.
- Replaced command-palette search placeholder, aria label, and empty state with
  readable English copy.
- Updated the command-palette component test to assert the new readable
  accessible search name and command labels.

Verification:

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/canvas-visible-copy.test.ts --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/canvas-visible-copy.test.ts tests/canvas-connect-to-create.test.ts tests/canvas-command-palette.test.tsx tests/canvas-selection-actions.test.ts tests/mention-edge-validation.test.tsx tests/canvas-edge-creation.test.ts tests/connection-validation-ux.test.tsx tests/canvas-snippet.test.ts tests/local-media-drop.test.ts tests/canvas-store.test.ts --reporter=dot
bun run typecheck
```

Result:

- RED first: `tests/canvas-visible-copy.test.ts` failed because visible canvas
  copy still lacked `Image Generation`, `Video Generation`, readable
  command-palette copy, and still exposed mojibake strings.
- PASS after implementation: visible-copy focused tests passed, 1 file and 3
  tests.
- PASS: REQ-092 interaction regression group passed, 10 files and 31 tests.
- PASS: TypeScript strict compile completed with exit code 0 through
  `bun run typecheck`.

Remaining REQ-092 quality gaps:

- Historical mojibake still exists in non-visible comments and older progress
  documentation; this slice only gates visible canvas copy.
- Desktop keyboard/mouse and invalid-connection feedback evidence remains
  pending before REQ-092 can be marked complete.

## 2026-06-27 - REQ-092 Command Palette / Fit View / Pan-Select Slice

Scope:

- Added `CanvasCommandPalette` as a searchable canvas command surface.
- Wired CanvasPage command actions for:
  - fit view through React Flow `fitView({ padding: 0.18, duration: 240 })`,
  - select mode,
  - pan mode,
  - duplicate selected nodes,
  - delete selected nodes.
- Added Ctrl/Cmd+K launch with editable-target protection.
- Added left toolbar buttons for select mode, pan mode, and command palette.
- Wired React Flow `selectionOnDrag` and `panOnDrag` to the current interaction
  mode.
- Repaired several pre-existing `CanvasPage.tsx` mojibake syntax breakages that
  were preventing TypeScript compilation, including broken JSX attributes,
  broken snippet feedback strings, and a damaged direct-connect success branch.

Verification:

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/canvas-command-palette.test.tsx --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/canvas-command-palette.test.tsx tests/canvas-selection-actions.test.ts tests/mention-edge-validation.test.tsx tests/canvas-edge-creation.test.ts tests/connection-validation-ux.test.tsx tests/canvas-snippet.test.ts tests/local-media-drop.test.ts tests/canvas-store.test.ts --reporter=dot
bun run typecheck
```

Result:

- RED first: `tests/canvas-command-palette.test.tsx` failed because
  `CanvasCommandPalette` did not exist.
- PASS after implementation: command palette focused tests passed, 1 file and
  2 tests.
- PASS: REQ-092 interaction regression group passed, 8 files and 25 tests.
- PASS: TypeScript strict compile completed with exit code 0 through
  `bun run typecheck`.

Remaining REQ-092 toolbar/shortcut gaps:

- Desktop keyboard/mouse checklist evidence remains pending.
- Context-menu and connect-to-create edge paths still need explicit
  shared-validation coverage.

## 2026-06-27 - REQ-092 Connect-To-Create Edge Validation Slice

Scope:

- Added `connectCreatedCanvasNode` as the shared renderer helper for
  connect-to-create gestures.
- The helper delegates to `createCanvasEdge` with reason `connect-to-create`,
  so duplicate rejection, connection-matrix rejection, and feedback messages
  stay on the same canonical path as direct and @mention edges.
- Wired CanvasPage node context-menu actions to create a new node and then
  attempt the source-node -> created-node edge through
  `connectCreatedCanvasNode`.

Verification:

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/canvas-connect-to-create.test.ts --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/canvas-connect-to-create.test.ts tests/canvas-command-palette.test.tsx tests/canvas-selection-actions.test.ts tests/mention-edge-validation.test.tsx tests/canvas-edge-creation.test.ts tests/connection-validation-ux.test.tsx tests/canvas-snippet.test.ts tests/local-media-drop.test.ts tests/canvas-store.test.ts --reporter=dot
bun run typecheck
```

Result:

- RED first: the focused test failed because
  `canvas-connect-to-create` did not exist.
- RED follow-up: CanvasPage wiring test failed because the helper was not
  imported or used by the node context menu.
- PASS after implementation: connect-to-create focused tests passed, 1 file and
  3 tests.
- PASS: REQ-092 interaction regression group passed, 9 files and 28 tests.
- PASS: TypeScript strict compile completed with exit code 0 through
  `bun run typecheck`.

Remaining REQ-092 connection gaps:

- Remaining explicit context-menu edge paths still need coverage if separate
  non-create edge actions are added.
- Desktop invalid-connection feedback evidence remains pending.

## 2026-06-27 - REQ-092 V2 @mention Edge Validation Slice

Scope:

- Added user-path coverage for V2 node `@mention` creation, not only the lower
  level edge helper.
- ImageConfigV2 and VideoConfigV2 now derive mention candidates from the current
  canvas store nodes, excluding the current node.
- Selecting a mention creates the edge through `createCanvasEdge`, so the same
  duplicate rejection and connection-matrix validation path is used.
- Mention-created edges now use the correct graph direction:
  mentioned/upstream node -> current V2 node.
- Removing a mention token cleans the corresponding `createdByMention` edge
  from upstream -> current node.
- ImageConfigV2 style loading now calls `listStyles({ includeDisabled: false })`
  consistently with VideoConfigV2 and the style selector contract.

Verification:

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/mention-edge-validation.test.tsx --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/mention-edge-validation.test.tsx tests/canvas-edge-creation.test.ts tests/connection-validation-ux.test.tsx tests/style-renderer-ui.test.tsx tests/migrated-node.test.tsx tests/node-contracts.test.ts --reporter=dot
bun run typecheck
```

Result:

- RED first: the V2 `@mention` test could not find the existing canvas node
  `Story Beat`, proving that the UI did not expose mention candidates to the
  user path.
- PASS after implementation: V2 `@mention` focused test passed, 1 file and 1
  test.
- PASS: mention, edge helper, connection feedback, style selector, migrated
  node, and node contract regression passed, 6 files and 14 tests.
- PASS: TypeScript strict compile completed with exit code 0 through
  `bun run typecheck`.

Remaining REQ-092 connection gaps:

- Context-menu and connect-to-create edge creation paths still need explicit
  shared-validation coverage when those flows are implemented.
- Desktop invalid-connection feedback evidence remains pending.

## 2026-06-27 - REQ-092 Selected Node Duplicate/Delete Shortcut Slice

Scope:

- Added shared renderer selection actions for duplicate and delete operations.
- Duplicating selected nodes now:
  - supports multiple selected nodes,
  - preserves only edges fully inside the selected subgraph,
  - offsets duplicated nodes by 40px,
  - writes the duplicate as one `applyChange` history entry so one undo removes
    the duplicated subgraph.
- Deleting selected nodes now removes all incident edges in one undoable
  `applyChange`.
- CanvasPage now reuses those same selection actions from:
  - context-menu duplicate/delete for a single node,
  - Ctrl/Cmd+D for selected-node duplicate,
  - Delete/Backspace for selected-node delete.
- Keyboard actions skip editable targets such as input, textarea, select, and
  contenteditable elements so prompt editing is not interrupted.

Verification:

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/canvas-selection-actions.test.ts --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/canvas-selection-actions.test.ts tests/canvas-store.test.ts tests/canvas-store-selector-stability.test.ts tests/canvas-snippet.test.ts --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/canvas-selection-actions.test.ts tests/mention-edge-validation.test.tsx tests/canvas-edge-creation.test.ts tests/connection-validation-ux.test.tsx tests/canvas-snippet.test.ts tests/local-media-drop.test.ts tests/canvas-store.test.ts --reporter=dot
bun run typecheck
```

Result:

- RED first: `canvas-selection-actions` did not exist, so the focused test
  failed during collection.
- PASS after implementation: selected duplicate/delete focused tests passed, 1
  file and 3 tests.
- PASS: store, selector-stability, and snippet-adjacent regression passed, 4
  files and 14 tests.
- PASS: REQ-092 interaction regression group passed, 7 files and 23 tests.
- PASS: TypeScript strict compile completed with exit code 0 through
  `bun run typecheck`.

Remaining REQ-092 toolbar/shortcut gaps:

- Command palette actions, zoom/fit, and pan/select mode still need explicit
  implementation and evidence.
- Desktop keyboard/mouse checklist evidence remains pending.

## 2026-06-27 - REQ-092 Direct Connection Feedback Slice

Scope:

- Replaced damaged connection UX strings with stable Chinese feedback messages.
- `createCanvasConnectHandler` remains the single renderer adapter over the
  canonical canvas store validation and connection matrix.
- CanvasPage direct ReactFlow `onConnect` now uses `createCanvasConnectHandler`
  instead of calling `canvasStore.addEdge` directly.
- Added `ConnectionFeedback` rendering inside the canvas so users get immediate,
  accessible feedback for duplicate and invalid connections.

Verification:

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/connection-validation-ux.test.tsx --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/connection-validation-ux.test.tsx tests/connection-matrix.test.ts tests/canvas-store.test.ts tests/apply-plan-runner.test.ts tests/canvas-snippet.test.ts --reporter=dot
bun run typecheck
```

Result:

- RED first: CanvasPage did not import or use the shared connection handler or
  feedback banner.
- PASS after implementation: connection UX focused tests passed, 1 file and 4
  tests.
- PASS: connection matrix, store, apply-plan, snippet, and CanvasPage-adjacent
  regression passed, 5 files and 22 tests.
- PASS: TypeScript strict compile completed with exit code 0 through
  `bun run typecheck`.

Remaining REQ-092 connection gaps:

- Context-menu, connect-to-create, and @mention-created edge paths still need
  explicit shared-validation coverage.
- Desktop invalid-connection feedback evidence remains pending.

## 2026-06-27 - REQ-092 Persisted Canvas Snippet Library Slice

Scope:

- Added shared snippet contracts and validation in `shared/snippets.ts`.
- Added SQLite persistence for reusable canvas snippets:
  - `canvas_snippets` table and migration `0004_canvas_snippets`,
  - repository list/save/delete with soft delete,
  - sanitized node/edge storage that drops invalid external edges,
  - newest-first listing by update time.
- Added `canvasSnippet.list`, `canvasSnippet.save`, and `canvasSnippet.delete`
  IPC handlers.
- Registered snippet handlers in the main runtime and exposed typed preload APIs:
  `listCanvasSnippets`, `saveCanvasSnippet`, and `deleteCanvasSnippet`.
- Upgraded CanvasPage snippet actions from latest in-memory only to a compact
  persisted snippet library selector.

Verification:

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/canvas-snippet-repository-ipc.test.ts tests/db-schema.test.ts tests/ipc-skeleton.test.ts --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/canvas-snippet.test.ts tests/canvas-snippet-repository-ipc.test.ts tests/db-schema.test.ts tests/ipc-skeleton.test.ts --reporter=dot
bun run typecheck
```

Result:

- RED first: `canvas-snippet.repo` did not exist, so the repository/IPC test
  failed during collection.
- PASS after implementation: snippet repository/IPC, schema, and IPC skeleton
  regression passed, 3 files and 11 tests.
- PASS: snippet core plus persisted-library regression passed, 4 files and 15
  tests.
- PASS: TypeScript strict compile completed with exit code 0 through
  `bun run typecheck`.

Remaining REQ-092 snippet gaps:

- Richer snippet management UI is still pending.
- Desktop select-save-insert and cross-project save/reopen evidence remains
  pending.
