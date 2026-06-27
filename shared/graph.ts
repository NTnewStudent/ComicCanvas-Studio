/**
 * Persisted canvas graph contract shared by renderer, IPC, and repositories.
 * @see docs/api-contracts/canvas-plan.md
 */

import { canConnect } from './connection-matrix'
import type { CanvasEdgeData, CanvasNodeData, NodeType } from './nodes'

const CANVAS_NODE_TYPES = new Set<NodeType>([
  'text',
  'image',
  'video',
  'character',
  'scene',
  'audio',
  'imageConfigV2',
  'videoConfigV2',
  'videoCompose',
  'superResolution',
  'muxAudioVideo',
  'mjImage',
])

/** Persisted canvas node position. */
export interface CanvasGraphPosition {
  /** Horizontal canvas coordinate. */
  x: number
  /** Vertical canvas coordinate. */
  y: number
}

/** Persisted canvas viewport. */
export interface CanvasGraphViewport {
  /** Horizontal pan offset. */
  x: number
  /** Vertical pan offset. */
  y: number
  /** Current zoom level. */
  zoom: number
}

/** Persisted canvas node. */
export interface CanvasGraphNode {
  /** Stable canvas node identifier. */
  id: string
  /** Shared node type. */
  type: NodeType
  /** Canvas layout position. */
  position: CanvasGraphPosition
  /** Shared node data payload. */
  data: CanvasNodeData
}

/** Persisted canvas edge. */
export interface CanvasGraphEdge {
  /** Stable edge identifier. */
  id: string
  /** Source node identifier. */
  source: string
  /** Target node identifier. */
  target: string
  /** Shared edge data payload. */
  data: CanvasEdgeData
}

/** Full graph snapshot persisted by `canvas.saveGraph`. */
export interface CanvasGraphSnapshot {
  /** Persisted canvas nodes. */
  nodes: CanvasGraphNode[]
  /** Persisted canvas edges. */
  edges: CanvasGraphEdge[]
  /** Persisted viewport. */
  viewport: CanvasGraphViewport
}

/** Request for saving a project graph. */
export interface CanvasSaveGraphRequest {
  /** Project/workflow identifier. */
  projectId: string
  /** Graph snapshot to persist. */
  graph: CanvasGraphSnapshot
}

/** Response returned after graph persistence. */
export interface CanvasSaveGraphResponse {
  /** New graph version identifier. */
  graphVersion: string
}

/** Request for loading the latest project graph. */
export interface CanvasLoadGraphRequest {
  /** Project/workflow identifier. */
  projectId: string
}

/**
 * Checks whether a raw string is part of the persisted canvas node vocabulary.
 * @param value - Candidate node type.
 * @returns True when the node type is supported by shared graph contracts.
 */
export function isCanvasNodeType(value: string): value is NodeType {
  return CANVAS_NODE_TYPES.has(value as NodeType)
}

/**
 * Sanitizes a canvas graph before persistence or cross-process handoff.
 * @param graph - Candidate graph snapshot.
 * @returns Graph with unsupported node types removed and edges revalidated.
 */
export function sanitizeCanvasGraphSnapshot(graph: CanvasGraphSnapshot): CanvasGraphSnapshot {
  const nodes = graph.nodes.filter((node) => isCanvasNodeType(node.type))
  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const edges = graph.edges.filter((edge) => {
    const source = nodeById.get(edge.source)
    const target = nodeById.get(edge.target)

    if (!source || !target) {
      return false
    }

    return canConnect(source.type, target.type)
  })

  return {
    nodes,
    edges,
    viewport: graph.viewport
  }
}
