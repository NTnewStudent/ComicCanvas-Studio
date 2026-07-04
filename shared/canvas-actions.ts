/**
 * Canonical durable canvas graph mutation semantics shared by UI and tools.
 * @see docs/api-contracts/canvas-plan.md
 */

import { canConnect } from './connection-matrix'
import type { CanvasGraphEdge, CanvasGraphNode, CanvasGraphPosition, CanvasGraphSnapshot } from './graph'
import type { CanvasEdgeData, CanvasNodeData, EdgeType, ImageRole, NodeType } from './nodes'

export type CanvasActionFailureReason = 'node_not_found' | 'connection_not_allowed' | 'duplicate_edge'

export interface CanvasActionSuccess<T> {
  ok: true
  graph: CanvasGraphSnapshot
  result: T
}

export interface CanvasActionFailure {
  ok: false
  reason: CanvasActionFailureReason
}

export type CanvasActionResult<T> = CanvasActionSuccess<T> | CanvasActionFailure

/** Returns canonical default node data for manual UI and Agent-created nodes. */
export function defaultCanvasNodeData(type: NodeType, sequence: number): CanvasNodeData {
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
      inputVideoId: '',
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

/** Returns the canonical edge type for a new edge from a source node type. */
export function defaultCanvasEdgeType(sourceType: NodeType): EdgeType {
  if (sourceType === 'text') return 'promptOrder'
  if (sourceType === 'image' || sourceType === 'imageConfigV2') return 'imageRole'
  return 'default'
}

function cloneGraph(graph: CanvasGraphSnapshot): CanvasGraphSnapshot {
  return structuredClone(graph)
}

function getNode(graph: CanvasGraphSnapshot, nodeId: string): CanvasGraphNode | null {
  return graph.nodes.find((node) => node.id === nodeId) ?? null
}

function duplicateLabel(data: CanvasNodeData): string {
  const label = typeof data.label === 'string' && data.label.trim().length > 0 ? data.label : 'Node'
  return `${label} Copy`
}

function withLabel(data: CanvasNodeData, label: string): CanvasNodeData {
  return { ...data, label } as CanvasNodeData
}

export interface CreateCanvasNodeInput {
  nodeId: string
  type: NodeType
  position: CanvasGraphPosition
  data?: Partial<CanvasNodeData>
}

export interface CreateCanvasNodeResult {
  nodeId: string
}

/** Creates a node using canonical default data merged with caller data. */
export function createCanvasNode(graph: CanvasGraphSnapshot, input: CreateCanvasNodeInput): CanvasActionSuccess<CreateCanvasNodeResult> {
  const draft = cloneGraph(graph)
  const sequence = draft.nodes.filter((node) => node.type === input.type).length + 1
  draft.nodes.push({
    id: input.nodeId,
    type: input.type,
    position: input.position,
    data: { ...defaultCanvasNodeData(input.type, sequence), ...input.data } as CanvasNodeData
  })

  return { ok: true, graph: draft, result: { nodeId: input.nodeId } }
}

export interface ConnectCanvasNodesInput {
  edgeId: string
  source: string
  target: string
  edgeType?: EdgeType
  imageRole?: ImageRole
  createdAt: number
  createdByMention?: boolean
}

export interface ConnectCanvasNodesResult {
  edgeId: string
}

/** Connects two nodes using canonical matrix, duplicate, and edge-data rules. */
export function connectCanvasNodes(graph: CanvasGraphSnapshot, input: ConnectCanvasNodesInput): CanvasActionResult<ConnectCanvasNodesResult> {
  const source = getNode(graph, input.source)
  const target = getNode(graph, input.target)
  if (!source || !target) {
    return { ok: false, reason: 'node_not_found' }
  }

  if (graph.edges.some((edge) => edge.source === input.source && edge.target === input.target)) {
    return { ok: false, reason: 'duplicate_edge' }
  }

  if (!canConnect(source.type, target.type)) {
    return { ok: false, reason: 'connection_not_allowed' }
  }

  const data: CanvasEdgeData = {
    edgeType: input.edgeType ?? defaultCanvasEdgeType(source.type),
    createdAt: input.createdAt,
    ...(input.imageRole ? { imageRole: input.imageRole } : {}),
    ...(input.createdByMention ? { createdByMention: true } : {})
  }
  const draft = cloneGraph(graph)
  draft.edges.push({ id: input.edgeId, source: input.source, target: input.target, data })

  return { ok: true, graph: draft, result: { edgeId: input.edgeId } }
}

export interface DuplicateCanvasNodeInput {
  nodeId: string
  newNodeId: string
  offset: CanvasGraphPosition
}

/** Duplicates one node with canonical label and position semantics. */
export function duplicateCanvasNode(graph: CanvasGraphSnapshot, input: DuplicateCanvasNodeInput): CanvasActionSuccess<CreateCanvasNodeResult> {
  const node = getNode(graph, input.nodeId)
  if (!node) {
    throw new Error(`Canvas node not found: ${input.nodeId}`)
  }
  const draft = cloneGraph(graph)
  draft.nodes.push({
    id: input.newNodeId,
    type: node.type,
    position: { x: node.position.x + input.offset.x, y: node.position.y + input.offset.y },
    data: withLabel(structuredClone(node.data), duplicateLabel(node.data))
  })

  return { ok: true, graph: draft, result: { nodeId: input.newNodeId } }
}

export interface DeleteCanvasNodeInput {
  nodeId: string
}

export interface DeleteCanvasNodeResult {
  nodeId: string
  deletedEdgeIds: string[]
}

/** Deletes one node and all incident edges. */
export function deleteCanvasNode(graph: CanvasGraphSnapshot, input: DeleteCanvasNodeInput): CanvasActionSuccess<DeleteCanvasNodeResult> {
  if (!getNode(graph, input.nodeId)) {
    throw new Error(`Canvas node not found: ${input.nodeId}`)
  }
  const deletedEdgeIds = graph.edges
    .filter((edge) => edge.source === input.nodeId || edge.target === input.nodeId)
    .map((edge) => edge.id)
  const draft = cloneGraph(graph)
  draft.nodes = draft.nodes.filter((node) => node.id !== input.nodeId)
  draft.edges = draft.edges.filter((edge) => edge.source !== input.nodeId && edge.target !== input.nodeId)

  return { ok: true, graph: draft, result: { nodeId: input.nodeId, deletedEdgeIds } }
}
