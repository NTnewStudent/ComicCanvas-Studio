# No-Demo Acceptance Review

Date: 2026-06-25

## Placeholder Scan

Scope checked:

- `specs/`
- `docs/api-contracts/`
- `docs/architecture/`
- `docs/progress/`
- `.codex/`
- `.agents/`
- `AGENTS.md`

Required result before M1:

- No unresolved placeholder text in foundation contracts.
- No canonical product spec links under `.codex/` or `.claude/`.
- Tool-specific directories remain runtime/config layers only.

Command to run during final M0 verification:

```bash
rg -n "TBD|TODO|FIXME|placeholder|\\.claude/specs|\\.codex/specs" specs docs/api-contracts docs/architecture docs/progress .codex .agents AGENTS.md
```

## No-Demo Acceptance Review

The foundation now has the minimum industrial-grade contracts expected before implementation:

| Module | Contract | Owner | Failure behavior | Test strategy | Recovery/security |
| :--- | :--- | :--- | :--- | :--- | :--- |
| CanvasPlan | `docs/api-contracts/canvas-plan.md`, `shared/plan.ts` | orchestrator-agent/canvas-agent | reject invalid JSON, executable content, illegal edges | sanitize tests, connection tests | plan apply revalidation |
| Jobs | `docs/api-contracts/jobs.md`, `shared/jobs.ts` | tooling-agent | stable error class, retry eligibility | state-machine and terminal uniqueness | startup recovery |
| Assets | `docs/api-contracts/assets-files.md`, `shared/assets.ts` | tooling-agent | metadata/path/reference errors | orientation, traversal, reference tests | safe protocol, tombstones |
| Gateway | `docs/api-contracts/gateway-providers.md`, `shared/gateway.ts` | tooling-agent | capability/provider/timeout errors | normalization and mock provider tests | encrypted keys, redaction |
| Tools/Plugins | `docs/api-contracts/tools-plugins.md`, `shared/tools.ts` | tooling-agent | permission/schema/quarantine errors | registry, permission, quarantine tests | ToolRuntime boundary |
| Agents | `docs/api-contracts/agents.md`, `shared/agents.ts` | orchestrator-agent | policy/context/run errors | permission monotonicity and run tests | trace metadata, sub-agent limits |
| Skills | `docs/api-contracts/skills.md`, `shared/skills.ts` | orchestrator-agent | metadata/reference/permission errors | lazy load and reload tests | previous-valid snapshot |
| Knowledge/RAG | `docs/api-contracts/knowledge-context.md`, `shared/knowledge.ts` | tooling-agent | scope/index/context errors | scope, delete, citation tests | scoped retrieval and redaction |
| Audit/Observability | `docs/api-contracts/audit-observability.md`, `shared/ipc.ts` | tooling-agent/pm-agent | safe error envelopes | redaction and health tests | trace IDs, health checks |

## M0 Exit Decision

M1 may start only when all of these are true:

- `bun run ci` passes.
- `python ltm/bin/ltm.py selftest` passes.
- `docs/api-contracts/` contains the required split contracts.
- `shared/` contains focused contracts for jobs, assets, gateway, tools, agents, skills, knowledge, and IPC.
- `docs/architecture/core-platform-implementation-readiness.md` exists and covers DB schema, repositories, migration, runtime plans, settings surfaces, built-in tools, skills, and agents.
- `docs/progress/backlog.md` marks only evidence-backed REQs as complete.

Current decision:

- M1 may start after the final M0 verification commands pass in this branch.
