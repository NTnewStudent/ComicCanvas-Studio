/**
 * Connected inputs panel for image and video generation nodes.
 * @see docs/api-contracts/canvas-plan.md
 */

import { Link2 } from 'lucide-react'
import { useStore } from 'zustand'
import type { StoreApi } from 'zustand/vanilla'

import { cn } from '../../lib/cn'
import { buildConnectedInputsView } from '../lib/connected-inputs'
import {
  canvasStore,
  type CanvasStoreEdge,
  type CanvasStoreNode,
  type CanvasStoreState
} from '../store/canvas.store'

/** Props for the connected inputs panel. */
export interface ConnectedInputsPanelProps {
  /** Optional controlled canvas nodes used to derive upstream text inputs. */
  nodes?: CanvasStoreNode[]
  /** Optional controlled canvas edges used to derive connection ordering. */
  edges?: CanvasStoreEdge[]
  /** Target image or video generation node ID. */
  nodeId: string
  /** Optional Zustand store API used by tests or alternate canvas instances. */
  store?: StoreApi<CanvasStoreState>
  /** Optional extra class names for node-specific layout. */
  className?: string
  /** Render denser chips for compact node panels. */
  compact?: boolean
}

/**
 * Renders ordered upstream text inputs and the byte-equivalent final prompt preview.
 * @param props - Canvas graph slice, target node ID, and optional class names.
 * @returns Connected inputs panel React element or null when no upstream text exists.
 * @throws Error never intentionally; invalid graph slices render an empty panel.
 * @see docs/api-contracts/canvas-plan.md
 */
export function ConnectedInputsPanel({
  nodes,
  edges,
  nodeId,
  store,
  className,
  compact = false
}: ConnectedInputsPanelProps): JSX.Element | null {
  const graphStore = store ?? canvasStore
  const storeNodes = useStore(graphStore, (state) => state.nodes)
  const storeEdges = useStore(graphStore, (state) => state.edges)
  const view = buildConnectedInputsView({ nodes: nodes ?? storeNodes, edges: edges ?? storeEdges }, nodeId)

  if (view.items.length === 0) {
    return null
  }

  return (
    <section
      className={cn(
        'flex flex-col rounded-xl border border-border-secondary bg-bg-input text-text-base shadow-card',
        compact ? 'gap-2 p-2' : 'gap-3 p-3',
        className
      )}
      aria-label="已连接的输入"
      data-compact={compact ? 'true' : 'false'}
    >
      <header className="flex items-center gap-2 text-[12px] font-semibold text-text-secondary">
        <Link2 className="h-3.5 w-3.5 text-brand" aria-hidden="true" />
        <span>已连接的输入</span>
        {view.referenceAssets.length > 0 && (
          <span className="ml-auto rounded-pill bg-bg-card px-2 py-0.5 text-[12px] font-medium text-semantic-info">
            引用 {view.referenceAssets.length}
          </span>
        )}
      </header>

      {(view.promptChips.length > 0 || view.imageChips.length > 0) && (
        <div className="flex flex-wrap gap-1.5" aria-label="连接顺序">
          {view.promptChips.map((chip) => (
            <span
              key={chip.edgeId}
              className="inline-flex items-center rounded-pill border border-border-input bg-bg-card px-2 py-0.5 text-[11px] font-medium text-brand"
              title={chip.sourceNodeId}
            >
              {chip.label}
            </span>
          ))}
          {view.imageChips.map((chip) => (
            <span
              key={chip.edgeId}
              className="inline-flex items-center rounded-pill border border-border-input bg-bg-card px-2 py-0.5 text-[11px] font-medium text-semantic-info"
              title={chip.sourceNodeId}
            >
              {chip.label}
            </span>
          ))}
        </div>
      )}

      <ol className="flex flex-col gap-2">
        {view.items.map((item) => (
          <li key={item.nodeId} className={cn('rounded-lg border border-border-input bg-bg-card', compact ? 'px-2 py-1.5' : 'px-3 py-2')}>
            <div className="mb-1 flex items-center gap-2 text-[12px] font-medium">
              <span className="inline-flex min-w-7 justify-center rounded-pill bg-bg-input px-2 py-0.5 text-brand">
                {item.chipLabel}
              </span>
              <span className="truncate text-text-secondary">{item.label}</span>
            </div>
            <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-text-base">{item.content}</p>
          </li>
        ))}
      </ol>

      {view.referenceAssets.length > 0 && (
        <div aria-label="引用素材" className="rounded-lg border border-border-input bg-bg-card px-2 py-2">
          <div className="mb-1 flex items-center justify-between text-[11px] font-medium text-text-muted">
            <span>引用素材</span>
            <span>
              图片 {view.referenceImages.length} / 视频 {view.referenceVideos.length}
            </span>
          </div>
          <div className="flex flex-col gap-1">
            {view.referenceAssets.map((asset) => (
              <div key={`${asset.mediaType}-${asset.nodeId}-${asset.assetId}`} className="flex min-w-0 items-center gap-2 text-[12px]">
                <span className="shrink-0 rounded-pill bg-bg-input px-2 py-0.5 text-[11px] text-text-muted">
                  {asset.mediaType === 'image' ? 'IMG' : 'VID'}
                </span>
                <span className="min-w-0 flex-1 truncate text-text-secondary">{asset.label}</span>
                <span className="max-w-[120px] truncate font-mono text-[11px] text-text-muted">{asset.assetId}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <pre
        aria-label="最终提示词预览"
        className="max-h-36 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border-input bg-bg-card px-3 py-2 font-sans text-[13px] leading-relaxed text-text-secondary"
      >
        {view.finalPrompt}
      </pre>
    </section>
  )
}
