/**
 * Shared UI primitives for semantic canvas edges.
 * @see docs/api-contracts/canvas-plan.md
 */

import { EdgeLabelRenderer, type EdgeProps, getBezierPath } from '@xyflow/react'
import { X } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '../../lib/cn'
import { canvasStore } from '../store/canvas.store'

/** Bezier geometry plus label position derived from React Flow edge props. */
export interface EdgeGeometry {
  /** SVG path string for BaseEdge. */
  edgePath: string
  /** Absolute label X coordinate. */
  labelX: number
  /** Absolute label Y coordinate. */
  labelY: number
}

/**
 * Builds a Bezier edge path and label coordinates for semantic edge components.
 * @param props - React Flow edge coordinates and handle positions.
 * @returns Edge path and label point.
 * @throws Error never intentionally; React Flow supplies numeric geometry.
 * @see docs/api-contracts/canvas-plan.md
 */
export function buildEdgeGeometry(props: Pick<EdgeProps, 'sourceX' | 'sourceY' | 'targetX' | 'targetY' | 'sourcePosition' | 'targetPosition'>): EdgeGeometry {
  const [edgePath, labelX, labelY] = getBezierPath(props)
  return { edgePath, labelX, labelY }
}

/**
 * Deletes an edge through the shared canvas store.
 * @param edgeId - Edge ID to delete.
 * @throws Error never intentionally; missing edges are ignored by the store.
 * @see docs/api-contracts/canvas-plan.md
 */
export function deleteCanvasEdge(edgeId: string): void {
  canvasStore.getState().deleteEdge(edgeId)
}

/**
 * Renders the small delete button shown at an edge label anchor.
 * @param props - Edge ID plus selected state.
 * @returns React element for an edge delete button.
 * @throws Error never intentionally; click events stop propagation before deleting.
 * @see docs/api-contracts/canvas-plan.md
 */
export function EdgeDeleteButton({ edgeId, selected }: { edgeId: string; selected?: boolean }): JSX.Element {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation()
        deleteCanvasEdge(edgeId)
      }}
      className={cn(
        'flex h-5 w-5 items-center justify-center rounded-full border border-border-secondary bg-bg-card text-text-muted shadow-sm transition-all duration-200 ease-luxury',
        selected
          ? 'scale-110 border-transparent bg-red-500 text-white opacity-100'
          : 'opacity-0 group-hover:opacity-100 hover:border-transparent hover:bg-red-500 hover:text-white',
      )}
      aria-label="Delete edge"
      title="Delete edge"
    >
      <X className="h-3 w-3" />
    </button>
  )
}

/**
 * Positions edge label controls at the React Flow label coordinates.
 * @param props - Label coordinates and child controls.
 * @returns Positioned edge label element.
 * @throws Error never intentionally.
 * @see docs/api-contracts/canvas-plan.md
 */
export function EdgeLabelControls({ labelX, labelY, children }: { labelX: number; labelY: number; children: ReactNode }): JSX.Element {
  return (
    <EdgeLabelRenderer>
      <div
        style={{
          position: 'absolute',
          transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
          pointerEvents: 'all',
        }}
        className="nodrag nopan group flex items-center gap-1"
      >
        {children}
      </div>
    </EdgeLabelRenderer>
  )
}
