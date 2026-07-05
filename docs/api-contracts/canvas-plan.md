# Canvas Plan Contract

## Owner

- Primary: pm-agent
- Implementation: orchestrator-agent, canvas-agent, tooling-agent
- Shared source: `shared/plan.ts`, `shared/nodes.ts`, `shared/connection-matrix.ts`

## Scope

本契约涵盖用于文本、图片、视频漫剧工作流的声明式 CanvasPlan 创建、净化、
应用与运行步骤执行。CanvasPlan 只是数据。它不能包含可执行代码、脚本、
动态 import、shell 命令，或特定 provider 的负载。

Non-goals：

- Plan 应用不直接触发模型调用。
- 不同步返回生成的资产。
- 不存在渲染层独有的一份节点/边/运行步骤规则副本。

## Request/Response Contracts

### `canvas.chatSend`

Request:

```ts
interface CanvasChatSendRequest {
  message: string
  agentId?: string
}
```

Response:

```ts
interface CanvasChatSendResponse {
  runId: string
  jobId: string
  messageId: string
  status: 'pending'
}
```

Rules:

- `canvas.chatSend` SHALL 入队一个 `agent.run` 任务，并在一秒内返回，不
  同步返回 CanvasPlan。
- 响应 SHALL 包含 `runId`，以便渲染层 UI 能通过 `agent.getRun` 恢复 Agent
  的 trace 摘要。
- 编排任务 SHALL 在主进程中运行 orchestrator 的 AsyncGenerator，并通过
  本地任务运行时发出进度/终态任务事件。
- 若终态的 `AgentResponse` 是 `canvasPlan`，产出的 CanvasPlan SHALL 只能
  在异步完成后通过 `canvas.chatGetPlan` 获取。
- 若终态的 `AgentResponse` 是 `answer` 或 `clarification`，主进程 SHALL
  发出 `agent.responseReady`；不为该消息存储任何 CanvasPlan。

### `agent.responseReady`

Event:

```ts
interface AgentResponseReadyEvent {
  runId: string
  messageId: string
  response:
    | { type: 'answer'; summary: string; text: string; dropped: string[] }
    | { type: 'clarification'; summary: string; question: string; missing: string[]; dropped: string[] }
}
```

Rules:

- 渲染层聊天界面 SHALL 直接渲染 `answer.text` 或 `clarification.question`。
- 渲染层聊天界面 SHALL NOT 为 `agent.responseReady` 调用
  `canvas.chatGetPlan`。
- 除非用户明确要求创建或运行画布工作流，问候语、日期/时间问题、编码帮助
  或常识性回答等普通问题 SHALL 使用此事件路径。

### `canvas.chatGetPlan`

Request:

```ts
interface CanvasChatGetPlanRequest {
  messageId: string
}
```

Response:

```ts
type CanvasChatGetPlanResponse = CanvasPlan
```

Rules:

- `canvas.chatGetPlan` SHALL 在 agent 任务完成后，返回该消息 ID 对应的最新
  已存储 plan。
- 若因 Agent 产出了 `answer` 或 `clarification` 而没有可用 plan，调用方
  SHALL 使用 `agent.responseReady` / `agent.getRun`，而不是轮询
  `canvas.chatGetPlan`。
- 若因 plan 任务失败而没有可用 plan，handler SHALL 返回一个稳定的安全
  错误封装；SHALL NOT 暴露内部 prompt 或 provider 细节。

### `canvas.applyPlan`

Request:

```ts
interface CanvasApplyPlanRequest {
  plan: CanvasPlan
  mode: 'draft' | 'apply'
  sourceAgentRunId?: string
}
```

Response:

```ts
interface CanvasApplyPlanResponse {
  graphVersion: string
  appliedNodeIds: string[]
  appliedEdgeIds: string[]
  dropped: string[]
}
```

Rules:

- 主进程或渲染层的 plan applicator SHALL 在修改图之前对 plan 做净化。
- 每个 Agent 创建的节点类型 SHALL 属于 `text`、`image`、`video`、
  `imageConfigV2`、`videoConfigV2`、`character`、`scene`、`audio`、
  `videoCompose`、`superResolution`、`muxAudioVideo` 之一。
- `image` 与 `video` 是媒体引用节点；生成类运行步骤 SHALL 面向
  `imageConfigV2` 与 `videoConfigV2`。
- `mjImage` 为图兼容性而保留的历史已知类型，但 Agent 创建的 plan 与运行
  步骤不可使用。
- 每条边 SHALL 通过 `shared/connection-matrix.ts` 重新校验。
- 每个运行步骤 SHALL 使用 `shared/plan.ts` 中的 `RunAction` 白名单。
- 子 agent 草稿图的合并 SHALL 对子级产出的图 JSON 做净化，剔除节点数据中
  的可执行字符串，通过 `shared/connection-matrix.ts` 重新校验边，并只有
  在父级批准后才写入新的不可变工作流版本。

### `canvas.runPlan`

Request:

```ts
interface CanvasRunPlanRequest {
  graphVersion: string
  runSteps: PlanRunStep[]
}
```

Response:

```ts
interface CanvasRunPlanResponse {
  jobIds: string[]
  status: 'queued'
}
```

Rules:

- `canvas.runPlan` SHALL 只入队本地任务并返回任务 ID。
- 某个运行步骤失败 SHALL 使后续步骤短路，同时保留其待处理状态供检查。

### `canvas.saveGraph`

Request:

```ts
interface CanvasSaveGraphRequest {
  projectId: string
  graph: CanvasGraphSnapshot
}

interface CanvasGraphSnapshot {
  nodes: Array<{
    id: string
    type: 'text' | 'image' | 'video'
    position: { x: number; y: number }
    data: CanvasNodeData
  }>
  edges: Array<{
    id: string
    source: string
    target: string
    data: CanvasEdgeData
  }>
  viewport: { x: number; y: number; zoom: number }
}
```

Response:

```ts
interface CanvasSaveGraphResponse {
  graphVersion: string
}
```

Rules:

- `canvas.saveGraph` SHALL 通过 workflow repository 持久化一个新的不可变
  工作流版本。
- 保存事务 SHALL 包含图版本插入与工作流 `updatedAt` 刷新。
- 每条已保存的边 SHALL 通过 `shared/connection-matrix.ts` 重新校验；缺失
  节点与非法类型的边 SHALL 从持久化版本中丢弃。
- 持久化的图 SHALL 包含节点位置与视口信息，以便应用重启/加载时能恢复可见
  的画布布局。

### `canvas.loadGraph`

Request:

```ts
interface CanvasLoadGraphRequest {
  projectId: string
}
```

Response:

```ts
type CanvasLoadGraphResponse = CanvasGraphSnapshot
```

Rules:

- `canvas.loadGraph` SHALL 返回所请求项目的最新工作流版本。
- 若不存在图，SHALL 返回一个带 `viewport: { x: 0, y: 0, zoom: 1 }` 的空图。
- 加载出的图响应 SHALL 只包含安全的图 JSON，SHALL NOT 包含生成的字节
  数据、provider URL 或绝对文件系统路径。

### Workflow Project Summaries

`canvas.listWorkflows` 的响应条目：

```ts
interface WorkflowSummaryView {
  id: string
  name: string
  scope: 'draft' | 'template'
  published: boolean
  description: string | null
  visibility: 'private' | 'public'
  ownerId: string
  ownedByCurrentUser: boolean
  tags: string[]
  thumbnailUrl: string | null
  updatedAt: string
  nodeCount: number
  edgeCount: number
  coverAssetId: string | null
  latestRunStatus: 'idle' | 'pending' | 'running' | 'done' | 'error'
  defaultStylePresetId: string | null
  archived: boolean
  versionChecksum: string
  warningSummary: {
    unsupportedNodes: number
    invalidEdges: number
  }
}
```

Rules:

- 工作流摘要 SHALL 从最新持久化的工作流图版本派生。
- `canvas.listWorkflows` SHALL 返回私有草稿工作流。`canvas.listWorkflowTemplates`
  默认返回已发布的公开模板，并 MAY 接受
  `{ scope: 'my' | 'public' | 'all' }` 用于本地管理界面。
- 工作流模板 SHALL 使用与项目相同的摘要形状，但 `scope: 'template'`；
  公开模板列表条目 SHALL 具有 `visibility: 'public'` 与
  `published: true`，而本地 owner/admin 视图 MAY 包含未发布的私有模板
  草稿。
- 模板摘要 SHALL 包含 description、visibility、owner、
  owned-by-current-user、tags 与缩略图 URL 元数据，以对齐 hjwall 的卡片
  展示。
- `edgeCount` SHALL 在 UI 过滤之前统计最新图的边数，以便项目卡片能展示
  已编排图的规模。
- `coverAssetId` SHALL 使用工作流显式设置的封面（如存在）；否则 MAY 回退
  到第一个带资产的节点。
- `latestRunStatus` SHALL 按以下优先级归纳最新节点运行状态：running、
  pending、error、done、idle。
- `versionChecksum` SHALL 是最新图 JSON 的确定性 SHA-256 校验和。
- `warningSummary` SHALL 为宽松保存/调试 UI 暴露不受支持节点与非法边的
  数量；严格的运行校验仍是独立的关卡。

### Workflow Import/Export Safety

`canvas.exportWorkflow` 响应：

```ts
interface WorkflowExportJson {
  schemaVersion: 1
  name: string
  graph: CanvasGraphSnapshot
}
```

`canvas.importWorkflow` 请求：

```ts
interface WorkflowImportRequest {
  json: string
  name?: string
}
```

Response:

```ts
interface WorkflowImportResponse {
  workflowId: string
  graphVersion: string
  dropped: string[]
}
```

Rules:

- 工作流导入 JSON SHALL 要求 `schemaVersion: 1`。未知、缺失或更高版本的
  schema SHALL 返回 `invalid_workflow_json`。
- 工作流导入 JSON SHALL 在持久化前完成解析与校验。格式错误的 JSON、缺失
  图对象、非数组的 nodes/edges，或非法的视口负载，SHALL 返回
  `invalid_workflow_json`。
- 导入与导出负载 SHALL NOT 包含 API key、bearer token、密钥访问密钥、
  provider 凭证、生成的字节数据、provider URL，或绝对文件系统路径。
- 当 JSON 树中任意位置存在类似密钥的键/值或绝对路径时，导入 SHALL 以
  `unsafe_workflow_json` 拒绝该不安全负载。
- 导入 SHALL 在写入工作流版本之前，通过共享的图持久化规则对图的节点、边
  与视口做净化。
- 导入 SHALL 保留兼容的图内容，并在 `dropped` 中报告不兼容或被丢弃的
  记录，以便渲染层能展示警告。
- 导入的工作流 SHALL 始终创建为 `scope: 'draft'` 且 `published: false`
  的私有草稿，即便源 JSON 来自模板导出。
- 渲染层的导入流程 SHALL 在成功后跳转到导入的草稿，并在用户关闭或离开该
  流程之前保持被丢弃项警告可见。

### Workflow Version History and Restore

`canvas.listWorkflowVersions` 请求：

```ts
interface WorkflowVersionListRequest {
  workflowId: string
  limit?: number
}
```

响应条目：

```ts
interface WorkflowVersionSummaryView {
  id: string
  createdAt: string
  createdBy: string
  nodeCount: number
  edgeCount: number
  checksum: string
  restoreSourceVersionId: string | null
  warningSummary: {
    unsupportedNodes: number
    invalidEdges: number
  }
}
```

`canvas.restoreWorkflowVersion` 请求：

```ts
interface WorkflowVersionRestoreRequest {
  workflowId: string
  versionId: string
}
```

Response:

```ts
interface WorkflowVersionRestoreResponse {
  workflowId: string
  graphVersion: string
  restoredFromVersionId: string
  checksum: string
  warningSummary: {
    unsupportedNodes: number
    invalidEdges: number
  }
}
```

Rules:

- 工作流图版本 SHALL 是不可变的。恢复一个历史版本 SHALL 创建一个新的最新
  图版本，SHALL NOT 更新或删除源版本。
- 版本历史 SHALL 按最新在前排序，并按请求的 `limit` 截断，且被限制在一个
  安全的最大值内。
- 版本调试元数据 SHALL 包含创建时间、创建者、节点数、边数、确定性
  SHA-256 校验和、warning summary，以及在该版本由恢复操作创建时的
  `restoreSourceVersionId`。
- 版本摘要 SHALL 描述持久化后的安全图。若保存/导入的净化在持久化前已丢弃
  了不受支持的节点或非法边，持久化版本的 warning summary MAY 为零。
- 恢复响应 SHALL 包含新的图版本 ID、源版本 ID、校验和与 warning summary，
  以便渲染层 UI 与未来的 Agent 工具能引用确切的恢复路径。
- 渲染层的项目 UI SHALL 将版本/调试元数据与恢复操作作为工程已完成的控件
  暴露。产品验收仍需人工桌面端评审。

### Graph Validation Modes

`canvas.validateGraph` 请求：

```ts
interface WorkflowGraphValidationRequest {
  workflowId?: string
  graph?: CanvasGraphSnapshot
  mode?: 'lenient' | 'strict'
}
```

Response:

```ts
interface WorkflowGraphValidationResponse {
  mode: 'lenient' | 'strict'
  valid: boolean
  issues: {
    code: string
    severity: 'warning' | 'error'
    message: string
    nodeId?: string
    edgeId?: string
    refId?: string
  }[]
  warningSummary: {
    unsupportedNodes: number
    invalidEdges: number
    unavailableModels: number
    unavailableStyles: number
    unavailableAssets: number
  }
}
```

Rules:

- 草稿保存 SHALL 使用宽松校验。不受支持的节点、非法边、不可用模型、不可用
  风格预设、已禁用风格预设与不可用资产 SHALL 记录为警告，且 SHALL NOT
  阻止持久化。
- 运行时操作，包括 `canvas.runNode`、显式的严格校验，以及未来的模板发布，
  SHALL 使用严格校验。严格模式下的问题 SHALL 作为阻断性错误返回，且
  SHALL NOT 入队 provider 任务。
- `canvas.saveGraph` SHALL 将宽松校验的警告与不可变图版本一起持久化。
  版本列表/调试 UI SHALL 读取持久化的 warning summary，以使历史诊断信息
  保持稳定。
- 模型可用性校验 SHALL 使用注入的模型注册表（如可用）。若未配置模型注册
  表，校验 SHALL NOT 凭空产生模型失败。
- 资产可用性校验 SHALL 使用资产仓储层，将失败、已回收、已墓碑化或缺失的
  资产视为不可用。
- 风格可用性校验 SHALL 使用风格仓储层（包括已禁用的预设），并将缺失或
  已禁用的风格视为严格运行时下的不可用。

## Workflow Node Definitions

`shared/workflow-node-definitions.ts` 是供手动 UI、ToolRuntime 与未来
Agent 规划共用的节点能力来源。

Rules:

- 每个 `NodeType` SHALL 恰好对应一份定义，包含 label、category、
  capabilities、允许的输入、允许的输出、可添加标志、连接即创建标志、
  可运行标志，以及可选的运行动作。
- `allowedInputs` 与 `allowedOutputs` SHALL 从
  `shared/connection-matrix.ts` 派生；渲染层代码 SHALL NOT 为添加/
  连接即创建过滤维护一份独立的连接表。
- 画布的添加菜单、命令面板的添加命令，以及连接即创建菜单，SHALL 通过共享
  定义进行过滤。
- 特性开关 MAY 在运行时禁用某些节点类型。被禁用的节点类型 SHALL 仍为共享
  定义服务所知，但 SHALL 被标记为不可添加、不可连接创建、不可运行，并附带
  不可用原因。
- ToolRuntime 的 `canvas.runNode` SHALL 在入队任务之前拒绝其定义为不可
  运行的节点。
- 网关模型目录 SHALL 提供 text/image/video/tool 的模型列表、能力标志，以及
  用于不可用模型校验的 `availableModelIds`。
- MJ 在本地 Phase A 中仅作为历史图兼容而保留为已知节点类型；SHALL NOT
  可添加、可连接创建或可运行。
- 文本润色沿用 CanvasPlan 的 `textPolish` 动作词汇，SHALL 通过同一个
  `canvas.runNode` 接口入队 `canvas.polishText` 任务。终态文本结果
  SHALL 更新文本节点内容与润色状态。

## Workflow Runtime Snapshot

`shared/workflow-graph-compiler.ts` 将目标节点编译为一份确定性的运行时
快照，供运行 handler 与未来的 Agent/工具执行使用。

快照字段：

```ts
interface WorkflowRuntimeSnapshot {
  nodeId: string
  nodeType: NodeType
  runAction: RunAction | null
  modelKey: string | null
  stylePresetId: string | null
  prompt: string
  promptParts: {
    nodeId: string
    nodeType: NodeType
    label: string
    text: string
    source: 'upstream' | 'self'
    order: number
    edgeId?: string
  }[]
  references: {
    nodeId: string
    nodeType: NodeType
    assetId: string
    mediaType: 'image' | 'video' | 'audio'
    role: 'first_frame' | 'last_frame' | 'reference' | 'audio' | 'video'
    order: number
    edgeId?: string
  }[]
  parameters: Record<string, unknown>
  negativePrompt: string | null
}
```

Rules:

- Prompt 各部分 SHALL 具备确定性：显式的 `promptOrder` 优先于边的创建
  时间，边的创建时间用于打破平局。
- 角色与场景节点 SHALL 在选中资产时贡献语义化的 prompt 行与图片引用。
- 图片引用 SHALL 保留 `imageOrder` 与 `imageRole`，以便首帧、尾帧与参考
  资产能绑定到网关输入。
- 风格解析 SHALL 优先使用节点覆盖值，其次是项目默认值。最终的 `prompt`
  SHALL 通过共享的风格组合器包含风格 prompt-before/after 或历史风格文本。
- 当生效风格提供了负向提示词时，`negativePrompt` SHALL 同时出现在
  `parameters.negativePrompt` 中。
- `canvas.runNode` 的 image/video 负载 SHALL 使用此快照获取 prompt、
  model key、参数与图派生的引用。

### `canvas.copyWorkflowTemplate`

Request:

```ts
interface WorkflowTemplateCopyRequest {
  templateId: string
  name?: string
}
```

Response:

```ts
interface WorkflowTemplateCopyResponse {
  workflowId: string
  graphVersion: string
  name: string
}
```

Rules:

- 源工作流 SHALL 为 `scope: 'template'`、`published: true` 且未被删除。
- 对于默认复制路径，源工作流 SHALL 也必须是公开可见的。
- 复制 SHALL 创建一个带有已复制最新图版本的新
  `scope: 'draft'`、`published: false` 工作流。
- 复制出的草稿 SHALL 只按 ID 保留安全的资产引用与封面选择；SHALL NOT
  复制 provider 密钥、绝对路径、生成的字节数据，或临时 URL。
- 复制出的草稿 SHALL 保留安全的模板标签与缩略图元数据，将自身标记为私有,
  并记录一个本地 owner ID。
- 若模板缺失、未发布，或没有图版本，handler SHALL 返回一个安全的不可
  重试错误封装。

### `canvas.publishWorkflowTemplate`

Request:

```ts
interface WorkflowTemplatePublishRequest {
  workflowId: string
  visibility?: 'private' | 'public'
}
```

Response: `WorkflowSummaryView` 或安全错误封装。

Rules:

- 发布 SHALL 在修改模板可见性/发布状态之前，对最新的工作流图版本运行
  严格图校验。
- 严格校验失败 SHALL 返回带 issues 的
  `workflow_template_validation_failed`，且 SHALL NOT 发布该模板。
- 不受支持的历史节点（包括与 MJ 相关的节点），在本地 Phase A 模板发布中
  SHALL 保持为阻断性校验错误。

### `canvasSnippet.list` / `canvasSnippet.get`

Request:

```ts
interface CanvasSnippetListRequest {
  scope?: 'my' | 'public' | 'all'
}
interface CanvasSnippetGetRequest {
  snippetId: string
}
```

Response:

```ts
interface CanvasSnippetView {
  id: string
  schemaVersion: 1
  name: string
  description?: string
  scope: 'my' | 'public'
  ownerId: string
  ownedByCurrentUser: boolean
  tags?: string[]
  thumbnailUrl?: string
  nodeCount: number
  edgeCount: number
  nodes: CanvasGraphNode[]
  edges: CanvasGraphEdge[]
  createdAt: number
  updatedAt: number
}
```

Rules:

- `canvasSnippet.list` SHALL 支持 all、my、public 三种 scope，并 SHALL
  返回净化后的元数据加图片段。
- `canvasSnippet.get` SHALL 返回用于插入的详情片段，并 SHALL 在不存在时
  返回一个安全的 not-found 封装。
- Snippet 保存 SHALL 对非法边做净化，并持久化 scope、owner、tags、
  description、缩略图 URL、节点数与边数。
- Snippet 删除 SHALL 只能删除当前本地用户拥有的 snippet；对公开或他人的
  snippet SHALL 返回一个不可重试的权限封装。
- 渲染层的 snippet 插入 SHALL 重映射节点与边 ID，保留内部拓扑结构，并
  写入一条可撤销的画布快照。

## Errors

| Error class | Meaning |
| :--- | :--- |
| `plan_invalid_json` | 负载不是合法的 CanvasPlan 对象。 |
| `plan_executable_content` | 净化过程中发现可执行代码或类脚本内容。 |
| `plan_node_type_unsupported` | 某个节点类型超出共享白名单。 |
| `plan_edge_rejected` | `canConnect(source,target)` 拒绝了某条边。 |
| `plan_graph_version_conflict` | 目标图在应用前已发生变更。 |
| `graph_invalid_json` | 负载不是合法的 CanvasGraphSnapshot 对象。 |
| `graph_project_missing` | 保存/加载请求未指明项目。 |
| `graph_persist_failed` | workflow repository 无法原子化地持久化该图版本。 |

IPC 响应 SHALL 只暴露稳定的错误类别与安全的错误信息。

## Permissions

- 应用一个 plan 是图写入操作，要求当前用户/会话具有画布写权限。
- 运行一个 plan 可能消耗 provider 额度，SHALL 经过任务/网关权限策略。
- M0/M1 中不允许破坏性的 plan 操作。后续的删除操作 SHALL 要求显式的
  `ask` 策略。
- 保存一个图是图写入操作，要求画布写权限。
- 加载一个图是图读取操作，要求项目读权限。

## Tests

- Unit：净化非法节点类型、非法边、可执行字符串与非法运行动作。
- Property：生成的边对组合与 `shared/connection-matrix.ts` 一致。
- Integration：`canvas.applyPlan` 只在净化后修改图。
- Integration：`applySubAgentResult` 在父级合并之前不持久化子级草稿图
  变更，并在合并期间丢弃可执行的节点数据与非法边。
- Integration：`canvas.runPlan` 返回任务票据，且永不返回资产字节数据、
  URL、绝对路径或 provider 临时 URL。
- Integration：`canvas.saveGraph` 之后重建 handler 再执行
  `canvas.loadGraph`，能返回最新节点、合法边、位置与视口。
- Repository：工作流版本持久化通过仓储层 API 完成，图 JSON 保存在
  `workflow_versions` 内。
- Repository：工作流摘要从最新图版本中暴露封面、边数、最新运行状态、
  默认风格、归档状态、校验和与警告数量。
- Repository/UI：已发布的工作流模板与草稿分开列出，并复制为带有新图
  版本的私有草稿工作流。
