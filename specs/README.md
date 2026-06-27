# Specs

Root-level project specifications live here. This directory is the canonical
source for requirements, design, and task specs shared by Codex, Claude-compatible
tooling, and human contributors.

Tool-specific directories are not spec roots:

- `.codex/` is for Codex runtime configuration, custom agent TOML, and rules.
- `.claude/` is a compatibility/archive layer.
- `.agents/` is for reusable repository skills.

## Active Specs

| Spec | Purpose |
| :--- | :--- |
| `core-platform-foundation/` | Cross-module foundation for canvas, jobs, assets, gateways, tools, plugins, agents, skills, and knowledge/RAG. |
| `milestone-execution-plan/` | Canonical execution plan migrated from historical `task/M0-M5`, with gaps filled for skills, plugins, knowledge/RAG, and observability. |
| `canvas-agent-orchestration/` | Detailed canvas orchestration MVP: CanvasPlan, connection matrix, async generation, prompt composition, assets, and PlanRunner. |
| `hjwall-canvas-full-migration/` | Canonical migration plan for hjwall canvas capabilities into ComicCanvas, excluding real gateway request details, with user-flow completion evidence gates. |

## Required Files

Each spec directory should contain:

- `requirements.md`
- `design.md`
- `tasks.md`
