# Knowledge And Context Contract

## Owner

- Primary: orchestrator-agent
- Supporting: tooling-agent, pm-agent
- Shared source: `shared/knowledge.ts`, `shared/assets.ts`, `shared/agents.ts`

## Scope

本契约覆盖 KnowledgeStore 的摄取（ingest）、分块（chunking）、检索、删除、
重建、引用元数据、ContextBuilder 优先级规则、作用域化的 Context Pack、
对话摘要，以及本地优先项目知识的 RAG 行为。

详细实现规格：

- `specs/conversation-context-engine/requirements.md`
- `specs/conversation-context-engine/design.md`
- `specs/conversation-context-engine/tasks.md`

Non-goals（非目标）：

- 不用隐式隐藏记忆替代检索。
- 不从活跃项目/工作区/用户已批准的作用域之外进行检索。
- 不在记忆/摘要中持久化 API key、服务商密钥或隐藏 prompt。

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

Internal service request（内部服务请求）：

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

Rules（规则）：

- 检索必须（SHALL）遵守作用域和删除状态。
- 进入 context 的检索片段必须（SHALL）包含用于引用/追溯的来源元数据。
- Context 优先级是确定性的：policy、用户请求、画布选区、
  文件/资产、检索到的片段、消息、摘要。
- `canvas.chatSend` 必须（SHALL）保持只返回票据；完整的 context 构建发生在
  `agent.run` job handler 中。
- 当前用户请求必须（SHALL）始终包含在成功的 Context Pack 中。
- 历史中包含的 plan 和 job/tool 结果默认必须（SHALL）被摘要化，而不是作为
  无限制的原始 JSON 或二进制 payload 粘贴进去。
- Context Pack 的持久化必须（SHALL）存储来源引用、token 估算、省略项、
  警告，以及红化类别。
- 对话压缩必须（SHALL）保留一个边界，使摘要与完整的旧消息不会在未来的
  Context Pack 中重复出现。

## Errors

| Error class | Meaning |
| :--- | :--- |
| `knowledge_source_missing` | 源文件、资产或笔记无法读取。 |
| `knowledge_scope_denied` | 请求的作用域超出已批准的边界。 |
| `knowledge_index_failed` | 分块或索引失败。 |
| `knowledge_retrieval_failed` | 检索后端安全失败（未崩溃）。 |
| `context_budget_exceeded` | Context 无法容纳必需的优先级条目。 |
| `context_scope_denied` | 请求的 context 来源超出 agent/项目作用域。 |
| `context_pack_not_found` | 请求的 Context Pack 不存在。 |
| `context_compaction_failed` | 无法安全地生成对话摘要。 |

## Permissions

- 摄取需要对所选文件、资产或项目来源的访问权限。
- 检索仅限于活跃项目/工作区/用户已批准的作用域。
- ContextBuilder 只能包含 agent context policy 所允许的来源。
- 已删除或移除的文档必须（SHALL）从未来的检索中排除。
- Context 查看是只读的，且必须对敏感片段做红化处理。
- `context.compact` 在确定性/本地场景下是只读的；由服务商支持的压缩必须作为
  异步 job 运行，且可能需要服务商消费权限。

## Tests

- Unit：ContextBuilder 优先级排序的确定性。
- Integration：删除/重建后，检索会排除已删除的文档。
- Integration：项目/用户作用域限制被正确执行。
- Trace：片段包含引用元数据。
- Redaction：摘要/记忆中排除密钥、认证头，以及隐藏 prompt。
- Integration：`agent.run` 在 planner/模型执行前构建 Context Pack。
- Integration：长对话历史被压缩为摘要，且不重复旧的完整消息。
- UI/human review：Context Pack 查看界面展示来源、警告、引用、
  省略项，以及红化计数。
