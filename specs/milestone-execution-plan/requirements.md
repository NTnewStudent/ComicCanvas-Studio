# Requirements Document - Milestone Execution Plan

## Introduction

This spec migrates the useful implementation detail from historical `task/M0-M5` PRDs into the canonical root-level `specs/` tree. It does not replace `core-platform-foundation`; it depends on it. Its job is to define the executable milestone requirements after foundation contracts are accepted.

Scope:

- M0 foundation closeout and stale task reconciliation.
- M1 runnable Electron skeleton with DB, jobs, stub provider, asset pipeline, and IPC.
- M2 complete canvas UI for text, image, and video nodes.
- M3 gateway settings and real provider adapters.
- M4 agent orchestration and chat-to-plan workflow.
- M5 advanced agent, tool, skill, plugin, asset library, and knowledge/RAG product surfaces.

Non-goals:

- It does not make `task/` a source of truth.
- It does not permit implementation before required API contracts exist.
- It does not remove the stricter platform constraints in `specs/core-platform-foundation/`.

## Glossary

- **Historical Task PRD**: Files under `task/`. They are reference material only.
- **Milestone Spec**: This canonical spec under `specs/milestone-execution-plan/`.
- **Foundation Gate**: The contract, shared type, API document, security, and recovery work required before feature implementation.
- **Smoke Path**: A minimal end-to-end path proving a milestone is runnable.

## Requirements

### Requirement 1: M0 Foundation Closeout

**User Story:** As the project owner, I want old task detail reconciled into canonical specs, so that future agents do not work from stale or conflicting task files.

#### Acceptance Criteria

1. WHEN milestone work is planned, THE project SHALL use `specs/` and `docs/progress/backlog.md` as the source of truth, not `task/`.
2. WHEN old `task/` content is useful, THE project SHALL migrate the content into canonical specs before implementation uses it.
3. IF old task content conflicts with Codex-era rules or foundation specs, THEN THE canonical spec SHALL supersede the old task text.
4. WHEN M0 closes, THE project SHALL have API contract docs for jobs, assets/files, gateways, tools/plugins, agents, skills, knowledge/context, canvas plan, and audit/observability.
5. WHEN M0 closes, THE project SHALL have shared contract skeletons for jobs, assets, gateway, tools, agents, skills, knowledge, and IPC domains.

### Requirement 2: M1 Runnable Skeleton

**User Story:** As a developer, I want a runnable Electron app with local persistence and stub generation, so that later UI and agent work can be integrated safely.

#### Acceptance Criteria

1. WHEN `npm run dev` starts, THE app SHALL open a BrowserWindow and load the renderer without console startup errors.
2. THE BrowserWindow SHALL keep `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`.
3. THE preload SHALL expose only typed whitelist APIs and SHALL NOT expose raw Node or raw `ipcRenderer`.
4. WHEN DB initializes, THE main process SHALL use Drizzle migrations and repository boundaries; service and IPC layers SHALL NOT contain raw SQL/Drizzle queries.
5. WHEN `canvas.runNode` is invoked for a stub image node, THE main process SHALL enqueue a durable job and return a ticket without waiting for provider output.
6. WHEN the stub worker completes, THE system SHALL persist asset metadata, emit one terminal IPC event, and update the renderer node through event/query invalidation.
7. FOR ALL M1 generated assets returned to renderer, THE response SHALL use a safe asset URL and SHALL NOT include absolute paths.

### Requirement 3: M2 Complete Canvas

**User Story:** As a creator, I want a usable canvas with text/image/video nodes, connections, prompt preview, and persistence, so that I can manually build a comic-drama generation chain.

#### Acceptance Criteria

1. THE canvas store SHALL manage nodes, edges, viewport, undo/redo, and Plan application without direct IPC side effects.
2. Text nodes SHALL support collapsed label display, expanded editing, outside-click collapse, scrollable content, and inline rename.
3. Image nodes SHALL support idle, expanded, pending/running, done, and error states with prompt/model/orientation controls.
4. Video nodes SHALL support prompt/model/orientation/duration controls, optional first/last frame references, and video preview.
5. WHEN a connection is attempted, THE renderer SHALL use `shared/connection-matrix.ts`, reject invalid or duplicate edges, and show a user-facing reason quickly.
6. WHEN a generation node has upstream text, THE Connected Inputs Panel SHALL show ordered upstream content and a byte-equivalent final prompt preview.
7. WHEN canvas is saved and loaded, THE graph SHALL persist through main-process repositories and reload with connection revalidation.
8. THE renderer SHALL NOT poll generation status with `setInterval` or equivalent asset polling loops.

### Requirement 4: M3 Gateway System

**User Story:** As an operator, I want real provider gateway configuration with encrypted keys and hot reload, so that generation can move beyond the stub provider.

#### Acceptance Criteria

1. THE OpenAI-compatible adapter SHALL support image generation request/response normalization through the Gateway contract.
2. WHEN a provider returns base64 or URL output, THE adapter SHALL normalize bytes for AssetService without leaking temporary URLs to renderer.
3. THE async media adapter SHALL support submit, backoff poll, terminal normalize, timeout, and worker-side cancellation checks.
4. Settings UI SHALL let users create, edit, enable/disable, test, and delete gateway configurations.
5. API keys SHALL be encrypted through Electron safeStorage or an approved local secret store, and SHALL NOT appear in DB plaintext, logs, traces, or LTM.
6. WHEN gateway config changes, THE GatewayRegistry SHALL hot-reload future jobs while allowing in-flight jobs to finish with their original provider.
7. Gateway model mapping SHALL support separate image/video/text model keys with default fallback.

### Requirement 5: M4 Agent Orchestration

**User Story:** As a creator, I want natural language to create and run canvas plans, so that agent orchestration can operate the canvas reliably.

#### Acceptance Criteria

1. THE orchestrator SHALL run as an AsyncGenerator-compatible agent flow and return a pending ticket within one second for chat requests.
2. THE tool runtime SHALL expose canvas tools with schemas, permissions, read/write concurrency metadata, and streaming progress.
3. THE model-produced CanvasPlan SHALL pass through sanitizePlan before the renderer can apply it.
4. THE renderer SHALL apply a Plan with node/edge/action revalidation, layered layout, and one undo snapshot.
5. THE PlanRunner SHALL execute runSteps serially and short-circuit on failure while preserving unrun steps for manual execution.
6. THE Chat UI SHALL show conversation history, Plan summary, dropped-item warnings, apply/execute controls, and auto-execute behavior.
7. THE end-to-end agent smoke path SHALL create an image node from a natural-language request, run it through the stub provider, and show a completed node.

### Requirement 6: M5 Advanced Agent And Product Surfaces

**User Story:** As a power user, I want custom agents, skills, plugin tools, local file management, and knowledge retrieval, so that the system can grow beyond the initial built-ins.

#### Acceptance Criteria

1. WHEN an agent spawns a sub-agent, THE child effective permissions SHALL be a subset of the parent and depth SHALL not exceed the configured limit.
2. Sub-agents SHALL operate on isolated draft context/graph state unless the parent explicitly merges sanitized results.
3. Settings UI SHALL support user-defined agents while protecting built-in agents from deletion.
4. Chat input SHALL support @mention agent selection with keyboard navigation and explicit `agentId` routing.
5. Settings UI SHALL expose registered tools and allow enable/disable behavior through ToolRuntime permissions.
6. The asset library SHALL support nested folders, asset moves, delete-to-trash/tombstone semantics, and reference integrity checks.
7. Skill management SHALL support built-in and user-defined skills with metadata-first discovery, lazy reference loading, and permission checks.
8. Plugin tool management SHALL support local plugin manifest validation, tool registration, disable/unload, and quarantine diagnostics.
9. Knowledge/RAG management SHALL support ingest, retrieve, delete, rebuild, citation metadata, and scoped Context Pack inclusion.
10. Audit/observability SHALL provide traces and health checks across jobs, assets, gateways, tools, agents, skills, plugins, and knowledge indexes.

## Correctness Properties

### INV-1: Historical Task Reconciliation

*For any* useful requirement in `task/M0-M5`, THE canonical execution source SHALL either include it, supersede it with a stricter foundation rule, or document why it is intentionally dropped.

**Validates:** Requirement 1.

### INV-2: No Contract-Free Implementation

*For any* IPC/service/tool/provider/agent/skill/knowledge surface, THE implementation SHALL have a matching `docs/api-contracts/` entry before code work starts.

**Validates:** Requirements 1-6.

### INV-3: End-To-End Async Safety

*For any* generation path in M1-M5, THE request handler SHALL return a ticket without generated bytes or paths, and terminal state SHALL arrive through durable job state plus IPC/query recovery.

**Validates:** Requirements 2-5.

### INV-4: Permission And Scope Monotonicity

*For any* tool, plugin, skill, agent, sub-agent, or RAG retrieval call, effective permission and data scope SHALL not exceed the invoking actor's policy.

**Validates:** Requirement 6.

### INV-5: Renderer Safety

*For any* renderer feature, THE renderer SHALL not import main-process modules, access filesystem paths directly, use raw IPC, or poll generated asset state.

**Validates:** Requirements 2-3.
