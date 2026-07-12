/**
 * Production audio node for imported audio assets and mux inputs.
 * @see docs/api-contracts/canvas-plan.md
 * @see docs/api-contracts/assets-files.md
 */

import { Handle, NodeResizer, Position } from '@xyflow/react'
import { Eye, Import, Music2 } from 'lucide-react'
import React, { useCallback } from 'react'
import { useStore } from 'zustand'

import type { AudioNodeData } from '../../../../../../shared/nodes'
import { MediaInputControls } from '../components/MediaInputControls'
import type { NodeAssetOption } from '../components/NodeAssetPickerModal'
import { useNodeEditorOpen } from '../components/NodeEditorContext'
import {
  NodeEditorFooter,
  NodeFrame,
  NodeHeader,
  NodePreview,
  NodeSelectionEditor,
  NodeSummaryRows,
} from '../components/NodePrimitives'
import { NODE_MIN_HEIGHT, NODE_MIN_WIDTH, NODE_RESIZER_CLASS_NAMES } from '../lib/node-sizing'
import { canvasStore } from '../store/canvas.store'

/** Renderer props for the production audio node. */
export interface AudioNodeProps {
  /** Canvas node identifier. */
  id: string
  /** Shared audio node data. */
  data: AudioNodeData
  /** Whether React Flow marks this node as selected. */
  selected?: boolean
  /** Optional test or wrapper update callback. Falls back to canvas store updates. */
  onChange?: (id: string, patch: Partial<AudioNodeData>) => void
  /** Optional import intent callback handled by the renderer shell. */
  onImport?: (id: string) => void
  /** Optional asset viewer entry used by the renderer shell. */
  onViewAsset?: (assetId: string) => void
  /** Audio assets that can be bound directly to this node. */
  assetOptions?: NodeAssetOption[]
}

const referenceRoleLabels: Record<NonNullable<AudioNodeData['referenceRole']>, string> = {
  audio: '音频',
  voice: '人声',
  music: '音乐',
  sfx: '音效',
}

/**
 * Renders an audio media node with playback preview and asset binding.
 * @param props - Node ID, data, selection state, and update callback.
 * @returns Audio node element.
 * @throws Error never intentionally; empty asset IDs are stored as null.
 * @see docs/api-contracts/canvas-plan.md
 */
function AudioNodeComponent({
  id,
  data,
  selected = false,
  onChange,
  onImport,
  onViewAsset,
  assetOptions = [],
}: AudioNodeProps): JSX.Element {
  const editorOpen = useNodeEditorOpen(id)
  const updateNodeData = useStore(canvasStore, (state) => state.updateNodeData)
  const update = useCallback(
    (patch: Partial<AudioNodeData>) => {
      if (onChange) {
        onChange(id, patch)
        return
      }
      updateNodeData(id, patch)
    },
    [id, onChange, updateNodeData]
  )

  return (
    <NodeFrame
      role="group"
      aria-label={`音频节点 ${data.label}`}
      selected={selected}
      className="relative flex h-full min-h-[300px] w-full min-w-[360px] flex-col gap-3 p-3 text-text-base"
      data-node-id={id}
      data-node-type="audio"
    >
      <NodeResizer
        isVisible={selected}
        minWidth={NODE_MIN_WIDTH.audio}
        minHeight={NODE_MIN_HEIGHT.audio}
        lineClassName={NODE_RESIZER_CLASS_NAMES.line}
        handleClassName={NODE_RESIZER_CLASS_NAMES.handle}
      />

      <NodeHeader
        icon={<Music2 className="h-4 w-4 text-semantic-warning" />}
        title={data.label}
        meta="音频"
        status={data.status}
      />

      <NodePreview className="flex min-h-20 items-center p-3">
        {data.url ? (
          <audio data-testid="audio-node-player" src={data.url} controls className="w-full" />
        ) : (
          <div className="flex min-h-12 items-center gap-2 text-[13px] text-text-muted">
            <Music2 className="h-5 w-5" />
            暂无音频资产
          </div>
        )}
      </NodePreview>

      <NodeSummaryRows
        rows={[
          { label: '资产', value: data.assetId ?? '未绑定资产' },
          { label: '时长', value: data.durationSeconds ? `${data.durationSeconds}s` : '未知时长' },
          { label: 'Mux 输入', value: `音频引用：${referenceRoleLabels[data.referenceRole ?? 'audio']}` },
        ]}
      />

      <NodeSelectionEditor open={editorOpen} testId="audio-node-editor">
        <label className="flex flex-col gap-1 text-[12px] font-medium text-text-muted">
          音频名称
          <input
            aria-label="音频名称"
            className="nodrag h-9 rounded-md border border-border-input bg-bg-input px-2.5 text-[13px] font-semibold text-text-base outline-none focus:ring-1 focus:ring-brand"
            value={data.label}
            onChange={(event) => update({ label: event.target.value })}
          />
        </label>

        <label className="flex flex-col gap-1 text-[12px] font-medium text-text-muted">
          音频资产 ID
          <input
            aria-label="音频资产 ID"
            className="h-9 rounded-md border border-border-input bg-bg-input px-2.5 text-[13px] text-text-base outline-none focus:ring-1 focus:ring-brand"
            value={data.assetId ?? ''}
            onChange={(event) => update({ assetId: event.target.value.trim() || null })}
          />
        </label>

        <MediaInputControls
          mediaType="audio"
          label="音频素材"
          selectedAssetId={data.assetId}
          selectedSafeUrl={data.url}
          options={assetOptions}
          compact
          onSelect={(asset) => update({ assetId: asset.assetId, url: asset.safeUrl, status: data.status ?? 'idle' })}
          onClear={() => update({ assetId: null, url: '' })}
        />

        <label className="flex flex-col gap-1 text-[12px] font-medium text-text-muted">
          引用语义
          <select
            aria-label="音频引用语义"
            className="nodrag h-9 rounded-md border border-border-input bg-bg-input px-2.5 text-[12px] text-text-base outline-none focus:ring-1 focus:ring-brand"
            value={data.referenceRole ?? 'audio'}
            onChange={(event) => update({ referenceRole: event.target.value as NonNullable<AudioNodeData['referenceRole']> })}
          >
            <option value="audio">音频</option>
            <option value="voice">人声</option>
            <option value="music">音乐</option>
            <option value="sfx">音效</option>
          </select>
        </label>

        <NodeEditorFooter>
          <button
            type="button"
            aria-label="导入音频资产"
            className="nodrag mt-auto inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-border-input bg-bg-input px-2 py-2 text-[12px] text-text-secondary transition hover:border-border-primary hover:text-text-base"
            onClick={() => onImport?.(id)}
          >
            <Import className="h-3.5 w-3.5" />
            导入
          </button>
          <button
            type="button"
            aria-label="查看音频资产"
            disabled={!data.assetId}
            className="nodrag mt-auto inline-flex min-h-8 items-center justify-center gap-1.5 rounded-lg border border-border-input bg-bg-input px-2 py-2 text-[12px] text-text-secondary transition hover:border-border-primary hover:text-text-base disabled:opacity-45"
            onClick={() => {
              if (data.assetId) onViewAsset?.(data.assetId)
            }}
          >
            <Eye className="h-3.5 w-3.5" />
            查看
          </button>
        </NodeEditorFooter>
      </NodeSelectionEditor>

      <Handle type="target" position={Position.Left} className="cc-handle" />
      <Handle type="source" position={Position.Right} className="cc-handle" />
    </NodeFrame>
  )
}

/** Memoized production audio node component. */
export const AudioNode = React.memo(AudioNodeComponent)
