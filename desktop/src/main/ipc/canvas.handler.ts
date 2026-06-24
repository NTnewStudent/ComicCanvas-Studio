/**
 * Canvas IPC handler skeleton.
 * @see docs/api-contracts/canvas-plan.md
 */

import type { JobTicket } from '../../../../shared/jobs'
import type { CanvasPlan } from '../../../../shared/plan'
import { canConnect } from '../../../../shared/connection-matrix'
import type { CanvasGraphEdge, CanvasGraphSnapshot, CanvasSaveGraphRequest } from '../../../../shared/graph'
import type { IpcRegistrar } from './types'
import type { WorkflowRepository } from '../db/repositories/workflow.repo'
import type { OrchestratorRuntime } from '../agent/orchestrator'

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
  /** Clock used for deterministic version timestamps. */
  clock?: () => number
  /** ID factory used for graph version IDs. */
  idFactory?: () => string
  /** Current user identifier stored as graph version author. */
  currentUserId?: string
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
}
