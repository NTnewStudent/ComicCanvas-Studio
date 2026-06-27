/**
 * Generic renderer for migrated hjwall semantic and tool nodes.
 * @see docs/api-contracts/canvas-plan.md
 */

import { Handle, NodeResizer, Position } from '@xyflow/react'
import React from 'react'

import type { CanvasNodeData, NodeStatus, NodeType } from '../../../../../../shared/nodes'
import { NODE_MIN_HEIGHT, NODE_MIN_WIDTH, NODE_RESIZER_CLASS_NAMES } from '../lib/node-sizing'
import { cn } from '../../lib/cn'

const nodeTypeLabel: Record<NodeType, string> = {
  text: 'Text',
  image: 'Image',
  video: 'Video',
  character: 'Character',
  scene: 'Scene',
  audio: 'Audio',
  imageConfigV2: 'Image Config V2',
  videoConfigV2: 'Video Config V2',
  videoCompose: 'Video Compose',
  superResolution: 'Super Resolution',
  muxAudioVideo: 'Mux Audio Video',
  mjImage: 'MJ Image',
}

type EditableField = 'description' | 'prompt' | 'modelId' | 'assetId' | 'category'

export interface MigratedNodeProps {
  id: string
  type: NodeType
  data: CanvasNodeData
  selected?: boolean
  onChange?: (id: string, patch: Partial<CanvasNodeData>) => void
}

function readString(data: CanvasNodeData, key: EditableField): string {
  const value = (data as unknown as Record<string, unknown>)[key]
  return typeof value === 'string' ? value : ''
}

function readStatus(data: CanvasNodeData): NodeStatus | null {
  const value = (data as unknown as Record<string, unknown>).status
  return value === 'idle' || value === 'pending' || value === 'running' || value === 'done' || value === 'error' ? value : null
}

function readLabel(data: CanvasNodeData): string {
  const value = (data as unknown as Record<string, unknown>).label
  return typeof value === 'string' && value.trim().length > 0 ? value : 'Untitled'
}

function primaryText(type: NodeType, data: CanvasNodeData): string {
  if (type === 'character' || type === 'scene') return readString(data, 'description')
  if (type === 'mjImage') return readString(data, 'prompt')
  if (type === 'audio') return readString(data, 'assetId') || 'No audio asset selected'
  if (type === 'videoCompose') return 'Orders and combines connected video inputs'
  if (type === 'superResolution') return 'Enhances connected video resolution'
  if (type === 'muxAudioVideo') return 'Combines connected video and audio inputs'
  return ''
}

function editableFields(type: NodeType): EditableField[] {
  if (type === 'character') return ['description', 'assetId']
  if (type === 'scene') return ['description', 'category', 'assetId']
  if (type === 'audio') return ['assetId']
  if (type === 'mjImage') return ['prompt', 'modelId', 'assetId']
  if (type === 'videoCompose' || type === 'muxAudioVideo') return ['modelId', 'assetId']
  if (type === 'superResolution') return ['assetId']
  return []
}

function fieldLabel(field: EditableField): string {
  if (field === 'description') return 'Description'
  if (field === 'prompt') return 'Prompt'
  if (field === 'modelId') return 'Model'
  if (field === 'assetId') return 'Asset ID'
  return 'Category'
}

function MigratedNodeComponent({ id, type, data, selected = false, onChange }: MigratedNodeProps): JSX.Element {
  const label = readLabel(data)
  const typeLabel = nodeTypeLabel[type]
  const status = readStatus(data)
  const summary = primaryText(type, data)
  const fields = editableFields(type)

  function updateField(field: EditableField, value: string): void {
    onChange?.(id, { [field]: field === 'assetId' && value.trim().length === 0 ? null : value } as Partial<CanvasNodeData>)
  }

  return (
    <article
      role="group"
      aria-label={`${typeLabel} node ${label}`}
      className={cn(
        'relative flex min-h-[188px] w-[300px] flex-col gap-3 rounded-xl border border-border-secondary bg-bg-card p-4 text-text-base shadow-card transition-[border-color,box-shadow] duration-300 ease-luxury',
        selected && 'border-border-primary shadow-active'
      )}
      data-node-id={id}
      data-node-type={type}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={NODE_MIN_WIDTH.text}
        minHeight={NODE_MIN_HEIGHT.text}
        lineClassName={NODE_RESIZER_CLASS_NAMES.line}
        handleClassName={NODE_RESIZER_CLASS_NAMES.handle}
      />

      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-brand">{typeLabel}</div>
          <div className="truncate text-[15px] font-semibold leading-6 text-text-base">{label}</div>
        </div>
        {status ? (
          <span className="shrink-0 rounded-sm border border-border-secondary bg-bg-input px-2 py-1 text-[11px] font-medium text-text-muted">
            {status}
          </span>
        ) : null}
      </header>

      <div className="min-h-10 rounded-sm border border-border-input bg-bg-input px-3 py-2 text-[13px] leading-relaxed text-text-secondary">
        {summary || 'Connect this node to contribute context or tool inputs.'}
      </div>

      <div className="flex flex-col gap-2">
        {fields.map((field) => (
          <label key={field} className="flex flex-col gap-1 text-[11px] font-medium text-text-muted">
            {fieldLabel(field)}
            <input
              aria-label={fieldLabel(field)}
              className="h-8 rounded-sm border border-border-input bg-bg-input px-2 text-[13px] text-text-base outline-none focus-visible:shadow-[0_0_0_4px_var(--cc-focus-ring)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-brand"
              value={readString(data, field)}
              onChange={(event) => updateField(field, event.target.value)}
            />
          </label>
        ))}
      </div>

      <Handle type="target" position={Position.Left} className="cc-handle" />
      <Handle type="source" position={Position.Right} className="cc-handle" />
    </article>
  )
}

export const MigratedNode = React.memo(MigratedNodeComponent)
