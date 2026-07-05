# Tools & Agents Contract

> Shared sources: `shared/tools.ts`, `shared/tools-agents.ts`,
> `shared/canvas-actions.ts`, `shared/connection-matrix.ts`,
> `shared/plan.ts`.

本文档记录手动 assets/workflows/canvas 对齐工作完成后，可供 Agent 使用的工具词汇表。它本身并不启用 Agent 自动化；它定义的是未来编排开启后 Agent 可调用的词汇表。

Task 60 preflight: `docs/progress/task-60-agent-plan-apply-readiness.md`.

## Phase A 验收门槛

`HDR-PHASEA-001` 仍是 Phase A 验收门槛。在人工评审通过或产品方明确推迟之前，对已迁移 workflow 词汇表的 Agent 自动化保持禁用。

未来 CanvasPlan 节点词汇表限定为 text、image、video、imageConfigV2、videoConfigV2、character、scene、audio、videoCompose、superResolution、muxAudioVideo。MJ 是已知的历史类型，但在编排、新增路径、运行步骤、URL 刷新和本地自动化中均不可用。

CanvasPlan node vocabulary exact set: text, image, video, imageConfigV2, videoConfigV2, character, scene, audio, videoCompose, superResolution, muxAudioVideo.

未来 CanvasPlan 边词汇表限定为 promptOrder、imageOrder、imageRole、outputLink、reference、default。未来的 Agent 编排必须为规格不明、不安全、无效或不可用的请求保留 clarify 分支和 dropped 警告。

CanvasPlan edge vocabulary exact set: promptOrder, imageOrder, imageRole, outputLink, reference, default.

## 统一 Tool 接口

Agent 通过 `shared/tools.ts` 中的 ToolRuntime descriptor 调用工具。手动 UI 与 ToolRuntime 的图变更共用 `shared/canvas-actions.ts`，以保证持久化 create/connect/delete/default-data 语义一致。渲染层代码可以自行保留 undo 栈、临时选中态、hover 状态、拖拽预览、视口动画，以及本地化的反馈文案。

规则：

- 工具只返回数据、任务票据或安全的错误信息，绝不返回可执行代码。
- 消耗 provider 资源的工具返回持久化的任务票据，而不是生成的字节内容。
- `tool.list` 是已启用工具的发现源。
- `tool.invoke` 是 Agent 和插件的执行入口。
- 在尚未提供 ToolRuntime 包装时，IPC/service 支撑的操作仍是合法的手动等价路径。
- MJ 节点/组件相关操作在本地 Phase A 中不在范围内。`mjImage` 仅作为历史已知的图类型存在。

## Agent 可用工具词汇表

根据当前 `createCanvasTools` descriptor 生成。

| Tool ID | 用途 | Input schema | Output schema | Concurrency | Permissions |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `canvas.queryGraph` | 读取当前画布图的快照。 | `canvas.queryGraph.input` | `canvas.graph.output` | readonly | `canvas.read` |
| `canvas.proposePlan` | 返回 CanvasPlan 草案，不会修改图状态。 | `canvas.proposePlan.input` | `canvas.plan.output` | readonly | `canvas.read` |
| `canvas.validateGraph` | 使用共享图规则校验当前或指定的图。 | `canvas.validateGraph.input` | `canvas.validateGraph.output` | readonly | `canvas.read` |
| `canvas.createNode` | 创建节点；未提供 data 时使用共享默认节点数据填充。 | `canvas.createNode.input` | `canvas.createNode.output` | serial-write | `canvas.write` |
| `canvas.duplicateNode` | 按共享的标签与偏移语义复制单个节点。 | `canvas.duplicateNode.input` | `canvas.duplicateNode.output` | serial-write | `canvas.write` |
| `canvas.renameNode` | 更新节点的 label 字段。 | `canvas.renameNode.input` | `canvas.renameNode.output` | serial-write | `canvas.write` |
| `canvas.setNodePosition` | 持久化保存节点的精确位置。 | `canvas.setNodePosition.input` | `canvas.setNodePosition.output` | serial-write | `canvas.write` |
| `canvas.connectNodes` | 使用共享连接语义创建经校验的边。 | `canvas.connectNodes.input` | `canvas.connectNodes.output` | serial-write | `canvas.write` |
| `canvas.connectToCreate` | 创建目标节点并将其与已存在的源节点连接。 | `canvas.connectToCreate.input` | `canvas.connectToCreate.output` | serial-write | `canvas.write`, `canvas.write` |
| `canvas.deleteEdge` | 删除一条边。 | `canvas.deleteEdge.input` | `canvas.deleteEdge.output` | serial-write | `destructive`, `canvas.write` |
| `canvas.updateEdge` | 更新边的角色/顺序语义数据。 | `canvas.updateEdge.input` | `canvas.updateEdge.output` | serial-write | `canvas.write` |
| `canvas.updateNodeData` | 将部分数据合并进已存在的节点。 | `canvas.updateNodeData.input` | `canvas.updateNodeData.output` | serial-write | `canvas.write` |
| `canvas.extractSelection` | 返回选中的图片段，供片段引用或 Agent 审查使用。 | `canvas.extractSelection.input` | `canvas.graph.output` | readonly | `canvas.read` |
| `canvas.duplicateSelection` | 复制选中的节点以及内部选中的边。 | `canvas.duplicateSelection.input` | `canvas.duplicateSelection.output` | serial-write | `canvas.write`, `canvas.write` |
| `canvas.deleteSelection` | 删除选中的节点/边以及相连的边。 | `canvas.deleteSelection.input` | `canvas.deleteSelection.output` | serial-write | `destructive`, `canvas.write`, `canvas.write` |
| `canvas.layoutSelection` | 对选中节点应用确定性网格布局。 | `canvas.layoutSelection.input` | `canvas.layoutSelection.output` | serial-write | `canvas.write` |
| `canvas.deleteNode` | 删除单个节点以及相连的边。 | `canvas.deleteNode.input` | `canvas.deleteNode.output` | serial-write | `destructive`, `canvas.write` |
| `canvas.runNode` | 将节点对应的共享运行动作入队，并返回任务票据。 | `canvas.runNode.input` | `canvas.runNode.output` | serial-write | `provider.spend` |
| `asset.ensureCloudUrl` | 在需要时将本地资产上传至已配置的 COS/S3 兼容存储，或刷新已有的云端 URL。 | `asset.ensureCloudUrl.input` | `asset.ensureCloudUrl.output` | readonly-or-upload | `file.read`, `network` |

### Schema 说明

- `canvas.createNode` 和 `canvas.connectToCreate` 接受可选的 `data`。
  缺失的数据由 `shared/canvas-actions.ts` 补全。
- `canvas.connectNodes` 和 `canvas.connectToCreate` 会以 `ToolError.code = "invalid_edge"` 拒绝非法或重复的边。
- `canvas.runNode` 在入队前会拒绝不可用的节点定义。
  MJ 在本地 Phase A 中不可用。
- `canvas.runNode` 按节点类型分发生成配置节点：
  `imageConfigV2` 会入队 `canvas.generateImage`，而 `videoConfigV2`
  会入队 `canvas.generateVideo`。
- `canvas.runNode` 在入队前会通过 workflow 资产解析器解析引用资产。对于视频任务，首帧、末帧和参考图输入在已配置存储的情况下必须是 provider 可读取的云端 URL；仅当云存储缺失或被宿主 guard 拒绝时，才回退为本地安全 URL。
- 当持久化队列无法保存任务时，`canvas.runNode` 可能返回可重试的 `job_enqueue_failed`。
- 图的保存/加载/版本/导入/导出，以及片段（snippets）、workflows、styles、jobs、
  assets 和媒体编辑/拖放流程，目前是由 IPC/service 支撑的等价实现，记录在 `docs/api-contracts/tools-plugins.md` 中。
- `asset.ensureCloudUrl` 返回 `{ assetId, url, source, action, s3Key? }`。
  当未配置存储 provider 时，返回本地安全 URL，其中 `source = "local"`、
  `action = "local_fallback"`。

### 权限模型

- `canvas.read`：读取图或校验图，不修改状态。
- `canvas.write`：修改持久化的画布图状态。
- `destructive`：删除图中的元素；当前内置的清理工具允许编排器直接进行此类图编辑，而未来面向用户的 Agent 可能需要征询确认（ask）。
- `provider.spend`：将由网关/provider 支撑的工作入队。
- `file.read`：读取应用管理的资产字节内容，用于云端上传。
- `file.write`：为未来的文件/媒体导出工具预留；当前 Phase A 的
  Canvas 工具不需要此权限。
- `network`：调用已配置的存储/provider 端点。
- 子 Agent 的有效工具集必须是父 Agent 工具集的子集。

### 不支持或仅限手动的操作

- MJ 节点/组件相关操作、MJ 多结果 UI 对齐，以及 MJ URL 刷新，均不在本地 Phase A 范围内。
- Seedance/真人出镜流程不在范围内。
- 仅限渲染层的临时性 UI 行为保留在渲染层状态中：视口适配（viewport fit）、hover 菜单、
  拖拽预览、选框、面板开关状态，以及动画效果。
- 仅限手动的临时性操作示例包括视口适配、hover 菜单、拖拽预览。
- 手动桌面端验收仍是人工评审清单中的一项，而非自动化的 Agent 操作。

### Agent Plan 应用示例

创建一个文本 prompt 节点，创建一个图片生成配置节点，将它们连接起来，然后运行该生成配置节点：

```json
[
  {
    "toolId": "canvas.createNode",
    "input": {
      "type": "text",
      "position": { "x": 0, "y": 0 },
      "data": { "label": "Prompt", "content": "rainy neon alley" }
    }
  },
  {
    "toolId": "canvas.createNode",
    "input": {
      "type": "imageConfigV2",
      "position": { "x": 320, "y": 0 }
    }
  },
  {
    "toolId": "canvas.connectNodes",
    "input": {
      "source": "text-node-id",
      "target": "image-config-node-id",
      "edgeType": "promptOrder"
    }
  },
  {
    "toolId": "canvas.runNode",
    "input": { "nodeId": "image-config-node-id" }
  }
]
```

从一个已绑定的图片引用节点插入一个与之连接的视频生成配置节点。`image` 仍是媒体引用节点，不可运行：

```json
{
  "toolId": "canvas.connectToCreate",
  "input": {
    "source": "image-node-id",
    "type": "videoConfigV2",
    "position": { "x": 640, "y": 0 },
    "edgeType": "imageRole",
    "imageRole": "first_frame"
  }
}
```

## Sub-Agent 工具

`agent.spawnSubAgent` 仍是用于隔离长任务的 Agent 级工具。所申请的工具和 skill 会与父 Agent 的权限取交集；被剔除的条目会被记录审计。递归深度仍受
`MAX_SPAWN_DEPTH(2)` 上限约束。

安全规则：

- 子 Agent 不能获得其父 Agent 所没有的工具。
- 子 Agent 不能绕过 ToolRuntime 权限检查。
- 当意图不明确时，子 Agent 应优先使用 `canvas.proposePlan` 和 `canvas.validateGraph`，
  而不是直接使用写入类工具。
- 消耗 provider 资源的步骤应当明确声明，且只返回任务票据。
</content>
</invoke>
