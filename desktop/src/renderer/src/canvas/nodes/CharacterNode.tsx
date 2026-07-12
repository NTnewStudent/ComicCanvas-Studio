/**
 * Production character node for asset-backed semantic context.
 * @see docs/api-contracts/canvas-plan.md
 * @see docs/api-contracts/assets-files.md
 */

import { Handle, NodeResizer, Position } from '@xyflow/react'
import { Eye, Image as ImageIcon, Images, Sparkles, Tags, UserRound } from 'lucide-react'
import React, { useCallback, useMemo } from 'react'
import { useStore } from 'zustand'

import type { CharacterNodeData } from '../../../../../../shared/nodes'
import MentionTextarea from '../components/MentionTextarea'
import { useNodeEditorOpen } from '../components/NodeEditorContext'
import {
  NodeEditorFooter,
  NodeFrame,
  NodeHeader,
  NodePreview,
  NodeSelectionEditor,
  NodeSummaryRows,
} from '../components/NodePrimitives'
import { cn } from '../../lib/cn'
import { NODE_MIN_HEIGHT, NODE_MIN_WIDTH, NODE_RESIZER_CLASS_NAMES, NODE_UI_CLASS_NAMES } from '../lib/node-sizing'
import { createMentionReferenceEdge, mentionTargetsForNodes, pruneMentionReferenceEdges } from '../lib/canvas-mention-links'
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
  return description ? `角色 ${data.label}：${description}` : `角色 ${data.label}`
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
  const canvasNodes = useStore(canvasStore, (state) => state.nodes)
  const mentionTargets = useMemo(() => mentionTargetsForNodes(canvasNodes, id), [canvasNodes, id])
  const editorOpen = useNodeEditorOpen(id)

  return (
    <NodeFrame
      role="group"
      aria-label={`角色节点 ${data.label}`}
      selected={selected}
      className={cn('h-full w-full', NODE_UI_CLASS_NAMES.characterShell)}
      data-node-id={id}
      data-node-type="character"
    >
      <NodeResizer
        isVisible={selected}
        minWidth={NODE_MIN_WIDTH.character}
        minHeight={NODE_MIN_HEIGHT.character}
        lineClassName={NODE_RESIZER_CLASS_NAMES.line}
        handleClassName={NODE_RESIZER_CLASS_NAMES.handle}
      />

      <NodeHeader
        icon={<UserRound className="h-4 w-4" />}
        title={data.label}
        meta="角色"
        status={tags.length > 0 ? `${tags.length} 个标签` : undefined}
      />

      <NodePreview className="flex min-h-[168px] items-center justify-center">
        {data.url ? (
          <img src={data.url} alt={`${data.label} 角色参考图`} className="h-full w-full object-contain" />
        ) : (
          <ImageIcon className="h-7 w-7 text-text-muted" />
        )}
      </NodePreview>

      <NodeSummaryRows
        rows={[
          { label: '描述', value: data.description?.trim() || '未填写' },
          { label: '标签', value: tags.length > 0 ? tagsValue : '未设置' },
        ]}
      />

      <NodeSelectionEditor open={editorOpen} testId="character-node-editor">
        <label className="flex flex-col gap-1.5 text-[12px] font-medium text-text-muted">
          角色名称
          <input
            aria-label="角色名称"
            className={cn('w-full font-semibold', NODE_UI_CLASS_NAMES.field)}
            value={data.label}
            onChange={(event) => update({ label: event.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-[12px] font-medium text-text-muted">
          角色描述
          <MentionTextarea
            ariaLabel="角色描述"
            value={data.description ?? ''}
            onChange={(value) => update({ description: value })}
            placeholder="角色外貌、性格、服装"
            rows={4}
            className="nodrag nowheel"
            mentionTargets={mentionTargets}
            sourceNodeId={id}
            onMentionSelect={createMentionReferenceEdge}
            onMentionsChange={pruneMentionReferenceEdges}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-[12px] font-medium text-text-muted">
          <span className="flex items-center gap-1.5"><Tags className="h-3.5 w-3.5" />角色标签</span>
          <input
            aria-label="角色标签"
            className={cn('w-full', NODE_UI_CLASS_NAMES.field)}
            value={tagsValue}
            onChange={(event) => update({ tags: parseTagInput(event.target.value) })}
            placeholder="主角 / 飞行员 / 黑色电影"
          />
        </label>
        <div className="rounded-md border border-border-secondary bg-bg-input/60 px-3 py-2 text-[11px] leading-[1.5] text-text-muted">
          <div className="mb-1 font-semibold text-text-secondary">角色 Prompt</div>
          <div className="text-text-base">{characterPromptPreview(data)}</div>
        </div>
        <NodeEditorFooter>
          <button
            type="button"
            aria-label="查看角色资产"
            disabled={!data.assetId}
            className={cn('nodrag disabled:opacity-45', NODE_UI_CLASS_NAMES.compactButton)}
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
            className={cn('nodrag', NODE_UI_CLASS_NAMES.compactButton)}
            onClick={() => onGenerate?.(id, 'single')}
          >
            <Sparkles className="h-3.5 w-3.5" />
            单视图
          </button>
          <button
            type="button"
            aria-label="生成多视图角色图"
            className={cn('nodrag', NODE_UI_CLASS_NAMES.compactButton)}
            onClick={() => onGenerate?.(id, 'multi')}
          >
            <Images className="h-3.5 w-3.5" />
            多视图
          </button>
        </NodeEditorFooter>
      </NodeSelectionEditor>

      <Handle type="target" position={Position.Left} className="cc-handle" />
      <Handle type="source" position={Position.Right} className="cc-handle" />
    </NodeFrame>
  )
}

/** Memoized production character node component. */
export const CharacterNode = React.memo(CharacterNodeComponent)
