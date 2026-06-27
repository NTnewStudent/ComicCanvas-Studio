/**
 * Image ordering edge with a compact order label and delete action.
 * @see docs/api-contracts/canvas-plan.md
 */

import { BaseEdge, type EdgeProps } from '@xyflow/react'
import { memo } from 'react'

import type { CanvasEdgeData } from '../../../../../../shared/nodes'
import { buildEdgeGeometry, EdgeDeleteButton, EdgeLabelControls } from './edge-ui'

/**
 * Renders an image-order semantic edge.
 * @param props - React Flow edge props.
 * @returns Image order edge element.
 * @throws Error never intentionally; malformed data falls back to order 1.
 * @see docs/api-contracts/canvas-plan.md
 */
function ImageOrderEdge(props: EdgeProps): JSX.Element {
  const { id, selected, data } = props
  const { edgePath, labelX, labelY } = buildEdgeGeometry(props)
  const edgeData = data as CanvasEdgeData | undefined
  const order = typeof edgeData?.imageOrder === 'number' && Number.isFinite(edgeData.imageOrder)
    ? edgeData.imageOrder
    : 1

  return (
    <>
      <BaseEdge
        path={edgePath}
        className="cc-semantic-edge cc-semantic-edge-image-order"
      />
      <EdgeLabelControls labelX={labelX} labelY={labelY}>
        <span
          className="flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-bg-card bg-brand px-1.5 text-[11px] font-bold text-bg-base shadow-card"
          title={`Image order ${order}`}
        >
          {order}
        </span>
        <EdgeDeleteButton edgeId={id} selected={selected ?? false} />
      </EdgeLabelControls>
    </>
  )
}

export default memo(ImageOrderEdge)
