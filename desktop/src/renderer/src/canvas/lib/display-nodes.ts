/** Stable related-node CSS class used by the canvas display projection. */
const RELATED_NODE_CLASS = 'cc-flow-node-related'

/** Shared empty set so no-highlight projections preserve the input array. */
export const EMPTY_RELATED_NODE_IDS: ReadonlySet<string> = new Set()

interface DisplayNode {
  id: string
  className?: string
}

/**
 * Adds related-node styling without replacing unaffected React Flow node objects.
 * @param nodes - Current React Flow nodes.
 * @param relatedNodeIds - Node IDs that should receive the related style.
 * @returns The original nodes array when no decoration is required, otherwise a
 * projection that preserves every unaffected node reference.
 */
export function projectDisplayNodes<Node extends DisplayNode>(
  nodes: Node[],
  relatedNodeIds: ReadonlySet<string>
): Node[] {
  if (relatedNodeIds.size === 0) {
    return nodes
  }

  return nodes.map((node) => {
    if (!relatedNodeIds.has(node.id)) {
      return node
    }

    const className = node.className
      ? `${node.className} ${RELATED_NODE_CLASS}`
      : RELATED_NODE_CLASS
    return node.className === className ? node : { ...node, className }
  })
}
