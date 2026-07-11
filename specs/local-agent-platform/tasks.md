# Implementation Plan - Local Agent Platform

## Phase 0 - Contracts And Guardrails

- [x] 1. Update `docs/api-contracts/agents.md` with AgentRunEvent, Artifact, PermissionGrant, ChildAgentTask, Run Inspector, and local-only non-goals. _(R1-R9)_
- [x] 2. Update `shared/agents.ts` or add shared contracts for run events, artifacts, projector outputs, local permission grants, and child task summaries. _(R1, R2, R5, R6, R8)_
- [x] 3. Add schema/static tests that first-MVP contracts do not include enterprise team concepts such as organization roles, cloud sync, team memory, or centralized policy server. _(INV-7)_
- [x] 4. Define stable event vocabulary and payload redaction rules in shared types and docs. _(R1, R8)_

## Phase 1 - Agent Run Spine

- [x] 5. Add SQLite migrations and repositories for `agent_run_events`, `agent_artifacts`, `agent_permission_grants`, and `child_agent_tasks`. _(R1, R5, R6, R8)_
- [x] 6. Implement `AgentRunSpine` service for run creation, event append, artifact save, grant save, and snapshot reads. _(R1)_
- [x] 7. Implement a pure `RunProjector` that maps run snapshots to ChatTurns, task tree rows, inspector model, and artifact view models. _(R2, INV-1)_
- [x] 8. Add projector unit/property tests for live-event and replay equivalence. _(INV-1)_
- [x] 9. Wire `OrchestratorRuntime` to append run events while preserving existing IPC behavior. _(R1, R2)_
- [x] 10. Persist paused approval state and pending same-assistant-message tool calls through the run spine. _(R1, R6, INV-2)_

## Phase 2 - Permission And Approval Reliability

- [x] 11. Extract `PermissionService` from ToolRuntime/session grant logic with `allow | ask | deny` decisions. _(R6)_
- [x] 12. Add grant scopes for once, run, and session with workflow/tool/permission-kind boundaries. _(R6, INV-3)_
- [x] 13. Keep destructive operations ask-first by default and test that non-destructive session grants do not bypass destructive prompts. _(R6, INV-3)_
- [x] 14. Add transcript-closure tests for native OpenAI-compatible tool calls across approval resume, multiple tool calls, denied tools, and tool failures. _(R6, INV-2)_
- [x] 15. Make approval denial and approval failure project visible terminal or retryable states. _(R6, INV-5)_

## Phase 3 - Agent Workbench UI

- [x] 16. Create shared `AgentWorkbench` shell with conversation stream, artifact tabs, compact run status, and Run Inspector slot. _(R2, R8)_
- [x] 17. Convert ChatPanel to use workbench projection outputs instead of duplicating event state. _(R2)_
- [x] 18. Convert CanvasChatBox into a compact workbench entry that reuses the same store/projection and opens inspector details when needed. _(R2)_
- [x] 19. Add inline permission cards with approve once, approve run, approve session, and deny actions. _(R6)_
- [x] 20. Add artifact tabs for answer, clarification, CanvasPlan, canvas patch draft, search summary, memory suggestion, and diagnostics. _(R2, R4, R7, R8)_
- [x] 21. Add jsdom/browser tests for normal chat, permission resume, plan preview, failure blocks, clear-view behavior, and restart replay. _(R2, R6, R8, R9)_

## Phase 4 - Built-In Agent Team

- [x] 22. Implement `AgentRoleRegistry` for General Assistant, PM, Canvas Planner, Canvas Operator, Asset/Media, Workflow Runner, Tooling, and QA/Verifier. _(R5)_
- [x] 23. Update child-agent spawning so first MVP only uses built-in roles and persists ChildAgentTask records/events. _(R5)_
- [x] 24. Enforce child permission narrowing by parent policy, role policy, and tool permissions. _(R5, INV-3)_
- [x] 25. Add draft graph / draft CanvasPlan artifacts for child canvas proposals. _(R4, R5, INV-4)_
- [x] 26. Add parent merge/apply gate for child canvas artifacts. _(R4, R5)_
- [x] 27. Add task tree UI rows with role, status, summaries, effective tools, artifacts, and errors. _(R5, R8)_
- [x] 28. Add tests for child task success, failed child reporting, permission narrowing, draft isolation, and verifier gate output. _(R5, INV-3, INV-4)_

## Phase 5 - Context, Memory, Search

- [x] 29. Extend ContextPack builder to persist source refs, omissions, warnings, redactions, and token estimates. _(R7, INV-6)_
- [x] 30. Add Run Inspector view for ContextPack sources and omissions. _(R7, R8)_
- [ ] 31. Add local memory model for user, workflow, and optional agent-role memory. _(R7)_
- [ ] 32. Add manual memory save and Agent-suggested memory with user confirmation. _(R7)_
- [ ] 33. Ensure web.search results are treated as cited evidence and not hidden instructions. _(R7)_
- [ ] 34. Add tests for context priority, redaction, search citations, search failure visibility, and memory-write confirmation. _(R7, INV-6)_

## Phase 6 - Golden Scenarios And Cutover

- [ ] 35. Add golden scenario tests for `你好`, `你是谁`, `明天星期几`, and `你知道 Java 吗` producing visible answers without canvas mutation. _(R3, R9)_
- [ ] 36. Add golden scenario for inline approval resume with no stuck spinner and no repeated unnecessary prompts. _(R6, R9)_
- [ ] 37. Add golden scenario for comic scene workflow: child task tree, PlanCard, warnings, apply gate. _(R4, R5, R9)_
- [ ] 38. Add golden scenario for app restart restoring answer/tool/permission/plan/error blocks. _(R1, R2, R8, R9)_
- [x] 39. Add regression group command to project docs/progress for local Agent platform verification. _(R9)_
- [x] 40. Run `bun run typecheck`, targeted Vitest groups, and relevant UI tests before declaring implementation complete. _(R9)_
