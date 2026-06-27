/**
 * Image media reference node.
 * @see docs/api-contracts/canvas-plan.md
 * @see docs/api-contracts/assets-files.md
 */

import { Brush, Crop, FolderOpen, Image as ImageIcon, Link2Off, Maximize2 } from 'lucide-react'
import { Handle, NodeResizer, Position } from '@xyflow/react'
import React, { useEffect, useState } from 'react'

import type { ImageEditIntent } from '../../../../../../shared/assets'
import type { ImageNodeData } from '../../../../../../shared/nodes'
import { ImageEditorModal } from '../components/ImageEditorModal'
import { ImageInpaintModal } from '../components/ImageInpaintModal'
import { NodeAssetPickerModal, type NodeAssetOption } from '../components/NodeAssetPickerModal'
import {
  getOrientationPreviewStyle,
  NODE_MIN_HEIGHT,
  NODE_MIN_WIDTH,
  NODE_RESIZER_CLASS_NAMES,
  NODE_UI_CLASS_NAMES
} from '../lib/node-sizing'
import { cn } from '../../lib/cn'

/** Renderer props for the image media reference node. */
export interface ImageNodeProps {
  /** Canvas node identifier used by change callbacks. */
  id: string
  /** Shared image node data contract. */
  data: ImageNodeData
  /** Whether the canvas currently marks this node as selected. */
  selected?: boolean
  /** Safe renderer URL for the bound image asset. */
  assetSafeUrl?: string
  /** Image assets that can be bound directly to this node. */
  assetOptions?: NodeAssetOption[]
  /** Called when the renderer edits node data. */
  onChange?: (id: string, patch: Partial<ImageNodeData>) => void
  /** Called when the user opens the asset edit surface for the bound image asset. */
  onEditAsset?: (assetId: string) => void
  /** Called when the user applies crop/rotate/orientation edits for the bound image asset. */
  onApplyImageEdit?: (intent: ImageEditIntent) => void
}

/**
 * Renders a hjwall-style image media node: asset binding, preview, and reference handles only.
 * @param props - Image node ID, shared node data, safe asset URL, and callbacks.
 * @returns Image media reference node React element.
 * @throws Error never intentionally; invalid user actions are represented as disabled controls.
 * @see docs/api-contracts/canvas-plan.md
 * @see docs/api-contracts/assets-files.md
 */
function ImageNodeComponent({
  id,
  data,
  selected = false,
  assetSafeUrl,
  assetOptions = [],
  onChange,
  onEditAsset,
  onApplyImageEdit
}: ImageNodeProps): JSX.Element {
  const [isAssetPickerOpen, setIsAssetPickerOpen] = useState(false)
  const [isImageEditorOpen, setIsImageEditorOpen] = useState(false)
  const [isInpaintGateOpen, setIsInpaintGateOpen] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const displayUrl = assetSafeUrl ?? data.url ?? ''
  const hasAsset = Boolean(data.assetId && displayUrl)

  useEffect(() => {
    if (!previewUrl) return undefined

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') setPreviewUrl(null)
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [previewUrl])

  function update(patch: Partial<ImageNodeData>): void {
    onChange?.(id, patch)
  }

  function bindAsset(asset: NodeAssetOption): void {
    update({ assetId: asset.assetId, url: asset.safeUrl, status: 'done' })
    setIsAssetPickerOpen(false)
  }

  function clearAsset(): void {
    update({ assetId: null, url: '', status: 'idle' })
  }

  return (
    <article className={NODE_UI_CLASS_NAMES.mediaShell} data-node-id={id}>
      <NodeResizer
        isVisible={selected}
        minWidth={NODE_MIN_WIDTH.image}
        minHeight={NODE_MIN_HEIGHT.image}
        lineClassName={NODE_RESIZER_CLASS_NAMES.line}
        handleClassName={NODE_RESIZER_CLASS_NAMES.handle}
      />

      <header className="mb-1.5 flex min-h-6 items-center gap-1.5 px-1 text-[12px] font-medium text-text-muted">
        <ImageIcon className="h-3.5 w-3.5 text-text-muted" />
        <span className="min-w-0 truncate">{data.label || '图片节点'}</span>
      </header>

      <section
        className={cn(
          NODE_UI_CLASS_NAMES.mediaCard,
          'group relative flex min-h-[320px] flex-1 flex-col gap-3 rounded-2xl bg-bg-card p-3.5',
          selected ? 'border-brand shadow-[0_0_0_1px_var(--color-brand)]' : 'hover:border-border-primary'
        )}
      >
        <div className="absolute left-3.5 top-3.5 z-10 flex gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            type="button"
            aria-label="预览图片资产"
            disabled={!displayUrl}
            onClick={() => {
              if (displayUrl) setPreviewUrl(displayUrl)
            }}
            className="nodrag inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/60 text-white shadow-md transition hover:bg-black disabled:pointer-events-none disabled:opacity-0"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            aria-label="编辑图片资产"
            disabled={!hasAsset}
            onClick={() => {
              if (!data.assetId) return
              onEditAsset?.(data.assetId)
              setIsImageEditorOpen(true)
            }}
            className="nodrag inline-flex h-8 items-center gap-1 rounded-full bg-black/60 px-2.5 text-[11px] font-semibold text-white shadow-md transition hover:bg-black disabled:pointer-events-none disabled:opacity-0"
          >
            <Crop className="h-3.5 w-3.5" />
            编辑
          </button>
          <button
            type="button"
            aria-label="局部重绘图片资产"
            aria-disabled={!hasAsset}
            onClick={() => {
              if (hasAsset) setIsInpaintGateOpen(true)
            }}
            className="nodrag inline-flex h-8 items-center gap-1 rounded-full bg-black/60 px-2.5 text-[11px] font-semibold text-white shadow-md transition hover:bg-black aria-disabled:pointer-events-none aria-disabled:opacity-0"
          >
            <Brush className="h-3.5 w-3.5" />
            重绘
          </button>
        </div>

        <div
          className="relative flex w-full items-center justify-center overflow-hidden rounded-xl border border-border-primary/50 bg-bg-input"
          data-testid="image-preview-frame"
          style={getOrientationPreviewStyle(data.orientation)}
        >
          {displayUrl ? (
            <img
              key={displayUrl}
              src={displayUrl}
              alt={`${data.label || '图片节点'} preview`}
              className="h-full w-full object-contain"
              loading="lazy"
            />
          ) : (
            <div className="flex h-full min-h-40 flex-col items-center justify-center gap-2 text-text-muted">
              <ImageIcon className="h-8 w-8 opacity-45" />
              <span className="text-[12px] font-medium">未绑定图片</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            aria-label="选择图片素材"
            className={NODE_UI_CLASS_NAMES.compactButton}
            onClick={() => setIsAssetPickerOpen(true)}
          >
            <FolderOpen className="h-3.5 w-3.5" />
            选择素材
          </button>
          <button
            type="button"
            aria-label="清除图片素材"
            disabled={!data.assetId}
            className={cn(NODE_UI_CLASS_NAMES.compactButton, 'disabled:opacity-45')}
            onClick={clearAsset}
          >
            <Link2Off className="h-3.5 w-3.5" />
            清除
          </button>
        </div>

        <div className="min-w-0 truncate rounded-lg border border-border-secondary bg-bg-input/65 px-2.5 py-2 text-[11px] text-text-muted">
          {data.assetId ?? '未绑定资产'}
        </div>
      </section>

      {isAssetPickerOpen ? (
        <NodeAssetPickerModal
          mediaType="image"
          options={assetOptions}
          onClose={() => setIsAssetPickerOpen(false)}
          onSelect={bindAsset}
        />
      ) : null}

      {isImageEditorOpen && data.assetId && displayUrl ? (
        <ImageEditorModal
          nodeId={id}
          assetId={data.assetId}
          safeUrl={displayUrl}
          label={data.label}
          orientation={data.orientation}
          onClose={() => setIsImageEditorOpen(false)}
          onApply={(intent) => {
            if (intent.applyTarget === 'node') update({ orientation: intent.orientation })
            onApplyImageEdit?.(intent)
            setIsImageEditorOpen(false)
          }}
        />
      ) : null}

      {isInpaintGateOpen && data.assetId && displayUrl ? (
        <ImageInpaintModal
          assetId={data.assetId}
          safeUrl={displayUrl}
          label={data.label}
          onClose={() => setIsInpaintGateOpen(false)}
        />
      ) : null}

      {previewUrl ? (
        <div
          className="nodrag nowheel fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 px-5 py-6"
          onClick={() => setPreviewUrl(null)}
          role="presentation"
        >
          <img
            src={previewUrl}
            alt={`${data.label || '图片节点'} large preview`}
            className="max-h-[82vh] max-w-[88vw] rounded-2xl object-contain shadow-[0_24px_64px_rgba(0,0,0,0.55)]"
            onClick={(event) => event.stopPropagation()}
          />
        </div>
      ) : null}

      <Handle type="target" position={Position.Left} id="left" className="cc-handle" />
      <Handle type="source" position={Position.Right} id="right" className="cc-handle" />
    </article>
  )
}

export const ImageNode = React.memo(ImageNodeComponent)
