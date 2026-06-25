/**
 * Canvas IPC handler skeleton.
 * @see docs/api-contracts/canvas-plan.md
 */

import type { JobTicket } from '../../../../shared/jobs'
import type { CanvasPlan, PlanRunStep } from '../../../../shared/plan'
import { canConnect } from '../../../../shared/connection-matrix'
import type { CanvasGraphEdge, CanvasGraphNode, CanvasGraphSnapshot, CanvasSaveGraphRequest } from '../../../../shared/graph'
import type { GatewayReference } from '../../../../shared/gateway'
import type { VideoNodeData, ReferenceAsset } from '../../../../shared/nodes'
import type { IpcRegistrar } from './types'
import type { WorkflowRepository } from '../db/repositories/workflow.repo'
import type { AssetRepository } from '../db/repositories/asset.repo'
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
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function defaultGraph(): CanvasGraphSnapshot {
  return { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } }
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

function sanitizeGraph(graph: CanvasGraphSnapshot): CanvasGraphSnapshot {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]))
  const edges: CanvasGraphEdge[] = graph.edges.filter((edge) => {
    const source = nodeById.get(edge.source)
    const target = nodeById.get(edge.target)

    if (!source || !target) {
      return false
    }

    return canConnect(source.type, target.type)
  })

  return {
    nodes: graph.nodes,
    edges,
    viewport: graph.viewport
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
  deps: CanvasHandlerDependencies
): Array<{ assetId: string; role: string; url: string; mediaType: string }> {
  const graphStore = deps.graphStore
  const assets = deps.assets
  if (!graphStore) {
    return []
  }

  const graph = graphStore.getGraph()
  const node = graph.nodes.find((n) => n.id === nodeId)
  if (!node) {
    return []
  }

  const result: Array<{ assetId: string; role: string; url: string; mediaType: string }> = []
  const seen = new Set<string>()

  // 1. Resolve from VideoNodeData.referenceAssets
  const nodeData = node.data as Partial<VideoNodeData>
  if (Array.isArray(nodeData.referenceAssets)) {
    for (const refAsset of nodeData.referenceAssets as ReferenceAsset[]) {
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

    // Resolve references from the current graph node data and asset DB
    const references = resolveNodeReferences(nodeId, dependencies)

    if (dependencies.queue) {
      return dependencies.queue.enqueue({
        type: 'canvas.generateImage',
        targetId: nodeId,
        payload: { nodeId, references },
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
      graph: sanitizeGraph(parsed.graph),
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
        data: { edgeType: planEdge.edgeType, createdAt: clock(), ...(planEdge.imageRole ? { imageRole: planEdge.imageRole } : {}) } as CanvasGraphEdge['data']
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
      graph: mode === 'draft' ? sanitizeGraph(mergedGraph) : mergedGraph,
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
      const references = resolveNodeReferences(step.ref, dependencies)

      const ticket = dependencies.queue.enqueue({
        type: jobType,
        targetId: step.ref,
        payload: { nodeId: step.ref, action: step.action, graphVersion, references },
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
}
