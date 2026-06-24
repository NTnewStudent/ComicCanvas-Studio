/**
 * Tool 与 Agent 系统类型 — 前后端唯一真源
 * @see docs/api-contracts/tools-agents.md
 */

// ── Tools ──────────────────────────────────────────────────

export type ToolCategory = 'canvas' | 'file' | 'web' | 'model' | 'custom'
export type ToolSource   = 'builtin' | 'plugin'

export interface ToolDefinition {
  id: string            // 唯一 ID，如 "canvas.createNode"
  name: string          // 展示名
  description: string
  category: ToolCategory
  source: ToolSource
  isReadOnly: boolean
  /** 插件 Tool 的入口模块路径（builtin 为 null） */
  modulePath: string | null
  enabled: boolean
}

// ── Agents ─────────────────────────────────────────────────

export type AgentType   = 'builtin' | 'user'
export type AgentEffort = 'low' | 'medium' | 'high'

export interface AgentDefinition {
  id: string
  name: string
  description: string
  type: AgentType
  systemPrompt: string
  /** 绑定的模型网关配置 ID */
  gatewayId: string
  modelId: string
  /** 允许的工具 ID 列表；'*' 表示全部（super-agent 用）*/
  allowedTools: string[] | '*'
  maxTurns: number
  effort: AgentEffort
  enabled: boolean
}

// ── Sub-Agent Spawn（agent.spawnSubAgent 工具）─────────────
//
// super-agent 在长任务 / 需要上下文隔离 / 并行分解时，调用 spawnSubAgent
// 在隔离上下文里跑一个子 agent 主循环，跑完只返回最终结果，不污染父上下文。
//
// MVP 阶段用「内联定义」模式：调用点直接传完整子 agent 配置，不依赖 Registry。
// 后续接 Registry 时可加 agentId 查表模式（保留扩展位，本期不实现）。

/**
 * 子 agent 内联定义。权限边界在调用点锁死，不依赖外部注册表状态。
 */
export interface SubAgentSpec {
  /** 子任务描述（喂给子 agent 的初始 prompt） */
  task: string
  /** 子 agent 系统提示词 */
  systemPrompt: string
  /**
   * 子 agent 允许的工具白名单。
   * 约束：必须 ⊆ 父 agent 的 allowedTools（禁止提权）。
   * 运行时强制求交集，越界工具被静默剔除并记入 droppedTools。
   */
  allowedTools: string[]
  /** 复用父 agent 的网关/模型，或显式指定 */
  modelId?: string
  /** turn 预算上限，超出强制终止 */
  maxTurns: number
  effort?: AgentEffort
}

export interface SpawnSubAgentInput {
  /** 内联子 agent 定义（MVP 模式） */
  spec: SubAgentSpec
  /**
   * 当前 spawn 深度（运行时注入，调用方不填）。
   * 根 agent = 0；每 spawn 一层 +1。
   */
  depth?: number
}

export interface SpawnSubAgentResult {
  /** 子 agent 最终产出文本 */
  output: string
  status: 'completed' | 'failed' | 'aborted' | 'max_turns_exceeded'
  turnsUsed: number
  /** 因越权被剔除的工具（提权尝试审计） */
  droppedTools: string[]
  error?: string
}

// ── Sub-Agent 安全红线（运行时强制）─────────────────────────
//
// 1. 权限继承：子 agent allowedTools ⊆ 父 agent allowedTools，禁止提权。
// 2. 递归深度上限：MAX_SPAWN_DEPTH 层后，spawnSubAgent 工具对该 agent 不可用。
// 3. turn 预算：每个子 agent 独立 maxTurns，超出标记 max_turns_exceeded 并终止。
// 4. 可中止：长任务子 agent 走任务队列语义，用户可中止（status='aborted'）。

/** 子 agent 最大递归深度（根=0，最多再 spawn 2 层） */
export const MAX_SPAWN_DEPTH = 2 as const

// ── Model Gateway ──────────────────────────────────────────

export type GatewayType = 'openai_compat' // 支持扩展

export interface GatewayConfig {
  id: string
  name: string
  type: GatewayType
  baseUrl: string
  /** 模型到 endpoint 的映射 */
  modelMappings: {
    text?: string
    image?: string
    video?: string
  }
  enabled: boolean
  /** API Key 存 OS safeStorage，这里只存引用标识 */
  keyRef: string
}

// ── Asset Folders ──────────────────────────────────────────

export interface AssetFolder {
  id: string
  name: string
  parentId: string | null
  type: 'image' | 'video' | 'mixed'
  /** 相对 appData/assets/ 的路径 */
  relativePath: string
  createdAt: number
}
