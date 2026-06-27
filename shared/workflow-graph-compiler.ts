/**
 * Deterministic workflow graph compiler for runtime prompt/reference snapshots.
 * @see docs/api-contracts/canvas-plan.md
 */

import type { CanvasGraphEdge, CanvasGraphNode, CanvasGraphSnapshot } from './graph'
import type {
  AudioNodeData,
  CanvasNodeData,
  CharacterNodeData,
  ImageNodeData,
  ImageRole,
  NodeType,
  SceneNodeData,
  TextNodeData,
  VideoNodeData,
} from './nodes'
import type { RunAction } from './plan'
import { composeStyledPrompt, resolveEffectiveStylePreset, type StylePresetView } from './styles'
import { getNodeDefinition } from './workflow-node-definitions'

export interface WorkflowPromptPart {
  /** Source node that contributed this prompt part. */
  nodeId: string
  /** Source node type. */
  nodeType: NodeType
  /** Human-readable label. */
  label: string
  /** Prompt text after normalization. */
  text: string
  /** Contribution source class. */
  source: 'upstream' | 'self'
  /** Stable one-based order. */
  order: number
  /** Edge ID when the part came from an upstream node. */
  edgeId?: string
}

export interface WorkflowReferenceSnapshot {
  /** Source node carrying the referenced asset. */
  nodeId: string
  /** Source node type. */
  nodeType: NodeType
  /** Stable asset identifier. */
  assetId: string
  /** Referenced media type. */
  mediaType: 'image' | 'video' | 'audio'
  /** Runtime role derived from edge metadata. */
  role: ImageRole | 'reference' | 'audio' | 'video'
  /** Stable one-based order within its media group. */
  order: number
  /** Edge ID when the reference came from an upstream node. */
  edgeId?: string
}

export interface WorkflowRuntimeSnapshot {
  /** Target node ID. */
  nodeId: string
  /** Target node type. */
  nodeType: NodeType
  /** Definition run action, if available. */
  runAction: RunAction | null
  /** Provider model key selected by the node. */
  modelKey: string | null
  /** Effective style preset ID after node override/project default resolution. */
  stylePresetId: string | null
  /** Final styled prompt sent to runtime. */
  prompt: string
  /** Ordered prompt parts before style wrapping. */
  promptParts: WorkflowPromptPart[]
  /** Ordered asset references for runtime payloads. */
  references: WorkflowReferenceSnapshot[]
  /** Runtime parameters including style negative prompt when applicable. */
  parameters: Record<string, unknown>
  /** Effective negative prompt, if any. */
  negativePrompt: string | null
}

export interface WorkflowGraphCompilerInput {
  /** Canvas graph snapshot. */
  graph: CanvasGraphSnapshot
  /** Target node ID. */
  nodeId: string
  /** Available style presets. */
  styles?: StylePresetView[]
  /** Project default style preset ID. */
  projectDefaultStylePresetId?: string | null
}

interface OrderedIncoming {
  edge: CanvasGraphEdge
  node: CanvasGraphNode
  order: number
}

function readLabel(data: CanvasNodeData, fallback: string): string {
  const label = 'label' in data ? data.label : null
  return typeof label === 'string' && label.trim().length > 0 ? label.trim() : fallback
}

function clean(value: string | null | undefined): string {
  return value?.trim() ?? ''
}

function explicitOrder(edge: CanvasGraphEdge, fallback: number): number {
  const data = edge.data
  if (typeof data.promptOrder === 'number' && Number.isFinite(data.promptOrder)) return data.promptOrder
  if (typeof data.imageOrder === 'number' && Number.isFinite(data.imageOrder)) return data.imageOrder
  return fallback
}

function sortedIncoming(graph: CanvasGraphSnapshot, nodeId: string): OrderedIncoming[] {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]))
  return graph.edges
    .filter((edge) => edge.target === nodeId)
    .sort((left, right) => {
      const leftOrder = explicitOrder(left, left.data.createdAt)
      const rightOrder = explicitOrder(right, right.data.createdAt)
      if (leftOrder !== rightOrder) return leftOrder - rightOrder
      return left.data.createdAt - right.data.createdAt
    })
    .flatMap((edge, index): OrderedIncoming[] => {
      const node = nodeById.get(edge.source)
      if (!node) return []
      return [{ edge, node, order: explicitOrder(edge, index + 1) }]
    })
}

function promptPartFromIncoming(input: OrderedIncoming): WorkflowPromptPart | null {
  const { edge, node, order } = input
  const label = readLabel(node.data, node.id)

  if (node.type === 'text') {
    const text = clean((node.data as TextNodeData).content)
    return text ? { nodeId: node.id, nodeType: node.type, label, text, source: 'upstream', order, edgeId: edge.id } : null
  }

  if (node.type === 'character') {
    const text = clean((node.data as CharacterNodeData).description)
    return text ? { nodeId: node.id, nodeType: node.type, label, text: `Character ${label}: ${text}`, source: 'upstream', order, edgeId: edge.id } : null
  }

  if (node.type === 'scene') {
    const text = clean((node.data as SceneNodeData).description)
    return text ? { nodeId: node.id, nodeType: node.type, label, text: `Scene ${label}: ${text}`, source: 'upstream', order, edgeId: edge.id } : null
  }

  return null
}

function assetIdFromNode(node: CanvasGraphNode): string | null {
  if (!('assetId' in node.data)) return null
  const assetId = node.data.assetId
  return typeof assetId === 'string' && assetId.trim().length > 0 ? assetId : null
}

function mediaTypeForNode(type: NodeType): WorkflowReferenceSnapshot['mediaType'] | null {
  if (type === 'video' || type === 'videoCompose' || type === 'superResolution' || type === 'muxAudioVideo') return 'video'
  if (type === 'audio') return 'audio'
  if (type === 'image' || type === 'imageConfigV2' || type === 'character' || type === 'scene') return 'image'
  return null
}

function roleForReference(edge: CanvasGraphEdge, mediaType: WorkflowReferenceSnapshot['mediaType']): WorkflowReferenceSnapshot['role'] {
  if (mediaType === 'audio') return 'audio'
  if (mediaType === 'video') return 'video'
  return edge.data.imageRole ?? 'reference'
}

function referenceFromIncoming(input: OrderedIncoming): WorkflowReferenceSnapshot | null {
  const assetId = assetIdFromNode(input.node)
  const mediaType = mediaTypeForNode(input.node.type)
  if (!assetId || !mediaType) return null

  return {
    nodeId: input.node.id,
    nodeType: input.node.type,
    assetId,
    mediaType,
    role: roleForReference(input.edge, mediaType),
    order: input.order,
    edgeId: input.edge.id,
  }
}

function selfPromptPart(node: CanvasGraphNode, order: number): WorkflowPromptPart | null {
  if (node.type === 'text') {
    const text = clean((node.data as TextNodeData).content)
    return text ? { nodeId: node.id, nodeType: node.type, label: readLabel(node.data, node.id), text, source: 'self', order } : null
  }

  if (node.type === 'image' || node.type === 'video' || node.type === 'imageConfigV2' || node.type === 'videoConfigV2') {
    const text = clean((node.data as ImageNodeData | VideoNodeData).promptOverride)
    return text ? { nodeId: node.id, nodeType: node.type, label: readLabel(node.data, node.id), text, source: 'self', order } : null
  }

  return null
}

function styleIdForNode(node: CanvasGraphNode, projectDefaultStylePresetId: string | null | undefined): string | null {
  const data = node.data as Partial<ImageNodeData | VideoNodeData>
  return clean(data.stylePresetId) || projectDefaultStylePresetId || null
}

function modelKeyForNode(node: CanvasGraphNode): string | null {
  const data = node.data as Partial<ImageNodeData | VideoNodeData | AudioNodeData>
  if (!('modelId' in data)) return null
  return clean(data.modelId) || null
}

function referenceSortGroup(reference: WorkflowReferenceSnapshot): number {
  if (reference.role === 'first_frame' || reference.role === 'last_frame') return 1
  if (reference.nodeType === 'image' || reference.nodeType === 'imageConfigV2') return 1
  return 0
}

function normalizeReferenceOrders(references: WorkflowReferenceSnapshot[]): WorkflowReferenceSnapshot[] {
  let semanticOrder = 0

  return references.map((reference) => {
    if (referenceSortGroup(reference) !== 0) return reference
    semanticOrder += 1
    return { ...reference, order: semanticOrder }
  })
}

function runtimeParameters(node: CanvasGraphNode): Record<string, unknown> {
  const parameters: Record<string, unknown> = {}
  const data = node.data as Partial<ImageNodeData | VideoNodeData>

  if (clean(data.orientation)) parameters.orientation = data.orientation
  if (clean(data.ratio)) parameters.ratio = data.ratio

  if (node.type === 'video' || node.type === 'videoConfigV2') {
    const videoData = node.data as Partial<VideoNodeData>
    if (typeof videoData.duration === 'number') parameters.duration = videoData.duration
    else if (typeof videoData.durationSeconds === 'number') parameters.durationSeconds = videoData.durationSeconds
    if (clean(videoData.resolution)) parameters.resolution = videoData.resolution
  }

  return parameters
}

/**
 * Compiles one target node into a deterministic runtime snapshot.
 * @param input - Graph, target node, and optional style context.
 * @returns Prompt/reference/runtime payload snapshot for the target node.
 * @throws Error when the target node is missing or style resolution fails.
 */
export function compileWorkflowNodeRuntimeSnapshot(input: WorkflowGraphCompilerInput): WorkflowRuntimeSnapshot {
  const node = input.graph.nodes.find((candidate) => candidate.id === input.nodeId)
  if (!node) {
    throw new Error(`Workflow node not found: ${input.nodeId}`)
  }

  const definition = getNodeDefinition(node.type)
  const incoming = sortedIncoming(input.graph, input.nodeId)
  const promptParts = incoming
    .map(promptPartFromIncoming)
    .filter((part): part is WorkflowPromptPart => part !== null)
  const self = selfPromptPart(node, promptParts.length + 1)
  if (self) promptParts.push(self)

  const basePrompt = [
    incoming.some((item) => mediaTypeForNode(item.node.type) === 'image' && assetIdFromNode(item.node)) ? '参考图像：' : '',
    incoming.some((item) => mediaTypeForNode(item.node.type) === 'video' && assetIdFromNode(item.node)) ? '参考视频：' : '',
    ...promptParts.map((part) => part.text),
  ].filter((part) => part.length > 0).join('\n')

  const styleResult = resolveEffectiveStylePreset({
    nodeStylePresetId: styleIdForNode(node, null),
    projectDefaultStylePresetId: input.projectDefaultStylePresetId ?? null,
    styles: input.styles ?? [],
  })
  if (styleResult && 'errorClass' in styleResult) {
    throw new Error(styleResult.message)
  }

  const parameters = runtimeParameters(node)
  if (styleResult?.negativePrompt) parameters.negativePrompt = styleResult.negativePrompt

  return {
    nodeId: node.id,
    nodeType: node.type,
    runAction: definition.runAction,
    modelKey: modelKeyForNode(node),
    stylePresetId: styleResult?.id ?? styleIdForNode(node, input.projectDefaultStylePresetId ?? null),
    prompt: composeStyledPrompt(basePrompt, styleResult),
    promptParts,
    references: normalizeReferenceOrders(incoming
      .map(referenceFromIncoming)
      .filter((reference): reference is WorkflowReferenceSnapshot => reference !== null)
      .sort((left, right) => {
        const leftGroup = referenceSortGroup(left)
        const rightGroup = referenceSortGroup(right)
        if (leftGroup !== rightGroup) return leftGroup - rightGroup
        if (left.mediaType !== right.mediaType) return left.mediaType.localeCompare(right.mediaType)
        if (left.order !== right.order) return left.order - right.order
        return left.nodeId.localeCompare(right.nodeId)
      })),
    parameters,
    negativePrompt: styleResult?.negativePrompt ?? null,
  }
}
