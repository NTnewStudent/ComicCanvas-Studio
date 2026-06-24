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
