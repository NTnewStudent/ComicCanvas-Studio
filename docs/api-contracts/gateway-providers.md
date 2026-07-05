# Gateway Providers Contract

## Owner

- Primary: tooling-agent
- Supporting: orchestrator-agent, pm-agent
- Shared source: `shared/gateway.ts`, `shared/assets.ts`

## Scope

本契约涵盖网关配置、能力校验、归一化的 text/image/video 请求、OpenAI 兼容协议、异步媒体任务协议、热重载，以及密钥处理。

Non-goals：

- CanvasPlan 中不出现特定 provider 的负载。
- DB、日志、LTM、trace、渲染层响应中不出现明文 API key。
- 不将 provider 临时 URL 作为最终资产引用。

## Request/Response Contracts

### `gateway.save`

Request:

```ts
interface GatewayConfigInput {
  id?: string
  name: string
  type: GatewayType
  baseUrl: string
  auth: GatewayAuthInput
  capabilities: GatewayCapability[]
  modelMap: GatewayModelMap
  enabled: boolean
}
```

Response:

```ts
interface GatewayConfigView {
  id: string
  name: string
  type: GatewayType
  baseUrl: string
  capabilities: GatewayCapability[]
  modelMap: GatewayModelMap
  enabled: boolean
  keyRef: string
}
```

### `gateway.invoke`

内部服务请求：

```ts
interface GatewayRequest {
  channel: 'text' | 'image' | 'video'
  modelKey: string
  prompt: string
  references: GatewayReference[]
  parameters: Record<string, unknown>
  idempotencyKey: string
}
```

Response:

```ts
type GatewayResult =
  | { kind: 'text'; text: string; usage?: GatewayUsage }
  | { kind: 'assetBytes'; mediaType: 'image' | 'video'; bytes: Uint8Array; metadata: GatewayMediaMetadata }
  | { kind: 'remoteTask'; remoteTaskId: string; pollAfterMs: number }
```

Rules:

- 初版适配器 SHALL 包含 OpenAI 兼容的 text/chat 与 image 风格请求。
- 异步媒体 provider SHALL 采用提交、轮询/获取状态、拉取字节、归一化结果的流程。
- 异步媒体轮询 SHALL 接受带取消检查与进度回调的 worker 端调用上下文。取消 SHALL 在提交或轮询更多远程工作之前抛出 `provider_canceled`。
- Gateway 结果 SHALL 在被 JobWorker 或 AssetService 消费前完成归一化。

### `gateway.reload`

Request:

```ts
interface GatewayReloadRequest {
  gatewayId?: string
}
```

Response:

```ts
interface GatewayReloadResponse {
  reloadedGatewayIds: string[]
}
```

Rules:

- 保存一个已启用的网关 SHALL 触发该网关的重载，且无需重启应用。
- 带 `gatewayId` 的手动重载 SHALL 只重载该已启用网关；不带 `gatewayId` 的手动重载 SHALL 重载所有已启用网关。
- 注册表重载 SHALL 只替换后续调用使用的 provider handle。
- 已经捕获了 provider handle 的调用 SHALL 继续使用该原始 provider，即便在其完成前发生了重载。
- 若请求省略 `modelKey`，注册表 SHALL 在 preflight 与调用之前，从该请求 channel（`text`、`image` 或 `video`）对应的 provider model map 中解析出该值。

### `gateway.models`

Request: `{}`

Response:

```ts
interface WorkflowModelCatalog {
  models: {
    text: WorkflowModelOption[]
    image: WorkflowModelOption[]
    video: WorkflowModelOption[]
    tool: WorkflowModelOption[]
  }
  availableModelIds: string[]
  capabilityFlags: {
    text: boolean
    image: boolean
    video: boolean
    imageEdit: boolean
    videoFirstFrame: boolean
    videoLastFrame: boolean
    tools: boolean
  }
}
```

Rules:

- `gateway.models` SHALL 从已启用的网关配置及其 `modelMap` 派生出渲染层安全的 text/image/video 模型列表。
- Tool 模型 SHALL 暴露本地工具的运行能力（如 compose、mux、super-resolution），且不暗示远程 provider 支持。
- 响应 SHALL 包含供 UI 与 Agent 规划使用的能力标志，且 SHALL NOT 包含 `keyRef`、明文密钥、鉴权头，或已禁用网关的模型。
- 画布图校验 MAY 消费当前目录 `availableModelIds`，使过时的模型 ID 在保存时降级为警告、在运行时升级为严格错误。

### `gateway.fetchModels`

Request:

```ts
interface GatewayFetchModelsRequest {
  gatewayId?: string
  baseUrl?: string
  auth?: GatewayAuthInput
}
```

Response:

```ts
interface GatewayFetchModelsResponse {
  gatewayId?: string
  models: Array<{
    id: string
    ownedBy?: string
    created?: number
  }>
}
```

Rules:

- `gateway.fetchModels` SHALL 调用由表单或已保存网关 `baseUrl` 推导出的 OpenAI 兼容 `GET /models` 端点。
- 响应 SHALL 将 OpenAI 兼容的 `data[].id`、`owned_by`、`created` 字段归一化为按模型 ID 排序的、渲染层安全的模型记录。
- 重复的模型 ID SHALL 在返回渲染层前被去重。
- 渲染层 MAY 允许用户将拉取到的模型 ID 拖拽进 text、image、video 各 channel 槽位；保存后的输出仍沿用现有 `GatewayModelMap` 契约。
- 响应 SHALL NOT 包含明文密钥、鉴权头或 key 引用。

## Errors

| Error class | Meaning |
| :--- | :--- |
| `gateway_not_found` | 配置的网关 ID 不存在或已禁用。 |
| `gateway_secret_unavailable` | 密钥引用无法解密。 |
| `capability_unsupported` | 请求的 channel/model 不受支持。 |
| `provider_request_failed` | 远程 provider 拒绝或处理请求失败。 |
| `provider_timeout` | 超时策略触发。 |
| `provider_canceled` | 在 provider 到达终态结果之前，worker 端请求了取消。 |
| `provider_payload_invalid` | provider 响应无法归一化。 |

## Permissions

- 保存网关需要 settings 写权限。
- 调用付费或对外联网的 provider 需要网关/工具策略批准。
- API key SHALL 通过 OS/Electron 安全存储或等效的加密本地保险库来存储。

## Tests

- Unit：能力检查在远程提交前拒绝不受支持的 channel/model。
- Unit：网关模型目录不包含密钥与已禁用网关的模型。
- Unit：text 与 image 的 OpenAI 兼容负载归一化。
- Unit：异步媒体轮询能处理完成、失败、超时与取消。
- Integration：保存网关会热重载后续任务，同时进行中的任务保留其原始 provider。
- Redaction：密钥与鉴权头永不出现在日志、trace 或错误中。
