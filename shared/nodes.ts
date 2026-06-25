/**
 * 节点类型定义 — 前后端唯一真源
 * @see docs/api-contracts/nodes.md
 */

/** 画布节点类型（含 V2 配置节点） */
export type NodeType = 'text' | 'image' | 'video' | 'imageConfigV2' | 'videoConfigV2'

/** 连线语义 */
export type EdgeType = 'promptOrder' | 'imageRole' | 'default'

/** 图片角色（image → video 时的语义） */
export type ImageRole = 'first_frame' | 'last_frame' | 'reference'

/** 画幅方向 */
export type Orientation = 'landscape' | 'portrait' | 'square'

/** 图片比例（V2 扩展 6 种） */
export type ImageRatio = '9:16' | '3:4' | '1:1' | '4:3' | '16:9' | '21:9'

/** 视频比例（V2 扩展 6 种） */
export type VideoRatio = '9:16' | '3:4' | '1:1' | '4:3' | '16:9' | '21:9'

/** 视频分辨率 */
export type VideoResolution = '480p' | '720p' | '1080p'

/** 参考素材（图片/视频） */
export interface ReferenceAsset {
  id: string
  url: string
  type: 'image' | 'video'
  name: string
}

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

  // ── V2 新增字段（均为 optional，向后兼容） ──────────────

  /** 提示词（支持 @提及 token） */
  prompt?: string
  /** 画风预设 ID */
  stylePresetId?: string
  /** 图片比例（V2 扩展为 6 种） */
  ratio?: ImageRatio
  /** 生成结果 URL */
  url?: string
  /** 实际宽高比数值 */
  aspectRatio?: number
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

  // ── V2 新增字段（均为 optional，向后兼容） ──────────────

  /** 提示词（V2 面板） */
  prompt?: string
  /** 画风预设 ID */
  stylePresetId?: string
  /** 视频比例（V2 扩展为 6 种） */
  ratio?: VideoRatio
  /** 时长（秒，5-15） */
  duration?: number
  /** 分辨率 */
  resolution?: VideoResolution
  /** 生成结果 URL */
  url?: string
  /** 首帧素材 ID（V2 面板引用） */
  firstFrameAssetV2Id?: string
  /** 尾帧素材 ID（V2 面板引用） */
  lastFrameAssetV2Id?: string
  /** 参考素材列表 */
  referenceAssets?: ReferenceAsset[]
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
