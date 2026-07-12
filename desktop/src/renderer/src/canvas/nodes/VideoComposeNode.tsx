/**
 * Production video compose node for ordered video stitching.
 * @see docs/api-contracts/canvas-plan.md
 */

import { Handle, NodeResizer, Position } from '@xyflow/react'
import { Combine, ListOrdered, Play, Save } from 'lucide-react'
import React, { useCallback } from 'react'
import { useStore } from 'zustand'

import type { VideoComposeNodeData } from '../../../../../../shared/nodes'
import { useNodeEditorOpen } from '../components/NodeEditorContext'
import { NodeEditorFooter, NodeFrame, NodeHeader, NodePreview, NodeSelectionEditor, NodeSummaryRows } from '../components/NodePrimitives'
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

const transitionOptions: Array<{ value: NonNullable<VideoComposeNodeData['transitionName']>; label: string }> = [
  { value: 'cut', label: '硬切' },
  { value: 'crossfade', label: '交叉淡化' },
  { value: 'dip-to-black', label: '淡入黑场' },
]

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
  const editorOpen = useNodeEditorOpen(id)

  const handleRun = useCallback(() => {
    if (isRunning) return
    update({ status: 'running', url: '' })
    onRun?.(id)
  }, [id, isRunning, onRun, update])

  return (
    <NodeFrame
      className="h-full w-full"
      role="group"
      aria-label={`视频合成节点 ${data.label}`}
      selected={selected}
      data-node-id={id}
      data-node-type="videoCompose"
    >
      <NodeResizer
        isVisible={selected}
        minWidth={NODE_MIN_WIDTH.videoCompose}
        minHeight={NODE_MIN_HEIGHT.videoCompose}
        lineClassName={NODE_RESIZER_CLASS_NAMES.line}
        handleClassName={NODE_RESIZER_CLASS_NAMES.handle}
      />

      <NodeHeader icon={<Combine className="h-4 w-4" />} title={data.label} meta="视频合成" status={data.status} />
      <NodePreview>
        {data.url ? (
          <video
            data-testid="video-compose-output"
            src={data.url}
            controls
            className="aspect-video w-full bg-black object-contain"
          />
        ) : (
          <div className="flex aspect-video items-center justify-center gap-2 text-[13px] text-text-muted">
            <ListOrdered className="h-4 w-4" />
            合成输出等待队列回写
          </div>
        )}
      </NodePreview>
      <NodeSummaryRows rows={[
        { label: '输入', value: inputOrder.length > 0 ? `${inputOrder.length} 个视频` : '等待连接' },
        { label: '转场', value: transitionOptions.find((option) => option.value === (data.transitionName ?? 'cut'))?.label ?? '硬切' },
        { label: '模型', value: data.modelId || '未配置' }
      ]} />

      <NodeSelectionEditor open={editorOpen} testId="video-compose-node-editor">
        <div className="grid gap-3">
          <section>
            <div className="mb-2 flex items-center gap-2 text-[12px] font-medium text-text-muted"><ListOrdered className="h-3.5 w-3.5" />输入顺序</div>
            {inputOrder.length > 0 ? <ol className="grid gap-1 text-[13px]">{inputOrder.map((nodeId, index) => <li key={`${nodeId}-${index}`}>{nodeId}</li>)}</ol> : <p className="text-[13px] text-text-muted">连接多个视频节点后按边顺序合成</p>}
          </section>
          <label className="flex flex-col gap-1 text-[12px] font-medium text-text-muted">转场
            <select aria-label="转场" className="h-8 rounded-sm border border-border-input bg-bg-input px-2 text-[13px] text-text-base outline-none focus:ring-1 focus:ring-brand" value={data.transitionName ?? 'cut'} onChange={(event) => update({ transitionName: event.target.value })}>
              {transitionOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[12px] font-medium text-text-muted">合成模型
            <input aria-label="合成模型" className="h-8 rounded-sm border border-border-input bg-bg-input px-2 text-[13px] text-text-base outline-none focus:ring-1 focus:ring-brand" value={data.modelId ?? ''} onChange={(event) => update({ modelId: event.target.value })} />
          </label>
        </div>
        <NodeEditorFooter>
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
        </NodeEditorFooter>
      </NodeSelectionEditor>

      <Handle type="target" position={Position.Left} className="cc-handle" />
      <Handle type="source" position={Position.Right} className="cc-handle" />
    </NodeFrame>
  )
}

/** Memoized production video compose node component. */
export const VideoComposeNode = React.memo(VideoComposeNodeComponent)
