/**
 * Renderer canvas state store for nodes, edges, viewport, and undo history.
 * @see docs/api-contracts/canvas-plan.md
 */

import { createStore, type StoreApi } from 'zustand/vanilla'

import {
  connectCanvasNodes,
  createCanvasNode,
  deleteCanvasNode,
  type CanvasActionFailureReason,
} from '../../../../../../shared/canvas-actions'
import type { CanvasGraphSnapshot } from '../../../../../../shared/graph'
import type { CanvasEdgeData, CanvasNodeData, EdgeType, ImageRole, NodeStatus, NodeType } from '../../../../../../shared/nodes'

export interface CanvasPosition {
  x: number
  y: number
}

export interface CanvasViewport extends CanvasPosition {
  zoom: number
}

export interface CanvasStoreNode {
  id: string
  type: NodeType
  position: CanvasPosition
  width?: number
  height?: number
  data: CanvasNodeData
}

export interface CanvasStoreEdge {
  id: string
  source: string
  target: string
  data: CanvasEdgeData
}

export interface CanvasSnapshot {
  nodes: CanvasStoreNode[]
  edges: CanvasStoreEdge[]
  viewport: CanvasViewport
}

export type ConnectFailureReason = CanvasActionFailureReason

export type ConnectResult = { ok: true; edgeId: string } | { ok: false; reason: ConnectFailureReason }

export interface AddEdgeOptions {
  edgeType?: EdgeType
  imageRole?: ImageRole
  createdByMention?: boolean
}

export interface CanvasStoreOptions {
  idFactory?: () => string
  edgeIdFactory?: (source: string, target: string) => string
  clock?: () => number
}

export interface CanvasStoreState extends CanvasSnapshot {
  past: CanvasSnapshot[]
  future: CanvasSnapshot[]
  lastConnectError: { reason: ConnectFailureReason; at: number } | null
  addNode(this: void, type: NodeType, position: CanvasPosition, data?: Partial<CanvasNodeData>): string
  deleteNode(this: void, id: string): void
  updateNodeData(this: void, id: string, data: Partial<CanvasNodeData>): void
  setViewport(this: void, viewport: CanvasViewport): void
  /** Batch-replace nodes (used by debounced persistence from ReactFlow) */
  setNodes(this: void, nodes: CanvasStoreNode[]): void
  /** Batch-replace edges (used by debounced persistence from ReactFlow) */
  setEdges(this: void, edges: CanvasStoreEdge[]): void
  addEdge(this: void, source: string, target: string, options?: AddEdgeOptions): ConnectResult
  deleteEdge(this: void, id: string): void
  applyChange(this: void, snapshot: CanvasSnapshot): void
  undo(this: void): void
  redo(this: void): void
}

const maxHistory = 50

function cloneSnapshot(snapshot: CanvasSnapshot): CanvasSnapshot {
  return structuredClone(snapshot)
}

function takeSnapshot(state: CanvasStoreState): CanvasSnapshot {
  return cloneSnapshot({
    nodes: state.nodes,
    edges: state.edges,
    viewport: state.viewport
  })
}

function pushHistory(state: CanvasStoreState): Pick<CanvasStoreState, 'past' | 'future'> {
  return {
    past: [...state.past, takeSnapshot(state)].slice(-maxHistory),
    future: []
  }
}

function snapshotFromState(state: CanvasSnapshot): CanvasGraphSnapshot {
  return {
    nodes: state.nodes,
    edges: state.edges,
    viewport: state.viewport,
  }
}

/**
 * Creates a vanilla Zustand canvas store.
 * @param options - Optional deterministic ID, edge ID, and clock dependencies.
 * @returns Canvas store API.
 * @throws Error never intentionally; invalid operations are represented as no-ops or ConnectResult failures.
 * @see docs/api-contracts/canvas-plan.md
 */
export function createCanvasStore(options: CanvasStoreOptions = {}): StoreApi<CanvasStoreState> {
  const idFactory = options.idFactory ?? (() => `node-${crypto.randomUUID()}`)
  const edgeIdFactory = options.edgeIdFactory ?? ((source, target) => `edge-${source}-${target}-${Date.now()}`)
  const clock = options.clock ?? Date.now

  return createStore<CanvasStoreState>((set, get) => ({
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 },
    past: [],
    future: [],
    lastConnectError: null,

    addNode(type, position, data) {
      const id = idFactory()

      set((state) => {
        const next = createCanvasNode(snapshotFromState(state), {
          nodeId: id,
          type,
          position,
          ...(data ? { data } : {}),
        })

        return {
          ...pushHistory(state),
          nodes: next.graph.nodes,
        }
      })

      return id
    },

    deleteNode(id) {
      set((state) => {
        const next = deleteCanvasNode(snapshotFromState(state), { nodeId: id })
        return {
          ...pushHistory(state),
          nodes: next.graph.nodes,
          edges: next.graph.edges
        }
      })
    },

    updateNodeData(id, data) {
      set((state) => ({
        nodes: state.nodes.map((node) => (node.id === id ? { ...node, data: { ...node.data, ...data } } : node))
      }))
    },

    setViewport(viewport) {
      set({ viewport })
    },

    setNodes(nodes) {
      set({ nodes })
    },

    setEdges(edges) {
      set({ edges })
    },

    addEdge(source, target, options) {
      const state = get()
      const edgeId = edgeIdFactory(source, target)
      const createdAt = clock()
      const next = connectCanvasNodes(snapshotFromState(state), {
        edgeId,
        source,
        target,
        createdAt,
        ...(options?.edgeType ? { edgeType: options.edgeType } : {}),
        ...(options?.imageRole ? { imageRole: options.imageRole } : {}),
        ...(options?.createdByMention ? { createdByMention: true } : {}),
      })

      if (!next.ok) {
        set({ lastConnectError: { reason: next.reason, at: createdAt } })
        return { ok: false, reason: next.reason }
      }

      set((current) => ({
        ...pushHistory(current),
        edges: next.graph.edges,
        lastConnectError: null
      }))

      return { ok: true, edgeId }
    },

    deleteEdge(id) {
      set((state) => ({
        ...pushHistory(state),
        edges: state.edges.filter((edge) => edge.id !== id)
      }))
    },

    applyChange(snapshot) {
      set((state) => ({
        ...pushHistory(state),
        nodes: cloneSnapshot(snapshot).nodes,
        edges: cloneSnapshot(snapshot).edges,
        viewport: cloneSnapshot(snapshot).viewport
      }))
    },

    undo() {
      set((state) => {
        const previous = state.past.at(-1)
        if (!previous) return {}

        return {
          ...cloneSnapshot(previous),
          past: state.past.slice(0, -1),
          future: [takeSnapshot(state), ...state.future].slice(0, maxHistory)
        }
      })
    },

    redo() {
      set((state) => {
        const next = state.future[0]
        if (!next) return {}

        return {
          ...cloneSnapshot(next),
          past: [...state.past, takeSnapshot(state)].slice(-maxHistory),
          future: state.future.slice(1)
        }
      })
    }
  }))
}

export const canvasStore = createCanvasStore()
