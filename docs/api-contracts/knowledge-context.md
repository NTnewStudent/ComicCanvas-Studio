# Knowledge And Context Contract

## Owner

- Primary: orchestrator-agent
- Supporting: tooling-agent, pm-agent
- Shared source: `shared/knowledge.ts`, `shared/assets.ts`, `shared/agents.ts`

## Scope

This contract covers KnowledgeStore ingest, chunking, retrieval, deletion, rebuild, citation metadata, ContextBuilder priority rules, scoped Context Packs, and RAG behavior for local-first project knowledge.

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
  userMessage: string
  scope: KnowledgeScope
  selectedNodeIds: string[]
  selectedAssetIds: string[]
  tokenBudget: number
}
```

Response:

```ts
interface ContextPack {
  id: string
  agentId: string
  sources: ContextSource[]
  redactions: string[]
  createdAt: number
}
```

Rules:

- Retrieval SHALL respect scope and deletion state.
- Retrieved chunks entering context SHALL include source metadata for citation/trace.
- Context priority is deterministic: policy, user request, canvas selection, files/assets, retrieved chunks, messages, summaries.

## Errors

| Error class | Meaning |
| :--- | :--- |
| `knowledge_source_missing` | Source file, asset, or note cannot be read. |
| `knowledge_scope_denied` | Requested scope is outside approved boundary. |
| `knowledge_index_failed` | Chunking or indexing failed. |
| `knowledge_retrieval_failed` | Retrieval backend failed safely. |
| `context_budget_exceeded` | Context cannot fit required priority items. |

## Permissions

- Ingest requires access to the selected file, asset, or project source.
- Retrieval is limited to active project/workspace/user-approved scopes.
- ContextBuilder can include only sources allowed by agent context policy.
- Deleted or removed documents SHALL be excluded from future retrieval.

## Tests

- Unit: deterministic ContextBuilder priority ordering.
- Integration: retrieval excludes deleted documents after delete/rebuild.
- Integration: project/user scope restrictions are enforced.
- Trace: chunks include citation metadata.
- Redaction: summaries/memories exclude keys, auth headers, and hidden prompts.
