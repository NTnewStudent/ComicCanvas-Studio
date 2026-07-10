# Local Agent Workbench Progress - 2026-07-10

## Scope

This iteration upgrades the local general Agent from a chat demo into a durable Workbench surface while preserving the existing canvas-specific Agent path.

Included:

- General chat answers and model-backed tool use.
- Inline permission approval with `once`, `run`, and `session` scopes.
- Durable permission denial that terminates the paused Run.
- Durable Run Inspector projections for events, tools, permissions, child tasks, and artifacts.
- Chat history and Agent Run replay after renderer or application restart.
- Recovery of paused tool approvals after the Electron main process restarts.

Excluded:

- Organization roles, enterprise team collaboration, cloud sync, and centralized policy.
- A complete built-in child Agent team.
- Editable artifact editors and artifact mutation actions.

## Implemented

### Shared Workbench

- Added `AgentWorkbench` as the shared full/compact conversation shell.
- Added a persistent `RunInspector` with run and artifact tabs.
- Moved `ChatPanel` and `CanvasChatBox` onto the shared chat store implementation and block renderer.
- Added sequence-aware snapshot reconciliation so an older IPC snapshot cannot overwrite newer projected state.
- Added conversation-operation guards so late history responses cannot erase a newly sent message or overwrite a newer workflow restore.
- Moved IPC subscription startup into React effects so StrictMode cleanup/replay reconnects correctly.

### History And Replay

- Assistant answers and plans now persist under the same workflow as their user message.
- History loading includes the originating `runId` on user turns.
- Legacy assistant rows with a null workflow remain recoverable through their paired user message.
- Restore loads the latest persisted Agent Run projection and can synthesize a missing assistant turn from the Run ledger.
- Every terminal assistant outcome is projected from the complete durable Run and idempotently upserted, preserving pre-approval tool/permission history without duplicate rows.
- Persisted error blocks restore as failed turns for runtime failures and denied approvals.
- `approval_required` restores the pending job, busy state, permission card, and Run Inspector.
- Main Runtime now uses conservative startup recovery: only side-effect-free text polishing, untouched Agent runs, and queued approval resumes at a durable checkpoint are replayed. Started side-effecting, orphaned, or unsafe-checkpoint jobs fail closed to avoid duplicate work.

### Permission Reliability

- Inline permission cards expose approve-once, approve-run, approve-session, and deny controls.
- Non-destructive session grants are reused for later matching calls during the same application session.
- Destructive grants remain forced to `once`.
- Session grants are reusable only while their exact grant IDs are held by the current permission-service instance; persisted rows remain audit records after restart.
- Approval resume jobs carry an ephemeral application-session ID. A `session` approval consumed after another restart is downgraded to `once`, while approval granted after restart remains reusable inside that new session.
- Queued approvals are revalidated against the current Agent, tool, and permission policy before execution.
- A restarted `OrchestratorRuntime` can rebuild a paused Run from `agent_runs.trace.pendingApproval` and `paused_state_json`.
- A second restart after approval is queued but before the resume worker consumes the job is also recoverable.
- Deny now calls the typed `agent.denyTool` IPC path and commits the `aborted` Run, resolved permission, and terminal error facts in one SQLite transaction.
- A partial denial ledger failure rolls the transaction back, leaving the original paused Run recoverable and retryable.
- Approval or denial persistence failure leaves the original permission request pending and visible so the user can retry either action.

### Typed Artifacts

- Added typed, read-only artifact views for answers, clarifications, CanvasPlan, canvas patch drafts, search summaries, memory suggestions, and diagnostics.
- CanvasPlan artifacts expose nodes, edges, and run steps without applying the plan.
- Search summaries preserve result sources and citations, while memory suggestions remain explicitly pending and are never written automatically.
- Malformed or unsupported payloads render a safe fallback instead of throwing; fallback previews redact credential-shaped values and sensitive fields.
- Persisted snapshot artifacts take precedence over stale projected artifacts, and projection-only artifacts are runtime validated before rendering.
- Artifact selection survives appended artifacts and resets only when the selected artifact disappears or the Run changes.
- Run and artifact tabs support keyboard navigation, a single horizontal tab row, and safe wrapping for long citation text.

### Integrated UI Regression

- Added user-level jsdom flows for `hi` and `你好`, persisted answer replay, approval replay and resume, Plan hydration and apply gating, persisted failures, clear-view restoration, workflow validation, and subscription cleanup.
- Approval tests exercise the asynchronous same-Run sequence from pending permission through resolution to `responseReady`.
- The harness builds durable snapshots and events and projects them through the production `RunProjector` instead of fabricating unrelated UI state.

## Electron Verification

Profile:

```text
/tmp/comiccanvas-playwright-profile-workbench-20260710a
```

Scenario:

1. Sent: `请联网搜索 2026 年 7 月 10 日 OpenAI 官方最新动态，并用一句话总结。`
2. Confirmed the inline `web.search` permission card and `等待授权` Run status.
3. Closed Electron without approving.
4. Relaunched with the same profile and reopened `#/chat`.
5. Confirmed the original question, Run ID, permission card, and 11 persisted events were restored.
6. Clicked `批准并继续`.
7. Confirmed the same Run completed with a visible answer and 37 persisted events.
8. Confirmed no Playwright page errors.

SQLite evidence for Run `run-e7bf08e5-df9a-4bb7-9cd2-3e4c65843f9b`:

- Status: `completed`
- Last checkpoint: `run.completed`
- Paused state cleared: yes
- `permission.requested`: 1
- `permission.resolved`: 1
- `run.completed`: 1
- Stored grant: `web.search`, scope `session`

Screenshots:

- `output/playwright/agent-workbench-approval-before-restart.png`
- `output/playwright/agent-workbench-approval-after-restart-complete.png`

### Typed Artifact And Restart QA - 2026-07-11

Profile:

```text
/tmp/comiccanvas-phase3-qa-built-20260711
```

Scenario:

1. Launched the built Electron application and opened the live renderer at `#/chat`.
2. Sent `hi` and confirmed a visible Chinese answer with no CanvasPlan and no stuck busy state.
3. Opened the artifact inspector and confirmed the typed `Answer` tab and body.
4. Used `ArrowLeft` from the artifact tab and confirmed focus and selection returned to the Run tab.
5. Relaunched Electron with the same profile and confirmed the question, answer, completed Run, and inspector were restored.
6. Clicked `清空对话`, confirmed the current view cleared, then reloaded and confirmed persisted history returned.
7. Resized the window to `960x640` and confirmed the inspector had no horizontal overflow.
8. Confirmed no Playwright page errors after reload or interaction.

Screenshot:

- `output/playwright/agent-workbench-typed-answer-20260711.png`

## Automated Verification

Passed:

```text
166 test files, 697 tests
bun run typecheck
ESLint on all files changed by this iteration
git diff --check
bun run build
```

The focused regression group covers:

- Orchestrator approval pause/resume and two restart windows.
- Main Runtime startup recovery for persisted pending and abandoned processing jobs.
- Session-scope invalidation across application restarts.
- Durable denial, atomic denial rollback, and denial-failure retry state.
- Agent context loop and ToolRuntime permission scopes.
- Chat history, projection replay, legacy assistant recovery, and late-response workflow races.
- Chat store event reconciliation and StrictMode subscriptions.
- Full and compact Workbench UI, permission cards, plans, and failure blocks.
- Typed artifact projection, malformed payload fallback, sensitive preview redaction, and accessible artifact tabs.
- User-level chat, permission resume, Plan preview, failure, clear-view, restart replay, workflow validation, and subscription cleanup.

Repository-wide gates currently have pre-existing blockers outside this iteration:

- `bun run lint`: 119 existing errors across unrelated main, canvas, generated `.js` tests, and legacy test fixtures.
- `bun run verify:repo`: the tracked root `package-lock.json` violates the Bun-only repository check; it was introduced before this iteration.

## Remaining Gaps

- `ChatPanel` and `CanvasChatBox` share the same implementation but still create separate live store instances. Opening both does not yet guarantee one in-memory source of truth.
- Restore currently reconciles only the latest persisted Run referenced by chat history; an older unresolved approval can remain hidden after a newer Run completes.
- `RunInspector` renders the complete event list, including every persisted model delta, without virtualization or event compaction.
- Artifact views are read-only; editing, accepting, rejecting, or mutating artifact content remains future work.
- Browser automation covers the primary typed-answer restart path; the complete answer/tool/plan/error matrix remains covered across jsdom and service-level suites rather than one end-to-end browser suite.

These gaps remain unchecked in `specs/local-agent-platform/tasks.md` and should be completed before calling the whole local Agent platform finished.
