/**
 * Shared @mention reference wiring for canvas node prompt fields.
 * @see docs/api-contracts/canvas-plan.md
 */

import { createCanvasEdge } from './canvas-edge-creation'
import { canvasStore, type CanvasStoreNode } from '../store/canvas.store'

/** Node option shown by MentionTextarea candidate lists. */
export interface CanvasMentionTarget {
  id: string
  name: string
  type: string
}

/**
 * Builds mention targets from current canvas nodes.
 * @param nodes - Current canvas node list.
 * @param currentNodeId - Node being edited and therefore excluded.
 * @returns Mention target options sorted in canvas order.
 */
export function mentionTargetsForNodes(nodes: CanvasStoreNode[], currentNodeId: string): CanvasMentionTarget[] {
  return nodes
    .filter((node) => node.id !== currentNodeId)
    .map((node) => ({
      id: node.id,
      name: node.data.label || node.id,
      type: node.type,
    }))
}

/**
 * Creates a semantic reference edge for a selected mention token.
 * @param mentionedNodeId - Referenced upstream node ID.
 * @param targetNodeId - Node whose prompt field contains the mention.
 */
export function createMentionReferenceEdge(mentionedNodeId: string, targetNodeId: string): void {
  createCanvasEdge({
    store: canvasStore,
    request: {
      source: mentionedNodeId,
      target: targetNodeId,
      reason: 'mention',
      markCreatedByMention: true,
    },
  })
}

/**
 * Removes mention-created edges that no longer have a matching token.
 * @param currentMentionIds - Mention token source IDs still present in the text.
 * @param targetNodeId - Node whose prompt field is being edited.
 */
export function pruneMentionReferenceEdges(currentMentionIds: string[], targetNodeId: string): void {
  const state = canvasStore.getState()
  const filtered = state.edges.filter((edge) => {
    if (edge.target !== targetNodeId) return true
    if (!edge.data.createdByMention) return true
    return currentMentionIds.includes(edge.source)
  })

  if (filtered.length !== state.edges.length) {
    state.setEdges(filtered)
  }
}
