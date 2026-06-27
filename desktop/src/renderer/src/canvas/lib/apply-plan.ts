/**
 * Renderer-side CanvasPlan applicator with local revalidation.
 * @see docs/api-contracts/canvas-plan.md
 */

import type { StoreApi } from 'zustand/vanilla'

import { canConnect } from '../../../../../../shared/connection-matrix'
import type { CanvasEdgeData, CanvasNodeData, EdgeType, ImageRole, NodeType } from '../../../../../../shared/nodes'
import type { CanvasPlan, PlanEdge, PlanNode, RunAction } from '../../../../../../shared/plan'
import type { CanvasSnapshot, CanvasStoreEdge, CanvasStoreNode, CanvasStoreState } from '../store/canvas.store'
import type { PlanRunnerStep } from './plan-runner'

const NODE_TYPES = new Set<NodeType>([
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
  'muxAudioVideo'
])
const EDGE_TYPES = new Set<EdgeType>(['promptOrder', 'imageOrder', 'imageRole', 'outputLink', 'reference', 'default'])
const IMAGE_ROLES = new Set<ImageRole>(['first_frame', 'last_frame', 'reference'])
const RUN_ACTIONS = new Set<RunAction>([
  'imageRun',
  'videoRun',
  'textPolish'
])

const BASE_X = 120
const COL_GAP = 320
const ROW_GAP = 260
const EXISTING_GAP_Y = 360

export interface ApplyCanvasPlanOptions {
  idFactory?: (ref: string, index: number) => string
  edgeIdFactory?: (edge: { source: string; target: string; edgeType: EdgeType }, index: number) => string
  clock?: () => number
}

export interface ApplyCanvasPlanResult {
  refToId: Record<string, string>
  appliedNodeIds: string[]
  appliedEdgeIds: string[]
  runSteps: PlanRunnerStep[]
  dropped: string[]
}

function defaultData(node: PlanNode): CanvasNodeData {
  if (node.type === 'text') {
    return {
      label: node.title,
      content: typeof node.data.content === 'string' ? node.data.content : String(node.data.promptOverride ?? '')
    }
  }

  if (node.type === 'image') {
    return {
      label: node.title,
      promptOverride: typeof node.data.promptOverride === 'string' ? node.data.promptOverride : '',
      modelId: typeof node.data.modelId === 'string' ? node.data.modelId : 'stub-image',
      orientation: node.data.orientation === 'portrait' || node.data.orientation === 'square' ? node.data.orientation : 'landscape',
      assetId: null,
      status: 'idle'
    }
  }

  if (node.type === 'video') {
    return {
      label: node.title,
      promptOverride: typeof node.data.promptOverride === 'string' ? node.data.promptOverride : '',
      modelId: typeof node.data.modelId === 'string' ? node.data.modelId : 'stub-video',
      orientation: node.data.orientation === 'portrait' || node.data.orientation === 'square' ? node.data.orientation : 'landscape',
      durationSeconds: typeof node.data.durationSeconds === 'number' && Number.isFinite(node.data.durationSeconds) ? node.data.durationSeconds : 3,
      firstFrameAssetId: null,
      lastFrameAssetId: null,
      assetId: null,
      status: 'idle'
    }
  }

  if (node.type === 'character') {
    return {
      label: node.title,
      description: typeof node.data.description === 'string' ? node.data.description : '',
      assetId: typeof node.data.assetId === 'string' ? node.data.assetId : null,
      ...(typeof node.data.url === 'string' ? { url: node.data.url } : {})
    }
  }

  if (node.type === 'scene') {
    return {
      label: node.title,
      description: typeof node.data.description === 'string' ? node.data.description : '',
      assetId: typeof node.data.assetId === 'string' ? node.data.assetId : null,
      ...(typeof node.data.url === 'string' ? { url: node.data.url } : {})
    }
  }

  if (node.type === 'audio') {
    return {
      label: node.title,
      assetId: typeof node.data.assetId === 'string' ? node.data.assetId : null,
      ...(typeof node.data.url === 'string' ? { url: node.data.url } : {}),
      ...(typeof node.data.durationSeconds === 'number' ? { durationSeconds: node.data.durationSeconds } : {}),
      status: 'idle'
    }
  }

  if (node.type === 'videoCompose') {
    return {
      label: node.title,
      inputOrder: Array.isArray(node.data.inputOrder) ? node.data.inputOrder.filter((value): value is string => typeof value === 'string') : [],
      transitionName: typeof node.data.transitionName === 'string' ? node.data.transitionName : null,
      modelId: typeof node.data.modelId === 'string' ? node.data.modelId : undefined,
      assetId: null,
      status: 'idle'
    }
  }

  if (node.type === 'superResolution') {
    const scene = node.data.scene === 'short_series' || node.data.scene === 'ugc' || node.data.scene === 'old_film' ? node.data.scene : 'aigc'
    const resolution = node.data.resolution === '720p' || node.data.resolution === '4k' ? node.data.resolution : '1080p'
    return {
      label: node.title,
      inputVideoId: typeof node.data.inputVideoId === 'string' ? node.data.inputVideoId : '',
      scene,
      resolution,
      fps: typeof node.data.fps === 'number' && Number.isFinite(node.data.fps) ? node.data.fps : 30,
      assetId: null,
      status: 'idle'
    }
  }

  if (node.type === 'muxAudioVideo') {
    return {
      label: node.title,
      modelId: typeof node.data.modelId === 'string' ? node.data.modelId : undefined,
      assetId: null,
      status: 'idle'
    }
  }

  if (node.type === 'mjImage') {
    return {
      label: node.title,
      prompt: typeof node.data.prompt === 'string' ? node.data.prompt : '',
      modelId: typeof node.data.modelId === 'string' ? node.data.modelId : 'stub-image',
      ratio: node.data.ratio === '9:16' || node.data.ratio === '3:4' || node.data.ratio === '1:1' || node.data.ratio === '4:3' || node.data.ratio === '21:9' ? node.data.ratio : '16:9',
      urls: [],
      selectedIndex: 0,
      assetId: null,
      status: 'idle'
    }
  }

  return {
    label: node.title,
    promptOverride: typeof node.data.promptOverride === 'string' ? node.data.promptOverride : '',
    modelId: typeof node.data.modelId === 'string' ? node.data.modelId : 'stub-video',
    orientation: node.data.orientation === 'portrait' || node.data.orientation === 'square' ? node.data.orientation : 'landscape',
    durationSeconds: typeof node.data.durationSeconds === 'number' && Number.isFinite(node.data.durationSeconds) ? node.data.durationSeconds : 3,
    firstFrameAssetId: null,
    lastFrameAssetId: null,
    assetId: null,
    status: 'idle'
  }
}

function computeLayers(nodes: PlanNode[], edges: PlanEdge[]): Map<string, number> {
  const upstream = new Map<string, string[]>()

  for (const edge of edges) {
    upstream.set(edge.target, [...(upstream.get(edge.target) ?? []), edge.source])
  }

  const cache = new Map<string, number>()
  const visiting = new Set<string>()

  function layerOf(ref: string): number {
    const cached = cache.get(ref)

    if (cached !== undefined) {
      return cached
    }

    if (visiting.has(ref)) {
      return 0
    }

    visiting.add(ref)

    const sources = upstream.get(ref) ?? []
    const layer = sources.length === 0 ? 0 : Math.max(...sources.map(layerOf)) + 1

    visiting.delete(ref)
    cache.set(ref, layer)

    return layer
  }

  return new Map(nodes.map((node) => [node.ref, layerOf(node.ref)]))
}

function filterNodes(plan: CanvasPlan, dropped: string[]): PlanNode[] {
  const seenRefs = new Set<string>()
  const nodes: PlanNode[] = []

  for (const node of plan.nodes) {
    if (!NODE_TYPES.has(node.type)) {
      dropped.push(`node:${node.ref || '<missing-ref>'}:unsupported_type`)
      continue
    }

    if (!node.ref) {
      dropped.push('node:<missing-ref>:missing_ref')
      continue
    }

    if (seenRefs.has(node.ref)) {
      dropped.push(`node:${node.ref}:duplicate_ref`)
      continue
    }

    seenRefs.add(node.ref)
    nodes.push(node)
  }

  return nodes
}

function filterEdges(plan: CanvasPlan, nodesByRef: ReadonlyMap<string, PlanNode>, dropped: string[]): PlanEdge[] {
  const edges: PlanEdge[] = []

  for (const edge of plan.edges) {
    const source = nodesByRef.get(edge.source)
    const target = nodesByRef.get(edge.target)
    const label = `${edge.source || '<missing-ref>'}->${edge.target || '<missing-ref>'}`

    if (!EDGE_TYPES.has(edge.edgeType)) {
      dropped.push(`edge:${label}:unsupported_edge_type`)
      continue
    }

    if (!source || !target) {
      dropped.push(`edge:${label}:missing_node`)
      continue
    }

    if (!canConnect(source.type, target.type)) {
      dropped.push(`edge:${label}:connection_rejected`)
      continue
    }

    if (edge.imageRole && !IMAGE_ROLES.has(edge.imageRole)) {
      dropped.push(`edge:${label}:unsupported_image_role`)
      continue
    }

    edges.push(edge)
  }

  return edges
}

function mapRunSteps(plan: CanvasPlan, refToId: Readonly<Record<string, string>>, dropped: string[]): PlanRunnerStep[] {
  const steps: PlanRunnerStep[] = []

  for (const step of plan.runSteps) {
    if (!RUN_ACTIONS.has(step.action)) {
      dropped.push(`runStep:${step.ref || '<missing-ref>'}:unsupported_action`)
      continue
    }

    const nodeId = refToId[step.ref]

    if (!nodeId) {
      dropped.push(`runStep:${step.ref || '<missing-ref>'}:missing_node`)
      continue
    }

    steps.push({ ref: step.ref, nodeId, action: step.action })
  }

  return steps
}

function baseYFor(snapshot: CanvasSnapshot): number {
  if (snapshot.nodes.length === 0) {
    return 120
  }

  return Math.max(...snapshot.nodes.map((node) => node.position.y)) + EXISTING_GAP_Y
}

/**
 * Applies a sanitized CanvasPlan to the canvas store as a single undoable snapshot.
 * @param plan - CanvasPlan from the orchestrator after backend sanitization.
 * @param store - Canvas store receiving the planned graph snapshot.
 * @param options - Deterministic ID, edge ID, and clock dependencies.
 * @returns Applied node/edge/run-step mapping plus local dropped records.
 * @throws Error never intentionally; invalid plan items are recorded in `dropped`.
 * @see docs/api-contracts/canvas-plan.md
 */
export function applyCanvasPlan(
  plan: CanvasPlan,
  store: StoreApi<CanvasStoreState>,
  options: ApplyCanvasPlanOptions = {}
): ApplyCanvasPlanResult {
  const dropped = [...plan.dropped]
  const nodes = filterNodes(plan, dropped)
  const nodesByRef = new Map(nodes.map((node) => [node.ref, node]))
  const edges = filterEdges(plan, nodesByRef, dropped)
  const layers = computeLayers(nodes, edges)
  const rowByLayer = new Map<number, number>()
  const current = store.getState()
  const nextNodes: CanvasStoreNode[] = [...current.nodes]
  const nextEdges: CanvasStoreEdge[] = [...current.edges]
  const refToId: Record<string, string> = {}
  const appliedNodeIds: string[] = []
  const appliedEdgeIds: string[] = []
  const clock = options.clock ?? Date.now
  const idFactory = options.idFactory ?? ((ref) => `plan-node-${ref}`)
  const edgeIdFactory = options.edgeIdFactory ?? ((edge) => `plan-edge-${edge.source}-${edge.target}`)
  const baseY = baseYFor(current)

  nodes.forEach((node, index) => {
    const layer = layers.get(node.ref) ?? 0
    const row = rowByLayer.get(layer) ?? 0
    rowByLayer.set(layer, row + 1)

    const id = idFactory(node.ref, index)
    refToId[node.ref] = id
    appliedNodeIds.push(id)
    nextNodes.push({
      id,
      type: node.type,
      position: {
        x: BASE_X + layer * COL_GAP,
        y: baseY + row * ROW_GAP
      },
      data: defaultData(node)
    })
  })

  edges.forEach((edge, index) => {
    const source = refToId[edge.source]
    const target = refToId[edge.target]

    if (!source || !target) {
      return
    }

    const id = edgeIdFactory({ source, target, edgeType: edge.edgeType }, index)
    const data: CanvasEdgeData = {
      edgeType: edge.edgeType,
      createdAt: clock()
    }

    if (edge.imageRole) {
      data.imageRole = edge.imageRole
    }

    appliedEdgeIds.push(id)
    nextEdges.push({ id, source, target, data })
  })

  store.getState().applyChange({
    nodes: nextNodes,
    edges: nextEdges,
    viewport: current.viewport
  })

  return {
    refToId,
    appliedNodeIds,
    appliedEdgeIds,
    runSteps: mapRunSteps(plan, refToId, dropped),
    dropped
  }
}
