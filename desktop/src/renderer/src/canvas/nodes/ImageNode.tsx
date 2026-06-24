/**
 * Image canvas node for image generation configuration and preview.
 * @see docs/api-contracts/canvas-plan.md
 * @see docs/api-contracts/assets-files.md
 */

import { Image as ImageIcon, Loader2, Sparkles, XCircle } from 'lucide-react'
import { useState } from 'react'

import type { ImageNodeData, Orientation } from '../../../../../../shared/nodes'
import { cn } from '../../lib/cn'

/** Selectable image model option shown by the image node controls. */
export interface ImageModelOption {
  /** Stable model identifier passed back through node data updates. */
  id: string
  /** Human-readable model name rendered in the control. */
  label: string
}

/** Renderer props for the image generation canvas node. */
export interface ImageNodeProps {
  /** Canvas node identifier used by change and run callbacks. */
  id: string
  /** Shared image node data contract. */
  data: ImageNodeData
  /** Whether the canvas currently marks this node as selected. */
  selected?: boolean
  /** Safe renderer URL for the generated asset, normally `cc-asset://asset/<assetId>`. */
  assetSafeUrl?: string
  /** Available model choices for the image generation control. */
  modelOptions?: ImageModelOption[]
  /** Called when the renderer edits node data. */
  onChange?: (id: string, patch: Partial<ImageNodeData>) => void
  /** Called when the user requests asynchronous generation for this node. */
  onRun?: (id: string) => void
}

const orientationAspect: Record<Orientation, string> = {
  landscape: '16 / 9',
  portrait: '9 / 16',
  square: '1 / 1'
}

const orientationLabels: Record<Orientation, string> = {
  landscape: '16:9',
  portrait: '9:16',
  square: '1:1'
}

const statusLabel: Record<ImageNodeData['status'], string> = {
  idle: 'Idle',
  pending: 'Pending',
  running: 'Running',
  done: 'Done',
  error: 'Error'
}

/**
 * Renders an image node with prompt/model/orientation controls and async generation states.
 * @param props - Image node ID, shared node data, safe asset URL, and callbacks.
 * @returns Image node React element.
 * @throws Error never intentionally; invalid user actions are represented as disabled controls.
 * @see docs/api-contracts/canvas-plan.md
 * @see docs/api-contracts/assets-files.md
 */
export function ImageNode({
  id,
  data,
  selected = false,
  assetSafeUrl,
  modelOptions = [{ id: data.modelId, label: data.modelId }],
  onChange,
  onRun
}: ImageNodeProps): JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false)
  const isGenerating = data.status === 'pending' || data.status === 'running'
  const canPreview = data.status === 'done' && data.assetId !== null && typeof assetSafeUrl === 'string'

  function update(patch: Partial<ImageNodeData>): void {
    onChange?.(id, patch)
  }

  return (
    <article
      className={cn(
        'flex w-[340px] flex-col gap-2 select-none text-text-base',
        selected && 'drop-shadow-[0_0_18px_var(--cc-active-glow)]'
      )}
      data-node-id={id}
    >
      <header className="flex items-center gap-2 px-1 text-[12px] font-medium text-text-muted">
        <ImageIcon className="h-3.5 w-3.5 text-semantic-info" />
        <span className="max-w-[190px] truncate">{data.label}</span>
        <span
          className={cn(
            'ml-auto inline-flex items-center rounded-pill bg-bg-input px-2 py-0.5 text-[12px] font-medium',
            data.status === 'done' && 'text-semantic-success',
            isGenerating && 'text-brand',
            data.status === 'error' && 'text-semantic-negative'
          )}
        >
          {statusLabel[data.status]}
        </span>
      </header>

      <section
        className={cn(
          'rounded-xl border border-border-secondary bg-bg-card p-4 shadow-card transition-[border-color,box-shadow] duration-300 ease-luxury',
          selected && 'border-border-primary shadow-active',
          isGenerating && 'border-brand'
        )}
      >
        <div
          className="relative flex w-full items-center justify-center overflow-hidden rounded-lg border border-border-input bg-bg-input"
          data-testid="image-preview-frame"
          style={{ aspectRatio: orientationAspect[data.orientation] }}
        >
          {canPreview ? (
            <img
              src={assetSafeUrl}
              alt={`${data.label} preview`}
              className="h-full w-full object-contain"
              style={{ objectFit: 'contain' }}
              loading="lazy"
            />
          ) : data.status === 'error' ? (
            <div role="alert" className="flex h-full min-h-40 flex-col items-center justify-center gap-2 text-text-secondary">
              <XCircle className="h-7 w-7 text-semantic-negative" />
              <span className="text-[13px]">Generation failed</span>
            </div>
          ) : (
            <div
              role="status"
              aria-label={`Image generation ${data.status}`}
              className="flex h-full min-h-40 flex-col items-center justify-center gap-2 text-text-muted"
            >
              {isGenerating ? (
                <Loader2 className="h-7 w-7 animate-spin text-brand" />
              ) : (
                <ImageIcon className="h-7 w-7 text-semantic-info opacity-70" />
              )}
              <span className="text-[13px]">{isGenerating ? 'Generating image' : 'No image yet'}</span>
            </div>
          )}
        </div>

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            className="inline-flex min-h-8 flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-[13px] font-semibold text-bg-base transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => onRun?.(id)}
            disabled={isGenerating}
            aria-label="Generate image"
          >
            {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Generate image
          </button>
          <button
            type="button"
            className="inline-flex min-h-8 items-center justify-center rounded-lg border border-border-input bg-bg-input px-3 py-2 text-[13px] font-medium text-text-base transition hover:bg-bg-hover"
            aria-expanded={isExpanded}
            aria-label="Configure image node"
            onClick={() => setIsExpanded((value) => !value)}
          >
            Configure
          </button>
        </div>

        {isExpanded && (
          <div className="mt-3 flex flex-col gap-3 border-t border-border-secondary pt-3">
            <label className="flex flex-col gap-1.5 text-[12px] font-medium text-text-muted">
              Prompt override
              <textarea
                aria-label="Prompt override"
                className="min-h-24 resize-none rounded-lg border border-border-input bg-bg-input px-3 py-2 text-[13px] leading-relaxed text-text-base outline-none focus:ring-1 focus:ring-brand"
                value={data.promptOverride}
                onChange={(event) => update({ promptOverride: event.target.value })}
                placeholder="Describe the panel, character, mood, and camera."
              />
            </label>

            <fieldset className="flex flex-col gap-1.5">
              <legend className="text-[12px] font-medium text-text-muted">Model</legend>
              <div className="grid grid-cols-2 gap-2">
                {modelOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    aria-label={`Use model ${option.label}`}
                    className={cn(
                      'rounded-lg border border-border-input bg-bg-input px-3 py-2 text-left text-[12px] text-text-secondary transition hover:border-border-primary hover:text-text-base',
                      data.modelId === option.id && 'border-brand text-brand'
                    )}
                    onClick={() => update({ modelId: option.id })}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset className="flex flex-col gap-1.5">
              <legend className="text-[12px] font-medium text-text-muted">Orientation</legend>
              <div className="grid grid-cols-3 gap-2">
                {(Object.keys(orientationLabels) as Orientation[]).map((orientation) => (
                  <button
                    key={orientation}
                    type="button"
                    aria-label={`Use ${orientation} orientation`}
                    className={cn(
                      'rounded-lg border border-border-input bg-bg-input px-3 py-2 text-[12px] text-text-secondary transition hover:border-border-primary hover:text-text-base',
                      data.orientation === orientation && 'border-brand text-brand'
                    )}
                    onClick={() => update({ orientation })}
                  >
                    {orientationLabels[orientation]}
                  </button>
                ))}
              </div>
            </fieldset>
          </div>
        )}
      </section>
    </article>
  )
}
