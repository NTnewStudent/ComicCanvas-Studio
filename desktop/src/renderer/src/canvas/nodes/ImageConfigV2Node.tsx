/**
 * ImageConfigV2Node — 生图节点 V2
 *
 * 将提示词、生成配置与图片结果预览收敛在单个节点内。
 * 纯前端 UI，不含实际生图 API 调用；接口桩模拟状态流转。
 *
 * @see docs/api-contracts/canvas-plan.md
 */

import { memo, useCallback, useEffect, useMemo, useRef, useState, type FC } from 'react'
import { createPortal } from 'react-dom'
import { Handle, Position } from '@xyflow/react'
import { useStore } from 'zustand'
import {
  Download,
  Eye,
  Image as ImageIcon,
  ImagePlus,
  Loader2,
  Maximize2,
  Palette,
  RefreshCcw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'

import type { ImageNodeData, ImageRatio } from '../../../../../../shared/nodes'
import { cn } from '../../lib/cn'
import {
  V2_IMAGE_ASPECT_RATIO,
} from '../lib/node-sizing'
import { canvasStore } from '../store/canvas.store'
import RunStatusBadge from '../components/RunStatusBadge'
import Chip from '../components/Chip'
import PopoverMenu from '../components/PopoverMenu'
import PromptFocusModal from '../components/PromptFocusModal'
import MentionTextarea from '../components/MentionTextarea'

// ── 常量 ──────────────────────────────────────────────────────

/** 六种图片比例选项 */
const RATIO_OPTIONS: { value: ImageRatio; label: string }[] = [
  { value: '9:16', label: '9:16 竖屏' },
  { value: '3:4', label: '3:4 竖版' },
  { value: '1:1', label: '1:1 方形' },
  { value: '4:3', label: '4:3 横版' },
  { value: '16:9', label: '16:9 横屏' },
  { value: '21:9', label: '21:9 超宽' },
]

/** 模拟模型列表（纯前端桩数据） */
const MOCK_MODELS = [
  { id: 'sd-xl', label: 'SDXL' },
  { id: 'flux-pro', label: 'Flux Pro' },
  { id: 'flux-dev', label: 'Flux Dev' },
  { id: 'dall-e-3', label: 'DALL·E 3' },
]

/** 画风预设选项（纯前端桩数据） */
const STYLE_PRESETS = [
  { id: 'anime', label: '动漫风' },
  { id: 'realistic', label: '写实风' },
  { id: 'watercolor', label: '水彩风' },
  { id: 'oil-painting', label: '油画风' },
  { id: 'pixel-art', label: '像素风' },
  { id: 'sketch', label: '素描风' },
]

/** 接口桩：模拟生成延迟（毫秒） */
const MOCK_GENERATE_DELAY = 3000

// ── 辅助函数 ──────────────────────────────────────────────────

/**
 * 触发浏览器下载当前结果图。
 * @param url 图片 URL
 * @param nodeId 节点 ID，用作文件名兜底
 */
function downloadImage(url: string, nodeId: string): void {
  const a = document.createElement('a')
  a.href = url
  a.download = `image-${nodeId}.png`
  a.target = '_blank'
  a.rel = 'noopener noreferrer'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}

// ── Props ─────────────────────────────────────────────────────

interface ImageConfigV2NodeProps {
  id: string
  data: ImageNodeData
  selected?: boolean
}

// ── 组件 ──────────────────────────────────────────────────────

const ImageConfigV2Node: FC<ImageConfigV2NodeProps> = ({
  id,
  data,
  selected,
}) => {
  // ── Store 订阅 ──
  const updateNodeData = useStore(canvasStore, (s) => s.updateNodeData)
  const deleteNode = useStore(canvasStore, (s) => s.deleteNode)
  const setNodeRunStatus = useStore(canvasStore, (s) => s.setNodeRunStatus)
  const getNodeRunStatus = useStore(canvasStore, (s) => s.getNodeRunStatus)

  // ── 本地状态 ──
  const [isHovered, setIsHovered] = useState(false)
  const [isFocusModeOpen, setIsFocusModeOpen] = useState(false)
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const titleInputRef = useRef<HTMLInputElement>(null)

  // ── 数据提取 ──
  const d = data as ImageNodeData
  const status = getNodeRunStatus(id)
  const displayUrl = d.url ?? ''
  const generating = status === 'pending' || status === 'running'
  const hasError = status === 'error'
  const ratio = d.ratio ?? '1:1'
  const aspectRatio = V2_IMAGE_ASPECT_RATIO[ratio]
  const modelId = d.modelId ?? ''
  const modelLabel = MOCK_MODELS.find((m) => m.id === modelId)?.label ?? '选择模型'
  const styleLabel = STYLE_PRESETS.find((s) => s.id === d.stylePresetId)?.label ?? '选择画风'
  const ratioLabel = RATIO_OPTIONS.find((r) => r.value === ratio)?.label ?? ratio
  const showControls = selected || isHovered

  // ── 标题编辑 ──
  useEffect(() => {
    if (isEditingTitle && titleInputRef.current) {
      titleInputRef.current.focus()
      titleInputRef.current.select()
    }
  }, [isEditingTitle])

  const handleTitleDoubleClick = useCallback(() => {
    setIsEditingTitle(true)
  }, [])

  const handleTitleBlur = useCallback(() => {
    setIsEditingTitle(false)
  }, [])

  const handleTitleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        setIsEditingTitle(false)
      }
    },
    [],
  )

  // ── 生成桩 ──
  const handleGenerate = useCallback(() => {
    if (generating) return
    setNodeRunStatus(id, 'running')
    updateNodeData(id, { url: '' })
    window.setTimeout(() => {
      setNodeRunStatus(id, 'idle')
    }, MOCK_GENERATE_DELAY)
  }, [id, generating, setNodeRunStatus, updateNodeData])

  // ── 下载 ──
  const handleDownload = useCallback(() => {
    if (!displayUrl) return
    downloadImage(displayUrl, id)
  }, [displayUrl, id])

  // ── 删除 ──
  const handleDelete = useCallback(() => {
    deleteNode(id)
  }, [id, deleteNode])

  // ── 全屏预览 ESC 关闭 ──
  useEffect(() => {
    if (!previewImageUrl) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setPreviewImageUrl(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [previewImageUrl])

  // ── Popover 选择回调 ──
  const handleModelSelect = useCallback(
    (value: string) => {
      updateNodeData(id, { modelId: value })
    },
    [id, updateNodeData],
  )

  const handleRatioSelect = useCallback(
    (value: ImageRatio) => {
      updateNodeData(id, { ratio: value })
    },
    [id, updateNodeData],
  )

  const handleStyleSelect = useCallback(
    (value: string) => {
      updateNodeData(id, { stylePresetId: value })
    },
    [id, updateNodeData],
  )

  // ── Popover 项列表 ──
  const modelItems = useMemo(
    () => MOCK_MODELS.map((m) => ({ value: m.id, label: m.label })),
    [],
  )

  const ratioItems = useMemo(
    () => RATIO_OPTIONS.map((r) => ({ value: r.value, label: r.label })),
    [],
  )

  const styleItems = useMemo(
    () => [
      { value: '', label: '不限制画风' },
      ...STYLE_PRESETS.map((s) => ({ value: s.id, label: s.label })),
    ],
    [],
  )

  return (
    <div
      className="relative flex flex-col select-none items-center"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* ══════ 标签行 ══════ */}
      <header className="mb-1.5 flex items-center gap-1.5 px-1 text-xs font-medium text-text-muted">
        <ImagePlus className="h-3.5 w-3.5 text-text-muted" />
        {isEditingTitle ? (
          <input
            ref={titleInputRef}
            className="nodrag w-[140px] rounded border border-brand bg-bg-input px-1 py-0.5 text-[12px] text-text-base outline-none"
            value={d.label}
            onChange={(e) => updateNodeData(id, { label: e.target.value })}
            onBlur={handleTitleBlur}
            onKeyDown={handleTitleKeyDown}
          />
        ) : (
          <span
            className="max-w-[190px] cursor-pointer truncate"
            onDoubleClick={handleTitleDoubleClick}
            title="双击重命名"
          >
            {d.label || '生图节点'}
          </span>
        )}
        <RunStatusBadge status={status} />
      </header>

      {/* ══════ 预览卡 ══════ */}
      <div
        className={cn(
          'cc-node-card group relative w-[360px] overflow-hidden rounded-[20px]',
          selected && 'cc-node-selected',
          generating && 'cc-generating-ring',
          hasError && 'cc-failed-shake',
        )}
      >
        {/* 删除按钮 */}
        {showControls && (
          <button
            type="button"
            onClick={handleDelete}
            className="nodrag absolute right-3 top-3 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white opacity-0 shadow-md transition-all hover:bg-black group-hover:opacity-100"
            title="删除节点"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}

        {/* 预览区域 */}
        <div
          className="cc-preview-card relative w-full rounded-[20px]"
          style={{ aspectRatio }}
          data-testid="image-config-v2-preview"
        >
          {generating ? (
            /* 生成中 */
            <div
              data-testid="image-config-v2-loading"
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-bg-input text-text-secondary"
            >
              <Loader2 className="h-7 w-7 animate-spin text-brand" />
              <span className="text-[12px] font-bold">图片生成中...</span>
            </div>
          ) : displayUrl ? (
            /* 完成 */
            <img
              key={displayUrl}
              data-testid="image-config-v2-image"
              src={displayUrl}
              alt={d.label || '生成图片'}
              className="cc-media-reveal h-full w-full object-contain"
              loading="lazy"
              decoding="async"
            />
          ) : hasError ? (
            /* 错误 */
            <div
              data-testid="image-config-v2-error"
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-5 text-center text-text-secondary"
            >
              <X className="h-7 w-7 text-semantic-negative" />
              <span className="line-clamp-3 text-[12px] font-medium">生成失败</span>
            </div>
          ) : (
            /* 空态 */
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-text-muted">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-bg-card">
                <ImageIcon className="h-6 w-6 opacity-60" />
              </span>
              <span className="text-[12px] font-bold">暂无图片</span>
            </div>
          )}

          {/* hover 浮层 */}
          {displayUrl && !generating && showControls && (
            <div className="absolute inset-x-3 bottom-3 flex justify-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                type="button"
                onClick={() => setPreviewImageUrl(displayUrl)}
                className="nodrag flex h-8 w-8 items-center justify-center rounded-full bg-black/65 text-white shadow-md transition-colors hover:bg-black"
                title="预览放大"
                data-testid="image-config-v2-zoom"
              >
                <Eye className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="nodrag flex h-8 w-8 items-center justify-center rounded-full bg-black/65 text-white shadow-md transition-colors hover:bg-black"
                title="下载图片"
              >
                <Download className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating}
                className="nodrag flex h-8 w-8 items-center justify-center rounded-full bg-black/65 text-white shadow-md transition-colors hover:bg-black disabled:opacity-50"
                title="重新生成"
              >
                <RefreshCcw className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ══════ 选中 Toolbar ══════ */}
      {selected && (
        <div
          className="absolute z-30"
          style={{ top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 4 }}
          data-testid="image-config-v2-toolbar"
        >
          <div
            className="nodrag nowheel relative w-[960px] overflow-visible rounded-[24px] border border-border-primary bg-bg-panel px-5 pb-3.5 pt-4 shadow-card"
          >
            {/* 提示词输入 */}
            <div className="relative min-h-[78px]">
              <MentionTextarea
                value={d.prompt ?? ''}
                onChange={(value) => updateNodeData(id, { prompt: value })}
                placeholder="描述你想要生成的画面、角色、情绪和镜头..."
                rows={3}
                className="nodrag nowheel"
              />
              <button
                type="button"
                className="nodrag absolute right-0 top-0 flex h-8 w-8 items-center justify-center rounded-xl border-none bg-transparent text-text-muted transition-colors hover:bg-bg-hover hover:text-text-base"
                onClick={() => setIsFocusModeOpen(true)}
                title="专注模式"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
            </div>

            {/* 芯片行 */}
            <div
              className="mt-2 flex flex-wrap items-center gap-2 border-t border-border-secondary/50 pt-2.5 text-[12px]"
              data-testid="image-config-v2-controls"
            >
              {/* 模型选择 */}
              <PopoverMenu
                trigger={
                  <Chip
                    icon={<ImagePlus className="h-3.5 w-3.5" />}
                    label={`${modelLabel} ▾`}
                    active={!!modelId}
                  />
                }
                items={modelItems}
                selected={modelId}
                onSelect={handleModelSelect}
              />

              {/* 比例选择 */}
              <PopoverMenu
                trigger={
                  <Chip
                    icon={<ImageIcon className="h-3.5 w-3.5" />}
                    label={`${ratioLabel} ▾`}
                    active
                  />
                }
                items={ratioItems}
                selected={ratio}
                onSelect={handleRatioSelect}
              />

              {/* 画风选择 */}
              <PopoverMenu
                trigger={
                  <Chip
                    icon={<Palette className="h-3.5 w-3.5" />}
                    label={`${styleLabel} ▾`}
                    active={!!d.stylePresetId}
                  />
                }
                items={styleItems}
                selected={d.stylePresetId ?? ''}
                onSelect={handleStyleSelect}
              />

              {/* 弹性空间 */}
              <div className="min-w-4 flex-1" />

              {/* 生成按钮 */}
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating}
                data-testid="image-config-v2-generate-btn"
                className="nodrag cc-btn-primary flex h-9 min-w-[112px] items-center justify-center gap-1.5 rounded-xl px-4 text-[13px] font-bold shadow-sm transition-all disabled:opacity-50"
                title={displayUrl ? '重新生成' : '生成图片'}
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    生成中...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    {displayUrl ? '重新生成' : '生成图片'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════ Handle ══════ */}
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

      {/* ══════ 专注模式弹窗 ══════ */}
      <PromptFocusModal
        open={isFocusModeOpen}
        onClose={() => setIsFocusModeOpen(false)}
        value={d.prompt ?? ''}
        onChange={(prompt) => updateNodeData(id, { prompt })}
      />

      {/* ══════ 全屏图片预览 Portal ══════ */}
      {previewImageUrl !== null &&
        createPortal(
          <div
            className="nodrag nowheel dark wf-neo fixed inset-0 z-[9999] flex items-center justify-center bg-black/75"
            onClick={() => setPreviewImageUrl(null)}
          >
            <div
              className="relative flex items-center justify-center rounded-2xl bg-bg-panel shadow-[0_24px_64px_rgba(0,0,0,0.6)]"
              style={{ maxWidth: 'min(900px, 90vw)', maxHeight: 'min(760px, 86vh)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/85"
                onClick={() => setPreviewImageUrl(null)}
                title="关闭预览"
              >
                <X className="h-4 w-4" />
              </button>
              <img
                src={previewImageUrl}
                alt="全屏预览"
                className="block rounded-2xl object-contain"
                style={{ maxWidth: 'min(900px, 90vw)', maxHeight: 'min(760px, 86vh)' }}
              />
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}

export default memo(ImageConfigV2Node)
