/**
 * Shared node media binding controls for local asset selection and clear flows.
 * @see docs/api-contracts/assets-files.md
 */

import { ExternalLink, FolderOpen, Link2Off, X } from 'lucide-react'
import { useEffect, useState, type JSX } from 'react'
import { createPortal } from 'react-dom'

import { cn } from '../../lib/cn'
import { NodeAssetPickerModal, type NodeAssetOption, type NodeAssetPickerMediaType } from './NodeAssetPickerModal'

/** Props for shared node-scoped media input controls. */
export interface MediaInputControlsProps {
  /** Media kind controlled by this input. */
  mediaType: NodeAssetPickerMediaType
  /** User-visible control label. */
  label: string
  /** Currently bound asset ID, if any. */
  selectedAssetId?: string | null
  /** Currently bound safe renderer URL, if any. */
  selectedSafeUrl?: string | undefined
  /** Candidate local assets. */
  options: NodeAssetOption[]
  /** Called when the user selects a local asset. */
  onSelect: (asset: NodeAssetOption) => void
  /** Called when the user clears the current binding. */
  onClear: () => void
  /** Render a denser control surface for compact node panels. */
  compact?: boolean
}

function ExternalUrlGate({ label, onClose }: { label: string; onClose: () => void }): JSX.Element {
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
        aria-label={`外部 URL 暂不可用 ${label}`}
        className="flex w-full max-w-md flex-col gap-4 rounded-lg border border-border-secondary bg-bg-card p-5 text-text-base shadow-active"
      >
        <header className="flex items-center justify-between gap-3">
          <h2 className="text-[16px] font-semibold">外部 URL 暂不可用</h2>
          <button
            type="button"
            aria-label="关闭外部 URL 提示"
            className="inline-flex h-8 w-8 items-center justify-center rounded-sm border border-border-input bg-bg-input text-text-secondary"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="space-y-2 text-[13px] leading-relaxed text-text-muted">
          <p>本地画布暂不把外部 URL 直接绑定为节点素材。</p>
          <p>请先导入资产库，系统会生成 cc-asset:// 安全地址后再绑定。</p>
        </div>
        <button type="button" className="self-end rounded-sm bg-brand px-3 py-2 text-[13px] font-semibold text-bg-base" onClick={onClose}>
          知道了
        </button>
      </section>
    </div>,
    document.body
  )
}

/**
 * Renders a local-asset media binding control for image, video, and audio nodes.
 * @param props - Media type, label, current binding, options, and callbacks.
 * @returns Media input control with picker, clear, and external URL gate.
 * @throws Error never intentionally; empty options render through the picker empty state.
 * @see docs/api-contracts/assets-files.md
 */
export function MediaInputControls({
  mediaType,
  label,
  selectedAssetId,
  selectedSafeUrl,
  options,
  onSelect,
  onClear,
  compact = false
}: MediaInputControlsProps): JSX.Element {
  const [isPickerOpen, setIsPickerOpen] = useState(false)
  const [isExternalGateOpen, setIsExternalGateOpen] = useState(false)
  const hasSelection = Boolean(selectedAssetId)

  return (
    <section
      className={cn(
        'rounded-lg border border-border-secondary bg-bg-input/70 p-2 text-text-base',
        compact ? 'space-y-2' : 'space-y-3'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-medium text-text-muted">{label}</span>
        <span className="min-w-0 truncate text-[11px] text-text-muted">{selectedAssetId ?? '未绑定'}</span>
      </div>
      {selectedSafeUrl ? <span className="block truncate text-[11px] text-text-muted">{selectedSafeUrl}</span> : null}
      <div className={compact ? 'grid grid-cols-3 gap-1.5' : 'grid grid-cols-3 gap-2'}>
        <button
          type="button"
          aria-label={`选择${label}`}
          className="inline-flex min-h-8 items-center justify-center gap-1 rounded-lg border border-border-input bg-bg-input px-2 py-2 text-[12px] text-text-secondary transition hover:border-border-primary hover:text-text-base"
          onClick={() => setIsPickerOpen(true)}
        >
          <FolderOpen className="h-3.5 w-3.5" />
          选择
        </button>
        <button
          type="button"
          aria-label={`清除${label}`}
          disabled={!hasSelection}
          className="inline-flex min-h-8 items-center justify-center gap-1 rounded-lg border border-border-input bg-bg-input px-2 py-2 text-[12px] text-text-secondary transition hover:border-border-primary hover:text-text-base disabled:opacity-45"
          onClick={onClear}
        >
          <Link2Off className="h-3.5 w-3.5" />
          清除
        </button>
        <button
          type="button"
          aria-label={`使用外部 URL 作为${label}`}
          className="inline-flex min-h-8 items-center justify-center gap-1 rounded-lg border border-border-input bg-bg-input px-2 py-2 text-[12px] text-text-secondary transition hover:border-border-primary hover:text-text-base"
          onClick={() => setIsExternalGateOpen(true)}
        >
          <ExternalLink className="h-3.5 w-3.5" />
          URL
        </button>
      </div>

      {isPickerOpen ? (
        <NodeAssetPickerModal
          mediaType={mediaType}
          options={options}
          compact={compact}
          onClose={() => setIsPickerOpen(false)}
          onSelect={(asset) => {
            onSelect(asset)
            setIsPickerOpen(false)
          }}
        />
      ) : null}

      {isExternalGateOpen ? <ExternalUrlGate label={label} onClose={() => setIsExternalGateOpen(false)} /> : null}
    </section>
  )
}
