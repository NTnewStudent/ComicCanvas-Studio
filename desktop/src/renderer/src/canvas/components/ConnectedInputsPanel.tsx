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
  className
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
        'flex flex-col gap-3 rounded-xl border border-border-secondary bg-bg-input p-3 text-text-base shadow-card',
        className
      )}
      aria-label="Connected inputs"
    >
      <header className="flex items-center gap-2 text-[12px] font-semibold text-text-secondary">
        <Link2 className="h-3.5 w-3.5 text-brand" aria-hidden="true" />
        <span>Connected inputs</span>
        {view.referenceImages.length > 0 && (
          <span className="ml-auto rounded-pill bg-bg-card px-2 py-0.5 text-[12px] font-medium text-semantic-info">
            Image refs {view.referenceImages.length}
          </span>
        )}
      </header>

      <ol className="flex flex-col gap-2">
        {view.items.map((item) => (
          <li key={item.nodeId} className="rounded-lg border border-border-input bg-bg-card px-3 py-2">
            <div className="mb-1 flex items-center gap-2 text-[12px] font-medium">
              <span className="inline-flex min-w-7 justify-center rounded-pill bg-bg-input px-2 py-0.5 text-brand">
                #{item.order}
              </span>
              <span className="truncate text-text-secondary">{item.label}</span>
            </div>
            <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-text-base">{item.content}</p>
          </li>
        ))}
      </ol>

      <pre
        aria-label="Final prompt preview"
        className="max-h-36 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border-input bg-bg-card px-3 py-2 font-sans text-[13px] leading-relaxed text-text-secondary"
      >
        {view.finalPrompt}
      </pre>
    </section>
  )
}
