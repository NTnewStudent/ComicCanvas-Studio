# Tools And Plugins Contract

## Owner

- Primary: tooling-agent
- Supporting: orchestrator-agent, pm-agent
- Shared source: `shared/tools.ts`, `shared/agents.ts`

## Scope

本契约覆盖 ToolRuntime、ToolRegistry、内置工具、插件提供的工具、权限决策、进度流、并发类别、审计记录、插件校验，以及隔离（quarantine）机制。

不涉及的范围：

- 不允许 tool 直接调用 renderer。
- 首个实现版本不包含插件应用市场。
- 不允许在 ToolRuntime 之外执行工具。

## 请求/响应契约

### `tool.list`

Request:

```ts
interface ToolListRequest {
  includeDisabled?: boolean
  ownerKind?: 'builtin' | 'plugin'
}
```

Response:

```ts
type ToolListResponse = ToolDescriptor[]
```

当工具通过 ToolRuntime 注册时，`ToolDescriptor` 条目必须包含 `inputParametersJsonSchema`（工具输入的 JSON Schema draft 2020-12 快照）。

### `tool.invoke`

Request:

```ts
interface ToolInvokeRequest {
  toolId: string
  input: unknown
  actor: ToolActor
  traceId: string
}
```

Response:

```ts
interface ToolInvokeAccepted {
  invocationId: string
  status: 'accepted'
}
```

Events:

```ts
type ToolEvent =
  | { channel: 'tool.progress'; invocationId: string; progress: ToolProgress }
  | { channel: 'tool.completed'; invocationId: string; output: unknown }
  | { channel: 'tool.failed'; invocationId: string; error: ToolError }
```

规则：

- 内置工具与插件工具必须使用同一条 ToolRuntime 路径。
- 工具的输入和输出必须经过 schema 校验。
- 只读工具可以并发执行；写入类工具遵循串行或独占策略。
- 插件加载失败时必须将该插件/工具隔离（quarantine），并暴露诊断信息。

## 错误

Tool 错误保留历史上的 `errorClass/message/retryable` 结构，并可附带稳定的领域
`code` 以及安全的结构化 `details`，供 Agent 用于恢复处理：

```ts
interface ToolError {
  errorClass: string
  code?: string
  message: string
  retryable: boolean
  details?: Record<string, unknown>
}
```

| Error class | 含义 |
| :--- | :--- |
| `tool_not_found` | 工具 ID 不存在、已禁用或已被隔离。 |
| `tool_input_invalid` | 输入未通过 schema 校验。 |
| `tool_permission_denied` | 权限策略拒绝了执行。 |
| `tool_runtime_failed` | 工具在执行过程中失败。 |
| `plugin_manifest_invalid` | 插件 manifest 未通过校验。 |
| `plugin_quarantined` | 插件被安全诊断机制拦截。 |

当情况可被明确分类时，Canvas 和面向 Agent 的工具必须使用以下稳定的 `code` 取值：

| Code | Retryable | 含义 |
| :--- | :--- | :--- |
| `validation_failed` | false | 在发生修改之前，通用的 schema 或图校验失败。 |
| `invalid_edge` | false | 所请求的连接或边变更违反了连接矩阵，或与已有边重复。 |
| `missing_asset` | false | 无法解析所需的资产引用。 |
| `stale_style` | false | 节点或项目引用了一个已不存在的样式预设。 |
| `disabled_style` | true | 节点或项目引用了一个已被禁用的样式预设。 |
| `stale_model` | false | 节点引用的模型在当前网关目录中不可用。 |
| `job_enqueue_failed` | true | 本地持久化任务队列无法保存或入队所请求的任务。 |
| `job_failed` | false | 此前已入队的任务到达了终态的失败状态。 |

## 权限

- 工具在注册时声明所需权限和并发类别。
- 破坏性操作、涉及外部网络访问、写文件，或消耗 provider 资源的工具，需要显式的权限策略。
- 插件工具在被用户信任之前，默认权限为 `ask`。
- 子 Agent 的工具访问权限以父级权限为上限。

## Tool/UI 等价关系清单

Phase A 中，只有当某个持久化的手动画布操作拥有对应的 ToolRuntime 条目，或者已有 IPC/service 契约承担相同的校验与持久化语义时，才将其视为 Agent 可用。仅限渲染层的临时交互状态可以只存在于 UI 层。

手动 UI 与 ToolRuntime 的图变更必须共用
`shared/canvas-actions.ts`，以保证持久化的 create/connect/delete/default-data
语义一致。渲染层代码可以保留本地 undo 栈、临时选中态、
视口动画、hover 状态、拖拽预览，以及本地化的反馈文案。

| 持久化操作分组 | 等价接口 | 状态 |
| :--- | :--- | :--- |
| graph.query | `canvas.queryGraph` | ToolRuntime |
| graph.validate | `canvas.validateGraph` | ToolRuntime |
| graph.save-load-version | `canvas.saveGraph`, `canvas.loadGraph`, `canvas.listWorkflowVersions`, `canvas.restoreWorkflowVersion` | IPC/service-backed |
| graph.import-export | `canvas.importWorkflow`, `canvas.exportWorkflow` | IPC/service-backed |
| node.create | `canvas.createNode` | ToolRuntime |
| node.duplicate | `canvas.duplicateNode`, `canvas.duplicateSelection` | ToolRuntime |
| node.rename | `canvas.renameNode` | ToolRuntime |
| node.data | `canvas.updateNodeData` | ToolRuntime |
| node.position-batch | `canvas.setNodePosition`, `canvas.layoutSelection` | ToolRuntime |
| node.delete-batch | `canvas.deleteNode`, `canvas.deleteSelection` | ToolRuntime |
| edge.connect | `canvas.connectNodes` | ToolRuntime |
| edge.connect-to-create | `canvas.connectToCreate` | ToolRuntime |
| edge.update-delete | `canvas.updateEdge`, `canvas.deleteEdge` | ToolRuntime |
| selection.extract | `canvas.extractSelection` | ToolRuntime |
| snippet.save-insert | `canvasSnippet.save`, `canvasSnippet.get`, `canvasSnippet.list`, `canvasSnippet.delete` | IPC/service-backed |
| workflow.project-template | `canvas.listWorkflows`, `canvas.importWorkflow`, `canvas.copyWorkflowTemplate` | IPC/service-backed |
| style.resolve | `style.list`, `style.setProjectDefault`, `style.getProjectDefault`, runtime style injection | IPC/service-backed |
| job.recovery | `job.recover`, `job.list`, `canvas.runNode` | IPC/service-backed |
| media.drop | local media classifier plus `asset.import` and `canvas.createNode`/`canvas.updateNodeData` | Service-backed |
| media.image-edit | `ImageEditIntent` through asset/node update services | Service-backed |
| asset.category-reference | `asset.getCategories`, `asset.createCategory`, `asset.updateCategory`, `asset.assignCategory`, `asset.removeCategory`, `asset.trash` | IPC/service-backed |
| viewport.fit-view | none | Transient UI-only |
| hover-menu-drag-preview | none | Transient UI-only |

MJ 节点/组件相关操作不包含在 Phase A 的 Tool/UI 等价关系范围内。本地运行时仅将
`mjImage` 保留为历史已知的图类型；MJ 的新增/运行、
多结果 UI 对齐，以及 URL 刷新均不在范围内。

## 测试

- Unit：工具注册时校验 schema、权限和 owner。
- Unit：权限策略返回 allow、ask 或 deny，并附带审计原因。
- Unit：已禁用的插件工具不能被调用。
- Integration：内置 canvas 工具与插件工具共用同一套 ToolRuntime。
- Quarantine：非法的插件 manifest 会使 registry 保持在上一个有效快照。
