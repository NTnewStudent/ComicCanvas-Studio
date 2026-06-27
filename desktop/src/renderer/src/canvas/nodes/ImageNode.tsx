/**
 * Image canvas node for image generation configuration and preview.
 * @see docs/api-contracts/canvas-plan.md
 * @see docs/api-contracts/assets-files.md
 */

import { Brush, FolderOpen, Image as ImageIcon, Loader2, Pencil, Save, Sparkles, XCircle } from 'lucide-react'
import { Handle, NodeResizer, Position } from '@xyflow/react'
import React, { useState } from 'react'

import type { ImageEditIntent } from '../../../../../../shared/assets'
import type { ImageNodeData, Orientation } from '../../../../../../shared/nodes'
import { ConnectedInputsPanel } from '../components/ConnectedInputsPanel'
import { ImageEditorModal } from '../components/ImageEditorModal'
import { ImageInpaintModal } from '../components/ImageInpaintModal'
import { MediaInputControls } from '../components/MediaInputControls'
import MentionTextarea from '../components/MentionTextarea'
import { NodeAssetPickerModal, type NodeAssetOption } from '../components/NodeAssetPickerModal'
import {
  getOrientationPreviewStyle,
  NODE_MIN_HEIGHT,
  NODE_MIN_WIDTH,
  NODE_RESIZER_CLASS_NAMES
} from '../lib/node-sizing'
import { cn } from '../../lib/cn'

/** Selectable image model option shown by the image node controls. */
export interface ImageModelOption {
  /** Stable model identifier passed back through node data updates. */
  id: string
  /** Human-readable model name rendered in the control. */
  label: string
}

/** Renderer props for the image generation canvas node. */
export interface ImageNodeProps {
  /** Canvas node identifier used by change and run callbacks. */
  id: string
  /** Shared image node data contract. */
  data: ImageNodeData
  /** Whether the canvas currently marks this node as selected. */
  selected?: boolean
  /** Safe renderer URL for the generated asset, normally `cc-asset://asset/<assetId>`. */
  assetSafeUrl?: string
  /** Available model choices for the image generation control. */
  modelOptions?: ImageModelOption[]
  /** Image assets that can be bound directly to this node. */
  assetOptions?: NodeAssetOption[]
  /** Called when the renderer edits node data. */
  onChange?: (id: string, patch: Partial<ImageNodeData>) => void
  /** Called when the user requests asynchronous generation for this node. */
  onRun?: (id: string) => void
  /** Called when the user opens the asset edit surface for the bound image asset. */
  onEditAsset?: (assetId: string) => void
  /** Called when the user applies crop/rotate/orientation edits for the bound image asset. */
  onApplyImageEdit?: (intent: ImageEditIntent) => void
  /** Called when the user writes the current generated output back to the asset library. */
  onWriteOutputAsset?: (id: string, assetId: string) => void
}

const orientationLabels: Record<Orientation, string> = {
  landscape: '16:9',
  portrait: '9:16',
  square: '1:1'
}

const statusLabel: Record<ImageNodeData['status'], string> = {
  idle: '空闲',
  pending: '等待中',
  running: '运行中',
  done: '已完成',
  error: '错误'
}

/**
 * Renders an image node with prompt/model/orientation controls and async generation states.
 * @param props - Image node ID, shared node data, safe asset URL, and callbacks.
 * @returns Image node React element.
 * @throws Error never intentionally; invalid user actions are represented as disabled controls.
 * @see docs/api-contracts/canvas-plan.md
 * @see docs/api-contracts/assets-files.md
 */
function ImageNodeComponent({
  id,
  data,
  selected = false,
  assetSafeUrl,
  modelOptions = [{ id: data.modelId, label: data.modelId }],
  assetOptions = [],
  onChange,
  onRun,
  onEditAsset,
  onApplyImageEdit,
  onWriteOutputAsset
}: ImageNodeProps): JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isAssetPickerOpen, setIsAssetPickerOpen] = useState(false)
  const [isImageEditorOpen, setIsImageEditorOpen] = useState(false)
  const [isInpaintGateOpen, setIsInpaintGateOpen] = useState(false)
  const isGenerating = data.status === 'pending' || data.status === 'running'
  const canPreview = data.status === 'done' && data.assetId !== null && typeof assetSafeUrl === 'string'

  function update(patch: Partial<ImageNodeData>): void {
    onChange?.(id, patch)
  }

  function bindAsset(asset: NodeAssetOption): void {
    update({ assetId: asset.assetId, url: asset.safeUrl, status: 'done' })
    setIsAssetPickerOpen(false)
  }

  return (
    <article
      className={cn(
        'relative flex w-[340px] flex-col gap-2 select-none text-text-base',
        selected && 'shadow-[0_0_18px_var(--cc-active-glow)]'
      )}
      data-node-id={id}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={NODE_MIN_WIDTH.image}
        minHeight={NODE_MIN_HEIGHT.image}
        lineClassName={NODE_RESIZER_CLASS_NAMES.line}
        handleClassName={NODE_RESIZER_CLASS_NAMES.handle}
      />

      <header className="flex items-center gap-2 px-1 text-[12px] font-medium text-text-muted">
        <ImageIcon className="h-3.5 w-3.5 text-semantic-info" />
        <span className="max-w-[190px] truncate">{data.label}</span>
        <span
          className={cn(
            'ml-auto inline-flex items-center rounded-pill bg-bg-input px-2 py-0.5 text-[12px] font-medium',
            data.status === 'done' && 'text-semantic-success',
            isGenerating && 'text-brand',
            data.status === 'error' && 'text-semantic-negative'
          )}
        >
          {statusLabel[data.status]}
        </span>
      </header>

      <section
        className={cn(
          'rounded-xl border border-border-secondary bg-bg-card p-4 shadow-card transition-[border-color,box-shadow] duration-300 ease-luxury',
          selected && 'border-border-primary shadow-active',
          isGenerating && 'border-brand'
        )}
      >
        <div
          className="relative flex w-full items-center justify-center overflow-hidden rounded-lg border border-border-input bg-bg-input"
          data-testid="image-preview-frame"
          style={getOrientationPreviewStyle(data.orientation)}
        >
          {canPreview ? (
            <img
              src={assetSafeUrl}
              alt={`${data.label} preview`}
              className="h-full w-full object-contain"
              style={{ objectFit: 'contain' }}
              loading="lazy"
            />
          ) : data.status === 'error' ? (
            <div role="alert" className="flex h-full min-h-40 flex-col items-center justify-center gap-2 text-text-secondary">
              <XCircle className="h-7 w-7 text-semantic-negative" />
              <span className="text-[13px]">生成失败</span>
            </div>
          ) : (
            <div
              role="status"
              aria-label={`Image generation ${data.status}`}
              className="flex h-full min-h-40 flex-col items-center justify-center gap-2 text-text-muted"
            >
              {isGenerating ? (
                <Loader2 className="h-7 w-7 animate-spin text-brand" />
              ) : (
                <ImageIcon className="h-7 w-7 text-semantic-info opacity-70" />
              )}
              <span className="text-[13px]">{isGenerating ? '图片生成中' : '暂无图片'}</span>
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            className="inline-flex min-h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-[13px] font-semibold text-bg-base transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => onRun?.(id)}
            disabled={isGenerating}
            aria-label="生成图片"
          >
            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            生成图片
          </button>
          <button
            type="button"
            className="inline-flex min-h-8 items-center justify-center rounded-lg border border-border-input bg-bg-input px-3 py-2 text-[13px] font-medium text-text-base transition hover:bg-bg-hover"
            aria-expanded={isExpanded}
            aria-label="配置图片节点"
            onClick={() => setIsExpanded((value) => !value)}
          >
            配置
          </button>
        </div>

        {isExpanded && (
          <div className="mt-3 flex flex-col gap-3 border-t border-border-secondary pt-3">
            <ConnectedInputsPanel nodeId={id} />

            <MediaInputControls
              mediaType="image"
              label="图片素材"
              selectedAssetId={data.assetId}
              selectedSafeUrl={data.url ?? assetSafeUrl}
              options={assetOptions}
              compact
              onSelect={bindAsset}
              onClear={() => update({ assetId: null, url: '' })}
            />

            <div className="grid grid-cols-4 gap-2">
              <button
                type="button"
                aria-label="从资产库选择图片"
                className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-border-input bg-bg-input px-2 py-2 text-[12px] text-text-secondary transition hover:border-border-primary hover:text-text-base"
                onClick={() => setIsAssetPickerOpen(true)}
              >
                <FolderOpen className="h-3.5 w-3.5" />
                资产库
              </button>
              <button
                type="button"
                aria-label="编辑图片资产"
                className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-border-input bg-bg-input px-2 py-2 text-[12px] text-text-secondary transition hover:border-border-primary hover:text-text-base disabled:opacity-45"
                disabled={!data.assetId}
                onClick={() => {
                  if (data.assetId) {
                    onEditAsset?.(data.assetId)
                    setIsImageEditorOpen(true)
                  }
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
                编辑
              </button>
              <button
                type="button"
                aria-label="写回图片输出资产"
                className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-border-input bg-bg-input px-2 py-2 text-[12px] text-text-secondary transition hover:border-border-primary hover:text-text-base disabled:opacity-45"
                disabled={!data.assetId || data.status !== 'done'}
                onClick={() => {
                  if (data.assetId) onWriteOutputAsset?.(id, data.assetId)
                }}
              >
                <Save className="h-3.5 w-3.5" />
                写回
              </button>
              <button
                type="button"
                aria-label="局部重绘图片资产"
                aria-disabled={!data.assetId}
                className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-border-input bg-bg-input px-2 py-2 text-[12px] text-text-secondary transition hover:border-border-primary hover:text-text-base aria-disabled:pointer-events-none aria-disabled:opacity-45"
                onClick={() => {
                  if (data.assetId) setIsInpaintGateOpen(true)
                }}
              >
                <Brush className="h-3.5 w-3.5" />
                重绘
              </button>
            </div>

            <label className="flex flex-col gap-1.5 text-[12px] font-medium text-text-muted">
              Prompt 覆盖
              <MentionTextarea
                ariaLabel="Prompt 覆盖"
                value={data.promptOverride}
                onChange={(value) => update({ promptOverride: value })}
                placeholder="描述画面、角色、情绪和镜头。"
                rows={4}
                className="nodrag nowheel"
              />
            </label>

            <fieldset className="flex flex-col gap-1.5">
              <legend className="text-[12px] font-medium text-text-muted">模型</legend>
              <div className="grid grid-cols-2 gap-2">
                {modelOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    aria-label={`Use model ${option.label}`}
                    className={cn(
                      'rounded-lg border border-border-input bg-bg-input px-3 py-2 text-left text-[12px] text-text-secondary transition hover:border-border-primary hover:text-text-base',
                      data.modelId === option.id && 'border-brand text-brand'
                    )}
                    onClick={() => update({ modelId: option.id })}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="flex flex-col gap-1.5">
              <legend className="text-[12px] font-medium text-text-muted">方向</legend>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(orientationLabels) as Orientation[]).map((orientation) => (
                  <button
                    key={orientation}
                    type="button"
                    aria-label={`Use ${orientation} orientation`}
                    className={cn(
                      'rounded-lg border border-border-input bg-bg-input px-3 py-2 text-[12px] text-text-secondary transition hover:border-border-primary hover:text-text-base',
                      data.orientation === orientation && 'border-brand text-brand'
                    )}
                    onClick={() => update({ orientation })}
                  >
                    {orientationLabels[orientation]}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
        )}
      </section>

      {isAssetPickerOpen ? (
        <NodeAssetPickerModal
          mediaType="image"
          options={assetOptions}
          onClose={() => setIsAssetPickerOpen(false)}
          onSelect={bindAsset}
        />
      ) : null}

      {isImageEditorOpen && data.assetId && (assetSafeUrl ?? data.url) ? (
        <ImageEditorModal
          nodeId={id}
          assetId={data.assetId}
          safeUrl={assetSafeUrl ?? data.url ?? ''}
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

      {isInpaintGateOpen && data.assetId && (assetSafeUrl ?? data.url) ? (
        <ImageInpaintModal
          assetId={data.assetId}
          safeUrl={assetSafeUrl ?? data.url ?? ''}
          label={data.label}
          onClose={() => setIsInpaintGateOpen(false)}
        />
      ) : null}

      {/* 输入/输出连接点 */}
      <Handle type="target" position={Position.Left} className="cc-handle" />
      <Handle type="source" position={Position.Right} className="cc-handle" />
    </article>
  )
}

export const ImageNode = React.memo(ImageNodeComponent)
