# Batch Human Acceptance Runbook (2026-07-05)

Date: 2026-07-05

Engineering queue complete: M5 milestone-execution-plan **47/47**.

## Prerequisites

1. `bun install && bun run rebuild:native`
2. `bun scripts/run-vitest.mjs run` (full suite)
3. `bun run dev` — launch desktop client

## Scenario Source

Execute every scenario in:

- `docs/progress/hjwall-canvas-phase7-human-review-scenarios.md`

## Checklist

Record Pass/Fail in:

- `docs/progress/human-desktop-review-checklist.md`

Key gates:

- `HDR-PHASEA-001` — Phase A matrix overall
- `HDR-050` / `HDR-051` — Agent plan apply/run desktop flows

## Automated Evidence Already Landed

| Area | Tests |
| :--- | :--- |
| SkillRegistry | `tests/skill-registry.test.ts` 3/3 |
| PluginLoader | `tests/plugin-loader.test.ts` 2/2 |
| KnowledgeStore | `tests/knowledge-store.test.ts` 1/1 |
| Audit/redaction | `tests/redaction.test.ts` 2/2 |
| M5 integration | `tests/m5-integration.test.ts` 1/1 |
| Agent plan apply | `tests/agent-plan-apply-run.test.ts` |

## Session Template

Use `docs/progress/phase-a-human-review-session-template.md` and attach:

- Reviewer name + date
- App commit SHA
- Per-scenario Pass/Fail notes

## Post-Acceptance

1. Update REQ-098 → ✅ when all blocking HDR rows Pass
2. Advance RUEPE pointer to Phase E (`conversation-context-engine` task 1) or infinite-canvas per backlog focus
