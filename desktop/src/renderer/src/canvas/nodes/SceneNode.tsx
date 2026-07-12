/**
 * Production scene node for categorized environment references.
 * @see docs/api-contracts/canvas-plan.md
 * @see docs/api-contracts/assets-files.md
 */

import { Handle, NodeResizer, Position } from '@xyflow/react'
import { Eye, Image as ImageIcon, MapPin, Sparkles } from 'lucide-react'
import React, { useCallback, useMemo } from 'react'
import { useStore } from 'zustand'

import type { SceneNodeData } from '../../../../../../shared/nodes'
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
  return description ? `场景 ${data.label}：${description}` : `场景 ${data.label}`
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
  const canvasNodes = useStore(canvasStore, (state) => state.nodes)
  const mentionTargets = useMemo(() => mentionTargetsForNodes(canvasNodes, id), [canvasNodes, id])
  const editorOpen = useNodeEditorOpen(id)

  return (
    <NodeFrame
      role="group"
      aria-label={`场景节点 ${data.label}`}
      selected={selected}
      className={cn('h-full w-full', NODE_UI_CLASS_NAMES.sceneShell)}
      data-node-id={id}
      data-node-type="scene"
    >
      <NodeResizer
        isVisible={selected}
        minWidth={NODE_MIN_WIDTH.scene}
        minHeight={NODE_MIN_HEIGHT.scene}
        lineClassName={NODE_RESIZER_CLASS_NAMES.line}
        handleClassName={NODE_RESIZER_CLASS_NAMES.handle}
      />

      <NodeHeader
        icon={<MapPin className="h-4 w-4" />}
        title={data.label}
        meta="场景"
        status={data.category || undefined}
      />

      <NodePreview className="flex min-h-[168px] items-center justify-center">
        {data.url ? (
          <img src={data.url} alt={`${data.label} 场景参考图`} className="h-full w-full object-contain" />
        ) : (
          <ImageIcon className="h-8 w-8 text-text-muted" />
        )}
      </NodePreview>

      <NodeSummaryRows
        rows={[
          { label: '描述', value: data.description?.trim() || '未填写' },
          { label: '分类', value: data.category?.trim() || '未分类' },
        ]}
      />

      <NodeSelectionEditor open={editorOpen} testId="scene-node-editor">
        <label className="flex flex-col gap-1.5 text-[12px] font-medium text-text-muted">
          场景名称
          <input
            aria-label="场景名称"
            className={cn('w-full font-semibold', NODE_UI_CLASS_NAMES.field)}
            value={data.label}
            onChange={(event) => update({ label: event.target.value })}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-[12px] font-medium text-text-muted">
          场景分类
          <input
            aria-label="场景分类"
            className={cn('w-full', NODE_UI_CLASS_NAMES.field)}
            value={data.category ?? ''}
            onChange={(event) => update({ category: event.target.value })}
            placeholder="室内 / 室外 / 道具"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-[12px] font-medium text-text-muted">
          场景描述
          <MentionTextarea
            ariaLabel="场景描述"
            value={data.description ?? ''}
            onChange={(value) => update({ description: value })}
            placeholder="空间、光线、天气、时代感"
            rows={4}
            className="nodrag nowheel"
            mentionTargets={mentionTargets}
            sourceNodeId={id}
            onMentionSelect={createMentionReferenceEdge}
            onMentionsChange={pruneMentionReferenceEdges}
          />
        </label>
        <div className="rounded-md border border-border-secondary bg-bg-input/60 px-3 py-2 text-[11px] leading-[1.5] text-text-muted">
          <div className="mb-1 font-semibold text-text-secondary">场景 Prompt</div>
          <div className="text-text-base">{scenePromptPreview(data)}</div>
        </div>
        <NodeEditorFooter>
          <button
            type="button"
            aria-label="查看场景资产"
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
            aria-label="生成场景参考图"
            className={cn('nodrag', NODE_UI_CLASS_NAMES.compactButton)}
            onClick={() => onGenerate?.(id, 'single')}
          >
            <Sparkles className="h-3.5 w-3.5" />
            生成
          </button>
        </NodeEditorFooter>
      </NodeSelectionEditor>

      <Handle type="target" position={Position.Left} className="cc-handle" />
      <Handle type="source" position={Position.Right} className="cc-handle" />
    </NodeFrame>
  )
}

/** Memoized production scene node component. */
export const SceneNode = React.memo(SceneNodeComponent)
