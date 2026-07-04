/**
 * Node-scoped image editor modal for crop, rotation, and orientation intents.
 * @see docs/api-contracts/assets-files.md
 */

import { RotateCw, X } from 'lucide-react'
import { useEffect, useMemo, useState, type JSX } from 'react'
import { createPortal } from 'react-dom'

import type { ImageEditIntent } from '../../../../../../shared/assets'
import type { Orientation } from '../../../../../../shared/nodes'
import { cn } from '../../lib/cn'
import { getOrientationPreviewStyle } from '../lib/node-sizing'

type RotationDeg = ImageEditIntent['rotationDeg']

/** Props for the image editor modal. */
export interface ImageEditorModalProps {
  /** Canvas node whose image is being edited. */
  nodeId: string
  /** Source asset ID selected for editing. */
  assetId: string
  /** Safe renderer URL for image preview. */
  safeUrl: string
  /** User-visible image/node label. */
  label: string
  /** Initial orientation for the preview frame. */
  orientation: Orientation
  /** Called when the user applies crop/rotate/orientation settings. */
  onApply: (intent: ImageEditIntent) => void
  /** Called when the user closes the modal without applying. */
  onClose: () => void
}

const orientationLabels: Record<Orientation, string> = {
  landscape: '横图',
  portrait: '竖图',
  square: '方图'
}

function clampPercent(value: string, fallback: number): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return Math.min(100, Math.max(0, parsed))
}

/**
 * Renders an image edit modal that emits a structured media edit intent.
 * @param props - Source node/asset identifiers, preview URL, and callbacks.
 * @returns Portal-backed modal.
 * @throws Error never intentionally; numeric controls clamp values into percentages.
 * @see docs/api-contracts/assets-files.md
 */
export function ImageEditorModal({
  nodeId,
  assetId,
  safeUrl,
  label,
  orientation,
  onApply,
  onClose
}: ImageEditorModalProps): JSX.Element {
  const [crop, setCrop] = useState({ x: 0, y: 0, width: 100, height: 100 })
  const [rotationDeg, setRotationDeg] = useState<RotationDeg>(0)
  const [targetOrientation, setTargetOrientation] = useState<Orientation>(orientation)
  const [applyTarget, setApplyTarget] = useState<ImageEditIntent['applyTarget']>('node')
  const previewStyle = useMemo(() => getOrientationPreviewStyle(targetOrientation), [targetOrientation])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  function updateCrop(key: keyof typeof crop, value: string): void {
    setCrop((current) => ({ ...current, [key]: clampPercent(value, current[key]) }))
  }

  function rotateClockwise(): void {
    setRotationDeg((current) => (((current + 90) % 360) as RotationDeg))
  }

  function applyEdit(): void {
    onApply({
      nodeId,
      assetId,
      safeUrl,
      crop,
      rotationDeg,
      orientation: targetOrientation,
      applyTarget
    })
  }

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-5" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`编辑图片资产 ${label}`}
        className="grid max-h-[86vh] w-full max-w-5xl grid-cols-[minmax(0,1fr)_320px] gap-4 overflow-hidden rounded-lg border border-border-secondary bg-bg-card p-5 text-text-base shadow-active"
      >
        <div className="flex min-w-0 flex-col gap-3">
          <header className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-[16px] font-semibold">图片编辑</h2>
              <p className="truncate text-[12px] text-text-muted">{assetId}</p>
            </div>
            <button
              type="button"
              aria-label="关闭图片编辑"
              className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-border-input bg-bg-input text-text-secondary"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </button>
          </header>

          <div
            data-testid="image-editor-preview-frame"
            className="relative flex max-h-[62vh] min-h-72 items-center justify-center overflow-hidden rounded-lg border border-border-input bg-bg-input"
            style={previewStyle}
          >
            <img
              src={safeUrl}
              alt={`${label} edit preview`}
              className="h-full w-full object-contain"
              style={{ transform: `rotate(${rotationDeg}deg)` }}
            />
            <div
              aria-hidden="true"
              className="pointer-events-none absolute border-2 border-brand/80 bg-brand/10"
              style={{
                left: `${crop.x}%`,
                top: `${crop.y}%`,
                width: `${crop.width}%`,
                height: `${crop.height}%`
              }}
            />
          </div>
        </div>

        <aside className="flex min-w-0 flex-col gap-4 overflow-auto border-l border-border-secondary pl-4">
          <fieldset className="grid grid-cols-2 gap-2">
            <legend className="col-span-2 text-[12px] font-medium text-text-muted">裁剪百分比</legend>
            {([
              ['x', '裁剪 X'],
              ['y', '裁剪 Y'],
              ['width', '裁剪宽度'],
              ['height', '裁剪高度']
            ] as const).map(([key, ariaLabel]) => (
              <label key={key} className="flex flex-col gap-1 text-[12px] font-medium text-text-muted">
                {ariaLabel.replace('裁剪', '')}
                <input
                  aria-label={ariaLabel}
                  type="number"
                  min={0}
                  max={100}
                  className="h-8 rounded-sm border border-border-input bg-bg-input px-2 text-[13px] text-text-base outline-none focus:ring-1 focus:ring-brand"
                  value={crop[key]}
                  onChange={(event) => updateCrop(key, event.target.value)}
                />
              </label>
            ))}
          </fieldset>

          <button
            type="button"
            aria-label="顺时针旋转 90 度"
            className="inline-flex min-h-9 items-center justify-center gap-2 rounded-lg border border-border-input bg-bg-input px-3 py-2 text-[13px] text-text-secondary transition hover:border-border-primary hover:text-text-base"
            onClick={rotateClockwise}
          >
            <RotateCw className="h-4 w-4" />
            旋转 {rotationDeg}°
          </button>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-[12px] font-medium text-text-muted">方向预览</legend>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(orientationLabels) as Orientation[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-label={`使用${orientationLabels[value]}方向`}
                  className={cn(
                    'rounded-lg border border-border-input bg-bg-input px-2 py-2 text-[12px] text-text-secondary transition hover:border-border-primary hover:text-text-base',
                    targetOrientation === value && 'border-brand text-brand'
                  )}
                  onClick={() => setTargetOrientation(value)}
                >
                  {orientationLabels[value]}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="text-[12px] font-medium text-text-muted">应用范围</legend>
            <label className="inline-flex items-center gap-2 text-[13px] text-text-secondary">
              <input
                type="radio"
                name="image-edit-target"
                checked={applyTarget === 'node'}
                onChange={() => setApplyTarget('node')}
              />
              应用到节点
            </label>
            <label className="inline-flex items-center gap-2 text-[13px] text-text-secondary">
              <input
                type="radio"
                name="image-edit-target"
                checked={applyTarget === 'asset'}
                onChange={() => setApplyTarget('asset')}
              />
              应用到资产
            </label>
          </fieldset>

          <div className="mt-auto grid grid-cols-2 gap-2 pt-2">
            <button
              type="button"
              className="rounded-sm border border-border-input bg-bg-input px-3 py-2 text-[13px] text-text-secondary"
              onClick={onClose}
            >
              取消
            </button>
            <button
              type="button"
              className="rounded-sm bg-brand px-3 py-2 text-[13px] font-semibold text-bg-base"
              onClick={applyEdit}
            >
              应用图片编辑
            </button>
          </div>
        </aside>
      </section>
    </div>,
    document.body
  )
}
