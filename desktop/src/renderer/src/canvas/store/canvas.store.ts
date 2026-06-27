/**
 * Renderer canvas state store for nodes, edges, viewport, and undo history.
 * @see docs/api-contracts/canvas-plan.md
 */

import { createStore, type StoreApi } from 'zustand/vanilla'

import { canConnect } from '../../../../../../shared/connection-matrix'
import type { CanvasEdgeData, CanvasNodeData, EdgeType, NodeStatus, NodeType } from '../../../../../../shared/nodes'

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

export type ConnectFailureReason = 'node_not_found' | 'connection_not_allowed' | 'duplicate_edge'

export type ConnectResult = { ok: true; edgeId: string } | { ok: false; reason: ConnectFailureReason }

export interface CanvasStoreOptions {
  idFactory?: () => string
  edgeIdFactory?: (source: string, target: string) => string
  clock?: () => number
}

export interface CanvasStoreState extends CanvasSnapshot {
  past: CanvasSnapshot[]
  future: CanvasSnapshot[]
  lastConnectError: { reason: ConnectFailureReason; at: number } | null
  /** 节点运行状态（运行时数据，不参与 undo/redo） */
  nodeRunStatus: Map<string, NodeStatus>
  addNode(this: void, type: NodeType, position: CanvasPosition, data?: Partial<CanvasNodeData>): string
  deleteNode(this: void, id: string): void
  updateNodeData(this: void, id: string, data: Partial<CanvasNodeData>): void
  setViewport(this: void, viewport: CanvasViewport): void
  /** Batch-replace nodes (used by debounced persistence from ReactFlow) */
  setNodes(this: void, nodes: CanvasStoreNode[]): void
  /** Batch-replace edges (used by debounced persistence from ReactFlow) */
  setEdges(this: void, edges: CanvasStoreEdge[]): void
  addEdge(this: void, source: string, target: string): ConnectResult
  deleteEdge(this: void, id: string): void
  applyChange(this: void, snapshot: CanvasSnapshot): void
  undo(this: void): void
  redo(this: void): void
  /** 设置指定节点的运行状态 */
  setNodeRunStatus(this: void, nodeId: string, status: NodeStatus): void
  /** 获取指定节点的运行状态（未登记时返回 'idle'） */
  getNodeRunStatus(this: void, nodeId: string): NodeStatus
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

function defaultData(type: NodeType, sequence: number): CanvasNodeData {
  if (type === 'text') {
    return { label: `Text ${sequence}`, content: '' }
  }

  if (type === 'character') {
    return { label: `Character ${sequence}`, description: '', assetId: null, tags: [] }
  }

  if (type === 'scene') {
    return { label: `Scene ${sequence}`, description: '', assetId: null, category: '' }
  }

  if (type === 'audio') {
    return { label: `Audio ${sequence}`, assetId: null, durationSeconds: 0, status: 'idle' }
  }

  if (type === 'videoCompose') {
    return {
      label: `Video Compose ${sequence}`,
      inputOrder: [],
      transitionName: null,
      modelId: 'stub-compose',
      assetId: null,
      status: 'idle'
    }
  }

  if (type === 'superResolution') {
    return {
      label: `Super Resolution ${sequence}`,
      scene: 'aigc',
      resolution: '1080p',
      fps: 30,
      assetId: null,
      status: 'idle'
    }
  }

  if (type === 'muxAudioVideo') {
    return { label: `Mux Audio Video ${sequence}`, modelId: 'stub-mux', assetId: null, status: 'idle' }
  }

  if (type === 'mjImage') {
    return {
      label: `MJ Image ${sequence}`,
      prompt: '',
      modelId: 'stub-mj',
      ratio: '16:9',
      urls: [],
      selectedIndex: 0,
      assetId: null,
      status: 'idle'
    }
  }

  if (type === 'image' || type === 'imageConfigV2') {
    return {
      label: type === 'imageConfigV2' ? `生图 ${sequence}` : `Image ${sequence}`,
      promptOverride: '',
      modelId: 'stub-image',
      orientation: 'landscape',
      assetId: null,
      status: 'idle'
    }
  }

  return {
    label: type === 'videoConfigV2' ? `生视频 ${sequence}` : `Video ${sequence}`,
    promptOverride: '',
    modelId: 'stub-video',
    orientation: 'landscape',
    durationSeconds: 3,
    firstFrameAssetId: null,
    lastFrameAssetId: null,
    assetId: null,
    status: 'idle'
  }
}

function edgeTypeFor(source: NodeType): EdgeType {
  if (source === 'text') return 'promptOrder'
  if (source === 'image' || source === 'imageConfigV2') return 'imageRole'
  return 'default'
}

function findNodeType(nodes: CanvasStoreNode[], id: string): NodeType | null {
  return nodes.find((node) => node.id === id)?.type ?? null
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
    nodeRunStatus: new Map<string, NodeStatus>(),

    addNode(type, position, data) {
      const id = idFactory()

      set((state) => {
        const sequence = state.nodes.filter((node) => node.type === type).length + 1
        const node: CanvasStoreNode = {
          id,
          type,
          position,
          data: { ...defaultData(type, sequence), ...data }
        }

        return {
          ...pushHistory(state),
          nodes: [...state.nodes, node]
        }
      })

      return id
    },

    deleteNode(id) {
      set((state) => ({
        ...pushHistory(state),
        nodes: state.nodes.filter((node) => node.id !== id),
        edges: state.edges.filter((edge) => edge.source !== id && edge.target !== id)
      }))
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

    addEdge(source, target) {
      const state = get()
      const sourceType = findNodeType(state.nodes, source)
      const targetType = findNodeType(state.nodes, target)

      if (!sourceType || !targetType) {
        set({ lastConnectError: { reason: 'node_not_found', at: clock() } })
        return { ok: false, reason: 'node_not_found' }
      }

      if (state.edges.some((edge) => edge.source === source && edge.target === target)) {
        set({ lastConnectError: { reason: 'duplicate_edge', at: clock() } })
        return { ok: false, reason: 'duplicate_edge' }
      }

      if (!canConnect(sourceType, targetType)) {
        set({ lastConnectError: { reason: 'connection_not_allowed', at: clock() } })
        return { ok: false, reason: 'connection_not_allowed' }
      }

      const edgeId = edgeIdFactory(source, target)
      const edge: CanvasStoreEdge = {
        id: edgeId,
        source,
        target,
        data: {
          edgeType: edgeTypeFor(sourceType),
          createdAt: clock()
        }
      }

      set((current) => ({
        ...pushHistory(current),
        edges: [...current.edges, edge],
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
    },

    setNodeRunStatus(nodeId, status) {
      set((state) => {
        const next = new Map(state.nodeRunStatus)
        next.set(nodeId, status)
        return { nodeRunStatus: next }
      })
    },

    getNodeRunStatus(nodeId) {
      return get().nodeRunStatus.get(nodeId) ?? 'idle'
    }
  }))
}

export const canvasStore = createCanvasStore()
