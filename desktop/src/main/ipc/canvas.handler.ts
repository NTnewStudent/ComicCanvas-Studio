/**
 * Canvas IPC handler skeleton.
 * @see docs/api-contracts/canvas-plan.md
 */

import type { JobTicket, JobType } from '../../../../shared/jobs'
import type { CanvasPlan, PlanRunStep } from '../../../../shared/plan'
import { canConnect } from '../../../../shared/connection-matrix'
import { isCanvasNodeType, sanitizeCanvasGraphSnapshot, type CanvasGraphEdge, type CanvasGraphNode, type CanvasGraphSnapshot, type CanvasSaveGraphRequest } from '../../../../shared/graph'
import type {
  AudioNodeData,
  ImageNodeData,
  MjImageNodeData,
  MuxAudioVideoNodeData,
  NodeType,
  SuperResolutionNodeData,
  VideoComposeNodeData,
  VideoNodeData,
} from '../../../../shared/nodes'
import { composeFinalPrompt } from '../../../../shared/composed-prompt'
import { composeStyledPrompt, resolveEffectiveStylePreset } from '../../../../shared/styles'
import type { IpcRegistrar } from './types'
import type { WorkflowRepository } from '../db/repositories/workflow.repo'
import type { AssetRepository } from '../db/repositories/asset.repo'
import type { StyleRepository } from '../db/repositories/style.repo'
import type { OrchestratorRuntime } from '../agent/orchestrator'
import type { JobQueue } from '../jobs/queue'
import type { CanvasGraphStore } from '../tools/canvas'

function createPendingTicket(jobId: string): JobTicket {
  return {
    jobId,
    status: 'pending',
    createdAt: 1
  }
}

/** Dependencies used by canvas IPC handlers. */
export interface CanvasHandlerDependencies {
  /** Workflow repository for graph version persistence. */
  workflows?: WorkflowRepository
  /** Orchestrator runtime used by chat-to-plan IPC. */
  orchestrator?: Pick<OrchestratorRuntime, 'chatSend' | 'getPlan'>
  /** Durable local job queue used by runNode IPC. */
  queue?: Pick<JobQueue, 'enqueue'>
  /** Clock used for deterministic version timestamps. */
  clock?: () => number
  /** ID factory used for graph version IDs. */
  idFactory?: () => string
  /** Current user identifier stored as graph version author. */
  currentUserId?: string
  /** Node ID factory used when applying plan nodes to the graph. */
  nodeIdFactory?: () => string
  /** Asset repository for resolving cloud URLs on reference assets. */
  assets?: AssetRepository
  /** Graph store for reading current canvas node data. */
  graphStore?: Pick<CanvasGraphStore, 'getGraph'>
  /** Style repository for project defaults and runtime prompt injection. */
  styles?: Pick<StyleRepository, 'list' | 'getProjectDefault'>
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function defaultGraph(): CanvasGraphSnapshot {
  return { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } }
}

function unsafeWorkflowJson(value: unknown): boolean {
  return /([A-Za-z]:\\|file:\/\/|\/Users\/|\/tmp\/)/u.test(JSON.stringify(value))
}

function sanitizeGraphWithDropped(graph: CanvasGraphSnapshot): { graph: CanvasGraphSnapshot; dropped: string[] } {
  const sanitized = sanitizeCanvasGraphSnapshot(graph)
  const sanitizedNodeIds = new Set(sanitized.nodes.map((node) => node.id))
  const sanitizedEdgeIds = new Set(sanitized.edges.map((edge) => edge.id))
  const dropped: string[] = []

  for (const node of graph.nodes) {
    if (!isCanvasNodeType(String(node.type))) {
      dropped.push(`node:${node.id}:unsupported_type`)
    }
  }

  for (const edge of graph.edges) {
    if (!sanitizedEdgeIds.has(edge.id)) {
      dropped.push(`edge:${edge.id}:invalid_connection`)
    }
  }

  return {
    graph: {
      ...sanitized,
      edges: sanitized.edges.filter((edge) => sanitizedNodeIds.has(edge.source) && sanitizedNodeIds.has(edge.target)),
    },
    dropped,
  }
}

function parseWorkflowImportJson(json: string): { name: string; graph: CanvasGraphSnapshot } | null {
  try {
    const parsed = JSON.parse(json) as unknown
    if (!isObject(parsed) || !isObject(parsed.graph)) {
      return null
    }
    const graph = parsed.graph as unknown as CanvasGraphSnapshot
    if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges) || !isObject(graph.viewport)) {
      return null
    }
    const name = typeof parsed.name === 'string' && parsed.name.trim().length > 0 ? parsed.name : 'Imported workflow'
    return { name, graph }
  } catch {
    return null
  }
}

function defaultClarifyPlan(): CanvasPlan {
  return {
    kind: 'clarify',
    summary: 'The orchestrator runtime is not available.',
    nodes: [],
    edges: [],
    runSteps: [],
    question: '请稍后重试。',
    dropped: []
  }
}

function parseSaveGraphRequest(request: unknown): CanvasSaveGraphRequest {
  if (!isObject(request) || typeof request.projectId !== 'string' || !isObject(request.graph)) {
    return { projectId: 'default', graph: defaultGraph() }
  }

  return request as unknown as CanvasSaveGraphRequest
}

/**
 * Resolves GatewayReference[] from a node's data and the asset repository.
 * For video nodes: reads referenceAssets from VideoNodeData.
 * For all nodes: also looks up connected edges with imageRole to find upstream image references.
 * Falls back to local safeUrl when no cloud URL is available.
 */
function resolveNodeReferences(
  nodeId: string,
  deps: CanvasHandlerDependencies,
  workflowId = 'default'
): Array<{ assetId: string; role: string; url: string; mediaType: string }> {
  const graphStore = deps.graphStore
  const assets = deps.assets
  if (!graphStore) {
    return []
  }

  const graph = graphStore.getGraph(workflowId)
  const node = graph.nodes.find((n) => n.id === nodeId)
  if (!node) {
    return []
  }

  const result: Array<{ assetId: string; role: string; url: string; mediaType: string }> = []
  const seen = new Set<string>()

  // 1. Resolve from VideoNodeData.referenceAssets
  const nodeData = node.data as Partial<VideoNodeData>
  if (Array.isArray(nodeData.referenceAssets)) {
    for (const refAsset of nodeData.referenceAssets) {
      if (seen.has(refAsset.id)) continue
      seen.add(refAsset.id)

      const assetRecord = assets?.getById(refAsset.id)
      const url = assetRecord?.url ?? refAsset.url ?? assetRecord?.safeUrl ?? ''
      result.push({
        assetId: refAsset.id,
        role: 'reference',
        url,
        mediaType: refAsset.type
      })
    }
  }

  // 2. Resolve firstFrame/lastFrame from VideoNodeData asset IDs
  if (typeof nodeData.firstFrameAssetId === 'string' && nodeData.firstFrameAssetId.length > 0) {
    const assetRecord = assets?.getById(nodeData.firstFrameAssetId)
    if (assetRecord && !seen.has(assetRecord.id)) {
      seen.add(assetRecord.id)
      result.push({
        assetId: assetRecord.id,
        role: 'first_frame',
        url: assetRecord.url ?? assetRecord.safeUrl,
        mediaType: assetRecord.mediaType
      })
    }
  }
  if (typeof nodeData.lastFrameAssetId === 'string' && nodeData.lastFrameAssetId.length > 0) {
    const assetRecord = assets?.getById(nodeData.lastFrameAssetId)
    if (assetRecord && !seen.has(assetRecord.id)) {
      seen.add(assetRecord.id)
      result.push({
        assetId: assetRecord.id,
        role: 'last_frame',
        url: assetRecord.url ?? assetRecord.safeUrl,
        mediaType: assetRecord.mediaType
      })
    }
  }

  // 3. Resolve from incoming edges with imageRole (upstream image nodes)
  for (const edge of graph.edges) {
    if (edge.target !== nodeId || !edge.data.imageRole) continue
    const sourceNode = graph.nodes.find((n) => n.id === edge.source)
    if (!sourceNode) continue

    const sourceData = sourceNode.data as { assetId?: string | null }
    if (typeof sourceData.assetId !== 'string' || sourceData.assetId.length === 0) continue
    if (seen.has(sourceData.assetId)) continue
    seen.add(sourceData.assetId)

    const assetRecord = assets?.getById(sourceData.assetId)
    if (assetRecord) {
      result.push({
        assetId: assetRecord.id,
        role: edge.data.imageRole,
        url: assetRecord.url ?? assetRecord.safeUrl,
        mediaType: assetRecord.mediaType
      })
    }
  }

  return result
}

function readOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined
}

function readWorkflowId(request: unknown): string {
  return isObject(request) && typeof request.workflowId === 'string' && request.workflowId.trim().length > 0
    ? request.workflowId
    : 'default'
}

interface CanvasRunDescriptor {
  type: JobType
  payload: Record<string, unknown>
}

interface RuntimeInputRef {
  nodeId: string
  role: 'video' | 'audio' | 'image' | 'reference'
  assetId?: string
  url?: string
  mediaType?: string
}

function resolveAssetUrl(assetId: string | null | undefined, deps: CanvasHandlerDependencies, fallback?: string): string | undefined {
  if (!assetId) return fallback
  const assetRecord = deps.assets?.getById(assetId)
  return assetRecord?.url ?? assetRecord?.safeUrl ?? fallback
}

function referencePayloadFromComposed(
  composed: ReturnType<typeof composeFinalPrompt>,
  deps: CanvasHandlerDependencies
): Array<{ assetId: string; role: string; url?: string; mediaType: string }> {
  const refs: Array<{ assetId: string; role: string; url?: string; mediaType: string }> = []
  for (const ref of composed.referenceImages) {
    const url = resolveAssetUrl(ref.assetId, deps)
    refs.push({ assetId: ref.assetId, role: 'reference', ...(url ? { url } : {}), mediaType: 'image' })
  }
  for (const ref of composed.referenceVideos) {
    const url = resolveAssetUrl(ref.assetId, deps)
    refs.push({ assetId: ref.assetId, role: 'reference', ...(url ? { url } : {}), mediaType: 'video' })
  }
  return refs
}

function inputRefFromNode(node: CanvasGraphNode, deps: CanvasHandlerDependencies): RuntimeInputRef | null {
  if (node.type === 'video' || node.type === 'videoCompose' || node.type === 'superResolution' || node.type === 'muxAudioVideo') {
    const data = node.data as Partial<VideoNodeData | VideoComposeNodeData | SuperResolutionNodeData | MuxAudioVideoNodeData>
    const url = resolveAssetUrl(data.assetId, deps, data.url)
    return {
      nodeId: node.id,
      role: 'video',
      ...(data.assetId ? { assetId: data.assetId } : {}),
      ...(url ? { url } : {}),
    }
  }

  if (node.type === 'audio') {
    const data = node.data as AudioNodeData
    const url = resolveAssetUrl(data.assetId, deps, data.url)
    return {
      nodeId: node.id,
      role: 'audio',
      ...(data.assetId ? { assetId: data.assetId } : {}),
      ...(url ? { url } : {}),
    }
  }

  if (node.type === 'image' || node.type === 'mjImage') {
    const data = node.data as Partial<ImageNodeData | MjImageNodeData>
    const url = resolveAssetUrl(data.assetId, deps, data.url)
    return {
      nodeId: node.id,
      role: 'image',
      ...(data.assetId ? { assetId: data.assetId } : {}),
      ...(url ? { url } : {}),
    }
  }

  return null
}

function incomingInputs(
  graph: CanvasGraphSnapshot,
  nodeId: string,
  deps: CanvasHandlerDependencies,
  allowedTypes: NodeType[],
  orderedNodeIds?: string[]
): RuntimeInputRef[] {
  const edgeSources = graph.edges
    .filter((edge) => edge.target === nodeId)
    .sort((a, b) => a.data.createdAt - b.data.createdAt)
    .map((edge) => edge.source)

  const orderedSources = orderedNodeIds?.length
    ? [...orderedNodeIds.filter((id) => edgeSources.includes(id)), ...edgeSources.filter((id) => !orderedNodeIds.includes(id))]
    : edgeSources

  const inputs: RuntimeInputRef[] = []
  const seen = new Set<string>()

  for (const sourceId of orderedSources) {
    if (seen.has(sourceId)) continue
    seen.add(sourceId)
    const sourceNode = graph.nodes.find((candidate) => candidate.id === sourceId)
    if (!sourceNode || !allowedTypes.includes(sourceNode.type)) continue
    const input = inputRefFromNode(sourceNode, deps)
    if (input) inputs.push(input)
  }

  return inputs
}

function buildRunDescriptor(
  nodeId: string,
  deps: CanvasHandlerDependencies,
  workflowId = 'default'
): CanvasRunDescriptor {
  const graph = deps.graphStore?.getGraph(workflowId)
  const node = graph?.nodes.find((candidate) => candidate.id === nodeId)
  if (!graph || !node) {
    return { type: 'canvas.generateImage', payload: { nodeId, references: [] } }
  }

  const composed = composeFinalPrompt(graph, nodeId)
  const references = [
    ...referencePayloadFromComposed(composed, deps),
    ...resolveNodeReferences(nodeId, deps, workflowId),
  ]

  if (node.type === 'videoCompose') {
    const data = node.data as VideoComposeNodeData
    const parameters: Record<string, unknown> = {}
    if (data.transitionName) parameters.transitionName = data.transitionName
    return {
      type: 'canvas.composeVideo',
      payload: {
        nodeId,
        nodeType: node.type,
        ...(readOptionalString(data.modelId) ? { modelKey: data.modelId } : {}),
        inputs: incomingInputs(graph, nodeId, deps, ['video'], data.inputOrder),
        parameters,
      },
    }
  }

  if (node.type === 'superResolution') {
    const data = node.data as SuperResolutionNodeData
    return {
      type: 'canvas.upscaleVideo',
      payload: {
        nodeId,
        nodeType: node.type,
        inputs: incomingInputs(graph, nodeId, deps, ['video', 'videoCompose', 'muxAudioVideo']),
        parameters: {
          ...(data.scene ? { scene: data.scene } : {}),
          ...(data.resolution ? { resolution: data.resolution } : {}),
          ...(typeof data.fps === 'number' ? { fps: data.fps } : {}),
        },
      },
    }
  }

  if (node.type === 'muxAudioVideo') {
    const data = node.data as MuxAudioVideoNodeData
    return {
      type: 'canvas.muxAudioVideo',
      payload: {
        nodeId,
        nodeType: node.type,
        ...(readOptionalString(data.modelId) ? { modelKey: data.modelId } : {}),
        inputs: incomingInputs(graph, nodeId, deps, ['video', 'videoCompose', 'superResolution', 'audio']),
      },
    }
  }

  if (node.type === 'audio') {
    const data = node.data as AudioNodeData
    const input = inputRefFromNode(node, deps)
    return {
      type: 'canvas.generateAudio',
      payload: {
        nodeId,
        nodeType: node.type,
        inputs: input ? [input] : [],
        parameters: {
          ...(typeof data.durationSeconds === 'number' ? { durationSeconds: data.durationSeconds } : {}),
        },
      },
    }
  }

  if (node.type !== 'image' && node.type !== 'video' && node.type !== 'mjImage') {
    return { type: 'canvas.generateImage', payload: { nodeId, nodeType: node.type, references } }
  }

  const data = node.data as ImageNodeData | VideoNodeData | MjImageNodeData
  const styleResult = deps.styles
    ? resolveEffectiveStylePreset({
      nodeStylePresetId: readOptionalString(data.stylePresetId) ?? null,
      projectDefaultStylePresetId: deps.styles.getProjectDefault(workflowId),
      styles: deps.styles.list({ includeDisabled: true }),
    })
    : null
  const style = styleResult && !('errorClass' in styleResult) ? styleResult : null
  const parameters: Record<string, unknown> = {}

  if ('orientation' in data) parameters.orientation = data.orientation
  if (readOptionalString(data.ratio)) parameters.ratio = data.ratio
  if (node.type === 'video') {
    const videoData = data as VideoNodeData
    if (typeof videoData.duration === 'number') parameters.duration = videoData.duration
    else parameters.durationSeconds = videoData.durationSeconds
    if (readOptionalString(videoData.resolution)) parameters.resolution = videoData.resolution
  }
  if (style?.negativePrompt) parameters.negativePrompt = style.negativePrompt
  if (node.type === 'mjImage') parameters.resultMode = 'multiImage'
  const basePrompt = node.type === 'mjImage' && readOptionalString((data as MjImageNodeData).prompt)
    ? [composed.composedPrompt, `MJ Image ${data.label}: ${(data as MjImageNodeData).prompt}`].filter(Boolean).join('\n')
    : composed.composedPrompt

  return {
    type: node.type === 'video' ? 'canvas.generateVideo' : 'canvas.generateImage',
    payload: {
      nodeId,
      nodeType: node.type,
      prompt: composeStyledPrompt(basePrompt, style),
      modelKey: data.modelId,
      parameters,
      references,
    },
  }
}

/**
 * Registers canvas invoke handlers.
 * @param ipcMain - Electron-compatible IPC registrar.
 * @param dependencies - Optional workflow repository and deterministic test dependencies.
 * @returns void.
 * @throws Error when the registrar rejects handler registration.
 * @see docs/api-contracts/canvas-plan.md
 */
export function registerCanvasHandlers(ipcMain: IpcRegistrar, dependencies: CanvasHandlerDependencies = {}): void {
  const clock = dependencies.clock ?? Date.now
  const idFactory = dependencies.idFactory ?? (() => `graph-version-${clock()}`)

  ipcMain.handle('canvas.runNode', (_event, request) => {
    const nodeId = typeof request === 'object' && request !== null && 'nodeId' in request ? String(request.nodeId) : 'unknown'
    const workflowId = readWorkflowId(request)

    const descriptor = buildRunDescriptor(nodeId, dependencies, workflowId)

    if (dependencies.queue) {
      return dependencies.queue.enqueue({
        type: descriptor.type,
        targetId: nodeId,
        payload: descriptor.payload,
        requestedBy: { type: 'user', id: dependencies.currentUserId ?? 'user-local' }
      })
    }

    return createPendingTicket(`job-${nodeId}`)
  })

  ipcMain.handle('canvas.chatSend', (_event, request) => {
    const message = isObject(request) && typeof request.message === 'string' ? request.message : ''
    const agentId = isObject(request) && typeof request.agentId === 'string' ? request.agentId : undefined

    if (!dependencies.orchestrator) {
      return { jobId: 'job-agent-unavailable', messageId: 'message-unavailable', status: 'pending' as const }
    }

    return dependencies.orchestrator.chatSend({
      message,
      ...(agentId ? { agentId } : {}),
      requestedBy: dependencies.currentUserId ?? 'user-local'
    })
  })

  ipcMain.handle('canvas.chatGetPlan', (_event, request) => {
    const messageId = isObject(request) && typeof request.messageId === 'string' ? request.messageId : 'message-unavailable'
    return dependencies.orchestrator?.getPlan(messageId) ?? defaultClarifyPlan()
  })

  ipcMain.handle('canvas.saveGraph', (_event, request) => {
    const workflows = dependencies.workflows
    if (!workflows) {
      return { graphVersion: 'graph-version-unavailable' }
    }

    const parsed = parseSaveGraphRequest(request)
    const graphVersion = idFactory()
    workflows.addVersion({
      id: graphVersion,
      workflowId: parsed.projectId,
      graph: sanitizeCanvasGraphSnapshot(parsed.graph),
      createdAt: clock(),
      createdBy: dependencies.currentUserId ?? 'system'
    })

    return { graphVersion }
  })

  ipcMain.handle('canvas.loadGraph', (_event, request) => {
    const workflows = dependencies.workflows
    if (!workflows) {
      return defaultGraph()
    }

    const projectId = isObject(request) && typeof request.projectId === 'string' ? request.projectId : 'default'
    return workflows.getLatestVersion(projectId)?.graph ?? defaultGraph()
  })

  ipcMain.handle('canvas.applyPlan', (_event, request) => {
    const workflows = dependencies.workflows
    if (!workflows) {
      // Without a workflow repository the plan cannot be persisted; report an empty application.
      return { graphVersion: 'graph-version-unavailable', appliedNodeIds: [], appliedEdgeIds: [], dropped: [] }
    }

    if (!isObject(request) || !isObject(request.plan)) {
      return { graphVersion: 'graph-version-unavailable', appliedNodeIds: [], appliedEdgeIds: [], dropped: [] }
    }

    const plan = request.plan as unknown as CanvasPlan
    const mode = request.mode === 'apply' ? 'apply' : 'draft'
    const projectId = 'default'
    const existingGraph = workflows.getLatestVersion(projectId)?.graph ?? defaultGraph()
    const nodeIdFactory = dependencies.nodeIdFactory ?? (() => `node-${crypto.randomUUID()}`)

    // Map plan refs to stable graph node IDs.
    const refToId = new Map<string, string>()
    const appliedNodes: CanvasGraphNode[] = []
    const appliedNodeIds: string[] = []

    for (const planNode of plan.nodes) {
      const id = nodeIdFactory()
      refToId.set(planNode.ref, id)
      appliedNodes.push({
        id,
        type: planNode.type,
        position: { x: appliedNodes.length * 250, y: 0 },
        data: planNode.data as unknown as CanvasGraphNode['data']
      })
      appliedNodeIds.push(id)
    }

    const appliedEdges: CanvasGraphEdge[] = []
    const appliedEdgeIds: string[] = []
    const dropped: string[] = [...plan.dropped]

    for (const planEdge of plan.edges) {
      const source = refToId.get(planEdge.source)
      const target = refToId.get(planEdge.target)

      if (!source || !target) {
        dropped.push(`edge ${planEdge.source}->${planEdge.target}: unresolved ref`)
        continue
      }

      const sourceNode = appliedNodes.find((n) => n.id === source)
      const targetNode = appliedNodes.find((n) => n.id === target)

      if (!sourceNode || !targetNode || !canConnect(sourceNode.type, targetNode.type)) {
        dropped.push(`edge ${planEdge.source}->${planEdge.target}: connection matrix rejected`)
        continue
      }

      const edgeId = `edge-${crypto.randomUUID()}`
      appliedEdges.push({
        id: edgeId,
        source,
        target,
        data: { edgeType: planEdge.edgeType, createdAt: clock(), ...(planEdge.imageRole ? { imageRole: planEdge.imageRole } : {}) }
      })
      appliedEdgeIds.push(edgeId)
    }

    const mergedGraph: CanvasGraphSnapshot = {
      nodes: [...existingGraph.nodes, ...appliedNodes],
      edges: [...existingGraph.edges, ...appliedEdges],
      viewport: existingGraph.viewport
    }

    const graphVersion = idFactory()
    workflows.addVersion({
      id: graphVersion,
      workflowId: projectId,
      graph: mode === 'draft' ? sanitizeCanvasGraphSnapshot(mergedGraph) : mergedGraph,
      createdAt: clock(),
      createdBy: dependencies.currentUserId ?? 'system'
    })

    return { graphVersion, appliedNodeIds, appliedEdgeIds, dropped }
  })

  ipcMain.handle('canvas.runPlan', (_event, request) => {
    if (!isObject(request) || !Array.isArray(request.runSteps)) {
      // Run plan requests without valid run steps cannot enqueue any jobs.
      return { jobIds: [], status: 'queued' as const }
    }

    const runSteps = request.runSteps as PlanRunStep[]
    const graphVersion = typeof request.graphVersion === 'string' ? request.graphVersion : 'unknown'
    const jobIds: string[] = []

    if (!dependencies.queue) {
      return { jobIds: runSteps.map((_, i) => `job-plan-${graphVersion}-${i}`), status: 'queued' as const }
    }

    for (const step of runSteps) {
      const jobType = step.action === 'imageRun'
        ? 'canvas.generateImage'
        : step.action === 'videoRun'
          ? 'canvas.generateVideo'
          : 'canvas.generateImage' // textPolish maps to image generation pipeline for now

      // Resolve references for plan step nodes
      const workflowId = readWorkflowId(request)
      const descriptor = buildRunDescriptor(step.ref, dependencies, workflowId)

      const ticket = dependencies.queue.enqueue({
        type: descriptor.type ?? jobType,
        targetId: step.ref,
        payload: { ...descriptor.payload, action: step.action, graphVersion },
        requestedBy: { type: 'user', id: dependencies.currentUserId ?? 'user-local' }
      })
      jobIds.push(ticket.jobId)
    }

    return { jobIds, status: 'queued' as const }
  })

  ipcMain.handle('canvas.listWorkflows', () => {
    const workflows = dependencies.workflows
    if (!workflows) {
      return []
    }
    return workflows.list()
  })

  ipcMain.handle('canvas.createWorkflow', (_event, request) => {
    const workflows = dependencies.workflows
    if (!workflows) {
      return { id: 'workflow-unavailable', name: '' }
    }
    const name = isObject(request) && typeof request.name === 'string' ? request.name : '未命名工作流'
    const id = `wf-${clock()}`
    const now = clock()
    workflows.create({ id, name, createdAt: now, updatedAt: now })
    return { id, name }
  })

  ipcMain.handle('canvas.renameWorkflow', (_event, request) => {
    const workflows = dependencies.workflows
    if (!workflows) {
      return { id: '', name: '' }
    }
    const workflowId = isObject(request) && typeof request.workflowId === 'string' ? request.workflowId : ''
    const name = isObject(request) && typeof request.name === 'string' ? request.name : ''
    if (workflowId && name) {
      workflows.rename(workflowId, name)
    }
    return { id: workflowId, name }
  })

  ipcMain.handle('canvas.deleteWorkflow', (_event, request) => {
    const workflows = dependencies.workflows
    if (!workflows) {
      return { id: '', deleted: true as const }
    }
    const workflowId = isObject(request) && typeof request.workflowId === 'string' ? request.workflowId : ''
    if (workflowId) {
      workflows.delete(workflowId)
    }
    return { id: workflowId, deleted: true as const }
  })

  ipcMain.handle('canvas.exportWorkflow', (_event, request) => {
    const workflows = dependencies.workflows
    if (!workflows) {
      return { schemaVersion: 1 as const, name: '', graph: defaultGraph() }
    }
    const workflowId = isObject(request) && typeof request.workflowId === 'string' ? request.workflowId : 'default'
    const summary = workflows.getSummary(workflowId)
    const latest = workflows.getLatestVersion(workflowId)

    return {
      schemaVersion: 1 as const,
      name: summary?.name ?? workflowId,
      graph: latest ? sanitizeCanvasGraphSnapshot(latest.graph) : defaultGraph()
    }
  })

  ipcMain.handle('canvas.importWorkflow', (_event, request) => {
    const workflows = dependencies.workflows
    if (!workflows) {
      return { errorClass: 'workflow_repository_unavailable', message: 'Workflow repository is unavailable.', retryable: true }
    }
    const json = isObject(request) && typeof request.json === 'string' ? request.json : ''
    const parsed = parseWorkflowImportJson(json)

    if (!parsed) {
      return { errorClass: 'invalid_workflow_json', message: 'Workflow import JSON is invalid.', retryable: false }
    }
    if (unsafeWorkflowJson(parsed)) {
      return { errorClass: 'unsafe_workflow_json', message: 'Workflow import JSON cannot contain absolute file paths.', retryable: false }
    }

    const workflowId = `wf-import-${clock()}`
    const now = clock()
    const name = isObject(request) && typeof request.name === 'string' && request.name.trim().length > 0
      ? request.name
      : parsed.name
    const sanitized = sanitizeGraphWithDropped(parsed.graph)
    const graphVersion = idFactory()

    workflows.create({ id: workflowId, name, createdAt: now, updatedAt: now })
    workflows.addVersion({
      id: graphVersion,
      workflowId,
      graph: sanitized.graph,
      createdAt: clock(),
      createdBy: dependencies.currentUserId ?? 'system'
    })

    return { workflowId, graphVersion, dropped: sanitized.dropped }
  })
}
