/**
 * Production scene node for categorized environment references.
 * @see docs/api-contracts/canvas-plan.md
 * @see docs/api-contracts/assets-files.md
 */

import { Handle, NodeResizer, Position } from '@xyflow/react'
import { Eye, Image as ImageIcon, MapPin, Sparkles } from 'lucide-react'
import React, { useCallback } from 'react'
import { useStore } from 'zustand'

import type { SceneNodeData } from '../../../../../../shared/nodes'
import MentionTextarea from '../components/MentionTextarea'
import { cn } from '../../lib/cn'
import { NODE_MIN_HEIGHT, NODE_MIN_WIDTH, NODE_RESIZER_CLASS_NAMES } from '../lib/node-sizing'
import { canvasStore } from '../store/canvas.store'

/** Renderer props for the production scene node. */
export interface SceneNodeProps {
  /** Canvas node identifier. */
  id: string
  /** Shared scene node data. */
  data: SceneNodeData
  /** Whether React Flow marks this node as selected. */
  selected?: boolean
  /** Optional test or wrapper update callback. Falls back to canvas store updates. */
  onChange?: (id: string, patch: Partial<SceneNodeData>) => void
  /** Optional asset viewer entry used by the renderer shell. */
  onViewAsset?: (assetId: string) => void
  /** Optional generation intent callback; real generation remains queued outside this node. */
  onGenerate?: (id: string, mode: 'single') => void
}

function scenePromptPreview(data: SceneNodeData): string {
  const description = data.description?.trim()
  return description ? `Scene ${data.label}: ${description}` : `Scene ${data.label}`
}

/**
 * Renders a scene reference card with preview, category, and prompt description.
 * @param props - Node ID, data, selection state, and update callback.
 * @returns Scene node element.
 * @throws Error never intentionally; empty fields are persisted as empty strings/nulls.
 * @see docs/api-contracts/canvas-plan.md
 */
function SceneNodeComponent({
  id,
  data,
  selected = false,
  onChange,
  onViewAsset,
  onGenerate,
}: SceneNodeProps): JSX.Element {
  const updateNodeData = useStore(canvasStore, (state) => state.updateNodeData)
  const update = useCallback(
    (patch: Partial<SceneNodeData>) => {
      if (onChange) {
        onChange(id, patch)
        return
      }
      updateNodeData(id, patch)
    },
    [id, onChange, updateNodeData]
  )

  return (
    <article
      role="group"
      aria-label={`Scene node ${data.label}`}
      className={cn(
        'relative flex w-[320px] flex-col gap-3 rounded-xl border border-border-secondary bg-bg-card p-4 text-text-base shadow-card transition-[border-color,box-shadow] duration-300 ease-luxury',
        selected && 'border-border-primary shadow-active'
      )}
      data-node-id={id}
      data-node-type="scene"
    >
      <NodeResizer
        isVisible={selected}
        minWidth={NODE_MIN_WIDTH.text}
        minHeight={NODE_MIN_HEIGHT.text}
        lineClassName={NODE_RESIZER_CLASS_NAMES.line}
        handleClassName={NODE_RESIZER_CLASS_NAMES.handle}
      />

      <header className="flex items-center gap-2">
        <MapPin className="h-4 w-4 text-semantic-info" />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase text-text-muted">Scene</div>
          {selected ? (
            <input
              aria-label="场景名称"
              className="nodrag w-full rounded-sm border border-border-input bg-bg-input px-2 py-1 text-[13px] font-semibold text-text-base outline-none focus:ring-1 focus:ring-brand"
              value={data.label}
              onChange={(event) => update({ label: event.target.value })}
            />
          ) : (
            <div className="truncate text-[15px] font-semibold text-text-base">{data.label}</div>
          )}
        </div>
        {selected ? (
          <input
            aria-label="场景分类"
            className="nodrag w-[92px] rounded-sm border border-border-input bg-bg-input px-2 py-1 text-[11px] text-text-base outline-none focus:ring-1 focus:ring-brand"
            value={data.category ?? ''}
            onChange={(event) => update({ category: event.target.value })}
            placeholder="分类"
          />
        ) : data.category ? (
          <span className="rounded-sm border border-border-secondary bg-bg-input px-2 py-1 text-[11px] text-text-muted">
            {data.category}
          </span>
        ) : null}
      </header>

      <div className="flex h-36 items-center justify-center overflow-hidden rounded-lg border border-border-input bg-bg-input">
        {data.url ? (
          <img src={data.url} alt={`${data.label} scene reference`} className="h-full w-full object-contain" />
        ) : (
          <ImageIcon className="h-8 w-8 text-text-muted" />
        )}
      </div>

      <label className="flex flex-col gap-1 text-[12px] font-medium text-text-muted">
        场景描述
        <MentionTextarea
          ariaLabel="场景描述"
          value={data.description ?? ''}
          onChange={(value) => update({ description: value })}
          placeholder="空间、光线、天气、时代感"
          rows={3}
          className="nodrag nowheel"
        />
      </label>

      <div className="rounded-lg border border-border-secondary bg-bg-input/70 p-2 text-[11px] leading-relaxed text-text-muted">
        <div className="mb-1 font-semibold text-text-secondary">场景 Prompt</div>
        <div className="line-clamp-3 text-text-base">{scenePromptPreview(data)}</div>
      </div>

      {selected && (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            aria-label="查看场景资产"
            disabled={!data.assetId}
            className="nodrag inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-border-input bg-bg-input px-2 py-2 text-[12px] text-text-secondary transition hover:border-border-primary hover:text-text-base disabled:opacity-45"
            onClick={() => {
              if (data.assetId) onViewAsset?.(data.assetId)
            }}
          >
            <Eye className="h-3.5 w-3.5" />
            查看
          </button>
          <button
            type="button"
            aria-label="生成场景参考图"
            className="nodrag inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-border-input bg-bg-input px-2 py-2 text-[12px] text-text-secondary transition hover:border-border-primary hover:text-text-base"
            onClick={() => onGenerate?.(id, 'single')}
          >
            <Sparkles className="h-3.5 w-3.5" />
            生成
          </button>
        </div>
      )}

      <Handle type="target" position={Position.Left} className="cc-handle" />
      <Handle type="source" position={Position.Right} className="cc-handle" />
    </article>
  )
}

/** Memoized production scene node component. */
export const SceneNode = React.memo(SceneNodeComponent)
