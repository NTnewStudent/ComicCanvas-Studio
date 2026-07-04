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
import { cn } from '../../lib/cn'
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
  audio: 'audio',
  voice: 'voice',
  music: 'music',
  sfx: 'sfx',
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
    <article
      role="group"
      aria-label={`Audio node ${data.label}`}
      className={cn(
        'relative flex w-[320px] flex-col gap-3 rounded-xl border border-border-secondary bg-bg-card p-4 text-text-base shadow-card transition-[border-color,box-shadow] duration-300 ease-luxury',
        selected && 'border-border-primary shadow-active'
      )}
      data-node-id={id}
      data-node-type="audio"
    >
      <NodeResizer
        isVisible={selected}
        minWidth={NODE_MIN_WIDTH.text}
        minHeight={NODE_MIN_HEIGHT.text}
        lineClassName={NODE_RESIZER_CLASS_NAMES.line}
        handleClassName={NODE_RESIZER_CLASS_NAMES.handle}
      />

      <header className="flex items-center gap-2">
        <Music2 className="h-4 w-4 text-semantic-warning" />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase text-text-muted">Audio</div>
          {selected ? (
            <input
              aria-label="音频名称"
              className="nodrag w-full rounded-sm border border-border-input bg-bg-input px-2 py-1 text-[13px] font-semibold text-text-base outline-none focus:ring-1 focus:ring-brand"
              value={data.label}
              onChange={(event) => update({ label: event.target.value })}
            />
          ) : (
            <div className="truncate text-[15px] font-semibold text-text-base">{data.label}</div>
          )}
        </div>
        {data.status ? <span className="rounded-sm bg-bg-input px-2 py-1 text-[11px] text-text-muted">{data.status}</span> : null}
      </header>

      <div className="rounded-lg border border-border-input bg-bg-input p-3">
        {data.url ? (
          <audio data-testid="audio-node-player" src={data.url} controls className="w-full" />
        ) : (
          <div className="flex min-h-12 items-center gap-2 text-[13px] text-text-muted">
            <Music2 className="h-5 w-5" />
            暂无音频资产
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 text-[12px] text-text-muted">
        <span className="min-w-0 flex-1 truncate">{data.assetId ?? '未绑定资产'}</span>
        <span>{data.durationSeconds ? `${data.durationSeconds}s` : '未知时长'}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 rounded-lg border border-border-secondary bg-bg-input/70 p-2 text-[12px] text-text-muted">
        <span>Mux 输入</span>
        <span className="text-right">音频引用：{referenceRoleLabels[data.referenceRole ?? 'audio']}</span>
      </div>

      <label className="flex flex-col gap-1 text-[12px] font-medium text-text-muted">
        音频资产 ID
        <input
          aria-label="音频资产 ID"
          className="h-8 rounded-sm border border-border-input bg-bg-input px-2 text-[13px] text-text-base outline-none focus:ring-1 focus:ring-brand"
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

      {selected && (
        <div className="grid grid-cols-3 gap-2">
          <label className="flex flex-col gap-1 text-[12px] font-medium text-text-muted">
            引用语义
            <select
              aria-label="音频引用语义"
              className="nodrag h-8 rounded-sm border border-border-input bg-bg-input px-2 text-[12px] text-text-base outline-none focus:ring-1 focus:ring-brand"
              value={data.referenceRole ?? 'audio'}
              onChange={(event) => update({ referenceRole: event.target.value as NonNullable<AudioNodeData['referenceRole']> })}
            >
              <option value="audio">audio</option>
              <option value="voice">voice</option>
              <option value="music">music</option>
              <option value="sfx">sfx</option>
            </select>
          </label>
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
        </div>
      )}

      <Handle type="target" position={Position.Left} className="cc-handle" />
      <Handle type="source" position={Position.Right} className="cc-handle" />
    </article>
  )
}

/** Memoized production audio node component. */
export const AudioNode = React.memo(AudioNodeComponent)
