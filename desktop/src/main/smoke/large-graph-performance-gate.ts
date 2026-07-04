/**
 * Large graph smoke gates for the infinite canvas roadmap.
 * @see docs/architecture/infinite-canvas-architecture.md
 */

import { migrateDatabaseAtPath, openDatabaseAtPath } from '../db/migrate'
import { createWorkflowRepository } from '../db/repositories/workflow.repo'
import type { CanvasGraphEdge, CanvasGraphNode, CanvasGraphSnapshot } from '../../../../shared/graph'

export interface LargeGraphPerformanceGateOptions {
  dbPath: string
  nodeCounts: number[]
}

export interface LargeGraphGateResult {
  nodeCount: number
  edgeCount: number
  visibleNodeCount: number
  selectorStable: boolean
  draggedNodeId: string
  panViewport: { x: number; y: number; zoom: number }
  reopenedNodeCount: number
  reopenedEdgeCount: number
}

export interface LargeGraphPerformanceGateResult {
  desktopAcceptanceClaimed: false
  gates: LargeGraphGateResult[]
}

interface Bounds {
  x: number
  y: number
  width: number
  height: number
}

function createLargeGraph(nodeCount: number): CanvasGraphSnapshot {
  const nodes: CanvasGraphNode[] = []
  const edges: CanvasGraphEdge[] = []

  for (let index = 0; index < nodeCount; index += 1) {
    nodes.push({
      id: `node-${index}`,
      type: index % 2 === 0 ? 'text' : 'image',
      position: {
        x: (index % 25) * 280,
        y: Math.floor(index / 25) * 180
      },
      data: index % 2 === 0
        ? { label: `Text ${index}`, content: `Prompt ${index}` }
        : {
          label: `Image ${index}`,
          promptOverride: '',
          modelId: 'stub-image',
          orientation: 'landscape',
          assetId: null,
          status: 'idle'
        }
    })

    if (index > 0) {
      edges.push({
        id: `edge-${index - 1}-${index}`,
        source: `node-${index - 1}`,
        target: `node-${index}`,
        data: {
          edgeType: index % 2 === 1 ? 'promptOrder' : 'default',
          createdAt: 1_785_100_000_000 + index
        }
      })
    }
  }

  return {
    nodes,
    edges,
    viewport: { x: 0, y: 0, zoom: 1 }
  }
}

function nodeIntersects(node: CanvasGraphNode, bounds: Bounds): boolean {
  const width = 240
  const height = 140
  return node.position.x + width >= bounds.x
    && node.position.x <= bounds.x + bounds.width
    && node.position.y + height >= bounds.y
    && node.position.y <= bounds.y + bounds.height
}

function visibleNodeIds(graph: CanvasGraphSnapshot, viewport: Bounds): string[] {
  return graph.nodes
    .filter((node) => nodeIntersects(node, viewport))
    .map((node) => node.id)
}

function dragNode(graph: CanvasGraphSnapshot, nodeId: string, delta: { x: number; y: number }): CanvasGraphSnapshot {
  return {
    ...graph,
    nodes: graph.nodes.map((node) => node.id === nodeId
      ? { ...node, position: { x: node.position.x + delta.x, y: node.position.y + delta.y } }
      : node)
  }
}

/**
 * Runs deterministic large graph gates for 100/500/1000-style smoke coverage.
 * @param options - Database path and node counts to exercise.
 * @returns Gate summaries. This function intentionally does not claim desktop acceptance.
 * @throws Error when SQLite migration, graph persistence, or gate setup fails.
 */
export function runLargeGraphPerformanceGate(
  options: LargeGraphPerformanceGateOptions
): LargeGraphPerformanceGateResult {
  migrateDatabaseAtPath(options.dbPath)
  const db = openDatabaseAtPath(options.dbPath)

  try {
    const workflows = createWorkflowRepository(db)
    const gates: LargeGraphGateResult[] = []

    for (const nodeCount of options.nodeCounts) {
      const workflowId = `large-graph-${nodeCount}`
      const graph = createLargeGraph(nodeCount)
      const firstVisible = visibleNodeIds(graph, { x: 0, y: 0, width: 1400, height: 900 })
      const secondVisible = visibleNodeIds(graph, { x: 0, y: 0, width: 1400, height: 900 })
      const dragged = dragNode(graph, 'node-0', { x: 64, y: 48 })
      const panViewport = { x: -320, y: 180, zoom: 0.72 }
      const savedGraph = { ...dragged, viewport: panViewport }

      workflows.create({
        id: workflowId,
        name: `Large Graph ${nodeCount}`,
        createdAt: 1_785_100_000_000,
        updatedAt: 1_785_100_000_000
      })
      workflows.addVersion({
        id: `large-graph-version-${nodeCount}`,
        workflowId,
        graph: savedGraph,
        createdAt: 1_785_100_000_001,
        createdBy: 'large-graph-gate'
      })

      const reopened = workflows.getLatestVersion(workflowId)?.graph
      if (!reopened) {
        throw new Error(`large_graph_reopen_failed:${nodeCount}`)
      }

      gates.push({
        nodeCount,
        edgeCount: graph.edges.length,
        visibleNodeCount: firstVisible.length,
        selectorStable: JSON.stringify(firstVisible) === JSON.stringify(secondVisible),
        draggedNodeId: 'node-0',
        panViewport,
        reopenedNodeCount: reopened.nodes.length,
        reopenedEdgeCount: reopened.edges.length
      })
    }

    return {
      desktopAcceptanceClaimed: false,
      gates
    }
  } finally {
    db.close()
  }
}
