# Design Document - Milestone Execution Plan

> Source of truth: `requirements.md` in this directory. This design turns historical `task/M0-M5` detail into canonical milestone execution under root `specs/`.

## Overview

The historical `task/` directory contains useful implementation detail, but it is not wired into the current Codex-era source of truth. This design keeps `task/` as reference material and moves execution authority into `specs/milestone-execution-plan/`. It sits below `core-platform-foundation`: foundation contracts and shared schemas must exist before M1-M5 implementation work opens.

The execution model is:

1. Finish M0 foundation and reconciliation.
2. Build M1 runnable skeleton with stub generation.
3. Build M2 canvas UI and persistence.
4. Build M3 real gateway adapters and settings.
5. Build M4 agent orchestration and Chat UI.
6. Build M5 advanced agents, skills, plugins, asset library, knowledge/RAG, and observability.

## Source Mapping

| Historical Source | Canonical Destination | Action |
| :--- | :--- | :--- |
| `task/M0-contracts-governance.md` | `core-platform-foundation` + this spec M0 | Reconcile stale status and replace Claude-era governance with root `specs/` + Codex config |
| `task/M1-skeleton.md` | this spec M1 | Preserve detailed Electron/DB/jobs/provider/assets/IPC tasks |
| `task/M2-canvas-complete.md` | this spec M2 + `canvas-agent-orchestration` | Preserve component-level canvas tasks |
| `task/M3-gateway.md` | this spec M3 + `core-platform-foundation` gateway contracts | Preserve provider/settings/safeStorage/hot-reload details |
| `task/M4-agent-orchestration.md` | this spec M4 + `canvas-agent-orchestration` | Preserve orchestrator/tool/chat/applyPlan details |
| `task/M5-agent-advanced.md` | this spec M5 + `core-platform-foundation` agent/tool/asset contracts | Preserve advanced UI/runtime tasks and extend missing Skills/Plugins/RAG/Audit |

## Milestone Gates

| Gate | Required Before Moving On |
| :--- | :--- |
| M0 -> M1 | API contract docs exist; shared skeletons exist; backlog/spec references are canonical; `task/` marked historical |
| M1 -> M2 | Electron opens; DB migrates; stub runNode creates job, asset, terminal event, and renderer update |
| M2 -> M3 | Text/Image/Video nodes, connection validation, prompt preview, save/load, zero polling are verified |
| M3 -> M4 | OpenAI-compatible and async media provider flows are normalized; settings and safeStorage are verified |
| M4 -> M5 | Chat-to-CanvasPlan-to-runSteps smoke path passes with sanitization and serial execution |
| M5 complete | Custom agents, skills, plugin tools, asset folders, scoped RAG, audit/health checks pass integration tests |

## Execution Units

### M0: Foundation Closeout

M0 does not implement product features. It removes ambiguity:

- `task/` becomes historical reference.
- `specs/` is the canonical spec tree.
- API contract documents are created.
- Shared contracts are split into focused files.
- Backlog points to canonical specs.

### M1: Runnable Skeleton

M1 proves the desktop architecture:

- Electron main/preload/renderer are separated and secure.
- SQLite/Drizzle repositories are in place.
- JobRuntime can enqueue and complete stub work.
- ProviderRegistry has a deterministic stub provider.
- AssetService writes bytes and exposes safe URLs.
- IPC handlers return tickets and emit terminal events.

### M2: Canvas Complete

M2 turns the skeleton into a usable manual canvas:

- Zustand canvas store with undo/redo.
- Text/Image/Video nodes with domain-specific controls.
- Connection validation and duplicate-edge handling.
- Connected Inputs Panel and prompt preview.
- Graph save/load through repositories.
- IPC/query-driven state updates with no asset polling.

### M3: Gateway System

M3 replaces stub-only generation with real provider infrastructure:

- OpenAI-compatible adapter.
- Async media task adapter with worker-side polling.
- Gateway settings UI.
- KeyVault using Electron safeStorage or approved encrypted local storage.
- Provider hot reload and per-channel model maps.

### M4: Agent Orchestration

M4 wires natural language to the canvas:

- AsyncGenerator orchestrator flow.
- Permissioned canvas tools.
- sanitizePlan.
- chatSend/chatGetPlan IPC.
- applyPlan and PlanRunner.
- Chat UI with PlanCard and auto-execute.
- End-to-end natural-language-to-generated-node smoke test.

### M5: Advanced Platform

M5 extends beyond the old task directory:

- spawnSubAgent and isolated draft graph behavior.
- Custom agent settings and @mention routing.
- Tool management UI.
- Asset folders with reference integrity.
- SkillRegistry and skill settings.
- PluginLoader and plugin tool management.
- KnowledgeStore/RAG and ContextBuilder.
- Audit, tracing, redaction, and health checks.

## Superseded Historical Details

| Old Detail | Canonical Replacement |
| :--- | :--- |
| `.claude/` as governance layer | `.codex/` + `.agents/` for runtime/tooling; root `specs/` for product specs |
| `shared/tools-agents.ts` as one growing shared file | Focused shared contracts: `shared/tools.ts`, `shared/agents.ts`, `shared/gateway.ts`, `shared/skills.ts`, `shared/knowledge.ts` |
| `settings.*` IPC as generic settings bucket | Domain-specific contracts: `gateway.*`, `agent.*`, `tool.*`, `skill.*`, plus settings UI can call domain APIs |
| Provider interface tied to only image/video/text methods | Gateway normalized request/result envelopes with adapters |
| Asset deletion by folder behavior only | Reference integrity plus trash/tombstone semantics |

## Testing Strategy

| Milestone | Required Verification |
| :--- | :--- |
| M0 | Link scans, placeholder scans, contract docs exist, shared contracts compile |
| M1 | `bun run dev`, `bun run build`, DB migration test, job terminal uniqueness, stub e2e |
| M2 | Component tests for nodes, connection PBT, prompt byte equivalence, save/load integration, no polling scan |
| M3 | Provider mock tests, Zod response validation, key redaction tests, hot reload integration |
| M4 | Orchestrator mock tests, sanitizePlan property tests, PlanRunner tests, agent e2e |
| M5 | Permission monotonicity tests, sub-agent isolation tests, plugin quarantine tests, skill reload tests, RAG scope/deletion tests, audit redaction tests |

## Migration And Cutover

| Step | Work | Result |
| :--- | :--- | :--- |
| 1 | Add this spec and gap analysis | `task/` detail is captured in canonical docs |
| 2 | Update `specs/README.md` and backlog | New execution spec is discoverable |
| 3 | Add `task/README.md` | Future agents know `task/` is historical |
| 4 | Execute M0 foundation tasks | Implementation can begin from M1 with contracts in place |
