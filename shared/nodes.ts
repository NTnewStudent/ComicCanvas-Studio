/**
 * 节点类型定义 — 前后端唯一真源
 * @see docs/api-contracts/nodes.md
 */

/** 画布节点类型（含 V2 配置节点） */
export type NodeType =
  | 'text'
  | 'image'
  | 'video'
  | 'character'
  | 'scene'
  | 'audio'
  | 'imageConfigV2'
  | 'videoConfigV2'
  | 'videoCompose'
  | 'superResolution'
  | 'muxAudioVideo'
  | 'mjImage'

/** 连线语义 */
export type EdgeType = 'promptOrder' | 'imageOrder' | 'imageRole' | 'outputLink' | 'reference' | 'default'

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
  /** User-visible node title. */
  label: string
  /** Plain-text prompt contribution used by graph compilers. */
  content: string
  /** Optional rich-text HTML representation for renderer editing. */
  html?: string
  /** Optional text polish runtime status surfaced in the renderer. */
  polishStatus?: NodeStatus
  /** Optional model key used by the text polish action. */
  polishModelId?: string
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
  /** Generated safe image URLs for selectable imageConfigV2 results. */
  urls?: string[]
  /** Selected generated result index from `urls`. */
  selectedIndex?: number
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

/** Character semantic node used as prompt/reference context. */
export interface CharacterNodeData {
  /** User-visible character name. */
  label: string
  /** Character description or role biography. */
  description?: string
  /** Stable referenced asset ID when the character has an image. */
  assetId?: string | null
  /** Safe preview URL for the selected character asset. */
  url?: string
  /** Optional structured tags such as real/non-real, age, or costume. */
  tags?: string[]
  /** Optional custom asset category ID for library-origin insertion. */
  categoryId?: string | null
  /** Preferred generation surface for character reference images. */
  viewMode?: 'single' | 'multi'
}

/** Scene semantic node used as environment prompt/reference context. */
export interface SceneNodeData {
  /** User-visible scene name. */
  label: string
  /** Scene description used for prompt composition. */
  description?: string
  /** Stable referenced asset ID when the scene has an image. */
  assetId?: string | null
  /** Safe preview URL for the selected scene asset. */
  url?: string
  /** Optional scene category such as interior, exterior, or prop. */
  category?: string
  /** Optional custom asset category ID for library-origin insertion. */
  categoryId?: string | null
}

/** Audio media node used as a reference or mux input. */
export interface AudioNodeData {
  /** User-visible audio label. */
  label: string
  /** Stable referenced asset ID. */
  assetId: string | null
  /** Safe playback URL. */
  url?: string
  /** Duration in seconds when known. */
  durationSeconds?: number
  /** Runtime status for generated or imported audio. */
  status?: NodeStatus
  /** Semantic role when the audio is used as a reference or mux input. */
  referenceRole?: 'audio' | 'voice' | 'music' | 'sfx'
}

/** Video composition node that concatenates or transitions multiple video sources. */
export interface VideoComposeNodeData {
  /** User-visible node label. */
  label: string
  /** Ordered source video node IDs. */
  inputOrder?: string[]
  /** Optional transition effect name. */
  transitionName?: string | null
  /** Tool model ID or key selected for composition. */
  modelId?: string
  /** Result asset ID after composition completes. */
  assetId?: string | null
  /** Safe result preview URL. */
  url?: string
  /** Runtime status. */
  status: NodeStatus
  /** Last error message, if any. */
  error?: string
}

/** Video super-resolution node. */
export interface SuperResolutionNodeData {
  /** User-visible node label. */
  label: string
  /** Source video node selected for enhancement. */
  inputVideoId?: string
  /** Super-resolution scenario. */
  scene?: 'aigc' | 'short_series' | 'ugc' | 'old_film'
  /** Target resolution. */
  resolution?: '720p' | '1080p' | '4k'
  /** Target frames per second. */
  fps?: number
  /** Result asset ID after enhancement completes. */
  assetId?: string | null
  /** Safe result preview URL. */
  url?: string
  /** Runtime status. */
  status: NodeStatus
  /** Last error message, if any. */
  error?: string
}

/** Audio/video mux node that combines one video input and one audio input. */
export interface MuxAudioVideoNodeData {
  /** User-visible node label. */
  label: string
  /** Tool model ID or key selected for muxing. */
  modelId?: string
  /** Source video node selected for muxing. */
  videoInputId?: string
  /** Source audio node selected for muxing. */
  audioInputId?: string
  /** Result asset ID after mux completes. */
  assetId?: string | null
  /** Safe result preview URL. */
  url?: string
  /** Runtime status. */
  status: NodeStatus
  /** Last error message, if any. */
  error?: string
}

/** Midjourney-style image node that can produce multiple selectable images. */
export interface MjImageNodeData {
  /** User-visible node label. */
  label: string
  /** Prompt used for image generation. */
  prompt?: string
  /** Model ID or key. */
  modelId?: string
  /** Output ratio. */
  ratio?: ImageRatio
  /** Optional node-level style override. */
  stylePresetId?: string
  /** Generated safe image URLs. */
  urls?: string[]
  /** Selected result index from `urls`. */
  selectedIndex?: number
  /** Selected result safe URL. */
  url?: string
  /** Selected result asset ID. */
  assetId?: string | null
  /** Runtime status. */
  status: NodeStatus
  /** Last error message, if any. */
  error?: string
}

export type NodeStatus = 'idle' | 'pending' | 'running' | 'done' | 'error'

export type CanvasNodeData =
  | TextNodeData
  | ImageNodeData
  | VideoNodeData
  | CharacterNodeData
  | SceneNodeData
  | AudioNodeData
  | VideoComposeNodeData
  | SuperResolutionNodeData
  | MuxAudioVideoNodeData
  | MjImageNodeData

// ── Edge data ──────────────────────────────────────────────

export interface CanvasEdgeData {
  edgeType: EdgeType
  /** One-based order for prompt ordering edges. */
  promptOrder?: number
  /** One-based order for image ordering edges. */
  imageOrder?: number
  imageRole?: ImageRole
  /** 连接时间戳（用于确定性 prompt 拼接排序） */
  createdAt: number
  /** 由 @mention 引用自动创建（用于引用清理时识别） */
  createdByMention?: boolean
}
