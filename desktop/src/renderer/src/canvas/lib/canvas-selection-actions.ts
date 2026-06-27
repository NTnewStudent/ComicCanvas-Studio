/**
 * Selection-level canvas edit actions shared by keyboard shortcuts and menus.
 * @see docs/api-contracts/canvas-plan.md
 */

import type { StoreApi } from 'zustand/vanilla'

import type { CanvasPosition, CanvasStoreState } from '../store/canvas.store'

export interface DuplicateSelectedCanvasNodesOptions {
  store: StoreApi<CanvasStoreState>
  selectedNodeIds: string[]
  idFactory?: () => string
  edgeIdFactory?: (source: string, target: string) => string
  offset?: CanvasPosition
}

export interface DuplicateSelectedCanvasNodesResult {
  duplicatedNodeIds: string[]
  duplicatedEdgeIds: string[]
}

export interface DeleteSelectedCanvasNodesOptions {
  store: StoreApi<CanvasStoreState>
  selectedNodeIds: string[]
}

export interface DeleteSelectedCanvasNodesResult {
  deletedNodeIds: string[]
  deletedEdgeIds: string[]
}

const defaultOffset: CanvasPosition = { x: 40, y: 40 }

/**
 * Duplicates selected nodes plus only edges fully inside the selected subgraph.
 * @returns Created node and edge identifiers.
 * @see docs/api-contracts/canvas-plan.md
 */
export function duplicateSelectedCanvasNodes({
  store,
  selectedNodeIds,
  idFactory = () => `node-${crypto.randomUUID()}`,
  edgeIdFactory = (source, target) => `edge-${source}-${target}-${Date.now()}`,
  offset = defaultOffset,
}: DuplicateSelectedCanvasNodesOptions): DuplicateSelectedCanvasNodesResult {
  const state = store.getState()
  const selected = new Set(selectedNodeIds)
  const sourceNodes = state.nodes.filter((node) => selected.has(node.id))
  if (sourceNodes.length === 0) {
    return { duplicatedNodeIds: [], duplicatedEdgeIds: [] }
  }

  const idMap = new Map<string, string>()
  const duplicatedNodes = sourceNodes.map((node) => {
    const nextId = idFactory()
    idMap.set(node.id, nextId)
    return {
      ...structuredClone(node),
      id: nextId,
      position: {
        x: node.position.x + offset.x,
        y: node.position.y + offset.y,
      },
    }
  })

  const duplicatedEdges = state.edges
    .filter((edge) => selected.has(edge.source) && selected.has(edge.target))
    .map((edge) => {
      const source = idMap.get(edge.source)
      const target = idMap.get(edge.target)
      if (!source || !target) return null
      return {
        ...structuredClone(edge),
        id: edgeIdFactory(source, target),
        source,
        target,
      }
    })
    .filter((edge): edge is NonNullable<typeof edge> => edge !== null)

  store.getState().applyChange({
    nodes: [...state.nodes, ...duplicatedNodes],
    edges: [...state.edges, ...duplicatedEdges],
    viewport: state.viewport,
  })

  return {
    duplicatedNodeIds: duplicatedNodes.map((node) => node.id),
    duplicatedEdgeIds: duplicatedEdges.map((edge) => edge.id),
  }
}

/**
 * Deletes selected nodes and all incident edges in a single undoable change.
 * @returns Deleted node and edge identifiers.
 * @see docs/api-contracts/canvas-plan.md
 */
export function deleteSelectedCanvasNodes({
  store,
  selectedNodeIds,
}: DeleteSelectedCanvasNodesOptions): DeleteSelectedCanvasNodesResult {
  const state = store.getState()
  const selected = new Set(selectedNodeIds)
  const deletedNodeIds = state.nodes.filter((node) => selected.has(node.id)).map((node) => node.id)
  if (deletedNodeIds.length === 0) {
    return { deletedNodeIds: [], deletedEdgeIds: [] }
  }

  const deletedEdges = state.edges.filter((edge) => selected.has(edge.source) || selected.has(edge.target))

  store.getState().applyChange({
    nodes: state.nodes.filter((node) => !selected.has(node.id)),
    edges: state.edges.filter((edge) => !selected.has(edge.source) && !selected.has(edge.target)),
    viewport: state.viewport,
  })

  return {
    deletedNodeIds,
    deletedEdgeIds: deletedEdges.map((edge) => edge.id),
  }
}
