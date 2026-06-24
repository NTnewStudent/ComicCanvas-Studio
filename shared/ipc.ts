/**
 * IPC 通道契约 — 前后端唯一真源
 * 命名格式：domain.action
 * 请求走 invoke/handle，主动推送走 webContents.send + 渲染层订阅
 * @see docs/api-contracts/ipc.md
 */

// ── Canvas ─────────────────────────────────────────────────
// canvas.chatSend         发送编排对话消息 → { taskId, messageId, status:'pending' }
// canvas.chatGetPlan      拉取 Plan        → CanvasPlan
// canvas.runNode          触发节点生成      → { jobId }
// canvas.saveGraph        保存画布图        → void
// canvas.loadGraph        加载画布图        → GraphSnapshot

// ── Jobs ───────────────────────────────────────────────────
// job.subscribe           订阅任务终态事件（渲染层调一次）
// ↓ 主进程推送（webContents.send）
// job.progress            { jobId, progress: number }
// job.completed           { jobId, assetId, orientation }
// job.failed              { jobId, error: string }

// ── Settings ───────────────────────────────────────────────
// settings.getGateways    → GatewayConfig[]
// settings.saveGateway    → void（保存后热更新 Provider）
// settings.deleteGateway  → void
// settings.getAgents      → AgentDefinition[]
// settings.saveAgent      → void
// settings.deleteAgent    → void
// settings.getTools       → ToolDefinition[]
// settings.toggleTool     → void（启用/禁用后从 ToolRegistry 热插拔）

// ── Assets ─────────────────────────────────────────────────
// asset.getFolders        → AssetFolder[]
// asset.createFolder      → AssetFolder
// asset.moveAsset         → void
// asset.deleteAsset       → void

export type IpcChannel =
  | 'canvas.chatSend'
  | 'canvas.chatGetPlan'
  | 'canvas.runNode'
  | 'canvas.saveGraph'
  | 'canvas.loadGraph'
  | 'job.subscribe'
  | 'job.progress'
  | 'job.completed'
  | 'job.failed'
  | 'settings.getGateways'
  | 'settings.saveGateway'
  | 'settings.deleteGateway'
  | 'settings.getAgents'
  | 'settings.saveAgent'
  | 'settings.deleteAgent'
  | 'settings.getTools'
  | 'settings.toggleTool'
  | 'asset.getFolders'
  | 'asset.createFolder'
  | 'asset.moveAsset'
  | 'asset.deleteAsset'
