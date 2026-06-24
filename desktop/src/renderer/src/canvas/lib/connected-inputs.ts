/**
 * Connected input view derivation for generation nodes.
 * @see docs/api-contracts/canvas-plan.md
 */

import { composeFinalPrompt } from '../../../../../../shared/composed-prompt'
import type { AssetRef, GraphSnapshot } from '../../../../../../shared/composed-prompt'
import type { TextNodeData } from '../../../../../../shared/nodes'
import type { CanvasSnapshot } from '../store/canvas.store'

/** Upstream text input rendered above a generation prompt preview. */
export interface ConnectedInputItem {
  /** Stable canvas node identifier for the upstream text node. */
  nodeId: string
  /** One-based order after connection-time sorting. */
  order: number
  /** User-facing upstream node label. */
  label: string
  /** Text content contributed by the upstream node. */
  content: string
}

/** Read model for the connected inputs panel. */
export interface ConnectedInputsView {
  /** Ordered upstream text inputs that contribute to the target prompt. */
  items: ConnectedInputItem[]
  /** Byte-equivalent composed prompt from the shared prompt composer. */
  finalPrompt: string
  /** Image asset references returned by the shared prompt composer. */
  referenceImages: AssetRef[]
  /** Video asset references returned by the shared prompt composer. */
  referenceVideos: AssetRef[]
}

/**
 * Builds the connected inputs panel view for a target canvas node.
 * @param snapshot - Canvas store nodes and edges.
 * @param nodeId - Target image or video generation node ID.
 * @returns Ordered upstream text items plus the shared final prompt preview.
 * @throws Error never intentionally; missing nodes produce an empty view.
 * @see docs/api-contracts/canvas-plan.md
 */
export function buildConnectedInputsView(
  snapshot: Pick<CanvasSnapshot, 'nodes' | 'edges'>,
  nodeId: string
): ConnectedInputsView {
  const graph = toGraphSnapshot(snapshot)
  const composed = composeFinalPrompt(graph, nodeId)
  const nodeById = new Map(snapshot.nodes.map((node) => [node.id, node]))

  const items = snapshot.edges
    .filter((edge) => edge.target === nodeId)
    .sort((left, right) => left.data.createdAt - right.data.createdAt)
    .flatMap((edge): ConnectedInputItem[] => {
      const node = nodeById.get(edge.source)
      if (node?.type !== 'text') {
        return []
      }

      const data = node.data as TextNodeData
      return [
        {
          nodeId: node.id,
          order: 0,
          label: data.label,
          content: data.content
        }
      ]
    })
    .map((item, index) => ({ ...item, order: index + 1 }))

  return {
    items,
    finalPrompt: composed.composedPrompt,
    referenceImages: composed.referenceImages,
    referenceVideos: composed.referenceVideos
  }
}

/**
 * Converts the renderer canvas store shape to the shared graph prompt shape.
 * @param snapshot - Renderer canvas nodes and edges.
 * @returns Shared graph snapshot consumed by prompt composition.
 * @throws Error never intentionally; this is a structural projection only.
 * @see docs/api-contracts/canvas-plan.md
 */
export function toGraphSnapshot(snapshot: Pick<CanvasSnapshot, 'nodes' | 'edges'>): GraphSnapshot {
  return {
    nodes: snapshot.nodes.map(({ id, type, data }) => ({ id, type, data })),
    edges: snapshot.edges.map(({ id, source, target, data }) => ({ id, source, target, data }))
  }
}
