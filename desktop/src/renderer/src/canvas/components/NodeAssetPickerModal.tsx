/**
 * Lightweight node-scoped asset picker used by production media nodes.
 * @see docs/api-contracts/assets-files.md
 */

import { FileAudio, Image as ImageIcon, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import type { JSX } from 'react'

/** Media type supported by the node-scoped picker. */
export type NodeAssetPickerMediaType = 'image' | 'video' | 'audio'

/** Asset option shown by node-scoped media pickers. */
export interface NodeAssetOption {
  /** Stable local asset identifier. */
  assetId: string
  /** Human-readable label. */
  label: string
  /** Safe renderer URL, normally `cc-asset://asset/<assetId>`. */
  safeUrl: string
}

/** Props for the node-scoped asset picker modal. */
export interface NodeAssetPickerModalProps {
  /** Picker media type. */
  mediaType: NodeAssetPickerMediaType
  /** Candidate assets. */
  options: NodeAssetOption[]
  /** Called when the user picks one asset. */
  onSelect: (asset: NodeAssetOption) => void
  /** Called when the user closes the modal. */
  onClose: () => void
  /** Render denser options for embedded/compact media controls. */
  compact?: boolean
}

const mediaLabel: Record<NodeAssetPickerMediaType, string> = {
  image: '图片',
  video: '视频',
  audio: '音频'
}

/**
 * Renders a modal asset picker for a single canvas node.
 * @param props - Media type, asset options, and callbacks.
 * @returns Portal-backed picker element.
 * @throws Error never intentionally; empty options render an empty-state message.
 * @see docs/api-contracts/assets-files.md
 */
export function NodeAssetPickerModal({ mediaType, options, onSelect, onClose, compact = false }: NodeAssetPickerModalProps): JSX.Element {
  const label = mediaLabel[mediaType]

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-bg-base/80 p-5 backdrop-blur-sm" role="presentation">
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`选择${label}资产`}
        className="flex max-h-[80vh] w-full max-w-2xl flex-col gap-4 rounded-2xl border border-border-primary bg-bg-panel p-5 text-text-base shadow-pop"
      >
        <header className="flex items-center justify-between gap-3">
          <h2 className="text-[15px] font-semibold">选择{label}资产</h2>
          <button
            type="button"
            aria-label={`关闭${label}资产选择`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border-input bg-bg-input text-text-secondary transition hover:border-border-primary hover:bg-bg-hover hover:text-text-base"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {options.length > 0 ? (
          <div
            data-testid="node-asset-picker-grid"
            data-compact={compact ? 'true' : 'false'}
            className={compact ? 'grid max-h-[58vh] grid-cols-1 gap-2 overflow-auto' : 'grid max-h-[58vh] grid-cols-2 gap-3 overflow-auto'}
          >
            {options.map((asset) => (
              <button
                key={asset.assetId}
                type="button"
                aria-label={`选择${label}资产 ${asset.label}`}
                className={compact ? 'flex items-center gap-3 rounded-lg border border-border-secondary bg-bg-card p-2 text-left shadow-card transition-all duration-200 ease-luxury hover:border-border-primary hover:bg-bg-hover hover:shadow-float' : 'flex flex-col gap-2 rounded-lg border border-border-secondary bg-bg-card p-2 text-left shadow-card transition-all duration-200 ease-luxury hover:border-border-primary hover:bg-bg-hover hover:shadow-float'}
                onClick={() => onSelect(asset)}
              >
                <div className={compact ? 'flex h-12 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-border-input bg-bg-input' : 'flex aspect-video items-center justify-center overflow-hidden rounded-md border border-border-input bg-bg-input'}>
                  {mediaType === 'image' ? (
                    <img src={asset.safeUrl} alt={`${asset.label} thumbnail`} className="h-full w-full object-contain" />
                  ) : mediaType === 'video' ? (
                    <video
                      data-testid={`video-asset-option-${asset.assetId}`}
                      src={asset.safeUrl}
                      className="h-full w-full object-contain"
                      preload="metadata"
                      muted
                    />
                  ) : (
                    <audio
                      data-testid={`audio-asset-option-${asset.assetId}`}
                      src={asset.safeUrl}
                      className="w-full"
                      preload="metadata"
                    />
                  )}
                </div>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium text-text-base">{asset.label}</span>
                  <span className="block truncate text-[11px] text-text-muted">{asset.assetId}</span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex min-h-36 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border-input bg-bg-card text-text-muted">
            {mediaType === 'audio' ? <FileAudio className="h-6 w-6" /> : <ImageIcon className="h-6 w-6" />}
            <span className="text-[13px]">暂无可选{label}资产</span>
          </div>
        )}
      </section>
    </div>,
    document.body
  )
}
