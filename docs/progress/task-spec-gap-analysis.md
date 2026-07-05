# Task vs Specs Gap Analysis

Date: 2026-06-25

## Purpose

This document compares the historical `task/M0-M5` PRD files with the canonical root-level `specs/` tree. The goal is to prevent useful milestone detail from being forgotten while keeping `specs/` as the only execution source of truth.

## Current Source Status

| Source | Status | Use |
| :--- | :--- | :--- |
| `specs/core-platform-foundation/` | Canonical | Platform foundation contracts before implementation |
| `specs/canvas-agent-orchestration/` | Canonical | Canvas orchestration MVP requirements/design/tasks |
| `task/M0-M5` | Historical draft | Reference only; useful details have been migrated into `specs/milestone-execution-plan/` |

## Coverage Summary

| Area | In `task/` | In current `specs/` | Gap |
| :--- | :--- | :--- | :--- |
| M0 contracts/governance | Detailed REQ-001..009, but Claude-era and stale status | Foundation spec covers governance; canvas spec covers shared contracts | Need reconcile status and remove `.claude` as governance truth |
| M1 Electron/DB/jobs/provider/assets/IPC | Detailed implementation tasks and file paths | Foundation spec covers contracts; canvas spec has high-level tasks | Need migrate detailed M1 task list into canonical specs |
| M2 Canvas UI | Detailed Text/Image/Video nodes, store, prompt panel, save/load, zero polling | Canvas spec covers only compressed tasks | Need preserve UI component-level tasks |
| M3 Gateway | Detailed OpenAI provider, polling, settings UI, safeStorage, hot switch, model map | Foundation spec covers gateway abstraction | Need add concrete provider/settings/security tasks |
| M4 Agent orchestration | Detailed orchestrator, tools, sanitizePlan, chat IPC, applyPlan, PlanRunner, Chat UI | Canvas spec covers most logic, but not Chat UI and exact tool list details | Need merge detailed UI/IPC tasks and align tool names |
| M5 Agent advanced | Detailed spawnSubAgent, isolation, custom agent UI, @mention, tool UI, asset folders | Foundation spec covers agents/tools/assets broadly | Need preserve concrete advanced-product tasks |
| Skills runtime | Not covered | Foundation spec covers built-in/custom skills | Need add milestone tasks for SkillRegistry and skill management |
| Plugin tools | Partially tool UI only | Foundation spec covers PluginLoader/quarantine | Need add concrete plugin manifest/load/disable tasks |
| Knowledge/RAG | Not covered | Foundation spec covers KnowledgeStore/ContextBuilder | Need add concrete ingest/retrieve/delete/rebuild tasks |
| Audit/observability/recovery | Light coverage in invariants | Foundation spec covers audit and health checks | Need add concrete audit/log/redaction/health tasks |

## Decisions

1. `task/` remains a historical reference and must not be used as the execution source.
2. The detailed milestone implementation plan is migrated into `specs/milestone-execution-plan/`.
3. Backlog remains the REQ registry; specs contain requirements/design/tasks details.
4. M0 must finish foundation contracts before M1 starts.
5. `shared/tools-agents.ts` should be split into focused shared contracts during foundation work, so older `task/` references to editing that file are superseded by `shared/tools.ts`, `shared/agents.ts`, `shared/skills.ts`, `shared/gateway.ts`, and `shared/knowledge.ts`.

## Missing Items Added To Canonical Specs

- `specs/milestone-execution-plan/requirements.md`
- `specs/milestone-execution-plan/design.md`
- `specs/milestone-execution-plan/tasks.md`

## Follow-Up Status

- Completed: added `specs/milestone-execution-plan/` to `specs/README.md`.
- Completed: updated `docs/progress/backlog.md` to point execution planning to the new milestone spec.
- Completed: added `task/README.md` warning that `task/` is historical draft material.
- Completed (2026-07-05): M5 tasks 41–47 closed; foundation tasks 24–27 cross-referenced; skills/plugins/knowledge/audit runtime implemented.
