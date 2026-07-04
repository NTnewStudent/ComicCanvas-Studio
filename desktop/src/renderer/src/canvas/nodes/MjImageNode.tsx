/**
 * Production MJ image node for four-result image generation surfaces.
 * @see docs/api-contracts/canvas-plan.md
 * @see docs/api-contracts/assets-files.md
 */

import { Handle, NodeResizer, Position } from '@xyflow/react'
import { Check, ImagePlus, Sparkles } from 'lucide-react'
import React, { useCallback } from 'react'
import { useStore } from 'zustand'

import type { MjImageNodeData } from '../../../../../../shared/nodes'
import { cn } from '../../lib/cn'
import { NODE_MIN_HEIGHT, NODE_MIN_WIDTH, NODE_RESIZER_CLASS_NAMES } from '../lib/node-sizing'
import { canvasStore } from '../store/canvas.store'

/** Renderer props for the production MJ image node. */
export interface MjImageNodeProps {
  /** Canvas node identifier. */
  id: string
  /** Shared MJ image node data. */
  data: MjImageNodeData
  /** Whether React Flow marks this node as selected. */
  selected?: boolean
  /** Optional test or wrapper update callback. Falls back to canvas store updates. */
  onChange?: (id: string, patch: Partial<MjImageNodeData>) => void
}

/**
 * Renders an MJ image node with prompt, ratio, and selectable 2x2 result grid.
 * @param props - Node ID, data, selection state, and update callback.
 * @returns MJ image node element.
 * @throws Error never intentionally; result selection is ignored for missing URLs.
 * @see docs/api-contracts/canvas-plan.md
 */
function MjImageNodeComponent({ id, data, selected = false, onChange }: MjImageNodeProps): JSX.Element {
  const updateNodeData = useStore(canvasStore, (state) => state.updateNodeData)
  const update = useCallback(
    (patch: Partial<MjImageNodeData>) => {
      if (onChange) {
        onChange(id, patch)
        return
      }
      updateNodeData(id, patch)
    },
    [id, onChange, updateNodeData]
  )
  const urls = data.urls ?? []
  const selectedIndex = data.selectedIndex ?? 0

  return (
    <article
      role="group"
      aria-label={`MJ Image node ${data.label}`}
      className={cn(
        'relative flex w-[360px] flex-col gap-3 rounded-xl border border-border-secondary bg-bg-card p-4 text-text-base shadow-card transition-[border-color,box-shadow] duration-300 ease-luxury',
        selected && 'border-border-primary shadow-active'
      )}
      data-node-id={id}
      data-node-type="mjImage"
    >
      <NodeResizer
        isVisible={selected}
        minWidth={NODE_MIN_WIDTH.image}
        minHeight={NODE_MIN_HEIGHT.image}
        lineClassName={NODE_RESIZER_CLASS_NAMES.line}
        handleClassName={NODE_RESIZER_CLASS_NAMES.handle}
      />

      <header className="flex items-center gap-2">
        <ImagePlus className="h-4 w-4 text-brand" />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase text-text-muted">MJ Image</div>
          <div className="truncate text-[15px] font-semibold text-text-base">{data.label}</div>
        </div>
        <span className="rounded-sm bg-bg-input px-2 py-1 text-[11px] text-text-muted">{data.status}</span>
      </header>

      <label className="flex flex-col gap-1 text-[12px] font-medium text-text-muted">
        MJ Prompt
        <textarea
          aria-label="MJ Prompt"
          className="min-h-[72px] resize-none rounded-sm border border-border-input bg-bg-input px-2 py-1.5 text-[13px] leading-relaxed text-text-base outline-none focus:ring-1 focus:ring-brand"
          value={data.prompt ?? ''}
          onChange={(event) => update({ prompt: event.target.value })}
          placeholder="描述一组关键帧图像"
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        {[0, 1, 2, 3].map((index) => {
          const url = urls[index]
          const isSelected = selectedIndex === index
          return (
            <button
              key={index}
              type="button"
              aria-label={`选择 MJ 结果 ${index + 1}`}
              aria-pressed={isSelected}
              className={cn(
                'relative aspect-video overflow-hidden rounded-lg border border-border-input bg-bg-input text-[12px] text-text-muted transition hover:border-border-primary',
                isSelected && 'border-brand shadow-[0_0_0_1px_var(--cc-brand)]'
              )}
              onClick={() => {
                if (url) update({ selectedIndex: index, url })
              }}
            >
              {url ? (
                <img src={url} alt={`MJ result ${index + 1}`} className="h-full w-full object-contain" />
              ) : (
                <span className="flex h-full items-center justify-center gap-1">
                  <Sparkles className="h-3.5 w-3.5" />
                  空结果
                </span>
              )}
              {isSelected ? (
                <span className="absolute bottom-1 right-1 rounded-full bg-brand p-1 text-bg-base">
                  <Check className="h-3 w-3" />
                </span>
              ) : null}
            </button>
          )
        })}
      </div>

      <div className="flex items-center justify-between gap-2 text-[12px] text-text-muted">
        <span>{data.modelId ?? '未选择模型'}</span>
        <span>{data.ratio ?? '1:1'}</span>
      </div>

      <Handle type="target" position={Position.Left} className="cc-handle" />
      <Handle type="source" position={Position.Right} className="cc-handle" />
    </article>
  )
}

/** Memoized production MJ image node component. */
export const MjImageNode = React.memo(MjImageNodeComponent)
