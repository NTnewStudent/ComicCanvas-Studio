/**
 * Pure graph helpers for related-node highlighting on the canvas.
 * @see docs/api-contracts/canvas-plan.md
 */

/** Minimal edge shape needed to compute direct graph neighbors. */
export interface RelatedHighlightEdge {
  /** Upstream node ID. */
  source: string
  /** Downstream node ID. */
  target: string
}

/**
 * Computes direct upstream and downstream neighbors for a focused canvas node.
 * @param nodeId - Node ID currently hovered, selected, or drag-released.
 * @param edges - Current graph edges.
 * @returns A set of directly related node IDs, excluding the focused node itself.
 * @throws Error never intentionally; malformed unrelated edges are ignored.
 * @see docs/api-contracts/canvas-plan.md
 */
export function computeRelatedNodeIds(nodeId: string, edges: ReadonlyArray<RelatedHighlightEdge>): Set<string> {
  const related = new Set<string>()
  for (const edge of edges) {
    if (edge.source === nodeId && edge.target !== nodeId) {
      related.add(edge.target)
    } else if (edge.target === nodeId && edge.source !== nodeId) {
      related.add(edge.source)
    }
  }
  return related
}
