/**
 * Isolated sub-agent draft graph and parent-controlled merge helpers.
 * @see docs/api-contracts/agents.md
 * @see docs/api-contracts/canvas-plan.md
 */

import { canConnect } from '../../../../shared/connection-matrix'
import type { CanvasGraphEdge, CanvasGraphNode, CanvasGraphSnapshot } from '../../../../shared/graph'
import type { CanvasNodeData } from '../../../../shared/nodes'
import type { WorkflowRepository } from '../db/repositories/workflow.repo'
import type { CanvasGraphStore } from '../tools/canvas'
import { sanitizeGraphData } from './sanitize-graph'

export interface IsolatedSubAgentDraftInput {
  parentGraph: CanvasGraphSnapshot
  parentRunId: string
  childRunId: string
  traceId: string
}

export interface IsolatedSubAgentDraft {
  parentRunId: string
  childRunId: string
  traceId: string
  graphStore: CanvasGraphStore
  getDraftGraph(): CanvasGraphSnapshot
}

export interface ApplySubAgentResultInput {
  draft: IsolatedSubAgentDraft
  workflows: WorkflowRepository
  projectId: string
  graphVersionId: string
  createdAt: number
  createdBy: string
}

export interface ApplySubAgentResultOutput {
  graphVersion: string
  appliedNodeIds: string[]
  appliedEdgeIds: string[]
  dropped: string[]
  traceId: string
}

function cloneGraph(graph: CanvasGraphSnapshot): CanvasGraphSnapshot {
  return structuredClone(graph)
}

function sanitizeNodeData(node: CanvasGraphNode, dropped: string[]): CanvasNodeData {
  return sanitizeGraphData(node.data, `node:${node.id}:data`, dropped)
}

function sanitizeNode(node: CanvasGraphNode, dropped: string[]): CanvasGraphNode {
  return {
    id: node.id,
    type: node.type,
    position: node.position,
    data: sanitizeNodeData(node, dropped)
  }
}

function sanitizeEdges(graph: CanvasGraphSnapshot, dropped: string[]): CanvasGraphEdge[] {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]))

  return graph.edges.filter((edge) => {
    const source = nodeById.get(edge.source)
    const target = nodeById.get(edge.target)

    if (!source || !target) {
      dropped.push(`edge:${edge.source}->${edge.target}:missing_node`)
      return false
    }

    if (!canConnect(source.type, target.type)) {
      dropped.push(`edge:${edge.source}->${edge.target}:connection_rejected`)
      return false
    }

    return true
  })
}

function sanitizeDraftGraph(graph: CanvasGraphSnapshot): { graph: CanvasGraphSnapshot; dropped: string[] } {
  const dropped: string[] = []
  const nodes = graph.nodes.map((node) => sanitizeNode(node, dropped))
  const nextGraph = {
    nodes,
    edges: graph.edges,
    viewport: graph.viewport
  }

  return {
    graph: {
      nodes,
      edges: sanitizeEdges(nextGraph, dropped),
      viewport: graph.viewport
    },
    dropped
  }
}

/**
 * Creates an isolated mutable draft graph for a child agent run.
 * @param input - Parent graph and trace metadata used to seed the child draft.
 * @returns Draft graph facade consumable by built-in canvas tools.
 * @throws Error never intentionally; cloning errors propagate if graph is not structured-cloneable.
 * @see docs/api-contracts/agents.md
 */
export function createIsolatedSubAgentDraft(input: IsolatedSubAgentDraftInput): IsolatedSubAgentDraft {
  let draftGraph = cloneGraph(input.parentGraph)

  return {
    parentRunId: input.parentRunId,
    childRunId: input.childRunId,
    traceId: input.traceId,
    graphStore: {
      getGraph() {
        return cloneGraph(draftGraph)
      },
      setGraph(graph) {
        draftGraph = cloneGraph(graph)
      }
    },
    getDraftGraph() {
      return cloneGraph(draftGraph)
    }
  }
}

/**
 * Sanitizes and persists a child draft graph only after parent-controlled merge.
 * @param input - Child draft, target workflow repository, version metadata, and author.
 * @returns Merge result with applied IDs, dropped records, and trace correlation.
 * @throws Error when the workflow repository rejects the new graph version.
 * @see docs/api-contracts/agents.md
 * @see docs/api-contracts/canvas-plan.md
 */
export function applySubAgentResult(input: ApplySubAgentResultInput): ApplySubAgentResultOutput {
  const sanitized = sanitizeDraftGraph(input.draft.getDraftGraph())

  input.workflows.addVersion({
    id: input.graphVersionId,
    workflowId: input.projectId,
    graph: sanitized.graph,
    createdAt: input.createdAt,
    createdBy: input.createdBy
  })

  return {
    graphVersion: input.graphVersionId,
    appliedNodeIds: sanitized.graph.nodes.map((node) => node.id),
    appliedEdgeIds: sanitized.graph.edges.map((edge) => edge.id),
    dropped: sanitized.dropped,
    traceId: input.draft.traceId
  }
}
