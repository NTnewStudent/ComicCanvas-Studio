/**
 * 视频节点 v2 — VideoConfigV2Node
 *
 * 复刻 hjwall VideoConfigV2Node，纯前端 UI（预览卡 + Toolbar + 素材管理 + 时长滑条 + Handle）。
 * 接口桩模拟状态切换，不含实际生视频 API 调用。
 *
 * 结构概览:
 * 1. 顶部悬浮操作栏（hover/selected 时显示上传 + 资产库按钮）
 * 2. 标签行（图标 + 标题 + RunStatusBadge）
 * 3. 预览卡（四态切换：空态 / 生成中 / 完成 / 错误）
 * 4. 选中 Toolbar（960px 宽：MentionTextarea + 素材缩略图 + 状态芯片 + 设置芯片 + 生成按钮）
 * 5. Handle（左右各一）
 * 6. 全屏视频预览 portal
 *
 * @see hjwall/pc-client/src/modules/workflow-canvas/nodes/VideoConfigV2Node.tsx
 */

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
  type CSSProperties,
} from 'react'
import { createPortal } from 'react-dom'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import { useStore } from 'zustand'
import {
  Clapperboard,
  Loader2,
  Download,
  Film,
  Play,
  Pause,
  Clock,
  Square,
  Upload,
  FolderOpen,
  Maximize2,
  X,
  Monitor,
} from 'lucide-react'

import type {
  VideoNodeData,
  VideoRatio,
  VideoResolution,
  NodeStatus,
  CanvasNodeData,
} from '../../../../../../shared/nodes'
import { cn } from '../../lib/cn'
import {
  V2_VIDEO_WIDTH_PORTRAIT,
  V2_VIDEO_WIDTH_LANDSCAPE,
  V2_VIDEO_ASPECT_RATIO,
  V2_NODE_RADIUS,
  isPortraitRatio,
} from '../lib/node-sizing'
import RunStatusBadge from '../components/RunStatusBadge'
import Chip from '../components/Chip'
import PopoverMenu from '../components/PopoverMenu'
import MentionTextarea from '../components/MentionTextarea'
import { canvasStore } from '../store/canvas.store'

// ─── 常量 ──────────────────────────────────────────────────────────────────

const VIDEO_RATIOS: VideoRatio[] = ['9:16', '3:4', '1:1', '4:3', '16:9', '21:9']

const VIDEO_RESOLUTIONS: VideoResolution[] = ['480p', '720p', '1080p']

const RATIO_LABELS: Record<VideoRatio, string> = {
  '9:16': '9:16 (竖屏)',
  '3:4': '3:4 (竖屏)',
  '16:9': '16:9 (横屏)',
  '4:3': '4:3 (横屏)',
  '1:1': '1:1 (方形)',
  '21:9': '21:9 (宽屏)',
}

const DURATION_MIN = 5
const DURATION_MAX = 15
const DURATION_STEP = 1

/** 模拟视频生成延迟（ms） */
const MOCK_GENERATE_DELAY = 2500

// ─── 预览卡尺寸计算 ─────────────────────────────────────────────────────────

interface CardDims {
  width: number
  height: number
}

/**
 * 根据视频比例计算预览卡尺寸。
 * 竖屏比例 (9:16, 3:4) → 宽 180px；横屏/方形 → 宽 240px。
 * 高度通过 CSS aspect-ratio 数值反算。
 */
function getCardDimensions(ratio: VideoRatio): CardDims {
  const width = isPortraitRatio(ratio) ? V2_VIDEO_WIDTH_PORTRAIT : V2_VIDEO_WIDTH_LANDSCAPE
  const aspectRatio = V2_VIDEO_ASPECT_RATIO[ratio] // e.g. "9 / 16"
  const [wPart, hPart] = aspectRatio.split('/').map((s) => Number(s.trim()))

  const height =
    wPart && hPart ? Math.round(width * (hPart / wPart)) : Math.round(width * (16 / 9))

  return { width, height }
}

// ─── 视频预览卡四态 ─────────────────────────────────────────────────────────

type PreviewState = 'empty' | 'generating' | 'done' | 'error'

function derivePreviewState(url: string | undefined, status: NodeStatus): PreviewState {
  if (status === 'pending' || status === 'running') return 'generating'
  if (status === 'error') return 'error'
  if (url && status === 'done') return 'done'
  return 'empty'
}

// ─── 全屏视频预览弹窗 ──────────────────────────────────────────────────────

interface FullscreenPreviewProps {
  url: string
  onClose: () => void
}

const FullscreenVideoPreview: FC<FullscreenPreviewProps> = ({ url, onClose }) => {
  // Escape 关闭
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div
      className="nodrag nowheel dark wf-neo fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 px-5 py-6"
      onClick={onClose}
      data-testid="video-v2-preview-modal"
    >
      <div
        className="relative flex items-center justify-center rounded-2xl bg-black shadow-[0_24px_64px_rgba(0,0,0,0.6)]"
        style={{ maxWidth: 'min(920px, 92vw)', maxHeight: 'min(760px, 86vh)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          className="nodrag absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-black/60 text-white transition-colors hover:bg-black/85 cursor-pointer"
          onClick={onClose}
          title="关闭"
        >
          <X className="h-4 w-4" />
        </button>
        <video
          src={url}
          controls
          autoPlay
          playsInline
          className="block rounded-2xl object-contain"
          style={{ maxWidth: 'min(920px, 92vw)', maxHeight: 'min(760px, 86vh)' }}
        />
      </div>
    </div>,
    document.body,
  )
}

// ─── Toolbar 组件 ──────────────────────────────────────────────────────────

interface ToolbarProps {
  nodeId: string
  data: VideoNodeData
  generating: boolean
  onUpdateData: (patch: Partial<VideoNodeData>) => void
  onMentionSelect?: (mentionedNodeId: string, sourceNodeId: string) => void
  onMentionsChange?: (currentMentionIds: string[], sourceNodeId: string) => void
}

const VideoToolbar: FC<ToolbarProps> = ({ nodeId, data, generating, onUpdateData, onMentionSelect, onMentionsChange }) => {
  const ratio = data.ratio ?? '9:16'
  const duration = data.duration ?? data.durationSeconds ?? 5
  const resolution = data.resolution ?? '720p'
  const prompt = data.prompt ?? ''
  const referenceAssets = data.referenceAssets ?? []

  // ── 状态芯片 mock 数据（纯 UI） ──
  const hasPromptConnection = true // mock: 假定已有 prompt 连线
  const hasFirstFrame = data.firstFrameAssetId !== null || data.firstFrameAssetV2Id != null
  const hasLastFrame = data.lastFrameAssetId !== null || data.lastFrameAssetV2Id != null

  // ── 生成按钮桩 ──
  const handleGenerate = useCallback(() => {
    if (generating) return
    onUpdateData({ status: 'running' })
    setTimeout(() => {
      onUpdateData({
        status: 'done',
        url: 'mock://video-result.mp4',
      })
    }, MOCK_GENERATE_DELAY)
  }, [generating, onUpdateData])

  // ── 比例选择 ──
  const ratioItems = useMemo(
    () =>
      VIDEO_RATIOS.map((r) => ({
        value: r,
        label: RATIO_LABELS[r],
      })),
    [],
  )

  // ── 分辨率选择 ──
  const resolutionItems = useMemo(
    () =>
      VIDEO_RESOLUTIONS.map((r) => ({
        value: r,
        label: r,
      })),
    [],
  )

  return (
    <div
      className="nodrag nowheel relative w-[960px] overflow-visible rounded-[24px] border border-border-primary bg-bg-panel p-4 shadow-card"
    >
      {/* ── 提示词输入 ── */}
      <MentionTextarea
        value={prompt}
        onChange={(v) => onUpdateData({ prompt: v })}
        placeholder="描述视频内容、动作、镜头运动..."
        rows={3}
        className="nodrag nowheel"
        sourceNodeId={nodeId}
        {...(onMentionSelect ? { onMentionSelect } : {})}
        {...(onMentionsChange ? { onMentionsChange } : {})}
      />

      {/* ── 素材缩略图列表 ── */}
      {referenceAssets.length > 0 && (
        <div className="mt-3 flex flex-col gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-text-muted">
            参考素材
          </span>
          <div className="flex flex-wrap gap-2">
            {referenceAssets.map((asset) => (
              <div key={asset.id} className="flex flex-col items-center gap-1">
                <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border border-border-primary/50 bg-bg-input">
                  {asset.url ? (
                    asset.type === 'video' ? (
                      <video
                        src={asset.url}
                        muted
                        playsInline
                        preload="metadata"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <img
                        src={asset.url}
                        alt={asset.name}
                        className="h-full w-full object-cover"
                      />
                    )
                  ) : asset.type === 'video' ? (
                    <Film className="h-6 w-6 text-text-muted opacity-40" />
                  ) : (
                    <Monitor className="h-6 w-6 text-text-muted opacity-40" />
                  )}
                </div>
                <span className="max-w-[64px] truncate text-[10px] leading-none text-text-muted">
                  {asset.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── 状态芯片行 ── */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px]">
        <span
          className={cn(
            'rounded-full px-2 py-0.5 font-medium',
            hasPromptConnection
              ? 'bg-brand/10 text-brand'
              : 'bg-bg-input text-text-muted',
          )}
        >
          prompt 连线 {hasPromptConnection ? '✓' : '○'}
        </span>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 font-medium',
            hasFirstFrame
              ? 'bg-brand/10 text-brand'
              : 'bg-bg-input text-text-muted',
          )}
        >
          首帧 {hasFirstFrame ? '✓' : '○'}
        </span>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 font-medium',
            hasLastFrame
              ? 'bg-brand/10 text-brand'
              : 'bg-bg-input text-text-muted',
          )}
        >
          尾帧 {hasLastFrame ? '✓' : '○'}
        </span>
      </div>

      {/* ── 设置芯片行 ── */}
      <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-border-secondary/50 pt-3">
        {/* 模型 */}
        <Chip
          icon={<Clapperboard className="h-3.5 w-3.5" />}
          label={`${data.modelId || '模型'} ▾`}
          active={!!data.modelId}
          onClick={() => {
            /* 桩：模型选择暂不实现 */
          }}
        />

        {/* 画风 */}
        <Chip
          icon={<Film className="h-3.5 w-3.5" />}
          label="画风 ▾"
          onClick={() => {
            /* 桩：画风选择暂不实现 */
          }}
        />

        {/* 比例 */}
        <PopoverMenu
          trigger={
            <Chip
              icon={<Monitor className="h-3.5 w-3.5" />}
              label={`${RATIO_LABELS[ratio]} ▾`}
              active
            />
          }
          items={ratioItems}
          selected={ratio}
          onSelect={(v) => onUpdateData({ ratio: v as VideoRatio })}
        />

        {/* 时长 */}
        <PopoverMenu
          trigger={
            <Chip
              icon={<Clock className="h-3.5 w-3.5" />}
              label={`${duration}s`}
            />
          }
          items={Array.from({ length: DURATION_MAX - DURATION_MIN + 1 }, (_, i) => {
            const d = DURATION_MIN + i
            return { value: d, label: `${d}s` }
          })}
          selected={duration}
          onSelect={(v) => onUpdateData({ duration: v as number })}
        />

        {/* 分辨率 */}
        <PopoverMenu
          trigger={
            <Chip
              icon={<Square className="h-3.5 w-3.5" />}
              label={`${resolution} ▾`}
            />
          }
          items={resolutionItems}
          selected={resolution}
          onSelect={(v) => onUpdateData({ resolution: v as VideoResolution })}
        />

        {/* 弹性空间 */}
        <div className="ml-auto flex-grow" />

        {/* 生成按钮 */}
        <button
          type="button"
          onClick={handleGenerate}
          disabled={generating}
          data-testid="video-v2-generate-btn"
          className={cn(
            'cc-btn-primary nodrag flex shrink-0 items-center justify-center gap-1.5 rounded-xl px-5 py-2 text-[13px] font-bold shadow-sm transition-all',
            'disabled:cursor-not-allowed disabled:opacity-50',
          )}
          style={{ height: 36 }}
        >
          {generating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>生成中...</span>
            </>
          ) : (
            <>
              <Clapperboard className="h-4 w-4" />
              <span>生成视频</span>
            </>
          )}
        </button>
      </div>
    </div>
  )
}

// ─── 主组件 ────────────────────────────────────────────────────────────────

const VideoConfigV2Node: FC<NodeProps> = ({ id, data, selected }) => {
  const d = data as unknown as VideoNodeData

  // ── Store (vanilla zustand → React hook) ──
  const runStatus = useStore(canvasStore, (s) => s.getNodeRunStatus(id))

  // ── 本地状态 ──
  const [isHovered, setIsHovered] = useState(false)
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false)
  const [isPreviewPinned, setIsPreviewPinned] = useState(false)
  const [fullscreenUrl, setFullscreenUrl] = useState<string | null>(null)

  const previewVideoRef = useRef<HTMLVideoElement>(null)
  const showControls = isHovered || !!selected

  // ── 派生值 ──
  const ratio = d.ratio ?? '9:16'
  const url = d.url
  const hasResult = typeof url === 'string' && !!url
  const status = d.status
  const previewState = derivePreviewState(url, status)
  const generating = previewState === 'generating'

  // 预览卡尺寸：无结果时固定 9:16，有结果时按实际比例
  const displayRatio: VideoRatio = hasResult ? ratio : '9:16'
  const { width: cardWidth, height: cardHeight } = getCardDimensions(displayRatio)

  const errorMessage = status === 'error' ? '视频生成失败' : undefined

  // ── 数据更新 ──
  const updateData = useCallback(
    (patch: Partial<VideoNodeData>) => {
      canvasStore.getState().updateNodeData(id, patch as Partial<CanvasNodeData>)
    },
    [id],
  )

  // ── @mention 自动连线管理 ──
  const handleMentionSelect = useCallback(
    (mentionedNodeId: string, srcNodeId: string) => {
      const state = canvasStore.getState()
      const exists = state.edges.some(
        (e) => e.source === srcNodeId && e.target === mentionedNodeId,
      )
      if (exists) return
      const result = state.addEdge(srcNodeId, mentionedNodeId)
      if (result.ok) {
        const edges = canvasStore.getState().edges
        const updated = edges.map((e) =>
          e.id === result.edgeId ? { ...e, data: { ...e.data, createdByMention: true } } : e,
        )
        canvasStore.getState().setEdges(updated)
      }
    },
    [],
  )

  const handleMentionsChange = useCallback(
    (currentMentionIds: string[], srcNodeId: string) => {
      const state = canvasStore.getState()
      const filtered = state.edges.filter((edge) => {
        if (edge.source !== srcNodeId) return true
        if (!edge.data.createdByMention) return true
        return currentMentionIds.includes(edge.target)
      })
      if (filtered.length !== state.edges.length) {
        state.setEdges(filtered)
      }
    },
    [],
  )

  // ── 视频播放控制 ──
  const playPreview = useCallback(() => {
    const video = previewVideoRef.current
    if (!video || !url || generating) return
    void video.play().then(
      () => setIsPreviewPlaying(true),
      () => setIsPreviewPlaying(false),
    )
  }, [url, generating])

  const pausePreview = useCallback(() => {
    const video = previewVideoRef.current
    if (!video) return
    video.pause()
    setIsPreviewPlaying(false)
  }, [])

  const handlePreviewMouseEnter = useCallback(() => {
    if (!isPreviewPinned) playPreview()
  }, [isPreviewPinned, playPreview])

  const handlePreviewMouseLeave = useCallback(() => {
    if (!isPreviewPinned) pausePreview()
  }, [isPreviewPinned, pausePreview])

  const handleTogglePreview = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (isPreviewPlaying) {
        setIsPreviewPinned(false)
        pausePreview()
      } else {
        setIsPreviewPinned(true)
        playPreview()
      }
    },
    [isPreviewPlaying, pausePreview, playPreview],
  )

  const handleOpenFullscreen = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (url) setFullscreenUrl(url)
    },
    [url],
  )

  const handleDownload = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      if (!url) return
      const a = document.createElement('a')
      a.href = url
      a.download = `video-${id}.mp4`
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
    },
    [url, id],
  )

  // url 变化时重置播放状态
  useEffect(() => {
    setIsPreviewPinned(false)
    setIsPreviewPlaying(false)
  }, [url])

  // ── 顶部操作栏桩事件 ──
  const handleUploadClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    // 桩：上传功能暂未实现
  }, [])

  const handleAssetLibraryClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    // 桩：资产库功能暂未实现
  }, [])

  // ── 预览卡样式 ──
  const previewCardStyle: CSSProperties = {
    width: cardWidth,
    height: cardHeight,
    borderRadius: V2_NODE_RADIUS,
    overflow: 'hidden',
    position: 'relative',
    cursor: 'pointer',
  }

  return (
    <div
      className="relative flex flex-col select-none items-center"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* ── 顶部悬浮操作栏 ── */}
      {showControls && (
        <div
          className="border border-border-primary bg-bg-panel shadow-card"
          style={{
            position: 'absolute',
            zIndex: 20,
            top: -40,
            left: '50%',
            transform: 'translateX(-50%)',
            width: 280,
            height: 32,
            borderRadius: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 3,
            backdropFilter: 'blur(8px)',
            padding: '2px 4px',
          }}
        >
          <button
            type="button"
            className="nodrag flex cursor-pointer items-center gap-1 rounded-full border-none bg-transparent px-3 py-1 text-[12px] font-medium text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-base"
            onClick={handleUploadClick}
          >
            <Upload className="h-3.5 w-3.5" style={{ strokeWidth: 2.2 }} />
            上传
          </button>
          <button
            type="button"
            className="nodrag flex cursor-pointer items-center gap-1 rounded-full border-none bg-transparent px-3 py-1 text-[12px] font-medium text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-base"
            onClick={handleAssetLibraryClick}
          >
            <FolderOpen className="h-3.5 w-3.5" style={{ strokeWidth: 2.2 }} />
            资产库
          </button>
        </div>
      )}

      {/* ── 标签行 ── */}
      <article className={cn('cc-node-card relative flex flex-col items-center p-0')}>
        <header className="flex w-full items-center gap-[5px] self-start px-3 pt-2.5 pb-1.5 text-[12px] text-text-muted">
          <Film className="h-3.5 w-3.5 text-text-muted" />
          <span className="font-semibold text-text-muted">
            {d.label || '视频配置'}
          </span>
          <RunStatusBadge status={runStatus} className="ml-auto" />
        </header>

        {/* ── 预览卡 ── */}
        <div className="relative px-3 pb-3" style={{ width: cardWidth + 24 }}>
          <div
            data-testid="video-v2-preview"
            className={cn(
              'group relative border border-border-primary bg-canvas-surface shadow-card transition-all duration-200',
              selected && 'border-2 border-brand',
            )}
            style={previewCardStyle}
            onMouseEnter={handlePreviewMouseEnter}
            onMouseLeave={handlePreviewMouseLeave}
          >
            {/* ── 完成态：视频播放 ── */}
            {previewState === 'done' && url && (
              <>
                <video
                  ref={previewVideoRef}
                  src={url}
                  loop
                  muted
                  playsInline
                  controls={false}
                  className="cc-media-reveal absolute inset-0 h-full w-full object-cover"
                  data-testid="video-v2-video"
                  onPlay={() => setIsPreviewPlaying(true)}
                  onPause={() => setIsPreviewPlaying(false)}
                />

                {/* 播放/暂停覆盖层 */}
                <div
                  className={cn(
                    'absolute inset-0 flex items-center justify-center transition-all duration-200',
                    isPreviewPlaying
                      ? 'bg-black/0 opacity-0 hover:bg-black/20 hover:opacity-100'
                      : 'bg-black/18 opacity-100',
                  )}
                >
                  <button
                    type="button"
                    onClick={handleTogglePreview}
                    data-testid="video-v2-preview-toggle"
                    className="nodrag flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-white/50 bg-white/20 text-white shadow-[0_8px_24px_rgba(0,0,0,0.18)] backdrop-blur-md transition-all hover:scale-105 hover:bg-white/30"
                    title={isPreviewPlaying ? '暂停预览' : '播放预览'}
                  >
                    {isPreviewPlaying ? (
                      <Pause className="h-5 w-5 fill-current" strokeWidth={2.4} />
                    ) : (
                      <Play className="ml-0.5 h-5 w-5 fill-current" strokeWidth={2.4} />
                    )}
                  </button>
                </div>

                {/* 预览状态标签 */}
                <div
                  className={cn(
                    'pointer-events-none absolute left-2.5 top-2.5 rounded-full border border-white/25 bg-black/28 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-md transition-opacity',
                    isPreviewPlaying ? 'opacity-100' : 'opacity-0',
                  )}
                >
                  {isPreviewPinned ? '正在预览' : '悬停预览'}
                </div>

                {/* 放大预览按钮 */}
                <button
                  type="button"
                  onClick={handleOpenFullscreen}
                  data-testid="video-v2-zoom"
                  className="nodrag absolute right-2.5 top-2.5 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full border border-white/30 bg-black/30 text-white opacity-0 shadow-sm backdrop-blur-md transition-all hover:bg-black/45 hover:opacity-100 group-hover:opacity-100"
                  title="放大预览"
                >
                  <Maximize2 className="h-3.5 w-3.5" />
                </button>

                {/* 下载按钮 */}
                <button
                  type="button"
                  onClick={handleDownload}
                  className="nodrag absolute bottom-2.5 right-2.5 flex cursor-pointer items-center gap-1 rounded-md border-none bg-white/15 px-2 py-1 text-[11px] text-white backdrop-blur-sm transition-colors hover:bg-white/25"
                  title="下载"
                >
                  <Download className="h-3 w-3" />
                  下载
                </button>
              </>
            )}

            {/* ── 生成中态 ── */}
            {previewState === 'generating' && (
              <div
                className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-[20px] bg-black/35"
                data-testid="video-v2-loading"
              >
                <div className="cc-generating-ring flex h-10 w-10 items-center justify-center rounded-full border-2 border-brand">
                  <Loader2 className="h-5 w-5 animate-spin text-white" />
                </div>
                <span className="text-[12px] text-white/90">视频生成中...</span>
              </div>
            )}

            {/* ── 错误态 ── */}
            {previewState === 'error' && errorMessage && (
              <div
                className="cc-failed-shake absolute inset-0 flex flex-col items-center justify-center gap-1.5 rounded-[20px] bg-black/40 p-3"
              >
                <X className="h-6 w-6 text-semantic-negative" />
                <span className="text-center text-[11px] leading-[1.4] text-semantic-negative">
                  {errorMessage}
                </span>
              </div>
            )}

            {/* ── 空态 ── */}
            {previewState === 'empty' && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex h-[34px] w-[52px] items-center justify-center rounded-xl bg-bg-input/60">
                  <Play className="ml-0.5 h-4 w-4 fill-current text-white/80" strokeWidth={2.5} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Handle ── */}
        <Handle
          type="target"
          position={Position.Left}
          id="left"
          className="cc-handle"
        />
        <Handle
          type="source"
          position={Position.Right}
          id="right"
          className="cc-handle"
        />
      </article>

      {/* ── Toolbar（仅选中时显示） ── */}
      {selected && (
        <div
          className="absolute z-30"
          style={{ top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 8 }}
        >
          <VideoToolbar
            nodeId={id}
            data={d}
            generating={generating}
            onUpdateData={updateData}
            onMentionSelect={handleMentionSelect}
            onMentionsChange={handleMentionsChange}
          />
        </div>
      )}

      {/* ── 全屏视频预览 ── */}
      {fullscreenUrl !== null && (
        <FullscreenVideoPreview
          url={fullscreenUrl}
          onClose={() => setFullscreenUrl(null)}
        />
      )}
    </div>
  )
}

export default memo(VideoConfigV2Node)
