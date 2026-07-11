# Agents Contract

## Owner

- Primary: orchestrator-agent
- Supporting: tooling-agent, pm-agent
- Shared source: `shared/agents.ts`, `shared/tools.ts`, `shared/skills.ts`, `shared/knowledge.ts`

## Scope

本契约涵盖 AgentRegistry、内置 agent、自定义 agent、agent 运行、上下文策略、工具/skill 权限、CanvasPlan 输出、子 agent spawn、进度事件，以及 trace 元数据。

Non-goals：

- 不允许绕过工具的隐藏写入路径。
- 不允许子 agent 权限扩张。
- 不允许可执行的 CanvasPlan 输出。
- 子 agent 草稿工具在父级受控合并之前，不允许写入持久化图。

## Request/Response Contracts

### `agent.list`

Request:

```ts
interface AgentListRequest {
  includeDisabled?: boolean
}
```

Response:

```ts
type AgentListResponse = AgentDefinition[]
```

### `agent.save`

Request:

```ts
type AgentSaveRequest = AgentDefinition
```

Response:

```ts
type AgentSaveResponse = AgentDefinition
```

Rules:

- 保存的自定义 agent SHALL 以 `source: 'user'` 持久化。
- 内置 agent ID SHALL 可通过保存一条 `source: 'builtin'` 的持久化覆盖记录来编辑；当不存在覆盖记录时，代码定义的内置默认值仍作为兜底。
- `name`、`instructions`、`maxTurns`、工具策略、skill 策略、网关策略、上下文策略、触发策略与权限策略 SHALL 在持久化前完成校验。

### `agent.delete`

Request:

```ts
interface AgentDeleteRequest {
  agentId: string
}
```

Response:

```ts
interface AgentDeleteResponse {
  agentId: string
  deleted: true
}
```

### `agent.run`

Request:

```ts
interface AgentRunRequest {
  agentId: string
  message: string
  contextPolicyOverride?: Partial<AgentContextPolicy>
}
```

Response:

```ts
interface AgentRunTicket {
  runId: string
  jobId: string
  status: 'pending'
}
```

终态响应：

```ts
type AgentResponse =
  | { type: 'answer'; summary: string; text: string; dropped: string[] }
  | { type: 'clarification'; summary: string; question: string; missing: string[]; dropped: string[] }
  | { type: 'canvasPlan'; plan: CanvasPlan }
```

### Agent Run Spine

`AgentRunEvent` 是本地 Agent 运行的持久化事实源。现有 live IPC 事件仍作为投递通道；重放与 `agent.getRun` SHALL 从持久化的 `agent_runs`、`agent_run_events`、`agent_artifacts`、`agent_permission_grants` 与 `child_agent_tasks` 重建。

```ts
type AgentRunEventType = (typeof AGENT_RUN_EVENT_TYPES)[number]

type AgentRunEventRecord<Type extends AgentRunEventType = AgentRunEventType> = {
  [EventType in Type]: {
    id: string
    runId: string
    sequence: number
    type: EventType
    payload: AgentRunEventPayloadMap[EventType]
    createdAt: number
  }
}[Type]

interface LocalPermissionGrant {
  id: string
  toolId: string
  permissionKinds: ToolPermissionKind[]
  workflowId: string
  scope: 'once' | 'run' | 'session'
  runId?: string
  expiresAt?: number
  approvedByLabel: string
  createdAt: number
}
```

`AgentRunEventRecord` 与 live IPC envelope 是不同契约：

- durable record 具有持久化 `id`、每个 Run 单调递增的 `sequence`、`createdAt`，以及由 `type` 关联的 `payload`；它写入 `agent_run_events` 并用于重放。该 mapped type 对每个 `EventType` 分别构造 record，再以 `[Type]` 索引为 discriminated union，因此收窄 `type` 会同步收窄对应的 `payload`。
- live IPC envelope 使用现有 `agent.delta`、`agent.toolStarted`、`agent.toolCompleted`、`agent.permissionRequired`、`agent.responseReady`、`canvas.planReady` 与 `job.progress` 通道；它可包含投递所需的 `runId` / `messageId`，但不等同于 durable record，也不保证带有 durable `id` 或 `sequence`。
- live IPC 与 durable event 可以表达同一生命周期事实，但消费者 SHALL NOT 将 IPC 到达顺序当作持久化重放顺序。

#### Durable Event Payload Vocabulary

唯一事件名称真源为 `shared/agent-run-events.ts` 的 `AGENT_RUN_EVENT_TYPES`，当前固定为 15 种。`AgentRunEventPayloadMap` 定义每个 discriminator 的 payload，`AgentRunEventRecord` 的 mapped discriminated union SHALL 保持两者的编译期关联。

| Event type | Durable payload |
| :--- | :--- |
| `run.created` | `{ threadId, workflowId, agentId, trigger, messageId, policyProfileId, jobId?, gatewayId?, modelId? }` |
| `run.started` | `{ status: 'running', jobId?, resumedFromApproval? }` |
| `intent.analyzed` | `{ kind, summary, requirements, missing, localCapabilities, recommendedAgentId, executionMode, complexity }` |
| `context.built` | `{ contextPackId, tokenEstimate, messagesIncluded, sourceCount, redactionCount }` |
| `progress` | `{ message, progress }` |
| `model.delta` | `{ delta }` |
| `tool.started` | `{ callId, toolId, inputSummary? }` |
| `tool.completed` | `{ callId, toolId, invocationId?, status, summary }` |
| `permission.requested` | `{ callId, toolId, reason, requiredPermissions, inputSummary? }` |
| `permission.resolved` | `{ callId, decision, approvedByLabel?, deniedByLabel?, scope?, requestedScope?, phase? }` |
| `artifact.created` | `{ artifactId, kind, title, summary }` |
| `plan.ready` | `{ messageId, planId }` |
| `response.ready` | `{ messageId, response }`, where `response` is `answer` or `clarification`, never `canvasPlan` |
| `run.completed` | `{ status: 'completed' }` |
| `run.failed` | `{ errorClass, message, retryable, checkpoint? }` |

#### Durable Event Redaction

- `AgentRunSpine.appendEvent` SHALL recursively sanitize every durable event payload with `redactSensitiveData` immediately before calling `AgentRunEventRepository.append`. SQLite SHALL receive only that sanitized clone.
- `run.created` SHALL pass through the same append boundary while retaining the timestamp captured for the corresponding run record.
- `artifact.created.title` and `artifact.created.summary` SHALL be sanitized by the same event boundary.
- Durable event payloads SHALL contain bounded UI/audit metadata only. They SHALL NOT contain raw credentials or authorization headers, hidden system/provider prompts, unnecessary absolute local paths, raw provider request/response dumps, full conversation transcripts, raw tool arguments/results, binary/base64 asset bodies, or unbounded file contents.
- Redaction is defense in depth, not permission to put prohibited raw data into a typed payload. Producers SHALL emit IDs, counters, decisions, and bounded summaries that match `AgentRunEventPayloadMap`.
- `AgentRunSpine.saveArtifact` persists `agent_artifacts.payload_json` as supplied by the caller; it does not currently apply `redactSensitiveData` to the artifact record. Callers SHALL therefore keep artifact payloads free of secrets, hidden prompts, unnecessary absolute paths, and raw binary data. Only the derived `artifact.created` event metadata is guaranteed to pass through the durable event redaction boundary.

Rules:

- `AgentRunEvent` rows SHALL be append-only and strictly ordered by `(run_id, sequence)`.
- `RunProjector` SHALL be pure and deterministic for live events and persisted replay.
- `agent.getRun` MAY include `snapshot` and `projection` fields. Older consumers SHALL continue using `runId`, `status`, and `trace`.
- 每个 Run 的终态 assistant 回合 SHALL 从完整、按序的持久化 Run 快照投影，并以 `${messageId}-assistant` 幂等 upsert；重放、批准续跑、拒绝或失败 SHALL NOT 创建重复 assistant 行。
- `completed`、`failed`、`aborted` 与 `max_turns_exceeded` 终态 SHALL 持久化共享 `ChatBlock[]`。包含 error 块的历史回合恢复后 SHALL 保持 `status: 'failed'`。
- 启动恢复 SHALL 只重放尚未跨过副作用边界的初始 Agent Job，或停留在 `permission.resolved` 且仍持有暂停上下文的批准续跑 Job。已开始执行、缺少 Run、或检查点不安全的 Job SHALL fail closed，不得盲目重放。
- 本地专业版不包含 organization/team/cloud policy server、team memory、cloud sync、multi-user workspace 或 centralized admin policy。

Events:

```ts
interface AgentResponseReadyEvent {
  runId: string
  messageId: string
  response: Exclude<AgentResponse, { type: 'canvasPlan' }>
}

interface AgentToolStartedEvent {
  runId: string
  messageId: string
  callId: string
  toolId: string
  inputSummary: string
}

interface AgentToolCompletedEvent {
  runId: string
  messageId: string
  callId: string
  toolId: string
  invocationId: string
  status: 'completed' | 'failed' | 'denied'
  summary: string
}

interface AgentPermissionRequiredEvent {
  runId: string
  messageId: string
  callId: string
  toolId: string
  reason: string
  requiredPermissions: ToolPermission[]
}

interface AgentPermissionResolvedPayload {
  callId: string
  decision: 'approved' | 'denied'
  phase?: 'queued' | 'executing'
  scope?: 'once' | 'run' | 'session'
}
```

Rules:

- `agent.toolStarted` SHALL 在 ToolRuntime 执行一次 agent 发起的工具调用之前立即发出。
- `agent.toolCompleted` SHALL 在该调用从 ToolRuntime 返回后发出，包括被拒绝与失败的结果。
- `agent.permissionRequired` SHALL 在工具返回 `decision: 'ask'` 且主循环暂停等待 `agent.approveTool` 或 `agent.denyTool` 时发出。
- 工具生命周期事件 SHALL 包含 `runId` 与 `messageId`，以便渲染层时间线能将其与聊天轮次关联。

- `answer` 用于问候语、普通对话、编码/帮助类问题、时间/日期问题，以及不需要修改图的常识性回答。
- `clarification` 用于低信息量请求，以及 Agent 在选择工具或创建节点前需要更多信息的含糊任务。
- `canvasPlan` 专用于显式的画布图/节点/工作流任务，并通过 canvas plan 路径交付。
- 非 `canvasPlan` 的终态响应 SHALL 发出 `agent.responseReady`，且 SHALL NOT 为 `canvas.chatGetPlan` 存储 CanvasPlan。

### 聊天消息块契约（`shared/chat-blocks.ts`）

渲染层与主进程共享的消息块唯一真源：

```ts
type ChatBlock =
  | { kind: 'text'; markdown: string; streaming: boolean }
  | { kind: 'thinking'; lines: string[] }
  | { kind: 'toolCall'; callId: string; toolId: string;
      status: 'running' | 'completed' | 'failed' | 'denied';
      inputSummary?: string; resultSummary?: string; isSubAgent: boolean }
  | { kind: 'plan'; planId: string }
  | { kind: 'permission'; callId: string; toolId: string; reason: string;
      requiredPermissions?: ToolPermission[]; resolved: boolean;
      decision?: 'approved' | 'denied'; scope?: 'once' | 'run' | 'session' }
  | { kind: 'error'; errorClass: string; message: string; retryable: boolean }
  | { kind: 'usage'; summary: string }

interface ChatTurn {
  id: string
  role: 'user' | 'assistant'
  blocks: ChatBlock[]
  runId?: string
  messageId?: string
  status: 'pending' | 'streaming' | 'completed' | 'failed'
  createdAt: number
}
```

Rules:

- 块组装 SHALL 只通过共享纯 reducer `applyAgentEvent(turn, event)` 完成；渲染层实时组装与主进程终态持久化 SHALL 使用同一实现。
- 不新增流式块 IPC 通道：渲染层继续消费现有 `agent.delta` / `agent.toolStarted` / `agent.toolCompleted` / `agent.permissionRequired` / `agent.responseReady` / `canvas.planReady` / `job.progress` 事件。
- assistant 终态回合 SHALL 序列化为 `chat_messages.blocks_json`；恢复时损坏或缺失的块 JSON SHALL 按 content/planJson 降级合成，不得让历史恢复失败。
- 权限块 SHALL 通过 `decision` 区分批准与拒绝，不得仅用 `resolved: true` 将拒绝误显示为已批准。
- 主进程 SHALL 从完整 Run 投影持久化终态块，而不是只持久化最后一个响应事件，以保留批准续跑前的 tool、permission 与 thinking 历史。

### `chat.history`

Request:

```ts
interface ChatHistoryRequest {
  workflowId: string
}
```

Response:

```ts
type ChatHistoryResponse = ChatTurn[]
```

Rules:

- 按 `createdAt` 升序返回该 workflow 的会话回合；user 回合由 content 合成单 text 块。
- assistant 行 SHALL 优先从 `blocks_json` 恢复；包含 error 块时 SHALL 恢复为 failed 回合，而不是 completed 回合。
- 响应 SHALL NOT 包含资产字节、绝对路径或密钥。
- 「清空对话」是纯渲染层行为，SHALL NOT 删除持久化历史。

### `agent.approveTool`

Request:

```ts
interface AgentToolApprovalInput {
  runId: string
  callId: string
  approvedBy: string
  scope?: 'once' | 'run' | 'session'
}
```

Response:

```ts
type AgentToolApprovalResponse = AgentRunTicket
```

Rules:

- 未提供 `scope` 时，非破坏性权限默认按当前应用 `session` 复用，避免同一工具在每次对话中重复申请。
- `once` 仅批准当前保留的精确调用；`run` 仅在同一 run 内复用；`session` 可在当前应用会话、同一 workflow 内跨 run 复用。
- 包含 `destructive` 的权限请求 SHALL 强制降级为 `once`，不得通过 run/session grant 绕过后续确认。
- session grant SHALL 持久化用于本地审计，但只有其 grant ID 被当前 `AgentPermissionService` 实例持有时才可复用；应用重启或服务实例重建后 SHALL NOT 通过时间戳推断其仍然有效。
- 批准入队与实际执行之间 SHALL 再次按当前 Agent、工具与权限策略校验；策略变化 SHALL 以 `agent_approval_policy_changed` 终止，且不得执行旧批准。
- 批准请求或持久化失败时，Renderer SHALL 保留原 permission 块与 pending Run，使用户可以重试批准或改为拒绝。

### `agent.denyTool`

Request:

```ts
interface AgentToolDenialInput {
  runId: string
  callId: string
  deniedBy: string
}
```

Response:

```ts
interface AgentToolDenialResult {
  runId: string
  status: 'aborted'
  errorClass: 'agent_tool_denied'
}
```

Persistence failure:

```ts
interface AgentToolDenialError {
  errorClass: string
  message: string
  retryable: boolean
}
```

Rules:

- `runId`、`callId` 与 `deniedBy` SHALL 在 IPC 边界 trim，且每项 SHALL 为 1 至 256 个字符。
- 拒绝 SHALL NOT 执行工具或创建续跑 Job。
- 主进程 SHALL 在同一个 SQLite 事务中将等待中的 Run 持久化为 `aborted`，清除暂停上下文与待批准调用，并追加 `permission.resolved` 和 `run.failed` 事实。
- 应用重启后，被拒绝的 Run SHALL NOT 再恢复为待批准状态，后续批准请求 SHALL 返回 `agent_approval_unavailable`。
- 若拒绝无法持久化，Renderer SHALL 保留原待批准状态并允许用户重试，不得显示伪终态。

### `agent.spawn`

Request:

```ts
interface SpawnSubAgentInput {
  spec: SubAgentSpec
  depth?: number
}
```

Response:

```ts
interface SpawnSubAgentResult {
  output: string
  status: 'completed' | 'failed' | 'aborted' | 'max_turns_exceeded' | 'approval_required'
  turnsUsed: number
  droppedTools: string[]
  droppedSkills: string[]
  trace: {
    runId: string
    parentRunId: string
    parentTraceId: string
    depth: number
    startedAt: number
    completedAt: number
    requestedTools: string[]
    effectiveTools: string[]
    requestedSkills: string[]
    effectiveSkills: string[]
    droppedTools: string[]
    droppedSkills: string[]
    status: 'completed' | 'failed' | 'aborted' | 'max_turns_exceeded' | 'approval_required'
    error?: string
  }
  error?: string
}
```

Rules:

- 内置 agent SHALL 包含 `general-purpose`、`canvas-orchestrator`、兼容别名 `orchestrator`，以及 canvas、tooling、PM 角色。
- `general-purpose` SHALL 作为画布聊天的默认对话入口。其描述与指令 SHALL 聚焦于理解、需求拆解、歧义澄清，以及委派给本地能力。
- `canvas-orchestrator` SHALL 负责显式的画布图/节点/工作流 CanvasPlan 生成。旧的 `orchestrator` ID SHALL 保留为兼容别名。
- Agent 运行 SHALL 在修改图或输出 CanvasPlan 之前分析用户意图。问候语、闲聊与低信息量请求 SHALL 返回 `AgentResponse` 的 clarification，而不是创建图节点。
- 意图分析 SHALL 暴露一份可见的进度摘要，包含分类、复杂度、执行模式、推荐 agent 与本地能力检查。这是可审计的摘要，不是原始思维链。
- `agent.getRun` 的 trace 元数据 SHALL 持久化结构化的 `intentAnalysis` 与 `capabilityCheck`，使 UI 层能在重载或任务完成后恢复 Agent 的可见推理摘要。
- 简单的显式建节点请求 MAY 使用 `executionMode: 'direct'` 来产出最简 CanvasPlan。直接模式 SHALL NOT 绕过 ToolRuntime、plan-apply 关卡或用户批准策略。
- 生成图片或视频的请求 SHALL 使用生成配置节点（`imageConfigV2` / `videoConfigV2`）加运行步骤；引用型的 `image` 与 `video` 节点 SHALL NOT 被当作生成节点处理。
- 内置 agent SHALL 可通过 settings 编辑并持久化为覆盖记录，但 SHALL NOT 可删除。
- Agent 运行是异步的，返回票据。
- Agent 运行 SHALL 在主循环执行前解析出所选的 AgentDefinition，并 SHALL 拒绝已禁用的 agent 或 agent 触发策略不允许的触发方式。
- Agent 上下文循环 SHALL 从已解析的 AgentDefinition、触发策略、用户消息与当前 ToolRuntime 描述符初始化。
- Agent 上下文循环 SHALL 在模型/planner 执行前，按 `allowedTools`、启用状态与权限类型过滤工具。
- Agent 发起的工具调用 SHALL 只能通过 ToolRuntime 执行；工具观察结果 SHALL 在下一轮模型/planner 之前追加到循环消息中。
- Agent 发起的工具若返回权限 `ask` 决策，SHALL 以 `agent_tool_approval_required` 暂停循环，保留待处理的工具调用、输入、理由与所需权限，且 SHALL NOT 执行该工具，直到 `agent.approveTool` 使其恢复或 `agent.denyTool` 使其终止。
- `agent.approveTool` SHALL 入队一个新的 `agent.run` 任务，仅通过 ToolRuntime 执行那条被保留的待处理工具调用，将其观察结果追加到已暂停的循环中，并继续模型/planner 轮次，直到产出经过净化的 CanvasPlan 或终态错误。
- `agent.denyTool` SHALL 原子化持久化拒绝终态，且 SHALL NOT 允许该暂停调用在重启后再次批准。
- Agent 上下文循环 SHALL 针对 agent 上下文 token 预算，确定性地压缩较早的 assistant/tool 消息，同时保留系统提示词、当前用户请求与一个压缩摘要边界。
- 超出 `maxTurns` 的 Agent 循环 SHALL 以结构化元数据终止，包含 `errorClass`、`turnsUsed`、被丢弃的工具、压缩摘要与被省略的消息数量。
- 由网关驱动的 Agent 模型 SHALL 返回形如 `toolCalls` 或 `AgentResponse` 的 JSON；非法 JSON SHALL 被转换为带有 dropped 审计元数据的安全 clarification 响应，而不是修改图。
- 当 `resolveAgentToolProtocol` 选择 `native` 时，OpenAI 兼容网关 SHALL 使用原生 `tools` / `tool_calls`；stub 与未知网关 SHALL 保留 JSON `toolCalls` 协议。
- Agent 产出的 CanvasPlan SHALL 在应用前经过净化。
- 子级权限 SHALL 为父级权限与目标/请求策略的交集。
- 子 agent spawn 结果 SHALL 包含一份独立的 trace，含运行 ID、父级运行/trace ID、有效权限、被丢弃的权限、终态状态与耗时。
- 子 agent 的画布工具 SHALL 针对一份隔离的草稿图副本运行；`applySubAgentResult` SHALL 净化该草稿，且只有在父级明确合并时才持久化新的图版本。

## Errors

| Error class | Meaning |
| :--- | :--- |
| `agent_not_found` | Agent ID 不存在或已禁用。 |
| `agent_policy_invalid` | Agent 配置违反策略 schema。 |
| `agent_context_failed` | Context Pack 无法安全构建。 |
| `agent_permission_denied` | 工具、skill 或 spawn 权限被拒绝。 |
| `agent_tool_approval_required` | 工具执行暂停，直到用户批准该待处理工具调用。 |
| `agent_tool_denied` | 用户明确拒绝了待处理工具调用，Run 已终止。 |
| `agent_builtin_readonly` | 内置 agent 定义不可删除。 |
| `agent_depth_exceeded` | Spawn 深度超过配置的最大值。 |
| `agent_max_turns_exceeded` | Agent 循环在产出 plan 之前达到配置的轮次上限。 |
| `agent_run_failed` | Agent 循环失败，附带安全的错误元数据。 |
| `gateway_retry_exhausted` | 网关瞬时失败重试与 fallback 均耗尽。 |
| `compaction_failed` | 反应式上下文压缩后仍无法完成模型调用。 |
| `tool_failure_loop` | 同一工具连续失败达到上限，run 被终止以防死循环。 |

## Permissions

- 创建/编辑自定义 agent 需要 settings 写权限。
- 编辑内置 agent 需要 settings 写权限，并存储为覆盖记录而非修改代码默认值。
- `allowedTools`、`allowedSkills`、网关策略、上下文策略、触发策略与权限策略定义了能力上限。
- 子 agent 的有效权限 SHALL 小于或等于父级权限。

## Tests

- Unit：内置 agent 注册表包含必需的 agent ID。
- Unit：自定义 agent 策略校验拒绝过宽或格式错误的配置。
- Integration：自定义 agent 的 settings 通过类型化的 IPC/preload API 完成创建、编辑、列表与删除。
- Integration：内置 agent 的 settings 保存为持久化覆盖记录并拒绝删除。
- UI：agent 表单校验必填字段、可编辑内置项，并阻止对内置项的删除操作。
- Unit：Agent 上下文循环按策略过滤工具、拒绝不允许的触发方式、执行 ToolRuntime 调用、将工具观察结果送入下一轮，压缩超预算的上下文，并发出结构化的 max-turns 终态元数据。
- Property：子 agent 权限交集永不扩大访问范围。
- Integration：子 agent 草稿图写入在父级合并之前不会改变持久化的工作流图。
- Integration：`agent.run` 返回任务/运行票据并推送终态事件流。
- Injection：可执行的 CanvasPlan 字符串在应用前被丢弃或拒绝。
