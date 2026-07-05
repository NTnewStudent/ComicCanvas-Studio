# Jobs Contract

## Owner

- Primary: tooling-agent
- Supporting: pm-agent
- Shared source: `shared/jobs.ts`, `shared/ipc.ts`

## Scope

本契约定义了用于生成、网关调用、agent 运行、索引、插件重载等慢操作的持久化本地 JobRuntime。每个慢操作在返回给渲染层之前都必须（SHALL）入队一个持久化 job。

Non-goals（非目标）：

- 不使用 Redis、BullMQ 或远程队列。
- 不依赖 WebSocket；终态更新使用 Electron IPC 事件。
- 请求 handler 内部不做同步的模型/网关调用。

## Request/Response Contracts

### `job.enqueue`

Request:

```ts
interface JobCreateInput {
  type: JobType
  targetId?: string
  payload: Record<string, unknown>
  requestedBy: JobActor
  idempotencyKey?: string
}
```

Response:

```ts
interface JobTicket {
  jobId: string
  status: 'pending'
  createdAt: number
}
```

Canvas job types（画布任务类型）：

- `canvas.generateImage`、`canvas.generateVideo`、`canvas.generateAudio`、
  `canvas.composeVideo`、`canvas.upscaleVideo`、`canvas.muxAudioVideo`
  必须（SHALL）使用资产/报告类终态结果，且不得（SHALL NOT）在入队 IPC 中同步返回
  生成的字节数据或 URL。
- `canvas.polishText` 必须（SHALL）是 CanvasPlan `textPolish` 以及手动 TextNode
  AI 润色所使用的本地文本润色 job 类型。其终态成功结果必须（SHALL）为
  `{ kind: 'text', text }`。

### `job.get`

Request:

```ts
interface JobGetRequest {
  jobId: string
}
```

Response:

```ts
interface JobRecord {
  id: string
  type: JobType
  status: JobStatus
  targetId?: string
  progress: number
  result?: JobResult
  error?: JobError
  createdAt: number
  updatedAt: number
}
```

### Terminal Events（终态事件）

Events:

```ts
type JobTerminalEvent =
  | { channel: 'job.completed'; jobId: string; result: JobResult; emittedAt: number }
  | { channel: 'job.failed'; jobId: string; error: JobError; emittedAt: number }

interface JobProgressEvent {
  channel: 'job.progress'
  jobId: string
  progress: number
  message?: string
  emittedAt: number
}
```

Rules（规则）：

- 合法状态：`pending -> processing -> completed | failed | canceled`。
- 每个 job ID 必须（SHALL）恰好触发一次终态事件。
- 终态结果必须（SHALL）在终态 IPC 触发前完成持久化。
- 处理过程中可以（MAY）触发进度事件，且不计入（SHALL NOT）终态事件。
- 启动恢复流程必须（SHALL）在接受 worker 新工作之前，先协调处理遗留的
  `processing` 状态 job。
- 主进程的事件分发必须（SHALL）通过与 `event.channel` 匹配的白名单 Electron IPC
  通道发送终态事件。
- preload 桥接层必须（SHALL）为 `job.completed` 和 `job.failed` 暴露有类型的订阅
  辅助方法，返回取消订阅回调，且不暴露原始 `ipcRenderer`。
- 渲染层消费者必须（SHALL）使用 IPC 事件订阅加 query 失效来获取终态 job 状态，
  不得使用 `setInterval`、资产轮询循环，或 TanStack Query 的 `refetchInterval`。

### Renderer Reopen Reconciliation（渲染层重新打开时的状态协调）

Rules（规则）：

- 当加载一个工作流图时，渲染层必须（SHALL）通过 `job.list` 查询一次最近的 job，
  并协调错过的终态或正在进行的生成状态。
- 协调范围必须（SHALL）覆盖 image、video、character、scene、audio、
  videoCompose、superResolution、muxAudioVideo 节点的非 MJ 生成类 job，以及
  文本节点的 `canvas.polishText` job。
- 已完成的资产/报告类 job 结果必须（SHALL）为存在的字段修补节点的 `status`、
  `assetId`、`url`、`urls`、`selectedIndex`。
- 生成、合成、混流、超分、音频类 job 的 payload 必须（SHALL）在入队前通过
  workflow 资产解析器解析资产引用：本地 `cc-asset://` 兜底始终有效，云端 URL
  只有在存储已配置且刷新后的主机与配置的 endpoint 或 `publicUrlPrefix` 匹配时，
  才会被刷新或重新签名。
- 已完成的文本润色结果必须（SHALL）修补文本节点的 `content`、`html`，以及
  `polishStatus: 'done'`。
- 失败的 job 必须（SHALL）修补节点 `status: 'error'`，并保留供恢复 UI 使用的安全
  错误信息。
- 失败的文本润色 job 必须（SHALL）修补 `polishStatus: 'error'`，并保留供恢复 UI
  使用的安全错误信息。
- 处于 pending 或 processing 的 job 必须（SHALL）修补节点 `status: 'pending'`，
  并清除过期的 `assetId`。
- 处于 pending 或 processing 的文本润色 job 必须（SHALL）将 `polishStatus`
  修补为 `pending` 或 `running`，且不触碰资产字段。
- 渲染层可以（MAY）在图加载后展示一次性的恢复摘要，但不得（SHALL NOT）轮询
  job 状态。

### Renderer Run History Panel（渲染层运行历史面板）

Rules（规则）：

- 画布运行面板必须（SHALL）将 `job.list` 中的最近 job 渲染为本地运行历史列表，
  且不进行轮询。
- 每条运行历史记录必须（SHALL）展示 job 类型、状态、目标节点、进度，以及可用时
  的安全错误文本。
- 选中一条记录必须（SHALL）展示详情视图，包含逐节点目标、进度、终态输出摘要、
  失败/取消状态，以及错误类别/信息。
- 手动重跑必须（SHALL）调用现有的 `canvas.runNode`/preload 运行入口来针对选中
  的目标节点重跑；不得（SHALL NOT）引入单独的重跑 IPC 通道。
- 终态 job 事件可以（MAY）通过订阅刷新列表，且不需要（SHALL NOT require）渲染层
  使用 `setInterval`。

## Errors

| Error class | Meaning |
| :--- | :--- |
| `job_not_found` | 请求的 ID 不存在对应的 job。 |
| `job_payload_invalid` | payload 未通过 schema 校验。 |
| `job_transition_invalid` | 运行时尝试了非法的状态转换。 |
| `job_worker_interrupted` | 启动恢复流程发现了被遗弃的 worker lease。 |
| `job_retry_exhausted` | 重试策略已耗尽。 |

## Permissions

- 任何 UI 或 agent 调用只能入队其能力策略所允许的 job 类型。
- 消耗服务商额度的 job 需要网关权限策略。
- Job 的取消和重试属于写操作，需要明确的所有权或提升的权限。

## Tests

- Unit：状态机转换表。
- Unit：重复的终态事件触发会被拒绝。
- Integration：入队仅返回票据数据。
- Integration：过期 `processing` 状态的恢复策略是确定性的。
- Integration：终态事件恰好一次地分发到存活的渲染层窗口。
- Renderer：job 终态 IPC 事件在不轮询的前提下使 job 和资产 query 失效。
- Static/deep scan：同步响应中不包含生成的字节数据、绝对路径、安全 URL，或服务商临时 URL。
