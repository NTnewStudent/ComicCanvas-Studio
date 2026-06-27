/**
 * Connected input view derivation for generation nodes.
 * @see docs/api-contracts/canvas-plan.md
 */

import { composeFinalPrompt } from '../../../../../../shared/composed-prompt'
import type { AssetRef, GraphSnapshot } from '../../../../../../shared/composed-prompt'
import type { CanvasEdgeData, NodeType, TextNodeData } from '../../../../../../shared/nodes'
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
  /** Compact prompt-order chip label. */
  chipLabel: string
}

/** Compact edge chip rendered in connected-input summaries. */
export interface ConnectedInputChip {
  /** Stable edge identifier. */
  edgeId: string
  /** Source canvas node identifier. */
  sourceNodeId: string
  /** Source node type. */
  sourceType: NodeType
  /** Compact label such as P1 or I1. */
  label: string
}

/** Referenced media asset rendered as a compact chip/list item. */
export interface ConnectedReferenceAsset {
  /** Referenced canvas node identifier. */
  nodeId: string
  /** Referenced asset identifier. */
  assetId: string
  /** Media kind. */
  mediaType: 'image' | 'video'
  /** User-facing node label when available. */
  label: string
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
  /** Prompt-order chips for connected text inputs. */
  promptChips: ConnectedInputChip[]
  /** Image-order chips for connected image inputs. */
  imageChips: ConnectedInputChip[]
  /** Image/video reference assets with display labels. */
  referenceAssets: ConnectedReferenceAsset[]
}

function explicitOrder(data: CanvasEdgeData, fallback: number): number {
  if (typeof data.promptOrder === 'number' && Number.isFinite(data.promptOrder)) return data.promptOrder
  if (typeof data.imageOrder === 'number' && Number.isFinite(data.imageOrder)) return data.imageOrder
  return fallback
}

function displayLabelForNode(data: unknown, fallback: string): string {
  if (typeof data === 'object' && data !== null && 'label' in data) {
    const label = (data as { label?: unknown }).label
    if (typeof label === 'string' && label.trim().length > 0) return label
  }
  return fallback
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
  const incomingEdges = snapshot.edges.filter((edge) => edge.target === nodeId)

  const promptEdges = incomingEdges
    .filter((edge) => edge.data.edgeType === 'promptOrder')
    .sort((left, right) => left.data.createdAt - right.data.createdAt)

  const items = promptEdges
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
          content: data.content,
          chipLabel: ''
        }
      ]
    })
    .map((item, index) => {
      const order = explicitOrder(promptEdges[index]?.data ?? { edgeType: 'promptOrder', createdAt: 0 }, index + 1)
      return { ...item, order, chipLabel: `P${order}` }
    })

  const promptChips = promptEdges.map((edge, index): ConnectedInputChip => {
    const source = nodeById.get(edge.source)
    const order = explicitOrder(edge.data, index + 1)
    return {
      edgeId: edge.id,
      sourceNodeId: edge.source,
      sourceType: source?.type ?? 'text',
      label: `P${order}`
    }
  })

  const imageChips = incomingEdges
    .filter((edge) => edge.data.edgeType === 'imageOrder')
    .sort((left, right) => {
      const leftOrder = explicitOrder(left.data, left.data.createdAt)
      const rightOrder = explicitOrder(right.data, right.data.createdAt)
      return leftOrder - rightOrder
    })
    .map((edge, index): ConnectedInputChip => {
      const source = nodeById.get(edge.source)
      const order = explicitOrder(edge.data, index + 1)
      return {
        edgeId: edge.id,
        sourceNodeId: edge.source,
        sourceType: source?.type ?? 'image',
        label: `I${order}`
      }
    })

  const referenceAssets: ConnectedReferenceAsset[] = [
    ...composed.referenceImages.map((asset) => ({
      nodeId: asset.nodeId,
      assetId: asset.assetId,
      mediaType: 'image' as const,
      label: displayLabelForNode(nodeById.get(asset.nodeId)?.data, asset.nodeId)
    })),
    ...composed.referenceVideos.map((asset) => ({
      nodeId: asset.nodeId,
      assetId: asset.assetId,
      mediaType: 'video' as const,
      label: displayLabelForNode(nodeById.get(asset.nodeId)?.data, asset.nodeId)
    }))
  ]

  return {
    items,
    finalPrompt: composed.composedPrompt,
    referenceImages: composed.referenceImages,
    referenceVideos: composed.referenceVideos,
    promptChips,
    imageChips,
    referenceAssets
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
