/**
 * Prompt ordering edge with a compact order label and delete action.
 * @see docs/api-contracts/canvas-plan.md
 */

import { BaseEdge, type EdgeProps } from '@xyflow/react'
import { memo } from 'react'

import type { CanvasEdgeData } from '../../../../../../shared/nodes'
import { buildEdgeGeometry, EdgeDeleteButton, EdgeLabelControls } from './edge-ui'

/**
 * Renders a prompt-order semantic edge.
 * @param props - React Flow edge props.
 * @returns Prompt order edge element.
 * @throws Error never intentionally; malformed data falls back to order 1.
 * @see docs/api-contracts/canvas-plan.md
 */
function PromptOrderEdge(props: EdgeProps): JSX.Element {
  const { id, selected, data } = props
  const { edgePath, labelX, labelY } = buildEdgeGeometry(props)
  const edgeData = data as CanvasEdgeData | undefined
  const order = typeof edgeData?.promptOrder === 'number' && Number.isFinite(edgeData.promptOrder)
    ? edgeData.promptOrder
    : 1

  return (
    <>
      <BaseEdge
        path={edgePath}
        className="cc-semantic-edge cc-semantic-edge-prompt"
      />
      <EdgeLabelControls labelX={labelX} labelY={labelY}>
        <span
          className="flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-bg-card bg-text-base px-1.5 text-[11px] font-bold text-bg-base shadow-card"
          title={`提示词顺序 ${order}`}
        >
          {order}
        </span>
        <EdgeDeleteButton edgeId={id} selected={selected ?? false} />
      </EdgeLabelControls>
    </>
  )
}

export default memo(PromptOrderEdge)
