/**
 * Main-process runtime bootstrap for repositories, jobs, providers, agents, and IPC handlers.
 * @see docs/api-contracts/canvas-plan.md
 * @see docs/api-contracts/jobs.md
 * @see docs/api-contracts/assets-files.md
 * @see docs/api-contracts/gateway-providers.md
 * @see docs/api-contracts/agents.md
 */

import type { CanvasPlan } from '../../../shared/plan'
import type { IpcRegistrar } from './ipc/types'
import { createOrchestratorRuntime, type OrchestratorPlanner } from './agent/orchestrator'
import { createAgentRegistry } from './agent/registry'
import { createIpcCanvasPlanEventBus } from './ipc/canvas-plan-fanout'
import { createAssetPipeline } from './assets/pipeline'
import { applyMigrations, openDatabaseAtPath } from './db/migrate'
import { createAgentRepository } from './db/repositories/agent.repo'
import { createAssetRepository } from './db/repositories/asset.repo'
import { createChatMessageRepository } from './db/repositories/chat-message.repo'
import { createJobRepository } from './db/repositories/job.repo'
import { createWorkflowRepository } from './db/repositories/workflow.repo'
import { registerAgentHandlers } from './ipc/agent.handler'
import { registerAssetHandlers } from './ipc/asset.handler'
import { registerCanvasHandlers } from './ipc/canvas.handler'
import { registerGatewayHandlers } from './ipc/gateway.handler'
import { registerJobHandlers } from './ipc/job.handler'
import { createIpcJobEventBus } from './jobs/ipc-fanout'
import { createJobQueue } from './jobs/queue'
import { createJobWorker, type JobWorker } from './jobs/worker'
import { createGatewayConfigReloader } from './providers/gateway-reloader'
import { createGatewayRegistry } from './providers/registry'
import { createStubProvider } from './providers/stub.provider'
import { runImageNodeSmokePath } from './smoke/m1-smoke'

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

function defaultPlanner(): OrchestratorPlanner {
  return {
    proposePlan(input): CanvasPlan {
      return {
        kind: 'plan',
        summary: `Create an image node for: ${input.message}`,
        nodes: [
          {
            ref: 'image-1',
            type: 'image',
            title: '生成图片',
            data: {
              promptOverride: input.message,
              modelId: 'stub-image',
              orientation: 'landscape'
            }
          }
        ],
        edges: [],
        runSteps: [{ ref: 'image-1', action: 'imageRun' }],
        question: null,
        dropped: []
      }
    }
  }
}

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
  const workflows = createWorkflowRepository(db)
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
    planner: options.planner ?? defaultPlanner(),
    idFactory: options.messageIdFactory ?? ((prefix) => `${prefix}-${crypto.randomUUID()}`),
    planIdFactory: options.planIdFactory ?? (() => `plan-${crypto.randomUUID()}`),
    clock
  })
  worker = createJobWorker({
    jobs,
    events: jobEvents,
    leaseOwner: 'main-runtime-worker',
    clock,
    handlers: {
      'agent.run': orchestrator.createJobHandler(),
      'canvas.generateImage': (job) =>
        runImageNodeSmokePath({
          job,
          gateways,
          assets: assetPipeline,
          gatewayId: 'stub-main'
        })
    }
  })

  registerCanvasHandlers(options.ipcMain, {
    workflows,
    orchestrator,
    queue: autoQueue,
    clock,
    currentUserId: options.currentUserId ?? 'user-local'
  })
  registerJobHandlers(options.ipcMain)
  registerAssetHandlers(options.ipcMain)
  registerGatewayHandlers(options.ipcMain, { reloader })
  registerAgentHandlers(options.ipcMain, { registry: agentRegistry })

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
