import type { StoreApi } from 'zustand/vanilla'

import type { CanvasStoreEdge, CanvasStoreNode, CanvasStoreState } from '../store/canvas.store'

export interface CanvasSnippet {
  schemaVersion: 1
  name: string
  createdAt: number
  nodes: CanvasStoreNode[]
  edges: CanvasStoreEdge[]
}

export interface ExtractCanvasSnippetInput {
  name: string
  graph: Pick<CanvasStoreState, 'nodes' | 'edges'>
  selectedNodeIds: string[]
  createdAt: number
}

export interface InsertCanvasSnippetOptions {
  origin: { x: number; y: number }
  nodeIdFactory?: (node: CanvasStoreNode, index: number) => string
  edgeIdFactory?: (edge: CanvasStoreEdge, index: number) => string
}

export interface InsertCanvasSnippetResult {
  nodeIds: string[]
  edgeIds: string[]
  idMap: Record<string, string>
}

function normalizeSnippetNodes(nodes: CanvasStoreNode[]): CanvasStoreNode[] {
  const minX = Math.min(...nodes.map((node) => node.position.x))
  const minY = Math.min(...nodes.map((node) => node.position.y))

  return nodes.map((node) => ({
    ...structuredClone(node),
    position: {
      x: node.position.x - minX,
      y: node.position.y - minY,
    },
  }))
}

export function extractCanvasSnippet(input: ExtractCanvasSnippetInput): CanvasSnippet {
  const selectedIds = new Set(input.selectedNodeIds)
  const nodes = input.graph.nodes.filter((node) => selectedIds.has(node.id))

  if (nodes.length < 2) {
    throw new Error('snippet_requires_at_least_two_nodes')
  }

  const edges = input.graph.edges.filter((edge) => selectedIds.has(edge.source) && selectedIds.has(edge.target))

  return {
    schemaVersion: 1,
    name: input.name.trim() || 'Untitled snippet',
    createdAt: input.createdAt,
    nodes: normalizeSnippetNodes(nodes),
    edges: structuredClone(edges),
  }
}

export function insertCanvasSnippet(
  snippet: CanvasSnippet,
  store: StoreApi<CanvasStoreState>,
  options: InsertCanvasSnippetOptions,
): InsertCanvasSnippetResult {
  const nodeIdFactory = options.nodeIdFactory ?? ((node) => `snippet-${node.id}-${crypto.randomUUID()}`)
  const edgeIdFactory = options.edgeIdFactory ?? ((edge) => `snippet-${edge.id}-${crypto.randomUUID()}`)
  const idMap: Record<string, string> = {}
  const nodeIds: string[] = []
  const edgeIds: string[] = []

  const nextNodes = snippet.nodes.map((node, index) => {
    const id = nodeIdFactory(node, index)
    idMap[node.id] = id
    nodeIds.push(id)

    return {
      ...structuredClone(node),
      id,
      position: {
        x: options.origin.x + node.position.x,
        y: options.origin.y + node.position.y,
      },
    }
  })

  const nextEdges = snippet.edges.flatMap((edge, index) => {
    const source = idMap[edge.source]
    const target = idMap[edge.target]

    if (!source || !target) {
      return []
    }

    const id = edgeIdFactory(edge, index)
    edgeIds.push(id)

    return [{
      ...structuredClone(edge),
      id,
      source,
      target,
    }]
  })

  const current = store.getState()
  store.getState().applyChange({
    nodes: [...current.nodes, ...nextNodes],
    edges: [...current.edges, ...nextEdges],
    viewport: current.viewport,
  })

  return { nodeIds, edgeIds, idMap }
}
