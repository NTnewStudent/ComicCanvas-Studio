/**
 * Video canvas node for video generation configuration and preview.
 * @see docs/api-contracts/canvas-plan.md
 * @see docs/api-contracts/assets-files.md
 */

import { Clapperboard, Film, FolderOpen, Image as ImageIcon, Loader2, Pencil, Save, Sparkles, XCircle } from 'lucide-react'
import { Handle, NodeResizer, Position } from '@xyflow/react'
import React, { useState } from 'react'

import type { Orientation, VideoNodeData } from '../../../../../../shared/nodes'
import { ConnectedInputsPanel } from '../components/ConnectedInputsPanel'
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

/** Selectable video model option shown by the video node controls. */
export interface VideoModelOption {
  /** Stable model identifier passed back through node data updates. */
  id: string
  /** Human-readable model name rendered in the control. */
  label: string
}

/** Image asset option that can be assigned as the video first or last frame. */
export interface VideoFrameOption {
  /** Stable asset identifier stored in the video node data. */
  assetId: string
  /** Human-readable frame label rendered in the selector. */
  label: string
  /** Safe renderer URL for the image thumbnail. */
  safeUrl?: string
}

/** Renderer props for the video generation canvas node. */
export interface VideoNodeProps {
  /** Canvas node identifier used by change and run callbacks. */
  id: string
  /** Shared video node data contract. */
  data: VideoNodeData
  /** Whether the canvas currently marks this node as selected. */
  selected?: boolean
  /** Safe renderer URL for the generated asset, normally `cc-asset://asset/<assetId>`. */
  assetSafeUrl?: string
  /** Available model choices for the video generation control. */
  modelOptions?: VideoModelOption[]
  /** Upstream image assets available for first and last frame selection. */
  frameOptions?: VideoFrameOption[]
  /** Video assets that can be bound directly to this node. */
  assetOptions?: NodeAssetOption[]
  /** Called when the renderer edits node data. */
  onChange?: (id: string, patch: Partial<VideoNodeData>) => void
  /** Called when the user requests asynchronous generation for this node. */
  onRun?: (id: string) => void
  /** Called when the user opens the asset edit surface for the bound video asset. */
  onEditAsset?: (assetId: string) => void
  /** Called when the user writes the current generated output back to the asset library. */
  onWriteOutputAsset?: (id: string, assetId: string) => void
}

const orientationLabels: Record<Orientation, string> = {
  landscape: '16:9',
  portrait: '9:16',
  square: '1:1'
}

const statusLabel: Record<VideoNodeData['status'], string> = {
  idle: '空闲',
  pending: '等待中',
  running: '运行中',
  done: '已完成',
  error: '错误'
}

const durationOptions = [3, 5, 8, 10]

/**
 * Renders a video node with prompt/model/orientation/duration/frame controls and async generation states.
 * @param props - Video node ID, shared node data, safe asset URLs, and callbacks.
 * @returns Video node React element.
 * @throws Error never intentionally; invalid user actions are represented as disabled controls.
 * @see docs/api-contracts/canvas-plan.md
 * @see docs/api-contracts/assets-files.md
 */
function VideoNodeComponent({
  id,
  data,
  selected = false,
  assetSafeUrl,
  modelOptions = [{ id: data.modelId, label: data.modelId }],
  frameOptions = [],
  assetOptions = [],
  onChange,
  onRun,
  onEditAsset,
  onWriteOutputAsset
}: VideoNodeProps): JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false)
  const [isAssetPickerOpen, setIsAssetPickerOpen] = useState(false)
  const isGenerating = data.status === 'pending' || data.status === 'running'
  const canPreview = data.status === 'done' && data.assetId !== null && typeof assetSafeUrl === 'string'

  function update(patch: Partial<VideoNodeData>): void {
    onChange?.(id, patch)
  }

  function bindAsset(asset: NodeAssetOption): void {
    update({ assetId: asset.assetId, url: asset.safeUrl, status: 'done' })
    setIsAssetPickerOpen(false)
  }

  return (
    <article
      className={cn(
        'relative flex w-[360px] flex-col gap-2 select-none text-text-base',
        selected && 'shadow-[0_0_18px_var(--cc-active-glow)]'
      )}
      data-node-id={id}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={NODE_MIN_WIDTH.video}
        minHeight={NODE_MIN_HEIGHT.video}
        lineClassName={NODE_RESIZER_CLASS_NAMES.line}
        handleClassName={NODE_RESIZER_CLASS_NAMES.handle}
      />

      <header className="flex items-center gap-2 px-1 text-[12px] font-medium text-text-muted">
        <Clapperboard className="h-3.5 w-3.5 text-semantic-warning" />
        <span className="max-w-[200px] truncate">{data.label}</span>
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
          data-testid="video-preview-frame"
          style={getOrientationPreviewStyle(data.orientation)}
        >
          {canPreview ? (
            <video
              data-testid="video-preview"
              src={assetSafeUrl}
              controls
              preload="metadata"
              className="h-full w-full object-contain"
              style={{ objectFit: 'contain' }}
            />
          ) : data.status === 'error' ? (
            <div role="alert" className="flex h-full min-h-40 flex-col items-center justify-center gap-2 text-text-secondary">
              <XCircle className="h-7 w-7 text-semantic-negative" />
              <span className="text-[13px]">生成失败</span>
            </div>
          ) : (
            <div
              role="status"
              aria-label={`Video generation ${data.status}`}
              className="flex h-full min-h-40 flex-col items-center justify-center gap-2 text-text-muted"
            >
              {isGenerating ? (
                <Loader2 className="h-7 w-7 animate-spin text-brand" />
              ) : (
                <Film className="h-7 w-7 text-semantic-warning opacity-70" />
              )}
              <span className="text-[13px]">{isGenerating ? '视频生成中' : '暂无视频'}</span>
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            className="inline-flex min-h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-[13px] font-semibold text-bg-base transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => onRun?.(id)}
            disabled={isGenerating}
            aria-label="生成视频"
          >
            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            生成视频
          </button>
          <button
            type="button"
            className="inline-flex min-h-8 items-center justify-center rounded-lg border border-border-input bg-bg-input px-3 py-2 text-[13px] font-medium text-text-base transition hover:bg-bg-hover"
            aria-expanded={isExpanded}
            aria-label="配置视频节点"
            onClick={() => setIsExpanded((value) => !value)}
          >
            配置
          </button>
        </div>

        {isExpanded && (
          <div className="mt-3 flex flex-col gap-3 border-t border-border-secondary pt-3">
            <ConnectedInputsPanel nodeId={id} />

            <MediaInputControls
              mediaType="video"
              label="视频素材"
              selectedAssetId={data.assetId}
              selectedSafeUrl={data.url ?? assetSafeUrl}
              options={assetOptions}
              compact
              onSelect={bindAsset}
              onClear={() => update({ assetId: null, url: '' })}
            />

            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                aria-label="从资产库选择视频"
                className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-border-input bg-bg-input px-2 py-2 text-[12px] text-text-secondary transition hover:border-border-primary hover:text-text-base"
                onClick={() => setIsAssetPickerOpen(true)}
              >
                <FolderOpen className="h-3.5 w-3.5" />
                资产库
              </button>
              <button
                type="button"
                aria-label="编辑视频资产"
                className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-border-input bg-bg-input px-2 py-2 text-[12px] text-text-secondary transition hover:border-border-primary hover:text-text-base disabled:opacity-45"
                disabled={!data.assetId}
                onClick={() => {
                  if (data.assetId) onEditAsset?.(data.assetId)
                }}
              >
                <Pencil className="h-3.5 w-3.5" />
                编辑
              </button>
              <button
                type="button"
                aria-label="写回视频输出资产"
                className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-border-input bg-bg-input px-2 py-2 text-[12px] text-text-secondary transition hover:border-border-primary hover:text-text-base disabled:opacity-45"
                disabled={!data.assetId || data.status !== 'done'}
                onClick={() => {
                  if (data.assetId) onWriteOutputAsset?.(id, data.assetId)
                }}
              >
                <Save className="h-3.5 w-3.5" />
                写回
              </button>
            </div>

            <label className="flex flex-col gap-1.5 text-[12px] font-medium text-text-muted">
              Prompt 覆盖
              <MentionTextarea
                ariaLabel="Prompt 覆盖"
                value={data.promptOverride}
                onChange={(value) => update({ promptOverride: value })}
                placeholder="描述动作、镜头路径、时序和情绪。"
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

            <fieldset className="flex flex-col gap-1.5">
              <legend className="text-[12px] font-medium text-text-muted">时长</legend>
              <div className="grid grid-cols-4 gap-2">
                {durationOptions.map((duration) => (
                  <button
                    key={duration}
                    type="button"
                    aria-label={`Use ${duration} seconds duration`}
                    className={cn(
                      'rounded-lg border border-border-input bg-bg-input px-3 py-2 text-[12px] text-text-secondary transition hover:border-border-primary hover:text-text-base',
                      data.durationSeconds === duration && 'border-brand text-brand'
                    )}
                    onClick={() => update({ durationSeconds: duration })}
                  >
                    {duration}s
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="flex flex-col gap-1.5">
              <legend className="text-[12px] font-medium text-text-muted">帧</legend>
              <div className="grid grid-cols-2 gap-2">
                {frameOptions.map((option) => (
                  <div key={option.assetId} className="rounded-lg border border-border-input bg-bg-input p-2">
                    <div className="mb-2 flex h-16 items-center justify-center overflow-hidden rounded-md border border-border-secondary bg-bg-card">
                      {option.safeUrl ? (
                        <img src={option.safeUrl} alt={`${option.label} thumbnail`} className="h-full w-full object-contain" />
                      ) : (
                        <ImageIcon className="h-5 w-5 text-text-muted" />
                      )}
                    </div>
                    <div className="mb-2 truncate text-[12px] font-medium text-text-secondary">{option.label}</div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        aria-label={`Use ${option.label} as first frame`}
                        className={cn(
                          'rounded-md border border-border-input px-2 py-1.5 text-[12px] text-text-secondary transition hover:border-border-primary hover:text-text-base',
                          data.firstFrameAssetId === option.assetId && 'border-brand text-brand'
                        )}
                        onClick={() => update({ firstFrameAssetId: option.assetId })}
                      >
                        首帧
                      </button>
                      <button
                        type="button"
                        aria-label={`Use ${option.label} as last frame`}
                        className={cn(
                          'rounded-md border border-border-input px-2 py-1.5 text-[12px] text-text-secondary transition hover:border-border-primary hover:text-text-base',
                          data.lastFrameAssetId === option.assetId && 'border-brand text-brand'
                        )}
                        onClick={() => update({ lastFrameAssetId: option.assetId })}
                      >
                        末帧
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </fieldset>
          </div>
        )}
      </section>

      {isAssetPickerOpen ? (
        <NodeAssetPickerModal
          mediaType="video"
          options={assetOptions}
          onClose={() => setIsAssetPickerOpen(false)}
          onSelect={bindAsset}
        />
      ) : null}

      {/* 输入/输出连接点 */}
      <Handle type="target" position={Position.Left} className="cc-handle" />
      <Handle type="source" position={Position.Right} className="cc-handle" />
    </article>
  )
}

export const VideoNode = React.memo(VideoNodeComponent)
