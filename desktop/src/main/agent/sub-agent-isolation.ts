/**
 * Isolated sub-agent draft graph and parent-controlled merge helpers.
 * @see docs/api-contracts/agents.md
 * @see docs/api-contracts/canvas-plan.md
 */

import { canConnect } from '../../../../shared/connection-matrix'
import { isCanvasNodeType, type CanvasGraphEdge, type CanvasGraphNode, type CanvasGraphSnapshot } from '../../../../shared/graph'
import type { CanvasNodeData } from '../../../../shared/nodes'
import type { ChildDraftGraphArtifactDraft } from '../../../../shared/agents'
import type { WorkflowRepository } from '../db/repositories/workflow.repo'
import type { CanvasGraphStore } from '../tools/canvas'
import { sanitizeArtifactText, sanitizeGraphData, sanitizeUnknownGraphData } from './sanitize-graph'

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Rebuilds an unknown child graph payload from allowlisted fields and boundary-owned lineage. */
export function sanitizeDraftGraphArtifactPayload(
  value: unknown,
  lineage: ChildDraftGraphArtifactDraft['payload']['lineage']
): ChildDraftGraphArtifactDraft['payload'] {
  const dropped: string[] = []
  const source = isRecord(value) && isRecord(value.graph) ? value.graph : {}
  const nodes: CanvasGraphNode[] = []
  const nodeIds = new Set<string>()

  if (Array.isArray(source.nodes)) {
    source.nodes.forEach((entry, index) => {
      if (!isRecord(entry)) return dropped.push(`node[${index}]:invalid_object`)
      const id = sanitizeArtifactText(entry.id, `node[${index}].id`, dropped)
      const type = typeof entry.type === 'string' ? entry.type : ''
      const position = isRecord(entry.position) ? entry.position : {}
      if (!id || nodeIds.has(id) || !isCanvasNodeType(type)
        || typeof position.x !== 'number' || !Number.isFinite(position.x)
        || typeof position.y !== 'number' || !Number.isFinite(position.y)) {
        dropped.push(`node:${id || index}:invalid_node`)
        return
      }
      nodeIds.add(id)
      nodes.push({ id, type, position: { x: position.x, y: position.y }, data: sanitizeUnknownGraphData(entry.data, `node:${id}:data`, dropped) })
    })
  } else dropped.push('nodes:invalid_array')

  const nodeById = new Map(nodes.map((node) => [node.id, node]))
  const edgeIds = new Set<string>()
  const edges: CanvasGraphEdge[] = []
  if (Array.isArray(source.edges)) {
    source.edges.forEach((entry, index) => {
      if (!isRecord(entry)) return dropped.push(`edge[${index}]:invalid_object`)
      const id = sanitizeArtifactText(entry.id, `edge[${index}].id`, dropped)
      const sourceId = sanitizeArtifactText(entry.source, `edge[${index}].source`, dropped)
      const targetId = sanitizeArtifactText(entry.target, `edge[${index}].target`, dropped)
      const sourceNode = nodeById.get(sourceId)
      const targetNode = nodeById.get(targetId)
      if (!id || edgeIds.has(id) || !sourceNode || !targetNode || !canConnect(sourceNode.type, targetNode.type)) {
        dropped.push(`edge:${sourceId}->${targetId}:invalid_edge`)
        return
      }
      edgeIds.add(id)
      if (entry.data !== undefined) dropped.push(`edge:${id}:data:dropped`)
      edges.push({ id, source: sourceId, target: targetId, data: { edgeType: 'default', createdAt: 0 } })
    })
  } else dropped.push('edges:invalid_array')

  const viewport = isRecord(source.viewport) ? source.viewport : {}
  const safeViewport = {
    x: typeof viewport.x === 'number' && Number.isFinite(viewport.x) ? viewport.x : 0,
    y: typeof viewport.y === 'number' && Number.isFinite(viewport.y) ? viewport.y : 0,
    zoom: typeof viewport.zoom === 'number' && Number.isFinite(viewport.zoom) ? viewport.zoom : 1
  }
  const inheritedWarnings = isRecord(value) && Array.isArray(value.warnings)
    ? value.warnings.map((warning, index) => sanitizeArtifactText(warning, `warnings[${index}]`, dropped)).filter(Boolean)
    : []
  return { graph: { nodes, edges, viewport: safeViewport }, lineage: { ...lineage }, warnings: [...inheritedWarnings, ...dropped] }
}

/** Validates and normalizes a child graph artifact without allowing structural repair. */
export function sanitizeStrictChildDraftGraphArtifactPayload(
  value: unknown,
  lineage: ChildDraftGraphArtifactDraft['payload']['lineage']
): ChildDraftGraphArtifactDraft['payload'] | null {
  if (!isRecord(value)) return null
  const graph = value.graph
  if (!isRecord(graph) || !Array.isArray(graph.nodes)
    || !Array.isArray(graph.edges) || !isRecord(graph.viewport)
    || (value.warnings !== undefined && (!Array.isArray(value.warnings) || !value.warnings.every((warning) => typeof warning === 'string')))) {
    return null
  }

  if (typeof graph.viewport.x !== 'number' || !Number.isFinite(graph.viewport.x)
    || typeof graph.viewport.y !== 'number' || !Number.isFinite(graph.viewport.y)
    || typeof graph.viewport.zoom !== 'number' || !Number.isFinite(graph.viewport.zoom)) {
    return null
  }

  const nodes = new Map<string, string>()
  for (const node of graph.nodes) {
    const nodeType = isRecord(node) && typeof node.type === 'string' ? node.type : ''
    if (!isRecord(node) || typeof node.id !== 'string' || node.id.trim().length === 0
      || !isCanvasNodeType(nodeType) || !isRecord(node.position)
      || typeof node.position.x !== 'number' || !Number.isFinite(node.position.x)
      || typeof node.position.y !== 'number' || !Number.isFinite(node.position.y)
      || !isRecord(node.data) || nodes.has(node.id)) {
      return null
    }
    nodes.set(node.id, nodeType)
  }

  const edgeIds = new Set<string>()
  for (const edge of graph.edges) {
    if (!isRecord(edge) || typeof edge.id !== 'string' || edge.id.trim().length === 0
      || typeof edge.source !== 'string' || typeof edge.target !== 'string' || !isRecord(edge.data)
      || edgeIds.has(edge.id)) {
      return null
    }
    const sourceType = nodes.get(edge.source)
    const targetType = nodes.get(edge.target)
    if (!sourceType || !targetType || !isCanvasNodeType(sourceType) || !isCanvasNodeType(targetType)
      || !canConnect(sourceType, targetType)) {
      return null
    }
    edgeIds.add(edge.id)
  }

  return sanitizeDraftGraphArtifactPayload(value, lineage)
}

/** Builds a sanitized, child-owned graph proposal without applying it to the parent workflow. */
export function createDraftGraphArtifactDraft(
  draft: IsolatedSubAgentDraft
): ChildDraftGraphArtifactDraft {
  const sanitized = sanitizeDraftGraph(draft.getDraftGraph())
  return {
    kind: 'draftGraph',
    title: 'Child draft graph',
    summary: `Draft graph with ${sanitized.graph.nodes.length} node(s) and ${sanitized.graph.edges.length} edge(s).`,
    payload: {
      graph: sanitized.graph,
      lineage: {
        parentRunId: draft.parentRunId,
        childRunId: draft.childRunId,
        traceId: draft.traceId
      },
      warnings: sanitized.dropped
    }
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
