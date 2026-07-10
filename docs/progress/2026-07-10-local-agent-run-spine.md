# Local Agent Run Spine Verification

Date: 2026-07-10

## Implemented

- Added local-only Agent Run Spine contracts for run events, artifacts, permission grants, child tasks, snapshots, projections, and inspector models.
- Added SQLite migration `0015_agent_run_spine` with ordered event replay, artifact, permission grant, and child task persistence.
- Added repository boundaries for run metadata, append-only events, artifacts, grants, and child task summaries.
- Added a pure deterministic RunProjector that rebuilds chat turns, artifacts, task tree rows, and inspector state from persisted snapshots.
- Added the AgentRunSpine service for run creation, lifecycle updates, event append, artifact/grant/child-task persistence, and aggregate snapshot reads.
- Wired OrchestratorRuntime visible progress, model deltas, tool transitions, permission requests, responses, plans, artifacts, completion, and failure states into the Run Spine while preserving live IPC delivery.
- Added persistent `once | run | session` permission semantics. Non-destructive approvals default to the current application session; destructive approvals are forced to `once`.
- Added a session-start boundary so persisted session grants remain auditable but are not reused after application restart.
- Wired all Run Spine repositories and the persistent permission store into the real Electron main-process composition root.
- Enriched `agent.getRun` with `snapshot` and `projection` while preserving legacy `runId`, `status`, and `trace` fields.
- Restored the missing `onJobCompleted` ChatPanel API declaration used by terminal response reconciliation.

## Correctness Checks

- Run events are append-only and receive a strictly increasing per-run sequence from one SQLite insert statement.
- Replay sorts by sequence and produces deterministic chat, inspector, artifact, and child-task output even when input events arrive out of order.
- Successful runs persist one visible terminal completion; failed runs persist one visible terminal failure.
- Permission requests and resolutions retain the original `callId`, tool ID, required permission kinds, approving user label, and effective scope.
- Exact approved invocations resume through ToolRuntime; run grants do not cross run IDs, session grants do not cross app restarts, and once grants are not reused.
- Existing trace consumers continue to work when snapshot/projection fields are present.

## Verification

- Targeted Run Spine regression: 10 test files, 77 tests passed.
- Full repository regression: 164 test files, 646 tests passed.
- `bun run typecheck`: passed with no TypeScript errors.
- Milestone lint over all touched contracts, repositories, services, runtime, renderer API, and tests: passed with zero warnings.
- `git diff --check`: passed.

Commands:

```bash
bun scripts/run-vitest.mjs run tests/agent-run-contracts.test.ts tests/agent-run-spine-db.test.ts tests/agent-run-projector.test.ts tests/agent-permission-grants.test.ts tests/orchestrator-runtime.test.ts tests/tool-runtime.test.ts tests/agent-context-loop.test.ts tests/main-runtime-wiring.test.ts tests/chat-history.test.ts tests/chat-blocks.test.ts
bun run test
bun run typecheck
bun node_modules/eslint/bin/eslint.js shared/agent-run-events.ts shared/agent-run-projector.ts shared/agents.ts shared/ipc.ts desktop/src/main/agent/run-spine.ts desktop/src/main/agent/permission-service.ts desktop/src/main/agent/orchestrator.ts desktop/src/main/agent/context-loop.ts desktop/src/main/agent/gateway-loop-model.ts desktop/src/main/tools/runtime.ts desktop/src/main/runtime.ts desktop/src/main/db/migrate.ts desktop/src/main/db/schema.ts desktop/src/main/db/repositories/agent-run.repo.ts desktop/src/main/db/repositories/agent-run-event.repo.ts desktop/src/main/db/repositories/agent-artifact.repo.ts desktop/src/main/db/repositories/agent-permission-grant.repo.ts desktop/src/main/db/repositories/child-agent-task.repo.ts desktop/src/renderer/src/chat/ChatPanel.tsx tests/agent-run-contracts.test.ts tests/agent-run-spine-db.test.ts tests/agent-run-projector.test.ts tests/agent-permission-grants.test.ts tests/orchestrator-runtime.test.ts tests/tool-runtime.test.ts tests/agent-context-loop.test.ts tests/main-runtime-wiring.test.ts --max-warnings=0
git diff --check
```

## Existing Repository Lint Debt

`bun run lint` still reports 121 pre-existing errors outside this milestone, including unrelated canvas modules, storage/asset tests, and checked-in/generated JavaScript test copies. No Run Spine file appears in that failure list. This milestone keeps its touched-file lint gate green and does not broaden scope into unrelated cleanup.

## Remaining Platform Milestones

- Shared Agent Workbench shell, Run Inspector UI, artifact tabs, and explicit approve-once/run/session controls.
- Built-in specialist role registry, persisted child task execution, draft isolation, verifier gates, and visible task tree.
- ContextPack source accountability, omissions/redactions UI, local memory suggestions, and cited search artifacts.
- Golden restart/replay scenarios and browser-level approval interaction verification.

This milestone remains local-only. It adds no organization roles, multi-user workspace, cloud sync, team memory, or centralized policy server.
