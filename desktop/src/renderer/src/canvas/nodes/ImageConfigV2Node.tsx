/**
 * ImageConfigV2Node 鈥?鐢熷浘鑺傜偣 V2
 *
 * 灏嗘彁绀鸿瘝銆佺敓鎴愰厤缃笌鍥剧墖缁撴灉棰勮鏀舵暃鍦ㄥ崟涓妭鐐瑰唴銆?
 * 绾墠绔?UI锛屼笉鍚疄闄呯敓鍥?API 璋冪敤锛涙帴鍙ｆ々妯℃嫙鐘舵€佹祦杞€?
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
  V2_IMAGE_ASPECT_RATIO,
} from '../lib/node-sizing'
import { canvasStore } from '../store/canvas.store'
import RunStatusBadge from '../components/RunStatusBadge'
import Chip from '../components/Chip'
import PopoverMenu from '../components/PopoverMenu'
import PromptFocusModal from '../components/PromptFocusModal'
import MentionTextarea from '../components/MentionTextarea'
import { createCanvasEdge } from '../lib/canvas-edge-creation'

interface MentionTarget {
  id: string
  name: string
  type: string
}

interface UpstreamImageReference {
  id: string
  label: string
  url: string
  assetId: string | null
}

// 鈹€鈹€ 甯搁噺 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

/** 鍏鍥剧墖姣斾緥閫夐」 */
const RATIO_OPTIONS: { value: ImageRatio; label: string }[] = [
  { value: '9:16', label: '9:16 绔栧睆' },
  { value: '3:4', label: '3:4 绔栫増' },
  { value: '1:1', label: '1:1 鏂瑰舰' },
  { value: '4:3', label: '4:3 妯増' },
  { value: '16:9', label: '16:9 妯睆' },
  { value: '21:9', label: '21:9 瓒呭' },
]

/** 妯℃嫙妯″瀷鍒楄〃锛堢函鍓嶇妗╂暟鎹級 */
const MOCK_MODELS = [
  { id: 'sd-xl', label: 'SDXL' },
  { id: 'flux-pro', label: 'Flux Pro' },
  { id: 'flux-dev', label: 'Flux Dev' },
  { id: 'dall-e-3', label: 'DALL路E 3' },
]

/** 鎺ュ彛妗╋細妯℃嫙鐢熸垚寤惰繜锛堟绉掞級 */
const MOCK_GENERATE_DELAY = 3000

// 鈹€鈹€ 杈呭姪鍑芥暟 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

/**
 * 瑙﹀彂娴忚鍣ㄤ笅杞藉綋鍓嶇粨鏋滃浘銆?
 * @param url 鍥剧墖 URL
 * @param nodeId 鑺傜偣 ID锛岀敤浣滄枃浠跺悕鍏滃簳
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

// 鈹€鈹€ Props 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

interface ImageConfigV2NodeProps {
  id: string
  data: ImageNodeData
  selected?: boolean
}

// 鈹€鈹€ 缁勪欢 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

const ImageConfigV2Node: FC<ImageConfigV2NodeProps> = ({
  id,
  data,
  selected,
}) => {
  const updateNodeData = useStore(canvasStore, (s) => s.updateNodeData)
  const deleteNode = useStore(canvasStore, (s) => s.deleteNode)
  const setNodeRunStatus = useStore(canvasStore, (s) => s.setNodeRunStatus)
  const getNodeRunStatus = useStore(canvasStore, (s) => s.getNodeRunStatus)
  const canvasNodes = useStore(canvasStore, (s) => s.nodes)
  const canvasEdges = useStore(canvasStore, (s) => s.edges)

  const [isHovered, setIsHovered] = useState(false)
  const [isFocusModeOpen, setIsFocusModeOpen] = useState(false)
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null)
  const [isEditingTitle, setIsEditingTitle] = useState(false)
  const titleInputRef = useRef<HTMLInputElement>(null)

  const storeNodeData = canvasNodes.find((node) => node.id === id)?.data as ImageNodeData | undefined
  const d: ImageNodeData = { ...data, ...(storeNodeData ?? {}) }
  const status = getNodeRunStatus(id)
  const displayUrl = d.url ?? ''
  const resultUrls = d.urls ?? []
  const selectedResultIndex = d.selectedIndex ?? 0
  const selectedResultUrl = resultUrls[selectedResultIndex] ?? displayUrl
  const generating = status === 'pending' || status === 'running'
  const hasError = status === 'error'
  const ratio = d.ratio ?? '1:1'
  const aspectRatio = V2_IMAGE_ASPECT_RATIO[ratio]
  const modelId = d.modelId ?? ''
  const modelLabel = MOCK_MODELS.find((m) => m.id === modelId)?.label ?? '选择模型'
  const [stylePresets, setStylePresets] = useState<StylePresetView[]>([])
  const styleLabel = stylePresets.find((s) => s.id === d.stylePresetId)?.name ?? '选择画风'
  const ratioLabel = RATIO_OPTIONS.find((r) => r.value === ratio)?.label ?? ratio
  const showControls = selected || isHovered
  const mentionTargets = useMemo<MentionTarget[]>(
    () => canvasNodes
      .filter((node) => node.id !== id)
      .map((node) => ({
        id: node.id,
        name: node.data.label || node.id,
        type: node.type,
      })),
    [canvasNodes, id],
  )
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
    setNodeRunStatus(id, 'running')
    updateNodeData(id, { url: '' })
    window.setTimeout(() => {
      setNodeRunStatus(id, 'idle')
    }, MOCK_GENERATE_DELAY)
  }, [id, generating, setNodeRunStatus, updateNodeData])

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

  // @mention 自动连线管理
  const handleMentionSelect = useCallback(
    (mentionedNodeId: string, srcNodeId: string) => {
      createCanvasEdge({
        store: canvasStore,
        request: {
          source: mentionedNodeId,
          target: srcNodeId,
          reason: 'mention',
          markCreatedByMention: true,
        },
      })
    },
    [],
  )

  const handleMentionsChange = useCallback(
    (currentMentionIds: string[], srcNodeId: string) => {
      const state = canvasStore.getState()
      const filtered = state.edges.filter((edge) => {
        if (edge.target !== srcNodeId) return true
        if (!edge.data.createdByMention) return true
        return currentMentionIds.includes(edge.source)
      })
      if (filtered.length !== state.edges.length) {
        state.setEdges(filtered)
      }
    },
    [],
  )

  // 鈹€鈹€ 鍒犻櫎 鈹€鈹€
  const handleDelete = useCallback(() => {
    deleteNode(id)
  }, [id, deleteNode])

  // 鈹€鈹€ 鍏ㄥ睆棰勮 ESC 鍏抽棴 鈹€鈹€
  useEffect(() => {
    if (!previewImageUrl) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setPreviewImageUrl(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [previewImageUrl])

  // 鈹€鈹€ Popover 閫夋嫨鍥炶皟 鈹€鈹€
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

  // 鈹€鈹€ Popover 椤瑰垪琛?鈹€鈹€
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
      className="relative flex flex-col select-none items-center"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 鈺愨晲鈺愨晲鈺愨晲 鏍囩琛?鈺愨晲鈺愨晲鈺愨晲 */}
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
            {d.label || '鐢熷浘鑺傜偣'}
          </span>
        )}
        <RunStatusBadge status={status} />
      </header>

      {/* 鈺愨晲鈺愨晲鈺愨晲 棰勮鍗?鈺愨晲鈺愨晲鈺愨晲 */}
      <div
        className={cn(
          'group relative w-[360px] overflow-hidden rounded-xl border border-border-secondary bg-bg-card shadow-card transition-[border-color,box-shadow] duration-300 ease-luxury',
          selected && 'border-border-primary shadow-active',
          generating && 'cc-generating-ring',
          hasError && 'cc-failed-shake',
        )}
      >
        {/* 鍒犻櫎鎸夐挳 */}
        {showControls && (
          <button
            type="button"
            onClick={handleDelete}
            className="nodrag absolute right-3 top-3 z-20 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white opacity-0 shadow-md transition-all hover:bg-black group-hover:opacity-100"
            title="鍒犻櫎鑺傜偣"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}

        {/* 棰勮鍖哄煙 */}
        <div
          className="relative w-full overflow-hidden rounded-lg border border-border-input bg-bg-input"
          style={{ aspectRatio }}
          data-testid="image-config-v2-preview"
        >
          {generating ? (
            /* 鐢熸垚涓?*/
            <div
              data-testid="image-config-v2-loading"
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-bg-input text-text-secondary"
            >
              <Loader2 className="h-7 w-7 animate-spin text-brand" />
              <span className="text-[12px] font-bold">鍥剧墖鐢熸垚涓?..</span>
            </div>
          ) : displayUrl ? (
            /* 瀹屾垚 */
            <img
              key={displayUrl}
              data-testid="image-config-v2-image"
              src={displayUrl}
              alt={d.label || '鐢熸垚鍥剧墖'}
              className="cc-media-reveal h-full w-full object-contain"
              loading="lazy"
              decoding="async"
            />
          ) : hasError ? (
            /* 閿欒 */
            <div
              data-testid="image-config-v2-error"
              className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-5 text-center text-text-secondary"
            >
              <X className="h-7 w-7 text-semantic-negative" />
              <span className="line-clamp-3 text-[12px] font-medium">鐢熸垚澶辫触</span>
            </div>
          ) : (
            /* 绌烘€?*/
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-text-muted">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-bg-card">
                <ImageIcon className="h-6 w-6 opacity-60" />
              </span>
              <span className="text-[12px] font-bold">鏆傛棤鍥剧墖</span>
            </div>
          )}

          {/* hover 娴眰 */}
          {displayUrl && !generating && showControls && (
            <div className="absolute inset-x-3 bottom-3 flex justify-center gap-2 opacity-0 transition-opacity group-hover:opacity-100">
              <button
                type="button"
                onClick={() => setPreviewImageUrl(displayUrl)}
                className="nodrag flex h-8 w-8 items-center justify-center rounded-full bg-black/65 text-white shadow-md transition-colors hover:bg-black"
                title="棰勮鏀惧ぇ"
                data-testid="image-config-v2-zoom"
              >
                <Eye className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="nodrag flex h-8 w-8 items-center justify-center rounded-full bg-black/65 text-white shadow-md transition-colors hover:bg-black"
                title="涓嬭浇鍥剧墖"
              >
                <Download className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating}
                className="nodrag flex h-8 w-8 items-center justify-center rounded-full bg-black/65 text-white shadow-md transition-colors hover:bg-black disabled:opacity-50"
                title="閲嶆柊鐢熸垚"
              >
                <RefreshCcw className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {(upstreamImageReferences.length > 0 || resultUrls.length > 0) && (
        <section className="mt-2 flex w-[360px] flex-col gap-2 rounded-lg border border-border-secondary bg-bg-card/95 p-2 text-[11px] text-text-muted shadow-sm">
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

      {/* 鈺愨晲鈺愨晲鈺愨晲 閫変腑 Toolbar 鈺愨晲鈺愨晲鈺愨晲 */}
      {selected && (
        <div
          className="absolute z-30"
          style={{ top: '100%', left: '50%', transform: 'translateX(-50%)', marginTop: 4 }}
          data-testid="image-config-v2-toolbar"
        >
          <div
            className="nodrag nowheel relative w-[960px] overflow-visible rounded-[24px] border border-border-primary bg-bg-panel px-5 pb-3.5 pt-4 shadow-card"
          >
            {/* 鎻愮ず璇嶈緭鍏?*/}
            <div className="relative min-h-[78px]">
              <MentionTextarea
                value={d.prompt ?? ''}
                onChange={(value) => updateNodeData(id, { prompt: value })}
                placeholder="鎻忚堪浣犳兂瑕佺敓鎴愮殑鐢婚潰銆佽鑹层€佹儏缁拰闀滃ご..."
                rows={3}
                className="nodrag nowheel"
                mentionTargets={mentionTargets}
                sourceNodeId={id}
                onMentionSelect={handleMentionSelect}
                onMentionsChange={handleMentionsChange}
              />
              <button
                type="button"
                className="nodrag absolute right-0 top-0 flex h-8 w-8 items-center justify-center rounded-xl border-none bg-transparent text-text-muted transition-colors hover:bg-bg-hover hover:text-text-base"
                onClick={() => setIsFocusModeOpen(true)}
                title="涓撴敞妯″紡"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
            </div>

            {/* 鑺墖琛?*/}
            <div
              className="mt-2 flex flex-wrap items-center gap-2 border-t border-border-secondary/50 pt-2.5 text-[12px]"
              data-testid="image-config-v2-controls"
            >
              {/* 妯″瀷閫夋嫨 */}
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

              {/* 姣斾緥閫夋嫨 */}
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

              {/* 鐢婚閫夋嫨 */}
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

              {/* 寮规€х┖闂?*/}
              <div className="min-w-4 flex-1" />

              {/* 鐢熸垚鎸夐挳 */}
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating}
                data-testid="image-config-v2-generate-btn"
                aria-label={generating ? '生成中' : (displayUrl ? '重新生成图片' : '生成图片')}
                className="nodrag cc-btn-primary flex h-9 min-w-[112px] items-center justify-center gap-1.5 rounded-xl px-4 text-[13px] font-bold shadow-sm transition-all disabled:opacity-50"
                title={displayUrl ? '閲嶆柊鐢熸垚' : '鐢熸垚鍥剧墖'}
              >
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    鐢熸垚涓?..
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    {displayUrl ? '閲嶆柊鐢熸垚' : '鐢熸垚鍥剧墖'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 鈺愨晲鈺愨晲鈺愨晲 Handle 鈺愨晲鈺愨晲鈺愨晲 */}
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

      {/* 鈺愨晲鈺愨晲鈺愨晲 涓撴敞妯″紡寮圭獥 鈺愨晲鈺愨晲鈺愨晲 */}
      <PromptFocusModal
        open={isFocusModeOpen}
        onClose={() => setIsFocusModeOpen(false)}
        value={d.prompt ?? ''}
        onChange={(prompt) => updateNodeData(id, { prompt })}
      />

      {/* 鈺愨晲鈺愨晲鈺愨晲 鍏ㄥ睆鍥剧墖棰勮 Portal 鈺愨晲鈺愨晲鈺愨晲 */}
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
                title="鍏抽棴棰勮"
              >
                <X className="h-4 w-4" />
              </button>
              <img
                src={previewImageUrl}
                alt="鍏ㄥ睆棰勮"
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
