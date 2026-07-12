/**
 * Production super-resolution node for video enhancement.
 * @see docs/api-contracts/canvas-plan.md
 */

import { Handle, NodeResizer, Position } from '@xyflow/react'
import { Gauge, Play, Save, Sparkles } from 'lucide-react'
import React, { useCallback } from 'react'
import { useStore } from 'zustand'

import type { SuperResolutionNodeData } from '../../../../../../shared/nodes'
import { useNodeEditorOpen } from '../components/NodeEditorContext'
import { NodeEditorFooter, NodeFrame, NodeHeader, NodePreview, NodeSelectionEditor, NodeSummaryRows } from '../components/NodePrimitives'
import { NODE_MIN_HEIGHT, NODE_MIN_WIDTH, NODE_RESIZER_CLASS_NAMES } from '../lib/node-sizing'
import { canvasStore } from '../store/canvas.store'

type SuperResolutionScene = NonNullable<SuperResolutionNodeData['scene']>
type SuperResolutionTarget = NonNullable<SuperResolutionNodeData['resolution']>

const superResolutionSceneOptions: Array<{ value: SuperResolutionScene; label: string }> = [
  { value: 'aigc', label: 'AIGC 视频' },
  { value: 'short_series', label: '短剧' },
  { value: 'ugc', label: 'UGC' },
  { value: 'old_film', label: '老电影' },
]

/** Renderer props for the production super-resolution node. */
export interface SuperResolutionNodeProps {
  /** Canvas node identifier. */
  id: string
  /** Shared super-resolution node data. */
  data: SuperResolutionNodeData
  /** Whether React Flow marks this node as selected. */
  selected?: boolean
  /** Optional test or wrapper update callback. Falls back to canvas store updates. */
  onChange?: (id: string, patch: Partial<SuperResolutionNodeData>) => void
  /** Optional queued-run intent callback handled by the renderer shell. */
  onRun?: (id: string) => void
  /** Optional result writeback callback handled by the renderer shell. */
  onWriteOutputAsset?: (id: string, assetId: string) => void
}

/**
 * Renders a super-resolution tool node with scene, resolution, and FPS controls.
 * @param props - Node ID, data, selection state, and update callback.
 * @returns Super-resolution node element.
 * @throws Error never intentionally; numeric FPS parsing falls back to the previous valid value.
 * @see docs/api-contracts/canvas-plan.md
 */
function SuperResolutionNodeComponent({
  id,
  data,
  selected = false,
  onChange,
  onRun,
  onWriteOutputAsset,
}: SuperResolutionNodeProps): JSX.Element {
  const updateNodeData = useStore(canvasStore, (state) => state.updateNodeData)
  const update = useCallback(
    (patch: Partial<SuperResolutionNodeData>) => {
      if (onChange) {
        onChange(id, patch)
        return
      }
      updateNodeData(id, patch)
    },
    [id, onChange, updateNodeData]
  )
  const isRunning = data.status === 'pending' || data.status === 'running'
  const editorOpen = useNodeEditorOpen(id)

  const handleRun = useCallback(() => {
    if (isRunning) return
    update({ status: 'running', url: '' })
    onRun?.(id)
  }, [id, isRunning, onRun, update])

  function updateFps(value: string): void {
    const parsed = Number(value)
    update({ fps: Number.isFinite(parsed) && parsed > 0 ? parsed : (data.fps ?? 30) })
  }

  return (
    <NodeFrame
      className="h-full w-full"
      role="group"
      aria-label={`视频超分节点 ${data.label}`}
      selected={selected}
      data-node-id={id}
      data-node-type="superResolution"
    >
      <NodeResizer
        isVisible={selected}
        minWidth={NODE_MIN_WIDTH.superResolution}
        minHeight={NODE_MIN_HEIGHT.superResolution}
        lineClassName={NODE_RESIZER_CLASS_NAMES.line}
        handleClassName={NODE_RESIZER_CLASS_NAMES.handle}
      />

      <NodeHeader icon={<Sparkles className="h-4 w-4" />} title={data.label} meta="视频超分" status={data.status} />
      <NodePreview>
        {data.url ? (
          <video
            data-testid="super-resolution-output"
            src={data.url}
            controls
            className="aspect-video w-full bg-black object-contain"
          />
        ) : (
          <div className="flex aspect-video items-center justify-center gap-2 text-[13px] text-text-muted"><Gauge className="h-4 w-4" />
            超分输出等待队列回写
          </div>
        )}
      </NodePreview>
      <NodeSummaryRows rows={[
        { label: '输入', value: data.inputVideoId || '等待连接' },
        { label: '规格', value: `${data.resolution ?? '1080p'} · ${data.fps ?? 30} FPS` },
        { label: '场景', value: superResolutionSceneOptions.find((option) => option.value === (data.scene ?? 'aigc'))?.label ?? 'AIGC 视频' }
      ]} />

      <NodeSelectionEditor open={editorOpen} testId="super-resolution-node-editor">
        <div className="grid gap-3">
          <label className="flex flex-col gap-1 text-[12px] font-medium text-text-muted">视频输入
            <input aria-label="输入视频节点" className="h-8 rounded-sm border border-border-input bg-bg-input px-2 text-[13px] text-text-base outline-none focus:ring-1 focus:ring-brand" value={data.inputVideoId ?? ''} onChange={(event) => update({ inputVideoId: event.target.value })} />
          </label>
          <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-[12px] font-medium text-text-muted">
          场景
          <select
            aria-label="超分场景"
            className="h-8 rounded-sm border border-border-input bg-bg-input px-2 text-[13px] text-text-base outline-none focus:ring-1 focus:ring-brand"
            value={data.scene ?? 'aigc'}
            onChange={(event) => update({ scene: event.target.value as SuperResolutionScene })}
          >
            {superResolutionSceneOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-[12px] font-medium text-text-muted">
          目标分辨率
          <select
            aria-label="目标分辨率"
            className="h-8 rounded-sm border border-border-input bg-bg-input px-2 text-[13px] text-text-base outline-none focus:ring-1 focus:ring-brand"
            value={data.resolution ?? '1080p'}
            onChange={(event) => update({ resolution: event.target.value as SuperResolutionTarget })}
          >
            <option value="720p">720p</option>
            <option value="1080p">1080p</option>
            <option value="4k">4k</option>
          </select>
        </label>
          </div>

      <label className="flex flex-col gap-1 text-[12px] font-medium text-text-muted">
        FPS
        <input
          aria-label="FPS"
          type="number"
          min={1}
          max={120}
          className="h-8 rounded-sm border border-border-input bg-bg-input px-2 text-[13px] text-text-base outline-none focus:ring-1 focus:ring-brand"
          value={data.fps ?? 30}
          onChange={(event) => updateFps(event.target.value)}
        />
      </label>

        </div>
        <NodeEditorFooter>
            <button
              type="button"
              aria-label="运行视频超分"
              disabled={isRunning}
              className="nodrag inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-border-input bg-bg-input px-2 py-2 text-[12px] text-text-secondary transition hover:border-border-primary hover:text-text-base disabled:opacity-45"
              onClick={handleRun}
            >
              <Play className="h-3.5 w-3.5" />
              运行
            </button>
            <button
              type="button"
              aria-label="写回超分输出资产"
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

/** Memoized production super-resolution node component. */
export const SuperResolutionNode = React.memo(SuperResolutionNodeComponent)
