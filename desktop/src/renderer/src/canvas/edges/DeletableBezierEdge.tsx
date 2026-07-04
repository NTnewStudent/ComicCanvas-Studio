/**
 * Deletable Bezier edge for output, reference, and default semantic links.
 * @see docs/api-contracts/canvas-plan.md
 */

import { BaseEdge, type EdgeProps } from '@xyflow/react'
import { memo } from 'react'

import type { CanvasEdgeData, EdgeType } from '../../../../../../shared/nodes'
import { buildEdgeGeometry, EdgeDeleteButton, EdgeLabelControls } from './edge-ui'

const edgeLabels: Partial<Record<EdgeType, string>> = {
  outputLink: '输出',
  reference: '引用',
}

/**
 * Renders a generic deletable Bezier edge.
 * @param props - React Flow edge props.
 * @returns Deletable edge element.
 * @throws Error never intentionally.
 * @see docs/api-contracts/canvas-plan.md
 */
function DeletableBezierEdge(props: EdgeProps): JSX.Element {
  const { id, selected, data } = props
  const { edgePath, labelX, labelY } = buildEdgeGeometry(props)
  const edgeData = data as CanvasEdgeData | undefined
  const label = edgeData?.edgeType ? edgeLabels[edgeData.edgeType] : undefined

  return (
    <>
      <BaseEdge
        path={edgePath}
        className="cc-semantic-edge cc-semantic-edge-default"
      />
      <EdgeLabelControls labelX={labelX} labelY={labelY}>
        {label ? (
          <span className="rounded-full border border-border-secondary bg-bg-card px-2 py-1 text-[11px] font-semibold text-text-secondary shadow-card">
            {label}
          </span>
        ) : null}
        <EdgeDeleteButton edgeId={id} selected={selected ?? false} />
      </EdgeLabelControls>
    </>
  )
}

export default memo(DeletableBezierEdge)
