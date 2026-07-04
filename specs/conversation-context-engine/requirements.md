# Requirements - Conversation Context Engine

## Introduction

ComicCanvas currently persists chat messages and defines Context Pack contracts,
but the Agent runtime still plans from the current user message only. This spec
turns conversation context into a first-class, local-first runtime capability
inspired by cc-haha/Claude Code patterns:

1. session/workflow chat history,
2. scoped canvas and asset context,
3. explicit knowledge retrieval,
4. deterministic context budgeting,
5. conversation summarization/compaction,
6. replayable Context Packs attached to Agent runs.

This is not LTM. It is an application-owned, workflow-scoped context system
stored in SQLite, visible to debugging/review surfaces, redacted for secrets,
and assembled only from explicit scopes.

## Scope

- `shared/knowledge.ts`, `shared/agents.ts`, `shared/ipc.ts`
- `desktop/src/main/agent/**`
- `desktop/src/main/knowledge/**`
- `desktop/src/main/db/repositories/chat-message.repo.ts`
- `desktop/src/main/db/repositories/knowledge.repo.ts`
- `desktop/src/main/db/schema.ts`
- `desktop/src/main/ipc/**`
- renderer chat/canvas context request surfaces
- `docs/api-contracts/knowledge-context.md`

Reference-only comparison:

- `cc-haha-main/src/commands/compact/compact.ts`
- `cc-haha-main/src/history.ts`
- `cc-haha-main/src/assistant/sessionHistory.ts`
- `cc-haha-main/cc-haha-agent-context.html`

## Non-Goals

- Do not reintroduce project LTM or hidden long-term memory.
- Do not read arbitrary files or assets without explicit project/user scope.
- Do not copy cc-haha source code; re-implement concepts in ComicCanvas terms.
- Do not build embedding infrastructure before lexical retrieval and source
  citations work.
- Do not include API keys, provider secrets, auth headers, raw hidden prompts,
  or full unbounded transcripts in Context Packs.
- Do not allow context building to block `canvas.chatSend`; Agent runs remain
  job-backed and asynchronous.

## Glossary

- **Conversation Context Engine**: The service set that builds bounded context
  for Agent runs from chat, canvas, assets, knowledge, summaries, and policies.
- **Context Pack**: A persisted trace of selected context sources, redactions,
  token estimates, and rendered planner/model input.
- **Recent Messages**: Workflow-scoped chat turns included verbatim until the
  token budget requires summarization.
- **Conversation Summary**: Redacted summary of older chat/tool/result history
  used after compaction.
- **Canvas Summary**: Compact representation of active workflow graph, selected
  nodes, selected assets, and relevant graph warnings.
- **Knowledge Chunk**: Retrieved local file/note/asset/document text with
  citation metadata.
- **Attachment**: A dynamic context item generated during or after a turn, such
  as run status, diagnostics, changed assets, or tool results. First version may
  store these as typed `ContextSource` entries.

## Current State Summary

ComicCanvas already has:

- `chat_messages` table and repository methods for create/get/list/updatePlan.
- `context_packs` table in schema.
- `ContextBuildInput`, `ContextPack`, `ContextSource`, and knowledge contracts.
- Agent context policy flags for canvas graph, selected assets, recent messages,
  and knowledge.
- `canvas.chatSend` and `canvas.chatGetPlan` IPC.

Missing:

- `ContextBuilderService` implementation.
- `KnowledgeRepository` ingest/retrieve/delete/rebuild implementation.
- Orchestrator integration that passes context to planners.
- Recent message selection and summary/compaction.
- Canvas/asset summary builders.
- Persisted Context Pack source refs, token estimates, redaction traces.
- UI/debug surface to inspect what context was used.

## Requirement 1: Context-Aware Agent Runs

**User Story:** As a creator, I want the Agent to understand the current
workflow conversation and canvas state, so that follow-up prompts can refer to
previous turns and existing nodes.

### Acceptance Criteria

1. WHEN `canvas.chatSend` starts an Agent job THE system SHALL persist the user
   message and enqueue the job without synchronously building full context.
2. WHEN the `agent.run` job executes THE Orchestrator SHALL build a Context Pack
   before calling the planner/model.
3. WHEN the planner receives input THE input SHALL include the current message,
   agent ID, workflow ID when available, and a bounded Context Pack.
4. IF no workflow ID is available THEN THE ContextBuilder SHALL use a safe
   default scope and omit workflow-only sources.
5. WHEN the Agent produces a plan THE system SHALL persist the plan and the
   Context Pack ID for debug/replay correlation.

## Requirement 2: Recent Conversation History

**User Story:** As a creator, I want follow-up messages such as "make the last
scene darker" to work, so that the Agent can use prior chat turns.

### Acceptance Criteria

1. WHEN `includeRecentMessages` is enabled THE ContextBuilder SHALL load recent
   `chat_messages` for the active workflow in chronological order.
2. WHEN message history exceeds the budget THE ContextBuilder SHALL preserve the
   current user message and most recent turns before older turns.
3. WHEN assistant messages contain CanvasPlan JSON THE ContextBuilder SHALL
   include a compact plan summary rather than raw full plan JSON by default.
4. WHEN tool or job results are included THE ContextBuilder SHALL include
   terminal state summaries and source refs, not unbounded binary payloads.
5. IF a chat message references deleted assets or unavailable nodes THEN THE
   ContextBuilder SHALL include a warning source rather than failing the run.

## Requirement 3: Canvas And Asset Context

**User Story:** As a creator, I want the Agent to understand selected nodes,
assets, and the graph, so that it can modify the workflow safely.

### Acceptance Criteria

1. WHEN `includeCanvasGraph` is enabled THE ContextBuilder SHALL include a
   Canvas Summary with graph counts, node types, edge types, selected nodes, and
   validation warnings.
2. WHEN selected node IDs are provided THE ContextBuilder SHALL prioritize those
   nodes over non-selected graph nodes.
3. WHEN `includeSelectedAssets` is enabled THE ContextBuilder SHALL include
   selected asset metadata, categories/tags, media type, dimensions/duration,
   and safe renderer URL references where allowed.
4. IF the graph is too large THEN THE ContextBuilder SHALL summarize the graph
   instead of serializing all node data.
5. FOR ALL graph context THE system SHALL use shared node/edge contracts and
   SHALL NOT invent node types outside the current CanvasPlan whitelist.

## Requirement 4: Knowledge Retrieval

**User Story:** As a creator, I want Agents to use project files, notes, and
approved documents as grounded knowledge, so that outputs cite local sources.

### Acceptance Criteria

1. WHEN `includeKnowledge` is enabled THE ContextBuilder SHALL call
   `KnowledgeRepository.retrieve` with the active scope and current query.
2. WHEN first shipped THE KnowledgeRepository MAY use lexical retrieval, but its
   interface SHALL preserve retrieval mode support for future embeddings.
3. WHEN chunks enter a Context Pack THE system SHALL persist citation metadata
   including source ref, title/range where available, score, and document ID.
4. IF a document is deleted or outside scope THEN retrieval SHALL exclude its
   chunks.
5. IF retrieval fails safely THEN THE Agent run SHALL continue with a context
   warning unless required priority sources cannot fit.

## Requirement 5: Context Budgeting

**User Story:** As an operator, I want context assembly to be deterministic, so
that Agent behavior can be debugged and tested.

### Acceptance Criteria

1. WHEN building context THE ContextBuilder SHALL apply deterministic priority:
   policy/instructions, current user request, selected canvas/assets, retrieved
   knowledge, recent messages, summaries, optional attachments.
2. WHEN source text exceeds token budget THE ContextBuilder SHALL trim or
   summarize lower-priority sources before higher-priority sources.
3. WHEN a required high-priority source cannot fit THE ContextBuilder SHALL
   fail with `context_budget_exceeded`.
4. FOR ALL Context Packs THE system SHALL persist source ordering, approximate
   token counts, omitted source refs, and redactions.
5. WHEN token estimates are approximate THE estimator SHALL be deterministic for
   tests and SHALL err on the conservative side.

## Requirement 6: Conversation Compaction

**User Story:** As a creator, I want long conversations to keep their useful
state without hitting model context limits.

### Acceptance Criteria

1. WHEN recent messages exceed configured thresholds THE system SHALL summarize
   older messages into a Conversation Summary.
2. WHEN compaction runs THE summary SHALL include user intent, key decisions,
   created/changed nodes, assets referenced, unresolved tasks, errors/fixes,
   and next-step hints.
3. WHEN compaction completes THE system SHALL mark summarized message boundaries
   so future Context Packs do not duplicate full history and summary text.
4. IF compaction fails THEN THE system SHALL fall back to recent-message
   truncation and record a warning.
5. FOR ALL summaries THE system SHALL redact secrets and hidden prompts before
   persistence.

## Requirement 7: Context Pack Persistence And Inspection

**User Story:** As a developer or reviewer, I want to inspect what context an
Agent saw, so that bad plans can be traced.

### Acceptance Criteria

1. WHEN a Context Pack is built THE system SHALL persist it in `context_packs`
   with the Agent run ID where available.
2. WHEN a Context Pack is inspected THE UI or debug API SHALL show source types,
   refs, priority, token estimates, redactions, warnings, and rendered context
   excerpts.
3. WHEN a Context Pack contains knowledge chunks THE inspection surface SHALL
   show citations.
4. WHEN secrets are redacted THE inspection surface SHALL show redaction counts
   and classes, not secret values.
5. IF a Context Pack references a missing source THEN inspection SHALL show the
   stale source state without crashing.

## Requirement 8: IPC And Tool Surface

**User Story:** As an Agent/tool developer, I want context building and retrieval
exposed through typed contracts, so that manual UI and Agents share behavior.

### Acceptance Criteria

1. WHEN new context or knowledge IPC channels are added THE channels SHALL be
   registered in `shared/ipc.ts` and documented in
   `docs/api-contracts/knowledge-context.md`.
2. WHEN a context-related tool is exposed THE descriptor SHALL declare read
   permissions and scope requirements.
3. WHEN `context.build` is called manually THE output SHALL match the same
   ContextBuilder path used by `agent.run`.
4. WHEN `knowledge.retrieve` is called THE result SHALL be scope-limited and
   citable.
5. IF a future Agent calls context tools THE call SHALL be read-only unless it
   explicitly ingests/deletes/rebuilds knowledge.

## Requirement 9: Security, Redaction, And Scope Isolation

**User Story:** As an operator, I want context to be safe by default, so that
Agents cannot leak secrets or unrelated project data.

### Acceptance Criteria

1. FOR ALL context sources THE ContextBuilder SHALL enforce agent context policy
   and active project/workflow scope.
2. FOR ALL persisted summaries and Context Packs THE system SHALL redact API
   keys, auth headers, provider secrets, hidden prompts, and absolute local
   paths when not needed for trace.
3. WHEN scope denies a source THE ContextBuilder SHALL omit it and record a
   source warning.
4. IF user-approved source IDs are empty THEN knowledge retrieval SHALL return
   no user documents unless the source is explicitly built-in/system scoped.
5. WHEN debug logs mention context THE logs SHALL include IDs/counts/classes,
   not raw sensitive content.

## Requirement 10: cc-haha-Inspired Runtime Behavior

**User Story:** As a product engineer, I want to adapt proven cc-haha context
patterns, so that our Agent runtime scales to long sessions.

### Acceptance Criteria

1. WHEN the app starts or an Agent run begins THE system MAY prefetch stable
   context such as agent policy and workflow metadata without blocking UI.
2. WHEN a turn is running THE system MAY prefetch retrieval candidates in
   parallel with other job work, but SHALL tolerate missed prefetch deadlines.
3. WHEN a conversation is long THE system SHALL compact before planner/model
   calls rather than waiting for provider prompt-too-long errors.
4. WHEN context is compacted THE system SHALL preserve a visible boundary or
   trace marker for resume/debug behavior.
5. WHEN child/sub-agents are added THE child run SHALL receive an explicit
   Context Pack derived from parent policy and child policy, not hidden shared
   memory.

## Correctness Properties

### INV-1: Explicit Scope Only

For any Context Pack, every source SHALL be traceable to active workflow scope,
agent policy, selected canvas/assets, recent chat, or approved knowledge source.

### INV-2: Current Request Preservation

For any successful context build, the current user request SHALL be present and
unmodified except for safe redaction of secrets.

### INV-3: Deterministic Budgeting

For identical inputs, scope, repository state, and token budget, ContextBuilder
SHALL produce the same source ordering, omissions, and rendered context.

### INV-4: No Secret Persistence

For any Context Pack or Conversation Summary, persisted content SHALL NOT contain
provider keys, auth headers, raw hidden prompts, or unredacted secret patterns.

### INV-5: Retrieval Isolation

For any knowledge retrieval, deleted, out-of-scope, or unapproved documents
SHALL NOT appear in retrieved chunks or Context Pack source refs.

### INV-6: Agent Replayability

For any completed Agent run, stored run metadata and Context Pack refs SHALL be
sufficient to inspect the context sources used for that run.
