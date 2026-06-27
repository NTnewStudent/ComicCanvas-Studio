/**
 * Connect-to-create helper that keeps new-node edge creation on the canonical
 * canvas edge validation path.
 * @see docs/api-contracts/canvas-plan.md
 */

import type { StoreApi } from 'zustand/vanilla'

import type { CanvasStoreState, ConnectResult } from '../store/canvas.store'
import type { ConnectionValidationFeedback } from './connection-validation'
import { createCanvasEdge } from './canvas-edge-creation'

export interface ConnectCreatedCanvasNodeOptions {
  store: StoreApi<CanvasStoreState>
  sourceNodeId: string | null | undefined
  createdNodeId: string | null | undefined
  notify?: (feedback: ConnectionValidationFeedback) => void
}

/**
 * Creates the edge implied by a connect-to-create gesture.
 * @returns The same connection result returned by the shared edge helper.
 */
export function connectCreatedCanvasNode({
  store,
  sourceNodeId,
  createdNodeId,
  notify,
}: ConnectCreatedCanvasNodeOptions): ConnectResult {
  return createCanvasEdge({
    store,
    ...(notify ? { notify } : {}),
    request: {
      source: sourceNodeId,
      target: createdNodeId,
      reason: 'connect-to-create',
    },
  })
}
