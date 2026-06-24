/**
 * 节点类型定义 — 前后端唯一真源
 * @see docs/api-contracts/nodes.md
 */

/** 三种画布节点类型 */
export type NodeType = 'text' | 'image' | 'video'

/** 连线语义 */
export type EdgeType = 'promptOrder' | 'imageRole' | 'default'

/** 图片角色（image → video 时的语义） */
export type ImageRole = 'first_frame' | 'last_frame' | 'reference'

/** 画幅方向 */
export type Orientation = 'landscape' | 'portrait' | 'square'

// ── Node data ──────────────────────────────────────────────

export interface TextNodeData {
  label: string
  content: string
}

export interface ImageNodeData {
  label: string
  /** 用户覆盖的 prompt（空字符串时取上游拼接结果） */
  promptOverride: string
  modelId: string
  orientation: Orientation
  /** 生成结果资产 ID（null = 未生成） */
  assetId: string | null
  status: NodeStatus
}

export interface VideoNodeData {
  label: string
  promptOverride: string
  modelId: string
  orientation: Orientation
  durationSeconds: number
  /** 首帧图资产 ID（可选） */
  firstFrameAssetId: string | null
  /** 尾帧图资产 ID（可选） */
  lastFrameAssetId: string | null
  assetId: string | null
  status: NodeStatus
}

export type NodeStatus = 'idle' | 'pending' | 'running' | 'done' | 'error'

export type CanvasNodeData = TextNodeData | ImageNodeData | VideoNodeData

// ── Edge data ──────────────────────────────────────────────

export interface CanvasEdgeData {
  edgeType: EdgeType
  imageRole?: ImageRole
  /** 连接时间戳（用于确定性 prompt 拼接排序） */
  createdAt: number
}
