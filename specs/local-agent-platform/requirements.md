# Requirements Document - Local Agent Platform

## Introduction

ComicCanvas needs a local professional Agent platform, not another demo chat box. The platform SHALL provide a Claude/Codex-like workbench for general conversation, search-assisted answers, tool use, permissions, replayable runs, and built-in canvas specialist agents. It remains local-first: Electron main process, SQLite, local assets, local jobs, and IPC events.

Scope:

- A durable Agent Run Spine for all general chat, tool calls, permissions, canvas planning, child-agent tasks, artifacts, failures, and replay.
- A shared Agent Workbench UI used by the full chat page and the canvas floating entry.
- A built-in local specialist Agent team for canvas planning, operation, media/assets, workflow running, tooling diagnostics, and verification.
- Local-only permission grants, run inspection, context packs, memory, and search evidence.

Non-goals:

- No enterprise team edition, multi-user workspace, role-based organization policy, cloud sync, remote collaboration, centralized admin policy server, or enterprise audit product.
- No executable code or scripts in CanvasPlan.
- No bypass around `shared/connection-matrix.ts`, CanvasPlan sanitization, Plan apply gates, local job queue terminal events, or `cc-asset://` asset handling.
- No direct copying of cc-haha or Claude/Codex source code. External projects and official docs are design references only.

## Glossary

- **Agent Workbench**: The UI shell that displays threads, messages, artifacts, tool cards, permission cards, task trees, and run inspection.
- **Agent Run Spine**: The durable local lifecycle for a run: input, intent, context, model/tool loop, approvals, child agents, artifacts, terminal state, and replay.
- **AgentRunEvent**: An append-only event that records a user-visible or audit-relevant transition in an Agent run.
- **Artifact**: A typed output from a run, such as an answer, clarification, CanvasPlan, canvas patch preview, asset reference, local memory suggestion, or diagnostic report.
- **ChildAgentTask**: A bounded specialist subtask spawned by a parent run with narrower or equal permissions.
- **ContextPack**: A redacted, token-budgeted, inspectable package of canvas, conversation, knowledge, memory, search, and policy context for one run.
- **Draft graph**: A non-persistent graph snapshot used by child agents for proposed canvas mutations before parent merge/apply gates.
- **PermissionGrant**: A local approval record scoped to a tool, permission kinds, workflow, run/session lifetime, and expiration.
- **Run projector**: A pure projection layer that turns AgentRunEvents into ChatTurns, task tree rows, inspector state, and artifact UI.

## Requirements

### Requirement 1: Durable Agent Run Spine

**User Story:** As a local creator, I want every assistant action to be recoverable and inspectable, so that a failed or restarted app does not lose what the Agent did.

#### Acceptance Criteria

1. WHEN a user sends a message THE system SHALL create an AgentRun before invoking any model or tool.
2. WHEN a run starts THE system SHALL persist its `runId`, `threadId`, `workflowId`, `agentId`, trigger, status, selected model/gateway, and local policy profile.
3. WHEN a run changes state THE system SHALL append an AgentRunEvent instead of relying only on transient renderer state.
4. WHEN the app restarts THE system SHALL reconstruct visible run state from persisted run records, events, artifacts, and chat blocks.
5. IF a run fails THEN THE system SHALL persist a stable error class, safe message, retryability, and last known checkpoint.
6. WHILE a run is awaiting approval THE system SHALL preserve the paused loop state and pending tool call metadata needed to resume safely.

### Requirement 2: Unified Workbench Projection

**User Story:** As a user, I want the chat page and canvas floating entry to show the same Agent behavior, so that the assistant does not feel different depending on where I open it.

#### Acceptance Criteria

1. WHEN AgentRunEvents arrive THE run projector SHALL produce deterministic ChatTurn blocks, task tree rows, artifact tabs, and inspector state.
2. WHEN the renderer receives live IPC events THE UI SHALL use the same projection rules as replay from SQLite.
3. IF a live IPC event is missed THEN THE UI SHALL reconcile from `agent.getRun` or equivalent persisted state.
4. WHEN an answer, clarification, or CanvasPlan is produced THE UI SHALL display it as a typed artifact and not as an unstructured log line.
5. WHILE a run is busy THE UI SHALL show the latest visible state: queued, thinking, tool running, approval required, child task running, retrying, failed, or completed.
6. IF the user clears the visible conversation THEN THE system SHALL clear only the local view unless the user explicitly requests deletion of persisted history.

### Requirement 3: General Chat Must Be First-Class

**User Story:** As a user, I want the assistant to answer ordinary questions naturally, so that it is not limited to canvas commands.

#### Acceptance Criteria

1. WHEN the user sends greetings such as `hi` or `你好` THE assistant SHALL produce a visible answer without mutating the canvas.
2. WHEN the user asks identity questions such as `你是谁` THE assistant SHALL explain its local Agent and canvas capabilities.
3. WHEN the user asks deterministic local questions such as dates or weekdays THE assistant SHALL answer without requiring model or tool approval when possible.
4. WHEN the user asks a general knowledge question THE assistant SHALL route to the configured text gateway or a safe clarification if no usable gateway exists.
5. IF the question requires current external information THEN THE assistant SHALL use controlled search or state that search is unavailable; it SHALL NOT pretend to have searched.
6. FOR ALL non-canvas answers THE system SHALL NOT call `canvas.chatGetPlan` or create hidden CanvasPlans.

### Requirement 4: Canvas Planning And Apply Gates

**User Story:** As a creator, I want canvas operations to remain powerful but safe, so that the assistant can build workflows without corrupting my graph.

#### Acceptance Criteria

1. WHEN the user expresses explicit canvas creation, edit, connection, or run intent THE system SHALL route to canvas planning or operation agents.
2. WHEN an Agent produces CanvasPlan THE plan SHALL be declarative JSON and pass existing sanitization before display or apply.
3. FOR ALL Agent-created edges THE system SHALL validate against `shared/connection-matrix.ts` as the only source of truth.
4. IF a CanvasPlan contains unsupported nodes, illegal edges, executable strings, unavailable assets, or unsupported run actions THEN THE system SHALL drop or reject those parts with visible warnings.
5. WHEN a plan is ready THE UI SHALL show a preview and require an apply gate unless local auto-apply policy explicitly permits it.
6. WHEN generation is requested THE system SHALL enqueue local jobs and emit terminal IPC events; request handlers SHALL NOT synchronously return generated assets.
7. IF a child agent proposes canvas mutations THEN THE changes SHALL land in a draft graph or draft CanvasPlan artifact until the parent merge/apply gate accepts them.

### Requirement 5: Built-In Specialist Agent Team

**User Story:** As a creator, I want multiple local specialist agents to collaborate visibly, so that complex canvas work is decomposed without hiding important decisions.

#### Acceptance Criteria

1. WHEN a complex request benefits from decomposition THE parent Agent MAY spawn ChildAgentTasks for built-in roles.
2. THE built-in roles SHALL include, at minimum: General Assistant, PM Agent, Canvas Planner, Canvas Operator, Asset/Media Agent, Workflow Runner, Tooling Agent, and QA/Verifier.
3. WHEN a child task is spawned THE system SHALL persist role ID, parent run ID, input summary, effective tools, status, events, artifacts, and output summary.
4. FOR ALL child agents THE effective permissions SHALL be no broader than the parent run permissions and the child role policy.
5. IF a child task needs canvas write capability THEN it SHALL write only to draft artifacts until parent merge/apply.
6. WHILE child tasks are running THE workbench SHALL display a task tree with role, status, summary, and artifact links.
7. IF a child task fails THEN the parent run SHALL receive a structured tool/child result and the UI SHALL show the failed task without losing the rest of the run.

### Requirement 6: Local Permission And Approval Model

**User Story:** As a user, I want clear control over tools and side effects, so that I can trust the assistant with local capabilities.

#### Acceptance Criteria

1. WHEN a tool is requested THE system SHALL decide `allow`, `ask`, or `deny` from Agent policy, tool permissions, current run/session grants, and local policy profile.
2. WHEN the decision is `ask` THE run SHALL pause and display an inline permission card with tool ID, reason, permission kinds, scope, and input summary.
3. WHEN the user approves once THE system SHALL resume only the matching pending tool call.
4. WHEN the user approves for a run or session THE grant SHALL be scoped by tool ID, permission kinds, workflow, and expiration.
5. IF an operation is destructive THEN THE system SHALL ask by default even if related non-destructive permissions were previously granted.
6. WHEN a run resumes after approval THE system SHALL execute remaining tool calls from the same assistant message before continuing the model loop.
7. FOR ALL native OpenAI-compatible tool calls THE system SHALL provide a matching tool message for every tool call ID before the next model request.
8. IF approval fails or is denied THEN THE UI SHALL show a terminal or resumable state; it SHALL NOT spin indefinitely.

### Requirement 7: Context Pack, Local Memory, And Search Evidence

**User Story:** As a user, I want the assistant to understand my current canvas and history without leaking or hallucinating context, so that it can act intelligently and transparently.

#### Acceptance Criteria

1. WHEN a run starts THE system SHALL build a ContextPack according to the selected Agent context policy.
2. THE ContextPack SHALL include source references, token estimate, omitted sources, warnings, and redaction summary.
3. WHEN selected canvas nodes or assets exist THE ContextPack SHALL prioritize them over global graph detail.
4. IF context exceeds budget THEN THE system SHALL summarize, trim, or omit lower-priority sources with visible omissions.
5. WHEN web search is used THE system SHALL treat results as untrusted evidence and include source citations in the response or artifact.
6. IF search fails THEN THE system SHALL produce a visible error or clarification and SHALL NOT claim current-source evidence.
7. WHEN local memory is written THE system SHALL require either explicit user action or user confirmation of an Agent suggestion in the first MVP.
8. THE memory scopes SHALL be local-only: user memory, workflow memory, and optional agent role memory. The design SHALL NOT include team or cloud memory.

### Requirement 8: Run Inspector And Local Audit

**User Story:** As a user debugging an Agent result, I want to inspect what happened, so that I can understand, retry, or report a problem.

#### Acceptance Criteria

1. WHEN a run is selected THE inspector SHALL show status, intent summary, context sources, model/gateway, tools, child tasks, permissions, artifacts, token/cost summary, and errors.
2. WHEN a permission is requested THE inspector SHALL show the risk reason and affected local scope.
3. WHEN a run fails THE inspector SHALL show the last event, stable error class, retryability, and available recovery actions.
4. WHEN the user exports a run report THE system SHALL redact secrets, raw environment values, auth headers, hidden prompts, asset bytes, and unnecessary absolute paths.
5. IF a user opens an old run THEN the inspector SHALL be reconstructed from persisted local records.

### Requirement 9: Reliability, Testing, And Non-Demo Quality

**User Story:** As a product owner, I want a verified local Agent platform, so that regressions like silent no-reply, stuck approvals, and malformed tool transcripts do not recur.

#### Acceptance Criteria

1. WHEN contracts are changed THE implementation SHALL add or update unit tests for reducers, projectors, permissions, tool transcripts, and sanitization gates.
2. WHEN UI behavior changes THE implementation SHALL add jsdom or browser tests for normal chat, permission resume, plan preview, failure blocks, and replay.
3. WHEN Agent loop behavior changes THE implementation SHALL test OpenAI-compatible native tool transcript closure.
4. WHEN child-agent behavior changes THE implementation SHALL test permission narrowing, draft isolation, task tree projection, and failed child reporting.
5. BEFORE completion THE implementation SHALL run relevant Bun/Vitest/typecheck verification and record the result.
6. FOR ALL new IPC channels THE docs/api-contracts SHALL be updated before handlers are added.

## Correctness Properties

### INV-1: Run Replay Determinism

*For any* persisted AgentRun, AgentRunEvent sequence, artifacts, and grants, THE run projector SHALL reconstruct the same visible ChatTurn/task/inspector state independent of whether events were received live or replayed after restart.

**Validates:** Requirements 1, 2, 8.

### INV-2: Tool Transcript Closure

*For any* assistant message containing N native tool calls, THE next model request SHALL include exactly one matching tool message for each tool call ID unless the run is still paused before resuming that assistant message.

**Validates:** Requirements 1.6, 6.6, 6.7.

### INV-3: Permission Monotonicity

*For any* child agent or resumed tool call, THE effective permissions SHALL be a subset of parent Agent policy, child/tool policy, and local grants.

**Validates:** Requirements 5, 6.

### INV-4: Canvas Mutation Safety

*For any* Agent-produced canvas mutation, THE persistent graph SHALL change only after sanitizer, connection matrix validation, apply gate, and local policy checks pass.

**Validates:** Requirement 4.

### INV-5: Visible Terminal State

*For any* Agent run, THE UI SHALL eventually project exactly one terminal or paused-visible state: completed, failed, aborted, max-turns, approval-required, or user-stopped. It SHALL NOT remain indefinitely busy without a visible reason.

**Validates:** Requirements 1, 2, 6, 8, 9.

### INV-6: Context Source Accountability

*For any* model invocation, THE system SHALL be able to list included, omitted, summarized, and redacted ContextPack sources without exposing secrets or raw binary assets.

**Validates:** Requirement 7.

### INV-7: Local-Only Scope

*For all* first-MVP data models and flows, THE system SHALL avoid multi-user workspace, organization roles, cloud sync, team memory, and centralized enterprise policy concepts.

**Validates:** Introduction, Requirements 6, 7, 8.
