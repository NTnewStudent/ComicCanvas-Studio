/**
 * Renderer connection validation adapter for React Flow onConnect handlers.
 * @see docs/api-contracts/canvas-plan.md
 */

import type { StoreApi } from 'zustand/vanilla'

import type { NodeType } from '../../../../../../shared/nodes'
import type {
  CanvasStoreState,
  ConnectFailureReason,
  ConnectResult
} from '../store/canvas.store'

/** Minimal connection shape emitted by the canvas UI. */
export interface CanvasConnectRequest {
  /** Source node ID. */
  source: string | null | undefined
  /** Target node ID. */
  target: string | null | undefined
}

/** User-facing connection validation feedback. */
export interface ConnectionValidationFeedback {
  /** Store-level failure reason. */
  reason: ConnectFailureReason
  /** Chinese UX message shown within the canvas. */
  message: string
  /** Timestamp copied from the store validation result. */
  at: number
}

/** Dependencies for creating a renderer onConnect handler. */
export interface CanvasConnectHandlerOptions {
  /** Canvas store that owns node types, existing edges, and validation. */
  store: StoreApi<CanvasStoreState>
  /** Optional notifier used by toast/banner UI. */
  notify?: (feedback: ConnectionValidationFeedback) => void
}

const nodeTypeLabel: Record<NodeType, string> = {
  text: '文本',
  image: '图片',
  video: '视频',
  imageConfigV2: '生图',
  videoConfigV2: '生视频',
}

const fallbackMessages: Record<ConnectFailureReason, string> = {
  node_not_found: '连接失败：节点不存在',
  connection_not_allowed: '这两个节点不能连接',
  duplicate_edge: '这两个节点已经连接过了'
}

/**
 * Converts a store validation failure into a stable Chinese canvas message.
 * @param reason - Store-level connection failure reason.
 * @param sourceType - Optional source node type for matrix-specific copy.
 * @param targetType - Optional target node type for matrix-specific copy.
 * @param at - Validation timestamp.
 * @returns Feedback payload suitable for toast/banner rendering.
 */
export function createConnectionFeedback(
  reason: ConnectFailureReason,
  sourceType: NodeType | null,
  targetType: NodeType | null,
  at: number
): ConnectionValidationFeedback {
  if (reason === 'connection_not_allowed' && sourceType !== null && targetType !== null) {
    return {
      reason,
      message: `${nodeTypeLabel[sourceType]}节点不能连接到${nodeTypeLabel[targetType]}节点`,
      at
    }
  }

  return {
    reason,
    message: fallbackMessages[reason],
    at
  }
}

/**
 * Creates a React Flow-compatible connection handler backed by the canonical canvas store.
 * @param options - Canvas store plus optional user-feedback callback.
 * @returns Function that validates and applies a connection.
 * @throws Error never intentionally; invalid connection requests return store failures.
 * @see docs/api-contracts/canvas-plan.md
 */
export function createCanvasConnectHandler({
  store,
  notify
}: CanvasConnectHandlerOptions): (connection: CanvasConnectRequest) => ConnectResult {
  return (connection) => {
    const source = connection.source
    const target = connection.target
    if (typeof source !== 'string' || typeof target !== 'string') {
      const at = Date.now()
      const feedback = createConnectionFeedback('node_not_found', null, null, at)
      notify?.(feedback)
      return { ok: false, reason: 'node_not_found' }
    }

    const stateBefore = store.getState()
    const sourceType = stateBefore.nodes.find((node) => node.id === source)?.type ?? null
    const targetType = stateBefore.nodes.find((node) => node.id === target)?.type ?? null
    const result = stateBefore.addEdge(source, target)

    if (!result.ok) {
      const storeError = store.getState().lastConnectError
      const feedback = createConnectionFeedback(result.reason, sourceType, targetType, storeError?.at ?? Date.now())
      notify?.(feedback)
    }

    return result
  }
}
