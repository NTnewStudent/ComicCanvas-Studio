# .qoder/ — Qoder IDE Configuration

Native Qoder IDE agent, rule, and skill configuration for **ComicCanvas Studio** — an AIGC comic-drama canvas + Agent orchestration desktop client (Electron + TypeScript + Node.js + SQLite, local-first).

Full project identity and global prohibitions live in the root `AGENTS.md`.
This directory is the **Qoder-native** configuration layer. Source files under `.codex/`, `.claude/`, `.agents/`, and `.kiro/` remain unchanged.

---

## Directory Structure

```
.qoder/
├── agents/
│   ├── orchestrator-agent.md
│   ├── canvas-agent.md
│   ├── tooling-agent.md
│   └── pm-agent.md
├── rules/
│   ├── project-identity.md      # always-apply
│   ├── coding-standards.md      # always-apply
│   ├── ltm-operations.md        # always-apply
│   ├── electron-node.md         # glob: desktop/src/main/**, desktop/src/preload/**
│   ├── agent-runtime.md         # glob: desktop/src/main/agent/**
│   ├── canvas-engine.md         # glob: desktop/src/renderer/canvas/**
│   ├── tool-contracts.md        # glob: desktop/src/main/tools/**
│   ├── data-persistence.md      # glob: desktop/src/main/db/**
│   ├── tests.md                 # glob: **/*.test.ts, **/*.spec.ts, etc.
│   └── ltm-memory-format.md     # glob: ltm/**
├── skills/
│   ├── canvas-node-designer/
│   │   └── SKILL.md
│   ├── pm-req-planner/
│   │   ├── SKILL.md
│   │   └── assets/
│   │       ├── requirements-template.md
│   │       └── design-template.md
│   └── skill-creator/
│       └── SKILL.md
├── settings.json
└── README.md
```

---

## Agents

Custom sub-agent definitions in Qoder TOML-compatible Markdown format.
Each agent is activated manually via slash command or auto-matched by Qoder based on context.

| Agent File | `name` | Description | Tools | Activation |
|---|---|---|---|---|
| `orchestrator-agent.md` | `orchestrator` | Natural language → declarative CanvasPlan, end-to-end orchestration | Read, Grep, Glob, Bash | `/orchestrator` or auto-match |
| `canvas-agent.md` | `canvas` | Renderer canvas / React Flow specialist, node/edge/canvas UI | Read, Grep, Glob, Bash, Write, Edit | `/canvas` or auto-match |
| `tooling-agent.md` | `tooling` | Main-process specialist: agent runtime, tools, jobs, providers, DB, assets, IPC | Read, Grep, Glob, Bash, Write, Edit | `/tooling` or auto-match |
| `pm-agent.md` | `pm` | PM specialist: requirements, EARS acceptance criteria, contract coordination, progress | Read, Grep, Glob, Bash, Write, Edit | `/pm` or auto-match |

---

## Rules

Executable command-policy rules. **Always-apply** rules are injected into every session automatically. **Glob-matched** rules activate when the conversation touches files matching their glob pattern.

### Always-Apply

| Rule File | Description |
|---|---|
| `project-identity.md` | Project identity, architecture, agent roles, core contracts, global prohibitions |
| `coding-standards.md` | General TypeScript / architecture coding standards, naming conventions, mandatory annotations |
| `ltm-operations.md` | LTM project memory operations: recall, checkpoints, maintenance commands |

### Glob-Matched

| Rule File | Glob Pattern | Description |
|---|---|---|
| `electron-node.md` | `desktop/src/main/**`, `desktop/src/preload/**` | Electron/Node main-process standards, security, IPC, task queue, secrets |
| `agent-runtime.md` | `desktop/src/main/agent/**` | Agent main loop, tool orchestration, context management, CanvasPlan output |
| `canvas-engine.md` | `desktop/src/renderer/canvas/**` | Canvas state management, connections, prompt composition, node UI, real-time updates |
| `tool-contracts.md` | `desktop/src/main/tools/**` | Tool interface contracts, canvas tool set, execution rules and prohibitions |
| `data-persistence.md` | `desktop/src/main/db/**` | SQLite / Drizzle ORM, repository layer, core tables, asset fields |
| `tests.md` | `**/*.test.ts`, `**/*.spec.ts`, `**/*.test.tsx`, `**/*.spec.tsx` | Property-based tests, unit tests, IPC integration tests, prohibitions |
| `ltm-memory-format.md` | `ltm/**` | LTM record formats: events, checkpoints, sessions, secret redaction rules |

---

## Skills

Reusable repository-scoped workflows. Invoked via slash command or `#` reference in Qoder chat.

| Skill | Invocation | Description |
|---|---|---|
| `canvas-node-designer` | `/canvas-node-designer` | Design or modify a node type across shared contracts, connection matrix, renderer UI, main-process run mapping, Plan whitelist, and tests |
| `pm-req-planner` | `/pm-req-planner` | Turn a rough feature request into requirements, design, and tasks specs with EARS acceptance criteria and correctness properties |
| `skill-creator` | `/skill-creator` | Create a new repository-scoped skill under `.agents/skills/` or `.qoder/skills/` with a valid SKILL.md and optional assets |

---

## Hooks

Configured in `settings.json`.

| Hook | Trigger | Command | Purpose |
|---|---|---|---|
| LTM capture-turn | **Stop** (end of every agent turn) | `python ltm/bin/ltm.py capture-turn` | Automatically persist conversation context to LTM for session continuity |

> **Windows note:** Check `ltm/config.json` for `python_cmd` — it may be `python` or `py`.

---

## Source Mapping

Each Qoder configuration file was derived from existing Kiro / Codex / Claude sources:

| Qoder File | Source (Kiro) | Source (Codex) | Source (Claude) |
|---|---|---|---|
| `agents/orchestrator-agent.md` | `.kiro/steering/agents/agent-orchestrator.md` | `.codex/agents/orchestrator-agent.toml` | `.claude/agents/orchestrator-agent.md` |
| `agents/canvas-agent.md` | `.kiro/steering/agents/agent-canvas.md` | `.codex/agents/canvas-agent.toml` | `.claude/agents/canvas-agent.md` |
| `agents/tooling-agent.md` | `.kiro/steering/agents/agent-tooling.md` | `.codex/agents/tooling-agent.toml` | `.claude/agents/tooling-agent.md` |
| `agents/pm-agent.md` | `.kiro/steering/agents/agent-pm.md` | `.codex/agents/pm-agent.toml` | `.claude/agents/pm-agent.md` |
| `rules/*` | `.kiro/steering/rules/*` | — | `.claude/rules/*` |
| `skills/*` | `.kiro/steering/skills/*` | — | `.claude/skills/*` |
| `settings.json` | `.kiro/hooks/ltm-capture-on-stop.json` | `.codex/config.toml` (stop hook) | `.claude/settings.json` (stop hook) |

---

## Onboarding Checklist

Before starting any Qoder session on ComicCanvas Studio:

- [ ] Read root `AGENTS.md` (auto-loaded by Qoder as project-wide guidance)
- [ ] Read `global/design/DESIGN.md` before any renderer / UI task
- [ ] Read `shared/` contracts (`connection-matrix.ts`, `plan.ts`, `nodes.ts`, `ipc.ts`) before cross-module work
- [ ] Check `docs/api-contracts/` before opening new IPC channels or service interfaces
- [ ] Run LTM recall (`python ltm/bin/ltm.py files --limit 10`) if resuming prior work
- [ ] Follow coding standards enforced by always-apply rules (`project-identity`, `coding-standards`, `ltm-operations`)

---

## Notes

1. Qoder auto-discovers `.qoder/` on startup — no extra registration needed.
2. This directory is the **Qoder-native** config layer only; `.codex/`, `.claude/`, `.agents/`, and `.kiro/` remain independent.
3. All four IDE layers (Qoder / Kiro / Codex / Claude) share the same `specs/` directory as the product spec source of truth.
4. Glob-matched rules activate automatically when matched files appear in the conversation context.
5. The root `AGENTS.md` is read by Qoder as project-wide guidance and takes precedence unless overridden by `.qoder/rules/`.
