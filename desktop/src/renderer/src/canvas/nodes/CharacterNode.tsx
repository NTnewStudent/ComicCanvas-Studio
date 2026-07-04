/**
 * Production character node for asset-backed semantic context.
 * @see docs/api-contracts/canvas-plan.md
 * @see docs/api-contracts/assets-files.md
 */

import { Handle, NodeResizer, Position } from '@xyflow/react'
import { Eye, Image as ImageIcon, Images, Sparkles, Tags, UserRound } from 'lucide-react'
import React, { useCallback } from 'react'
import { useStore } from 'zustand'

import type { CharacterNodeData } from '../../../../../../shared/nodes'
import MentionTextarea from '../components/MentionTextarea'
import { cn } from '../../lib/cn'
import { NODE_MIN_HEIGHT, NODE_MIN_WIDTH, NODE_RESIZER_CLASS_NAMES } from '../lib/node-sizing'
import { canvasStore } from '../store/canvas.store'

/** Renderer props for the production character node. */
export interface CharacterNodeProps {
  /** Canvas node identifier. */
  id: string
  /** Shared character node data. */
  data: CharacterNodeData
  /** Whether React Flow marks this node as selected. */
  selected?: boolean
  /** Optional test or wrapper update callback. Falls back to canvas store updates. */
  onChange?: (id: string, patch: Partial<CharacterNodeData>) => void
  /** Optional asset viewer entry used by the renderer shell. */
  onViewAsset?: (assetId: string) => void
  /** Optional generation intent callback; real generation remains queued outside this node. */
  onGenerate?: (id: string, mode: 'single' | 'multi') => void
}

function parseTagInput(value: string): string[] {
  return value
    .split(/[/,，、\n]/u)
    .map((tag) => tag.trim())
    .filter(Boolean)
}

function characterPromptPreview(data: CharacterNodeData): string {
  const description = data.description?.trim()
  return description ? `Character ${data.label}: ${description}` : `Character ${data.label}`
}

/**
 * Renders a character reference card with preview, description, tags, and asset binding.
 * @param props - Node ID, data, selection state, and update callback.
 * @returns Character node element.
 * @throws Error never intentionally; empty fields are persisted as empty strings/nulls.
 * @see docs/api-contracts/canvas-plan.md
 */
function CharacterNodeComponent({
  id,
  data,
  selected = false,
  onChange,
  onViewAsset,
  onGenerate,
}: CharacterNodeProps): JSX.Element {
  const updateNodeData = useStore(canvasStore, (state) => state.updateNodeData)
  const update = useCallback(
    (patch: Partial<CharacterNodeData>) => {
      if (onChange) {
        onChange(id, patch)
        return
      }
      updateNodeData(id, patch)
    },
    [id, onChange, updateNodeData]
  )
  const tags = data.tags ?? []
  const tagsValue = tags.join(' / ')

  return (
    <article
      role="group"
      aria-label={`Character node ${data.label}`}
      className={cn(
        'relative flex w-[320px] flex-col gap-3 rounded-xl border border-border-secondary bg-bg-card p-4 text-text-base shadow-card transition-[border-color,box-shadow] duration-300 ease-luxury',
        selected && 'border-border-primary shadow-active'
      )}
      data-node-id={id}
      data-node-type="character"
    >
      <NodeResizer
        isVisible={selected}
        minWidth={NODE_MIN_WIDTH.text}
        minHeight={NODE_MIN_HEIGHT.text}
        lineClassName={NODE_RESIZER_CLASS_NAMES.line}
        handleClassName={NODE_RESIZER_CLASS_NAMES.handle}
      />

      <header className="flex items-center gap-2">
        <UserRound className="h-4 w-4 text-brand" />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase text-text-muted">Character</div>
          {selected ? (
            <input
              aria-label="角色名称"
              className="nodrag w-full rounded-sm border border-border-input bg-bg-input px-2 py-1 text-[13px] font-semibold text-text-base outline-none focus:ring-1 focus:ring-brand"
              value={data.label}
              onChange={(event) => update({ label: event.target.value })}
            />
          ) : (
            <div className="truncate text-[15px] font-semibold text-text-base">{data.label}</div>
          )}
        </div>
      </header>

      <div className="flex gap-3">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border-input bg-bg-input">
          {data.url ? (
            <img src={data.url} alt={`${data.label} character reference`} className="h-full w-full object-contain" />
          ) : (
            <ImageIcon className="h-7 w-7 text-text-muted" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <label className="flex flex-col gap-1 text-[12px] font-medium text-text-muted">
            角色描述
            <MentionTextarea
              ariaLabel="角色描述"
              value={data.description ?? ''}
              onChange={(value) => update({ description: value })}
              placeholder="角色外貌、性格、服装"
              rows={3}
              className="nodrag nowheel"
            />
          </label>
        </div>
      </div>

      <div className="flex items-center gap-2 text-[12px] text-text-muted">
        <Tags className="h-3.5 w-3.5" />
        {selected ? (
          <input
            aria-label="角色标签"
            className="nodrag min-w-0 flex-1 rounded-sm border border-border-input bg-bg-input px-2 py-1 text-[12px] text-text-base outline-none focus:ring-1 focus:ring-brand"
            value={tagsValue}
            onChange={(event) => update({ tags: parseTagInput(event.target.value) })}
            placeholder="lead / pilot / noir"
          />
        ) : (
          <span className="min-w-0 flex-1 truncate">{tags.length > 0 ? tagsValue : '未设置标签'}</span>
        )}
      </div>

      <div className="rounded-lg border border-border-secondary bg-bg-input/70 p-2 text-[11px] leading-relaxed text-text-muted">
        <div className="mb-1 font-semibold text-text-secondary">角色 Prompt</div>
        <div className="line-clamp-3 text-text-base">{characterPromptPreview(data)}</div>
      </div>

      {selected && (
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            aria-label="查看角色资产"
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
            aria-label="生成单视图角色图"
            className="nodrag inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-border-input bg-bg-input px-2 py-2 text-[12px] text-text-secondary transition hover:border-border-primary hover:text-text-base"
            onClick={() => onGenerate?.(id, 'single')}
          >
            <Sparkles className="h-3.5 w-3.5" />
            单视图
          </button>
          <button
            type="button"
            aria-label="生成多视图角色图"
            className="nodrag inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-border-input bg-bg-input px-2 py-2 text-[12px] text-text-secondary transition hover:border-border-primary hover:text-text-base"
            onClick={() => onGenerate?.(id, 'multi')}
          >
            <Images className="h-3.5 w-3.5" />
            多视图
          </button>
        </div>
      )}

      <Handle type="target" position={Position.Left} className="cc-handle" />
      <Handle type="source" position={Position.Right} className="cc-handle" />
    </article>
  )
}

/** Memoized production character node component. */
export const CharacterNode = React.memo(CharacterNodeComponent)
