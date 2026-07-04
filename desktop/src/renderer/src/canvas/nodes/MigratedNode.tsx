/**
 * Generic renderer for migrated hjwall semantic and tool nodes.
 * @see docs/api-contracts/canvas-plan.md
 */

import { Handle, NodeResizer, Position } from '@xyflow/react'
import React from 'react'

import { defaultCanvasNodeSize } from '../../../../../../shared/node-layout'
import type { CanvasNodeData, NodeStatus, NodeType } from '../../../../../../shared/nodes'
import { NODE_MIN_HEIGHT, NODE_MIN_WIDTH, NODE_RESIZER_CLASS_NAMES } from '../lib/node-sizing'
import { cn } from '../../lib/cn'

const nodeTypeLabel: Record<NodeType, string> = {
  text: '文本',
  image: '图片',
  video: '视频',
  character: '角色',
  scene: '场景',
  audio: '音频',
  imageConfigV2: '图片生成 V2',
  videoConfigV2: '视频生成 V2',
  videoCompose: '视频合成',
  superResolution: '视频超分',
  muxAudioVideo: '音视频合成',
  mjImage: 'MJ 图片',
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
  return typeof value === 'string' && value.trim().length > 0 ? value : '未命名'
}

function primaryText(type: NodeType, data: CanvasNodeData): string {
  if (type === 'character' || type === 'scene') return readString(data, 'description')
  if (type === 'mjImage') return readString(data, 'prompt')
  if (type === 'audio') return readString(data, 'assetId') || '未选择音频资产'
  if (type === 'videoCompose') return '按顺序合成已连接的视频输入'
  if (type === 'superResolution') return '提升已连接视频的分辨率'
  if (type === 'muxAudioVideo') return '合成已连接的视频和音频输入'
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
  if (field === 'description') return '描述'
  if (field === 'prompt') return 'Prompt'
  if (field === 'modelId') return '模型'
  if (field === 'assetId') return '资产 ID'
  return '分类'
}

function MigratedNodeComponent({ id, type, data, selected = false, onChange }: MigratedNodeProps): JSX.Element {
  const label = readLabel(data)
  const typeLabel = nodeTypeLabel[type]
  const status = readStatus(data)
  const summary = primaryText(type, data)
  const fields = editableFields(type)
  const size = defaultCanvasNodeSize(type)

  function updateField(field: EditableField, value: string): void {
    onChange?.(id, { [field]: field === 'assetId' && value.trim().length === 0 ? null : value } as Partial<CanvasNodeData>)
  }

  return (
    <article
      role="group"
      aria-label={`${typeLabel}节点 ${label}`}
      className={cn(
        'relative flex h-full w-full flex-col gap-3 rounded-xl border border-border-secondary bg-bg-card p-4 text-text-base shadow-card transition-[border-color,box-shadow] duration-300 ease-luxury',
        selected && 'border-border-primary shadow-active'
      )}
      style={{ minWidth: size.width, minHeight: size.height }}
      data-node-id={id}
      data-node-type={type}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={NODE_MIN_WIDTH[type]}
        minHeight={NODE_MIN_HEIGHT[type]}
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
        {summary || '连接此节点以提供上下文或工具输入。'}
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
