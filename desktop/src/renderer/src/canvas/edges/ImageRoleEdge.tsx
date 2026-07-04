/**
 * Image role edge for first-frame, last-frame, and reference links.
 * @see docs/api-contracts/canvas-plan.md
 */

import { BaseEdge, type EdgeProps } from '@xyflow/react'
import { memo } from 'react'

import type { CanvasEdgeData, ImageRole } from '../../../../../../shared/nodes'
import { buildEdgeGeometry, EdgeDeleteButton, EdgeLabelControls } from './edge-ui'

const roleLabels: Record<ImageRole, string> = {
  first_frame: '首帧',
  last_frame: '尾帧',
  reference: '参考',
}

/**
 * Renders an image-role semantic edge.
 * @param props - React Flow edge props.
 * @returns Image role edge element.
 * @throws Error never intentionally; missing roles render as reference links.
 * @see docs/api-contracts/canvas-plan.md
 */
function ImageRoleEdge(props: EdgeProps): JSX.Element {
  const { id, selected, data } = props
  const { edgePath, labelX, labelY } = buildEdgeGeometry(props)
  const edgeData = data as CanvasEdgeData | undefined
  const role = edgeData?.imageRole ?? 'reference'

  return (
    <>
      <BaseEdge
        path={edgePath}
        className="cc-semantic-edge cc-semantic-edge-image-role"
      />
      <EdgeLabelControls labelX={labelX} labelY={labelY}>
        <span
          className="rounded-full border border-border-secondary bg-bg-card px-2.5 py-1 text-[11px] font-semibold text-text-base shadow-card"
          title="Image role"
        >
          {roleLabels[role]}
        </span>
        <EdgeDeleteButton edgeId={id} selected={selected ?? false} />
      </EdgeLabelControls>
    </>
  )
}

export default memo(ImageRoleEdge)
