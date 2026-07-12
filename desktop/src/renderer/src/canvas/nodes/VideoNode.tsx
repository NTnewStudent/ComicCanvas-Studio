/**
 * Video media reference node.
 * @see docs/api-contracts/canvas-plan.md
 * @see docs/api-contracts/assets-files.md
 */

import { Check, Clapperboard, Copy, Film, FolderOpen, Link2Off } from 'lucide-react'
import { Handle, NodeResizer, Position } from '@xyflow/react'
import React, { useState } from 'react'

import type { VideoNodeData } from '../../../../../../shared/nodes'
import { NodeAssetPickerModal, type NodeAssetOption } from '../components/NodeAssetPickerModal'
import { useNodeEditorOpen } from '../components/NodeEditorContext'
import { NodeFrame, NodeHeader, NodePreview, NodeSelectionEditor, NodeSummaryRows } from '../components/NodePrimitives'
import {
  getOrientationPreviewStyle,
  NODE_MIN_HEIGHT,
  NODE_MIN_WIDTH,
  NODE_RESIZER_CLASS_NAMES,
  NODE_UI_CLASS_NAMES
} from '../lib/node-sizing'
import { cn } from '../../lib/cn'

/** Renderer props for the video media reference node. */
export interface VideoNodeProps {
  /** Canvas node identifier used by change callbacks. */
  id: string
  /** Shared video node data contract. */
  data: VideoNodeData
  /** Whether the canvas currently marks this node as selected. */
  selected?: boolean
  /** Safe renderer URL for the bound video asset. */
  assetSafeUrl?: string
  /** Video assets that can be bound directly to this node. */
  assetOptions?: NodeAssetOption[]
  /** Called when the renderer edits node data. */
  onChange?: (id: string, patch: Partial<VideoNodeData>) => void
}

/**
 * Renders a hjwall-style video media node: asset binding, preview, and reference handles only.
 * @param props - Video node ID, shared node data, safe asset URL, and callbacks.
 * @returns Video media reference node React element.
 * @throws Error never intentionally; invalid user actions are represented as disabled controls.
 * @see docs/api-contracts/canvas-plan.md
 * @see docs/api-contracts/assets-files.md
 */
function VideoNodeComponent({
  id,
  data,
  selected = false,
  assetSafeUrl,
  assetOptions = [],
  onChange
}: VideoNodeProps): JSX.Element {
  const [isAssetPickerOpen, setIsAssetPickerOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const editorOpen = useNodeEditorOpen(id)
  const displayUrl = assetSafeUrl ?? data.url ?? ''

  function update(patch: Partial<VideoNodeData>): void {
    onChange?.(id, patch)
  }

  function bindAsset(asset: NodeAssetOption): void {
    update({ assetId: asset.assetId, url: asset.safeUrl, status: 'done' })
    setIsAssetPickerOpen(false)
  }

  function clearAsset(): void {
    update({ assetId: null, url: '', status: 'idle' })
  }

  function copyVideoUrl(): void {
    if (!displayUrl) return
    const clipboard = navigator.clipboard
    if (!clipboard) return
    void clipboard.writeText(displayUrl).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    }).catch(() => undefined)
  }

  return (
    <NodeFrame selected={selected} className={NODE_UI_CLASS_NAMES.videoShell} data-node-id={id}>
      <NodeResizer
        isVisible={selected}
        minWidth={NODE_MIN_WIDTH.video}
        minHeight={NODE_MIN_HEIGHT.video}
        lineClassName={NODE_RESIZER_CLASS_NAMES.line}
        handleClassName={NODE_RESIZER_CLASS_NAMES.handle}
      />

      <NodeHeader icon={<Film className="h-4 w-4" />} title={data.label || '视频节点'} meta="视频素材" />

      <NodePreview
          className="relative flex min-h-[280px] w-full items-center justify-center overflow-hidden"
          data-testid="video-preview-frame"
          style={getOrientationPreviewStyle(data.orientation)}
        >
          {displayUrl ? (
            <video
              key={displayUrl}
              data-testid="video-preview"
              src={displayUrl}
              controls
              preload="metadata"
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="flex h-full min-h-40 flex-col items-center justify-center gap-2 text-text-muted">
              <Clapperboard className="h-8 w-8 opacity-45" />
              <span className="text-[12px] font-medium">未绑定视频</span>
            </div>
          )}
      </NodePreview>

      <NodeSummaryRows rows={[{ label: '资产', value: data.assetId ?? '未绑定' }]} />

      <NodeSelectionEditor open={editorOpen} testId="video-node-editor">

        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            aria-label="选择视频素材"
            className={NODE_UI_CLASS_NAMES.compactButton}
            onClick={() => setIsAssetPickerOpen(true)}
          >
            <FolderOpen className="h-3.5 w-3.5" />
            选择素材
          </button>
          <button
            type="button"
            aria-label="清除视频素材"
            disabled={!data.assetId}
            className={cn(NODE_UI_CLASS_NAMES.compactButton, 'disabled:opacity-45')}
            onClick={clearAsset}
          >
            <Link2Off className="h-3.5 w-3.5" />
            清除
          </button>
          <button
            type="button"
            aria-label="复制视频 URL"
            disabled={!displayUrl}
            className={cn(NODE_UI_CLASS_NAMES.compactButton, copied && 'border-brand text-brand', 'disabled:opacity-45')}
            onClick={copyVideoUrl}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? '已复制' : '复制'}
          </button>
        </div>

        <div className="min-w-0 truncate rounded-lg border border-border-secondary bg-bg-input/65 px-2.5 py-2 text-[11px] text-text-muted">
          {data.assetId ?? '未绑定资产'}
        </div>
      </NodeSelectionEditor>

      {isAssetPickerOpen ? (
        <NodeAssetPickerModal
          mediaType="video"
          options={assetOptions}
          onClose={() => setIsAssetPickerOpen(false)}
          onSelect={bindAsset}
        />
      ) : null}

      <Handle type="target" position={Position.Left} id="left" className="cc-handle" />
      <Handle type="source" position={Position.Right} id="right" className="cc-handle" />
    </NodeFrame>
  )
}

export const VideoNode = React.memo(VideoNodeComponent)
