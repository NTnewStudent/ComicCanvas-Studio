/**
 * ImageConfigV2Node - 图片生成节点 V2。
 *
 * 将提示词、生成配置与图片结果预览收拢在单个节点内。
 * 纯前端 UI，不含实际生图 API 调用；接口桩模拟状态流转。
 *
 * @see docs/api-contracts/canvas-plan.md
 */

import { memo, useCallback, useEffect, useMemo, useRef, useState, type FC } from 'react'
import { createPortal } from 'react-dom'
import { Handle, NodeResizer, Position } from '@xyflow/react'
import { useStore } from 'zustand'
import {
  Download,
  Eye,
  Check,
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
import type { StylePresetView } from '../../../../../../shared/styles'
import { cn } from '../../lib/cn'
import {
  NODE_MIN_HEIGHT,
  NODE_MIN_WIDTH,
  NODE_RESIZER_CLASS_NAMES,
  NODE_UI_CLASS_NAMES,
} from '../lib/node-sizing'
import { canvasStore } from '../store/canvas.store'
import RunStatusBadge from '../components/RunStatusBadge'
import Chip from '../components/Chip'
import PopoverMenu from '../components/PopoverMenu'
import PromptFocusModal from '../components/PromptFocusModal'
import MentionTextarea from '../components/MentionTextarea'
import { createMentionReferenceEdge, mentionTargetsForNodes, pruneMentionReferenceEdges } from '../lib/canvas-mention-links'

interface UpstreamImageReference {
  id: string
  label: string
  url: string
  assetId: string | null
}

// 常量

/** 图片比例选项。 */
const RATIO_OPTIONS: { value: ImageRatio; label: string }[] = [
  { value: '9:16', label: '9:16 竖屏' },
  { value: '3:4', label: '3:4 竖版' },
  { value: '1:1', label: '1:1 方形' },
  { value: '4:3', label: '4:3 横版' },
  { value: '16:9', label: '16:9 横屏' },
  { value: '21:9', label: '21:9 超宽' },
]

/** 模拟模型列表（纯前端桩数据）。 */
const MOCK_MODELS = [
  { id: 'sd-xl', label: 'SDXL' },
  { id: 'flux-pro', label: 'Flux Pro' },
  { id: 'flux-dev', label: 'Flux Dev' },
  { id: 'dall-e-3', label: 'DALL-E 3' },
]

/** 接口桩：模拟生成延迟（毫秒）。 */
const MOCK_GENERATE_DELAY = 3000

/**
 * 触发浏览器下载当前结果图。
 * @param url 图片 URL。
 * @param nodeId 节点 ID，用作文件名兜底。
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

/**
 * Derives an asset ID from a safe asset URL when a generated result has not
 * already been written into the node's selected asset field.
 * @param url Safe renderer URL such as `cc-asset://asset/result-a`.
 * @returns Asset ID for repository writeback, or null when the URL is not asset-backed.
 */
function assetIdFromSafeUrl(url: string): string | null {
  const match = /^cc-asset:\/\/asset\/([^/?#]+)$/u.exec(url)
  if (!match) return null
  const value = decodeURIComponent(match[1]!)
  return value.startsWith('asset-') ? value : `asset-${value}`
}

interface ImageConfigV2NodeProps {
  id: string
  data: ImageNodeData
  selected?: boolean
  /** 触发真实运行调度（由 CanvasPage 的运行上下文注入） */
  onRun?: (id: string) => void
}

const ImageConfigV2Node: FC<ImageConfigV2NodeProps> = ({
  id,
  data,
  selected,
  onRun,
}) => {
  const updateNodeData = useStore(canvasStore, (s) => s.updateNodeData)
  const deleteNode = useStore(canvasStore, (s) => s.deleteNode)
  const canvasNodes = useStore(canvasStore, (s) => s.nodes)
  const canvasEdges = useStore(canvasStore, (s) => s.edges)

  const [isHovered, setIsHovered] = useState(false)
  const [isFocusModeOpen, setIsFocusModeOpen] = useState(false)
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const titleInputRef = useRef<HTMLInputElement>(null)

  const storeNodeData = canvasNodes.find((node) => node.id === id)?.data as ImageNodeData | undefined
  const d: ImageNodeData = { ...data, ...(storeNodeData ?? {}) }
  const status = d.status ?? 'idle'
  const displayUrl = d.url ?? ''
  const resultUrls = d.urls ?? []
  const selectedResultIndex = d.selectedIndex ?? 0
  const selectedResultUrl = resultUrls[selectedResultIndex] ?? displayUrl
  const generating = status === 'pending' || status === 'running'
  const hasError = status === 'error'
  const ratio = d.ratio ?? '1:1'
  const modelId = d.modelId ?? ''
  const modelLabel = MOCK_MODELS.find((m) => m.id === modelId)?.label ?? '选择模型'
  const [stylePresets, setStylePresets] = useState<StylePresetView[]>([])
  const styleLabel = stylePresets.find((s) => s.id === d.stylePresetId)?.name ?? '选择画风'
  const ratioLabel = RATIO_OPTIONS.find((r) => r.value === ratio)?.label ?? ratio
  const showControls = selected || isHovered
  const mentionTargets = useMemo(() => mentionTargetsForNodes(canvasNodes, id), [canvasNodes, id])
  const upstreamImageReferences = useMemo<UpstreamImageReference[]>(
    () => canvasEdges
      .filter((edge) => edge.target === id)
      .map((edge) => canvasNodes.find((node) => node.id === edge.source))
      .filter((node): node is NonNullable<typeof node> => {
        return node?.type === 'image' || node?.type === 'imageConfigV2'
      })
      .map((node) => {
        const nodeData = node.data as ImageNodeData
        return {
          id: node.id,
          label: nodeData.label || node.id,
          url: nodeData.url ?? '',
          assetId: nodeData.assetId ?? null,
        }
      })
      .filter((reference) => reference.url || reference.assetId),
    [canvasEdges, canvasNodes, id],
  )

  useEffect(() => {
    let cancelled = false
    void window.comicCanvas.listStyles({ includeDisabled: false }).then((styles) => {
      if (!cancelled) {
        setStylePresets(styles)
      }
    }).catch(() => {
      if (!cancelled) {
        setStylePresets([])
      }
    })

    return () => {
      cancelled = true
    }
  }, [])

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

  const handleGenerate = useCallback(() => {
    if (generating) return
    onRun?.(id)
  }, [generating, id, onRun])

  const handleDownload = useCallback(() => {
    if (!displayUrl) return
    downloadImage(displayUrl, id)
  }, [displayUrl, id])

  const handleResultSelect = useCallback(
    (index: number) => {
      const url = resultUrls[index]
      if (!url) return
      updateNodeData(id, { selectedIndex: index, url })
    },
    [id, resultUrls, updateNodeData],
  )

  const handleWriteback = useCallback(() => {
    if (!selectedResultUrl) return
    updateNodeData(id, {
      assetId: assetIdFromSafeUrl(selectedResultUrl),
      selectedIndex: selectedResultIndex,
      status: 'done',
      url: selectedResultUrl,
    })
  }, [id, selectedResultIndex, selectedResultUrl, updateNodeData])

  const handleDelete = useCallback(() => {
    deleteNode(id)
  }, [id, deleteNode])

  // 全屏预览 ESC 关闭
  useEffect(() => {
    if (!previewImageUrl) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setPreviewImageUrl(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [previewImageUrl])

  // Popover 选择回调
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
      { value: '', label: '不使用风格' },
      ...stylePresets.map((s) => ({ value: s.id, label: s.name })),
    ],
    [stylePresets],
  )

  return (
    <div
      className="relative flex h-full min-h-[520px] w-full min-w-[360px] flex-col items-center select-none"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <NodeResizer
        isVisible={selected ?? false}
        minWidth={NODE_MIN_WIDTH.imageConfigV2}
        minHeight={NODE_MIN_HEIGHT.imageConfigV2}
        lineClassName={NODE_RESIZER_CLASS_NAMES.line}
        handleClassName={NODE_RESIZER_CLASS_NAMES.handle}
      />

      <header className="mb-1.5 flex min-h-8 shrink-0 items-center gap-1.5 px-1 text-xs font-medium text-text-muted">
        <ImagePlus className="h-3.5 w-3.5 text-text-muted" />
        {isEditingTitle ? (
          <input
            ref={titleInputRef}
            className="nodrag w-[160px] rounded-lg border border-brand bg-bg-input px-2 py-1 text-[13px] text-text-base outline-none"
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

      <div
        className={cn(
          'group relative flex min-h-0 w-full flex-1 overflow-hidden rounded-xl border border-border-secondary bg-bg-card shadow-card transition-[border-color,box-shadow] duration-300 ease-luxury',
          selected && 'border-border-primary shadow-active',
          generating && 'cc-generating-ring',
          hasError && 'cc-failed-shake',
        )}
      >
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

        <div
          className="relative h-full min-h-0 w-full overflow-hidden rounded-lg border border-border-input bg-bg-input"
          data-testid="image-config-v2-preview"
        >
          {generating ? (
            <div
              data-testid="image-config-v2-loading"
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-bg-input text-text-secondary"
            >
              <Loader2 className="h-7 w-7 animate-spin text-brand" />
              <span className="text-[12px] font-bold">图片生成中...</span>
            </div>
          ) : displayUrl ? (
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
            <div
              data-testid="image-config-v2-error"
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-5 text-center text-text-secondary"
            >
              <X className="h-7 w-7 text-semantic-negative" />
              <span className="line-clamp-3 text-[12px] font-medium">生成失败</span>
            </div>
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-text-muted">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-bg-card">
                <ImageIcon className="h-6 w-6 opacity-60" />
              </span>
              <span className="text-[12px] font-bold">暂无图片</span>
            </div>
          )}

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

      {(upstreamImageReferences.length > 0 || resultUrls.length > 0) && (
        <section className="mt-2 flex w-full flex-col gap-2 rounded-lg border border-border-secondary bg-bg-card/95 p-2 text-[11px] text-text-muted shadow-sm">
          {upstreamImageReferences.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto">
              <span className="shrink-0 font-semibold text-text-secondary">参考图</span>
              {upstreamImageReferences.map((reference) => (
                <div
                  key={reference.id}
                  className="flex min-w-0 shrink-0 items-center gap-2 rounded-md border border-border-input bg-bg-input px-2 py-1"
                >
                  {reference.url ? (
                    <img
                      src={reference.url}
                      alt={reference.label}
                      className="h-7 w-10 rounded-sm object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <span className="flex h-7 w-10 items-center justify-center rounded-sm bg-bg-panel">
                      <ImageIcon className="h-3.5 w-3.5" />
                    </span>
                  )}
                  <span className="max-w-[120px] truncate text-text-base">{reference.label}</span>
                </div>
              ))}
            </div>
          )}

          {resultUrls.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto">
              <span className="shrink-0 font-semibold text-text-secondary">结果</span>
              {resultUrls.map((url, index) => {
                const isSelected = selectedResultIndex === index
                return (
                  <button
                    key={`${url}-${index}`}
                    type="button"
                    aria-label={`选择图片结果 ${index + 1}`}
                    aria-pressed={isSelected}
                    className={cn(
                      'relative h-12 w-16 shrink-0 overflow-hidden rounded-md border border-border-input bg-bg-input transition hover:border-border-primary',
                      isSelected && 'border-brand shadow-[0_0_0_1px_var(--cc-brand)]',
                    )}
                    onClick={() => handleResultSelect(index)}
                  >
                    <img
                      src={url}
                      alt={`图片结果 ${index + 1}`}
                      className="h-full w-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                    {isSelected ? (
                      <span className="absolute bottom-1 right-1 rounded-full bg-brand p-0.5 text-bg-base">
                        <Check className="h-3 w-3" />
                      </span>
                    ) : null}
                  </button>
                )
              })}
              <button
                type="button"
                aria-label="写回生图结果资产"
                className="nodrag ml-auto inline-flex min-h-8 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-border-input bg-bg-input px-2.5 py-1.5 text-[12px] font-semibold text-text-secondary transition hover:border-border-primary hover:text-text-base disabled:opacity-45"
                disabled={!selectedResultUrl}
                onClick={handleWriteback}
              >
                <Download className="h-3.5 w-3.5" />
                写回
              </button>
            </div>
          )}
        </section>
      )}

      {selected && (
        <div
          className="absolute z-30"
          style={{ top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 4 }}
          data-testid="image-config-v2-toolbar"
        >
          <div className={NODE_UI_CLASS_NAMES.toolbar}>
            <div className="relative min-h-[78px]">
              <MentionTextarea
                value={d.prompt ?? ''}
                onChange={(value) => updateNodeData(id, { prompt: value })}
                placeholder="描述你想要生成的画面、角色、情绪和镜头..."
                rows={3}
                className="nodrag nowheel"
                mentionTargets={mentionTargets}
                sourceNodeId={id}
                onMentionSelect={createMentionReferenceEdge}
                onMentionsChange={pruneMentionReferenceEdges}
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

            <div
              className="mt-2 flex flex-wrap items-center gap-2 border-t border-border-secondary/50 pt-2.5 text-[12px]"
              data-testid="image-config-v2-controls"
            >
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

              <div className="min-w-4 flex-1" />

              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating}
                data-testid="image-config-v2-generate-btn"
                aria-label={generating ? '生成中' : (displayUrl ? '重新生成图片' : '生成图片')}
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

      <PromptFocusModal
        open={isFocusModeOpen}
        onClose={() => setIsFocusModeOpen(false)}
        value={d.prompt ?? ''}
        onChange={(prompt) => updateNodeData(id, { prompt })}
      />

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
