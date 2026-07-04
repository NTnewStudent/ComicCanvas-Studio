# Knowledge And Context Contract

## Owner

- Primary: orchestrator-agent
- Supporting: tooling-agent, pm-agent
- Shared source: `shared/knowledge.ts`, `shared/assets.ts`, `shared/agents.ts`

## Scope

This contract covers KnowledgeStore ingest, chunking, retrieval, deletion,
rebuild, citation metadata, ContextBuilder priority rules, scoped Context Packs,
conversation summaries, and RAG behavior for local-first project knowledge.

Detailed implementation spec:

- `specs/conversation-context-engine/requirements.md`
- `specs/conversation-context-engine/design.md`
- `specs/conversation-context-engine/tasks.md`

Non-goals:

- No implicit hidden memory as a substitute for retrieval.
- No retrieval from outside active project/workspace/user-approved scopes.
- No persistence of API keys, provider secrets, or hidden prompts in memories/summaries.

## Request/Response Contracts

### `knowledge.ingest`

Request:

```ts
interface KnowledgeIngestRequest {
  sourceType: 'file' | 'asset' | 'note' | 'document'
  sourceRef: string
  scope: KnowledgeScope
  metadata?: Record<string, unknown>
}
```

Response:

```ts
interface KnowledgeDocument {
  id: string
  sourceType: string
  sourceRef: string
  scope: KnowledgeScope
  status: 'indexed' | 'pending' | 'failed' | 'deleted'
  createdAt: number
  updatedAt: number
}
```

### `knowledge.retrieve`

Request:

```ts
interface KnowledgeQuery {
  query: string
  scope: KnowledgeScope
  limit: number
  retrievalMode: 'lexical' | 'embedding' | 'hybrid'
}
```

Response:

```ts
interface KnowledgeRetrieveResponse {
  chunks: KnowledgeChunk[]
}
```

### `context.build`

Internal service request:

```ts
interface ContextBuildInput {
  agentId: string
  runId?: string
  messageId?: string
  workflowId?: string
  userMessage: string
  scope: KnowledgeScope
  selectedNodeIds: string[]
  selectedAssetIds: string[]
  graphSnapshot?: unknown
  tokenBudget: number
  policyOverride?: Partial<AgentContextPolicy>
}
```

Response:

```ts
interface ContextPack {
  id: string
  agentId: string
  runId?: string
  workflowId?: string
  sources: ContextSource[]
  renderedContext: string
  tokenEstimate: number
  omittedSources: { kind: string; refId: string; reason: string }[]
  warnings: { code: string; message: string; refId?: string }[]
  redactions: string[]
  createdAt: number
}
```

### `context.getPack`

Request:

```ts
interface ContextGetPackRequest {
  contextPackId: string
}
```

Response:

```ts
interface ContextPackInspection {
  pack: ContextPack
  sourceExcerpts: Array<{
    kind: string
    refId: string
    priority: number
    tokenEstimate: number
    excerpt?: string
    citation?: KnowledgeChunk['citation'] & { score?: number }
  }>
}
```

### `context.compact`

Request:

```ts
interface ContextCompactRequest {
  workflowId: string
  fromMessageId?: string
  toMessageId?: string
  mode: 'auto' | 'manual'
}
```

Response:

```ts
interface ContextCompactResponse {
  jobId?: string
  summaryId?: string
  status: 'pending' | 'completed'
}
```

Rules:

- Retrieval SHALL respect scope and deletion state.
- Retrieved chunks entering context SHALL include source metadata for citation/trace.
- Context priority is deterministic: policy, user request, canvas selection,
  files/assets, retrieved chunks, messages, summaries.
- `canvas.chatSend` SHALL remain ticket-only; full context building happens in
  the `agent.run` job handler.
- Current user request SHALL always be included in successful Context Packs.
- Plans and job/tool results included from history SHALL be summarized by
  default, not pasted as unbounded raw JSON or binary payloads.
- Context Pack persistence SHALL store source refs, token estimates, omissions,
  warnings, and redaction classes.
- Conversation compaction SHALL preserve a boundary so summaries and full old
  messages are not duplicated in future Context Packs.

## Errors

| Error class | Meaning |
| :--- | :--- |
| `knowledge_source_missing` | Source file, asset, or note cannot be read. |
| `knowledge_scope_denied` | Requested scope is outside approved boundary. |
| `knowledge_index_failed` | Chunking or indexing failed. |
| `knowledge_retrieval_failed` | Retrieval backend failed safely. |
| `context_budget_exceeded` | Context cannot fit required priority items. |
| `context_scope_denied` | Requested context source is outside agent/project scope. |
| `context_pack_not_found` | Requested Context Pack does not exist. |
| `context_compaction_failed` | Conversation summary could not be produced safely. |

## Permissions

- Ingest requires access to the selected file, asset, or project source.
- Retrieval is limited to active project/workspace/user-approved scopes.
- ContextBuilder can include only sources allowed by agent context policy.
- Deleted or removed documents SHALL be excluded from future retrieval.
- Context inspection is read-only and must redact sensitive excerpts.
- `context.compact` is read-only when deterministic/local; provider-backed
  compaction must run as an async job and may require provider spend permission.

## Tests

- Unit: deterministic ContextBuilder priority ordering.
- Integration: retrieval excludes deleted documents after delete/rebuild.
- Integration: project/user scope restrictions are enforced.
- Trace: chunks include citation metadata.
- Redaction: summaries/memories exclude keys, auth headers, and hidden prompts.
- Integration: `agent.run` builds a Context Pack before planner/model execution.
- Integration: long histories compact into summaries without duplicating old
  full messages.
- UI/human review: Context Pack inspection shows sources, warnings, citations,
  omissions, and redaction counts.
