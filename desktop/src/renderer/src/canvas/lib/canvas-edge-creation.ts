/**
 * Shared renderer edge creation helper for direct, contextual, and mention-created edges.
 * @see docs/api-contracts/canvas-plan.md
 */

import type { StoreApi } from 'zustand/vanilla'

import type { EdgeType, ImageRole, NodeType } from '../../../../../../shared/nodes'
import type { CanvasStoreState, ConnectResult } from '../store/canvas.store'
import { createCanvasConnectHandler, createConnectionFeedback, type ConnectionValidationFeedback } from './connection-validation'

export type CanvasEdgeCreationReason = 'direct' | 'context-menu' | 'connect-to-create' | 'mention'

export interface CanvasEdgeCreationRequest {
  source: string | null | undefined
  target: string | null | undefined
  reason: CanvasEdgeCreationReason
  edgeType?: EdgeType
  imageRole?: ImageRole
  markCreatedByMention?: boolean
}

export interface CanvasEdgeCreationOptions {
  store: StoreApi<CanvasStoreState>
  request: CanvasEdgeCreationRequest
  notify?: (feedback: ConnectionValidationFeedback) => void
}

/**
 * Infers durable edge semantics from source/target node types.
 * @param sourceType - Source canvas node type.
 * @param targetType - Target canvas node type.
 * @param request - Optional caller-provided overrides.
 * @returns Edge metadata used by manual UI, mentions, and future Agent tools.
 * @see docs/api-contracts/canvas-plan.md
 */
export function inferCanvasEdgeSemantics(
  sourceType: NodeType,
  targetType: NodeType,
  request: Pick<CanvasEdgeCreationRequest, 'edgeType' | 'imageRole'> = {},
): { edgeType?: EdgeType; imageRole?: ImageRole } {
  if (request.edgeType || request.imageRole) {
    return {
      ...(request.edgeType ? { edgeType: request.edgeType } : {}),
      ...(request.imageRole ? { imageRole: request.imageRole } : {}),
    }
  }

  if (sourceType === 'text' || sourceType === 'character' || sourceType === 'scene') {
    return { edgeType: 'promptOrder' }
  }

  if ((sourceType === 'image' || sourceType === 'imageConfigV2' || sourceType === 'mjImage') && (targetType === 'video' || targetType === 'videoConfigV2')) {
    return { edgeType: 'imageRole', imageRole: 'reference' }
  }

  if (sourceType === 'image' || sourceType === 'imageConfigV2' || sourceType === 'mjImage') {
    return { edgeType: 'reference', imageRole: 'reference' }
  }

  if (sourceType === 'audio' || sourceType === 'video' || sourceType === 'videoConfigV2') {
    return { edgeType: 'reference' }
  }

  return {}
}

/**
 * Creates a canvas edge through the canonical store validation path.
 * @param options - Store, edge request, and optional feedback notifier.
 * @returns Store connection result.
 * @throws Error never intentionally; invalid requests return a failure result.
 * @see docs/api-contracts/canvas-plan.md
 */
export function createCanvasEdge({ store, request, notify }: CanvasEdgeCreationOptions): ConnectResult {
  const source = request.source
  const target = request.target
  if (typeof source !== 'string' || typeof target !== 'string') {
    const handler = notify
      ? createCanvasConnectHandler({ store, notify })
      : createCanvasConnectHandler({ store })
    return handler({ source, target })
  }

  const state = store.getState()
  const sourceType = state.nodes.find((node) => node.id === source)?.type
  const targetType = state.nodes.find((node) => node.id === target)?.type
  const semantics = sourceType && targetType ? inferCanvasEdgeSemantics(sourceType, targetType, request) : {}
  const result = state.addEdge(source, target, {
    ...semantics,
    ...(request.markCreatedByMention ? { createdByMention: true } : {}),
  })

  if (!result.ok && notify) {
    const storeError = store.getState().lastConnectError
    notify(createConnectionFeedback(result.reason, sourceType ?? null, targetType ?? null, storeError?.at ?? Date.now()))
  }

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
