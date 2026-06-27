/**
 * Main-process runtime bootstrap for repositories, jobs, providers, agents, and IPC handlers.
 * @see docs/api-contracts/canvas-plan.md
 * @see docs/api-contracts/jobs.md
 * @see docs/api-contracts/assets-files.md
 * @see docs/api-contracts/gateway-providers.md
 * @see docs/api-contracts/agents.md
 */

import type { IpcRegistrar } from './ipc/types'
import { createDefaultOrchestratorPlanner, createOrchestratorRuntime, type OrchestratorPlanner } from './agent/orchestrator'
import { createAgentRegistry } from './agent/registry'
import { createIpcCanvasPlanEventBus } from './ipc/canvas-plan-fanout'
import { createAssetPipeline } from './assets/pipeline'
import { applyMigrations, openDatabaseAtPath } from './db/migrate'
import { createAgentRepository } from './db/repositories/agent.repo'
import { createAssetRepository } from './db/repositories/asset.repo'
import { createChatMessageRepository } from './db/repositories/chat-message.repo'
import { createCanvasSnippetRepository } from './db/repositories/canvas-snippet.repo'
import { createJobRepository } from './db/repositories/job.repo'
import { createStyleRepository } from './db/repositories/style.repo'
import { createWorkflowRepository } from './db/repositories/workflow.repo'
import { registerAgentHandlers } from './ipc/agent.handler'
import { registerAssetHandlers } from './ipc/asset.handler'
import { registerCanvasHandlers } from './ipc/canvas.handler'
import { registerCanvasSnippetHandlers } from './ipc/canvas-snippet.handler'
import { registerGatewayHandlers } from './ipc/gateway.handler'
import { registerJobHandlers } from './ipc/job.handler'
import { registerStyleHandlers } from './ipc/style.handler'
import { registerToolHandlers } from './ipc/tool.handler'
import { registerStorageHandlers } from './ipc/storage.handler'
import { createIpcJobEventBus } from './jobs/ipc-fanout'
import { createJobQueue } from './jobs/queue'
import { createJobWorker, type JobWorker } from './jobs/worker'
import { createGatewayConfigReloader } from './providers/gateway-reloader'
import { createGatewayRegistry } from './providers/registry'
import { createStubProvider } from './providers/stub.provider'
import { runImageNodeSmokePath } from './smoke/m1-smoke'
import { createCanvasTools, type CanvasGraphStore } from './tools/canvas'
import { createToolRuntime } from './tools/runtime'

export interface MainProcessRuntimeOptions {
  ipcMain: IpcRegistrar
  dbPath: string
  assetRoot: string
  getWindows: MainRuntimeWindowProvider
  currentUserId?: string
  planner?: OrchestratorPlanner
  clock?: () => number
  idFactory?: () => string
  assetIdFactory?: () => string
  messageIdFactory?: (prefix: 'message' | 'run') => string
  planIdFactory?: () => string
}

export interface MainProcessRuntime {
  drainJobsForTests(): Promise<void>
  waitForIdleForTests(): Promise<void>
  close(): void
}

interface MainRuntimeWindow {
  isDestroyed(): boolean
  webContents: {
    send(channel: string, event: unknown): void
  }
}

type MainRuntimeWindowProvider = () => MainRuntimeWindow[]

/**
 * Creates and wires the actual Electron main-process runtime.
 * @param options - IPC registrar, storage paths, window provider, and optional deterministic test dependencies.
 * @returns Runtime handle with a test drain hook and close lifecycle.
 * @throws Error when database migration, handler registration, or runtime construction fails.
 * @see docs/api-contracts/canvas-plan.md
 */
export function createMainProcessRuntime(options: MainProcessRuntimeOptions): MainProcessRuntime {
  const clock = options.clock ?? Date.now
  const db = openDatabaseAtPath(options.dbPath)
  applyMigrations(db)

  const jobs = createJobRepository(db)
  const assets = createAssetRepository(db)
  const agents = createAgentRepository(db)
  const styles = createStyleRepository(db)
  const snippets = createCanvasSnippetRepository(db)
  const workflows = createWorkflowRepository(db)
  try {
    workflows.create({ id: 'default', name: 'Default workspace', createdAt: clock(), updatedAt: clock() })
  } catch {
    // The default workflow is created once; repeated runtime starts keep using the existing row.
  }
  const jobEvents = createIpcJobEventBus(options.getWindows)
  const planEvents = createIpcCanvasPlanEventBus(options.getWindows)
  const queue = createJobQueue({
    jobs,
    ...(options.idFactory ? { idFactory: options.idFactory } : {}),
    clock
  })
  const assetPipeline = createAssetPipeline({
    assetRoot: options.assetRoot,
    assets,
    ...(options.assetIdFactory ? { idFactory: options.assetIdFactory } : {}),
    clock
  })
  const gateways = createGatewayRegistry()
  gateways.set('stub-main', createStubProvider({ id: 'stub-main' }))
  const reloader = createGatewayConfigReloader({ registry: gateways })
  const agentRegistry = createAgentRegistry({ agents, clock })
  const graphStore: CanvasGraphStore = {
    getGraph(workflowId = 'default') {
      return workflows.getLatestVersion(workflowId)?.graph ?? { nodes: [], edges: [], viewport: { x: 0, y: 0, zoom: 1 } }
    },
    setGraph(graph, workflowId = 'default') {
      workflows.addVersion({
        id: `tool-graph-version-${clock()}`,
        workflowId,
        graph,
        createdAt: clock(),
        createdBy: options.currentUserId ?? 'tool-runtime'
      })
    }
  }
  let draining: Promise<void> | null = null
  let worker: JobWorker | null = null

  async function drainJobs(): Promise<void> {
    if (!worker) {
      return
    }

    while (await worker.runNext()) {
      // Continue until the queue has no pending jobs.
    }
  }

  function scheduleDrain(): void {
    if (!draining) {
      draining = Promise.resolve()
        .then(drainJobs)
        .finally(() => {
          draining = null
        })
    }
  }

  const autoQueue: typeof queue = {
    enqueue(input) {
      const ticket = queue.enqueue(input)
      scheduleDrain()
      return ticket
    }
  }
  const orchestrator = createOrchestratorRuntime({
    queue: autoQueue,
    events: jobEvents,
    chatMessages: createChatMessageRepository(db),
    planEvents,
    workflowId: 'default',
    planner: options.planner ?? createDefaultOrchestratorPlanner(),
    idFactory: options.messageIdFactory ?? ((prefix) => `${prefix}-${crypto.randomUUID()}`),
    planIdFactory: options.planIdFactory ?? (() => `plan-${crypto.randomUUID()}`),
    clock
  })
  const toolRuntime = createToolRuntime({
    tools: createCanvasTools({
      graphStore,
      queue: autoQueue,
      clock
    }),
    clock
  })
  worker = createJobWorker({
    jobs,
    events: jobEvents,
    leaseOwner: 'main-runtime-worker',
    clock,
    handlers: {
      'agent.run': orchestrator.createJobHandler(),
      'canvas.generateAudio': (job) => ({ kind: 'report', summary: 'Queued local audio generation stub.', data: { nodeId: job.targetId ?? null } }),
      'canvas.generateImage': (job) =>
        runImageNodeSmokePath({
          job,
          gateways,
          assets: assetPipeline,
          gatewayId: 'stub-main',
          assetRepo: assets,
          assetRoot: options.assetRoot
        }),
      'canvas.generateVideo': (job) => ({ kind: 'report', summary: 'Queued local video generation stub.', data: { nodeId: job.targetId ?? null } }),
      'canvas.composeVideo': (job) => ({ kind: 'report', summary: 'Queued local video composition stub.', data: { nodeId: job.targetId ?? null } }),
      'canvas.upscaleVideo': (job) => ({ kind: 'report', summary: 'Queued local video upscale stub.', data: { nodeId: job.targetId ?? null } }),
      'canvas.muxAudioVideo': (job) => ({ kind: 'report', summary: 'Queued local audio/video mux stub.', data: { nodeId: job.targetId ?? null } })
    }
  })

  registerCanvasHandlers(options.ipcMain, {
    workflows,
    orchestrator,
    queue: autoQueue,
    clock,
    currentUserId: options.currentUserId ?? 'user-local',
    assets,
    graphStore,
    styles
  })
  registerJobHandlers(options.ipcMain, {
    jobs,
    queue: autoQueue,
    clock
  })
  registerAssetHandlers(options.ipcMain, {
    assets,
    assetRoot: options.assetRoot,
    clock,
    idFactory: (prefix) => `${prefix}-${crypto.randomUUID()}`
  })
  registerGatewayHandlers(options.ipcMain, { reloader })
  registerStyleHandlers(options.ipcMain, {
    styles,
    clock,
    idFactory: () => `style-${crypto.randomUUID()}`
  })
  registerCanvasSnippetHandlers(options.ipcMain, {
    snippets,
    clock,
    idFactory: () => `snippet-${crypto.randomUUID()}`
  })
  registerAgentHandlers(options.ipcMain, { registry: agentRegistry })
  registerToolHandlers(options.ipcMain, { runtime: toolRuntime, currentUserId: options.currentUserId ?? 'user-local' })
  registerStorageHandlers(options.ipcMain)

  async function drainJobsForTests(): Promise<void> {
    await drainJobs()
  }

  return {
    drainJobsForTests,
    async waitForIdleForTests() {
      await draining
    },
    close() {
      db.close()
    }
  }
}
