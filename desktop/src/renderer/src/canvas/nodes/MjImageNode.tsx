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
import { useNodeEditorOpen } from '../components/NodeEditorContext'
import {
  NodeFrame,
  NodeHeader,
  NodePreview,
  NodeSelectionEditor,
  NodeSummaryRows,
} from '../components/NodePrimitives'
import { NODE_MIN_HEIGHT, NODE_MIN_WIDTH, NODE_RESIZER_CLASS_NAMES, NODE_UI_CLASS_NAMES } from '../lib/node-sizing'
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
  const selectedUrl = urls[selectedIndex] ?? data.url
  const editorOpen = useNodeEditorOpen(id)

  return (
    <NodeFrame
      role="group"
      aria-label={`MJ Image node ${data.label}`}
      selected={selected}
      className="h-full w-full"
      data-node-id={id}
      data-node-type="mjImage"
    >
      <NodeResizer
        isVisible={selected}
        minWidth={NODE_MIN_WIDTH.mjImage}
        minHeight={NODE_MIN_HEIGHT.mjImage}
        lineClassName={NODE_RESIZER_CLASS_NAMES.line}
        handleClassName={NODE_RESIZER_CLASS_NAMES.handle}
      />

      <NodeHeader
        icon={<ImagePlus className="h-4 w-4" />}
        title={data.label}
        meta="MJ Image"
        status={data.status}
      />

      <NodePreview className="flex min-h-[180px] items-center justify-center">
        {selectedUrl ? (
          <img src={selectedUrl} alt={`${data.label} 当前 MJ 结果`} className="h-full w-full object-contain" />
        ) : (
          <Sparkles className="h-7 w-7 text-text-muted" />
        )}
      </NodePreview>

      <div className="line-clamp-2 text-[12px] leading-relaxed text-text-secondary">
        {data.prompt?.trim() || '未填写 Prompt'}
      </div>

      <NodeSummaryRows
        rows={[
          { label: '模型', value: data.modelId ?? '未选择' },
          { label: '画幅', value: data.ratio ?? '1:1' },
          { label: '结果', value: `${urls.filter(Boolean).length}/4` },
        ]}
      />

      <NodeSelectionEditor open={editorOpen} testId="mj-image-node-editor">
        <label className="flex flex-col gap-1.5 text-[12px] font-medium text-text-muted">
          MJ Prompt
          <textarea
            aria-label="MJ Prompt"
            className={cn('min-h-[88px] resize-none py-2 leading-relaxed', NODE_UI_CLASS_NAMES.field)}
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
                  'relative aspect-video overflow-hidden rounded-md border border-border-input bg-bg-input text-[12px] text-text-muted transition hover:border-border-primary',
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
      </NodeSelectionEditor>

      <Handle type="target" position={Position.Left} className="cc-handle" />
      <Handle type="source" position={Position.Right} className="cc-handle" />
    </NodeFrame>
  )
}

/** Memoized production MJ image node component. */
export const MjImageNode = React.memo(MjImageNodeComponent)
