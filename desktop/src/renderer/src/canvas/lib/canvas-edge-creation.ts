/**
 * Shared renderer edge creation helper for direct, contextual, and mention-created edges.
 * @see docs/api-contracts/canvas-plan.md
 */

import type { StoreApi } from 'zustand/vanilla'

import type { CanvasStoreState, ConnectResult } from '../store/canvas.store'
import { createCanvasConnectHandler, type ConnectionValidationFeedback } from './connection-validation'

export type CanvasEdgeCreationReason = 'direct' | 'context-menu' | 'connect-to-create' | 'mention'

export interface CanvasEdgeCreationRequest {
  source: string | null | undefined
  target: string | null | undefined
  reason: CanvasEdgeCreationReason
  markCreatedByMention?: boolean
}

export interface CanvasEdgeCreationOptions {
  store: StoreApi<CanvasStoreState>
  request: CanvasEdgeCreationRequest
  notify?: (feedback: ConnectionValidationFeedback) => void
}

/**
 * Creates a canvas edge through the canonical store validation path.
 * @param options - Store, edge request, and optional feedback notifier.
 * @returns Store connection result.
 * @throws Error never intentionally; invalid requests return a failure result.
 * @see docs/api-contracts/canvas-plan.md
 */
export function createCanvasEdge({ store, request, notify }: CanvasEdgeCreationOptions): ConnectResult {
  const handler = notify
    ? createCanvasConnectHandler({ store, notify })
    : createCanvasConnectHandler({ store })
  const result = handler({
    source: request.source,
    target: request.target,
  })

  if (result.ok && request.markCreatedByMention) {
    const state = store.getState()
    state.setEdges(
      state.edges.map((edge) => (
        edge.id === result.edgeId
          ? { ...edge, data: { ...edge.data, createdByMention: true } }
          : edge
      )),
    )
  }

  return result
}
