/**
 * Explicit unavailable gate for image inpaint until mask/runtime support exists.
 * @see docs/api-contracts/assets-files.md
 */

import { Brush, X } from 'lucide-react'
import { useEffect, type JSX } from 'react'
import { createPortal } from 'react-dom'

/** Props for the gated image inpaint modal. */
export interface ImageInpaintModalProps {
  /** User-visible image/node label. */
  label: string
  /** Source asset ID selected for inpaint. */
  assetId: string
  /** Safe renderer URL for preview only. */
  safeUrl: string
  /** Called when the user closes the unavailable gate. */
  onClose: () => void
}

/**
 * Renders an unavailable-state modal for future image inpaint support.
 * @param props - Source asset label, ID, preview URL, and close callback.
 * @returns Portal-backed unavailable inpaint gate.
 * @throws Error never intentionally; Escape closes the modal.
 * @see docs/api-contracts/assets-files.md
 */
export function ImageInpaintModal({ label, assetId, safeUrl, onClose }: ImageInpaintModalProps): JSX.Element {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-5" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`局部重绘暂不可用 ${label}`}
        className="grid max-h-[82vh] w-full max-w-3xl grid-cols-[minmax(0,1fr)_280px] gap-4 overflow-hidden rounded-lg border border-border-secondary bg-bg-card p-5 text-text-base shadow-active"
      >
        <div className="flex min-w-0 flex-col gap-3">
          <header className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-[16px] font-semibold">局部重绘</h2>
              <p className="truncate text-[12px] text-text-muted">{assetId}</p>
            </div>
            <button
              type="button"
              aria-label="关闭局部重绘提示"
              className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-border-input bg-bg-input text-text-secondary"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </button>
          </header>
          <div className="flex aspect-video min-h-64 items-center justify-center overflow-hidden rounded-lg border border-border-input bg-bg-input">
            <img src={safeUrl} alt={`${label} inpaint preview`} className="h-full w-full object-contain" />
          </div>
        </div>

        <aside className="flex min-w-0 flex-col gap-4 border-l border-border-secondary pl-4">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-border-input bg-bg-input text-brand">
            <Brush className="h-5 w-5" />
          </div>
          <div className="space-y-2">
            <p className="text-[14px] font-medium text-text-base">当前本地版本尚未接入蒙版编辑和局部重绘执行能力。</p>
            <p className="text-[13px] leading-relaxed text-text-muted">
              后续需要接入 media.inpaint tool、蒙版数据模型和支持 inpaint 的图片网关后再开放。
            </p>
          </div>
          <div className="rounded-lg border border-dashed border-border-input bg-bg-input p-3 text-[12px] leading-relaxed text-text-muted">
            这一步先明确不可用状态，避免手动 UI 或 Agent 调用不存在的局部重绘能力。
          </div>
          <button
            type="button"
            className="mt-auto rounded-sm bg-brand px-3 py-2 text-[13px] font-semibold text-bg-base"
            onClick={onClose}
          >
            知道了
          </button>
        </aside>
      </section>
    </div>,
    document.body
  )
}
