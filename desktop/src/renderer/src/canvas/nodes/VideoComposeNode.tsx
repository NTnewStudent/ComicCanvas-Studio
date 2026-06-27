/**
 * Production video compose node for ordered video stitching.
 * @see docs/api-contracts/canvas-plan.md
 */

import { Handle, NodeResizer, Position } from '@xyflow/react'
import { Combine, ListOrdered, Play, Save } from 'lucide-react'
import React, { useCallback } from 'react'
import { useStore } from 'zustand'

import type { VideoComposeNodeData } from '../../../../../../shared/nodes'
import { cn } from '../../lib/cn'
import { NODE_MIN_HEIGHT, NODE_MIN_WIDTH, NODE_RESIZER_CLASS_NAMES } from '../lib/node-sizing'
import { canvasStore } from '../store/canvas.store'

/** Renderer props for the production video compose node. */
export interface VideoComposeNodeProps {
  /** Canvas node identifier. */
  id: string
  /** Shared video compose node data. */
  data: VideoComposeNodeData
  /** Whether React Flow marks this node as selected. */
  selected?: boolean
  /** Optional test or wrapper update callback. Falls back to canvas store updates. */
  onChange?: (id: string, patch: Partial<VideoComposeNodeData>) => void
  /** Optional queued-run intent callback handled by the renderer shell. */
  onRun?: (id: string) => void
  /** Optional result writeback callback handled by the renderer shell. */
  onWriteOutputAsset?: (id: string, assetId: string) => void
}

const transitionOptions = ['cut', 'crossfade', 'dip-to-black']

/**
 * Renders a video composition tool node with input order and transition controls.
 * @param props - Node ID, data, selection state, and update callback.
 * @returns Video compose node element.
 * @throws Error never intentionally; controls write validated literal values from select options.
 * @see docs/api-contracts/canvas-plan.md
 */
function VideoComposeNodeComponent({
  id,
  data,
  selected = false,
  onChange,
  onRun,
  onWriteOutputAsset,
}: VideoComposeNodeProps): JSX.Element {
  const updateNodeData = useStore(canvasStore, (state) => state.updateNodeData)
  const update = useCallback(
    (patch: Partial<VideoComposeNodeData>) => {
      if (onChange) {
        onChange(id, patch)
        return
      }
      updateNodeData(id, patch)
    },
    [id, onChange, updateNodeData]
  )
  const inputOrder = data.inputOrder ?? []
  const isRunning = data.status === 'pending' || data.status === 'running'

  const handleRun = useCallback(() => {
    if (isRunning) return
    update({ status: 'running', url: '' })
    onRun?.(id)
  }, [id, isRunning, onRun, update])

  return (
    <article
      role="group"
      aria-label={`Video Compose node ${data.label}`}
      className={cn(
        'relative flex w-[340px] flex-col gap-3 rounded-xl border border-border-secondary bg-bg-card p-4 text-text-base shadow-card transition-[border-color,box-shadow] duration-300 ease-luxury',
        selected && 'border-border-primary shadow-active'
      )}
      data-node-id={id}
      data-node-type="videoCompose"
    >
      <NodeResizer
        isVisible={selected}
        minWidth={NODE_MIN_WIDTH.video}
        minHeight={NODE_MIN_HEIGHT.video}
        lineClassName={NODE_RESIZER_CLASS_NAMES.line}
        handleClassName={NODE_RESIZER_CLASS_NAMES.handle}
      />

      <header className="flex items-center gap-2">
        <Combine className="h-4 w-4 text-brand" />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase text-text-muted">Video Compose</div>
          <div className="truncate text-[15px] font-semibold text-text-base">{data.label}</div>
        </div>
        <span className="rounded-sm bg-bg-input px-2 py-1 text-[11px] text-text-muted">{data.status}</span>
      </header>

      <section className="rounded-lg border border-border-input bg-bg-input p-3">
        <div className="mb-2 flex items-center gap-2 text-[12px] font-medium text-text-muted">
          <ListOrdered className="h-3.5 w-3.5" />
          输入顺序
        </div>
        {inputOrder.length > 0 ? (
          <ol className="flex flex-col gap-1 text-[13px] text-text-base">
            {inputOrder.map((nodeId, index) => (
              <li key={`${nodeId}-${index}`} className="rounded-sm bg-bg-card px-2 py-1">
                {nodeId}
              </li>
            ))}
          </ol>
        ) : (
          <div className="text-[13px] text-text-muted">连接多个视频节点后按边顺序合成</div>
        )}
      </section>

      <div className="overflow-hidden rounded-lg border border-border-input bg-bg-input">
        {data.url ? (
          <video
            data-testid="video-compose-output"
            src={data.url}
            controls
            className="aspect-video w-full bg-black object-contain"
          />
        ) : (
          <div className="flex aspect-video items-center justify-center text-[13px] text-text-muted">
            合成输出等待队列回写
          </div>
        )}
      </div>

      <label className="flex flex-col gap-1 text-[12px] font-medium text-text-muted">
        转场
        <select
          aria-label="转场"
          className="h-8 rounded-sm border border-border-input bg-bg-input px-2 text-[13px] text-text-base outline-none focus:ring-1 focus:ring-brand"
          value={data.transitionName ?? 'cut'}
          onChange={(event) => update({ transitionName: event.target.value })}
        >
          {transitionOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-[12px] font-medium text-text-muted">
        合成模型
        <input
          aria-label="合成模型"
          className="h-8 rounded-sm border border-border-input bg-bg-input px-2 text-[13px] text-text-base outline-none focus:ring-1 focus:ring-brand"
          value={data.modelId ?? ''}
          onChange={(event) => update({ modelId: event.target.value })}
        />
      </label>

      {selected && (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            aria-label="运行视频合成"
            disabled={isRunning}
            className="nodrag inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-border-input bg-bg-input px-2 py-2 text-[12px] text-text-secondary transition hover:border-border-primary hover:text-text-base disabled:opacity-45"
            onClick={handleRun}
          >
            <Play className="h-3.5 w-3.5" />
            运行
          </button>
          <button
            type="button"
            aria-label="写回合成输出资产"
            disabled={!data.assetId || data.status !== 'done'}
            className="nodrag inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-border-input bg-bg-input px-2 py-2 text-[12px] text-text-secondary transition hover:border-border-primary hover:text-text-base disabled:opacity-45"
            onClick={() => {
              if (data.assetId) onWriteOutputAsset?.(id, data.assetId)
            }}
          >
            <Save className="h-3.5 w-3.5" />
            写回
          </button>
        </div>
      )}

      <Handle type="target" position={Position.Left} className="cc-handle" />
      <Handle type="source" position={Position.Right} className="cc-handle" />
    </article>
  )
}

/** Memoized production video compose node component. */
export const VideoComposeNode = React.memo(VideoComposeNodeComponent)
