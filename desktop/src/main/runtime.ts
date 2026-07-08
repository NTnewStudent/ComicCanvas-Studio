/**
 * Main-process runtime bootstrap for repositories, jobs, providers, agents, and IPC handlers.
 * @see docs/api-contracts/canvas-plan.md
 * @see docs/api-contracts/jobs.md
 * @see docs/api-contracts/assets-files.md
 * @see docs/api-contracts/gateway-providers.md
 * @see docs/api-contracts/agents.md
 */

import type { IpcRegistrar } from './ipc/types'
import { join } from 'node:path'
import { createDefaultOrchestratorPlanner, createOrchestratorRuntime, type OrchestratorPlanner } from './agent/orchestrator'
import { createGatewayAgentPlanner } from './agent/gateway-loop-model'
import { createAgentRegistry } from './agent/registry'
import { createIpcCanvasPlanEventBus } from './ipc/canvas-plan-fanout'
import { createAssetCloudUrlService } from './assets/asset-cloud-url'
import { createAssetPipeline } from './assets/pipeline'
import { createWorkflowAssetResolver } from './assets/workflow-asset-resolver'
import { applyMigrations, openDatabaseAtPath } from './db/migrate'
import { createAgentRepository } from './db/repositories/agent.repo'
import { createAgentRunRepository } from './db/repositories/agent-run.repo'
import { createAssetRepository } from './db/repositories/asset.repo'
import { createChatMessageRepository } from './db/repositories/chat-message.repo'
import { createCanvasSnippetRepository } from './db/repositories/canvas-snippet.repo'
import { createJobRepository } from './db/repositories/job.repo'
import { createStorageConfigRepository } from './db/repositories/storage.repo'
import { createStyleRepository } from './db/repositories/style.repo'
import { createKnowledgeRepository } from './db/repositories/knowledge.repo'
import { createSkillRepository } from './db/repositories/skill.repo'
import { registerAuditHandlers } from './ipc/audit.handler'
import { registerKnowledgeHandlers } from './ipc/knowledge.handler'
import { createAuditService } from './audit/service'
import { createKnowledgeStore } from './knowledge/store'
import { createPluginLoader } from './tools/plugin-loader'
import { createWorkflowRepository } from './db/repositories/workflow.repo'
import { registerAgentHandlers } from './ipc/agent.handler'
import { registerSkillHandlers } from './ipc/skill.handler'
import { spawnSubAgent } from './agent/spawn-sub-agent'
import { registerAssetHandlers } from './ipc/asset.handler'
import { registerCanvasHandlers } from './ipc/canvas.handler'
import { registerCanvasSnippetHandlers } from './ipc/canvas-snippet.handler'
import { getGatewayModelCatalog, getGatewayConfig, registerGatewayHandlers, seedGatewayConfigs } from './ipc/gateway.handler'
import { registerJobHandlers } from './ipc/job.handler'
import { registerStyleHandlers } from './ipc/style.handler'
import { registerToolHandlers } from './ipc/tool.handler'
import { getCurrentStorageConfig, registerStorageHandlers } from './ipc/storage.handler'
import { createIpcJobEventBus } from './jobs/ipc-fanout'
import { createJobQueue } from './jobs/queue'
import { createJobWorker, type JobWorker } from './jobs/worker'
import { createGatewayConfigReloader } from './providers/gateway-reloader'
import { createGatewayRegistry } from './providers/registry'
import { loadLocalGateways } from './providers/local-gateways'
import { createStubProvider } from './providers/stub.provider'
import { runImageNodeSmokePath } from './smoke/m1-smoke'
import { storageFactory } from './storage/storage-factory'
import { createAssetTools } from './tools/asset'
import { createCanvasTools, type CanvasGraphStore } from './tools/canvas'
import { createFsTools } from './tools/fs'
import { createWebSearchTools } from './tools/web-search'
import { createAgentSpawnTool, createChildAgentRunner } from './tools/agent'
import { createSkillRegistry } from './skills/registry'
import { createSkillService } from './skills/skill.service'
import { createToolRuntime } from './tools/runtime'
import type { SafeStorageAdapter } from './security/key-vault'

export interface MainProcessRuntimeOptions {
  ipcMain: IpcRegistrar
  dbPath: string
  assetRoot: string
  /** Absolute path that bounds the read-only fs.* tools. Defaults to process.cwd(). */
  workspaceRoot?: string
  /** Absolute path to a local, git-ignored gateways JSON file to bootstrap real providers. */
  gatewaysFile?: string
  storageSafeStorage?: SafeStorageAdapter
  getWindows: MainRuntimeWindowProvider
  currentUserId?: string
  planner?: OrchestratorPlanner
  agentPlannerMode?: 'deterministic' | 'gateway'
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
  const agentRuns = createAgentRunRepository(db)
  const storageConfigs = createStorageConfigRepository(db)
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
  // Bootstrap real providers (and their secrets) from a local git-ignored file when present.
  const localGatewaysFile = options.gatewaysFile ?? process.env.COMIC_CANVAS_GATEWAYS_FILE
  const localGateways = localGatewaysFile ? loadLocalGateways(localGatewaysFile) : { configs: [], secretsByKeyRef: {} }
  const reloader = createGatewayConfigReloader({
    registry: gateways,
    resolveSecret: (keyRef: string) => localGateways.secretsByKeyRef[keyRef] ?? ''
  })
  if (localGateways.configs.length > 0) {
    seedGatewayConfigs(localGateways.configs)
    reloader.reload(localGateways.configs)
  }
  const agentRegistry = createAgentRegistry({ agents, clock })
  const skillRepo = createSkillRepository(db)
  const skillRegistry = createSkillRegistry({ repo: skillRepo, clock })
  const skillService = createSkillService({ registry: skillRegistry, repo: skillRepo, clock })
  const knowledgeRepo = createKnowledgeRepository(db)
  const knowledgeStore = createKnowledgeStore({ repo: knowledgeRepo, clock })
  const auditService = createAuditService({ clock })
  const assetCloudUrls = createAssetCloudUrlService({
    assetRoot: options.assetRoot,
    assets,
    getStorageConfig: getCurrentStorageConfig,
    createStorageProvider: (config) => storageFactory.create(config)
  })
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
  const toolRuntime = createToolRuntime({
    tools: [
      ...createCanvasTools({
        graphStore,
        queue: autoQueue,
        clock
      }),
      ...createAssetTools({
        assets,
        cloudUrls: assetCloudUrls
      }),
      ...createWebSearchTools(),
      ...createFsTools({
        workspaceRoot: options.workspaceRoot ?? process.cwd()
      })
    ],
    clock
  })
  const pluginLoader = createPluginLoader({ runtime: toolRuntime })
  pluginLoader.loadFromDirectory(join(process.cwd(), 'plugins'))
  // Lazily build the agent spawn tool once the planner and toolRuntime are both available.
  // Registered after toolRuntime is created to avoid circular dependency during construction.
  function registerAgentSpawnTool(plannerInstance: typeof planner): void {
    void plannerInstance // planner is used by the child runner when a step model is provided
    const childRunner = createChildAgentRunner({
      toolRuntime,
      listTools: () => toolRuntime.list()
    })
    toolRuntime.register(createAgentSpawnTool({
      parentAgent: agentRegistry.get('general-purpose') ?? {
        id: 'general-purpose', source: 'builtin', name: 'General Purpose', description: '',
        instructions: '', allowedTools: ['canvas.queryGraph', 'fs.read', 'fs.glob', 'fs.grep', 'web.search'],
        allowedSkills: '*',
        gatewayPolicy: { allowedChannels: ['text'] },
        contextPolicy: { includeCanvasGraph: false, includeSelectedAssets: false, includeRecentMessages: false, includeKnowledge: false, maxContextTokens: 4000 },
        permissionPolicy: { allowedPermissionKinds: ['canvas.read', 'file.read', 'diagnostics', 'network'], requireAskForDestructive: true },
        triggerPolicy: { allowedTriggers: ['manual'], defaultTrigger: 'manual', autoRun: false },
        maxTurns: 4, effort: 'medium', enabled: true
      },
      parentRunId: 'runtime-spawn',
      parentTraceId: 'runtime',
      currentDepth: 0,
      runChild: childRunner
    }))
  }
  // Prefer a configured real (non-stub) text model so general questions get real answers.
  // Resolved lazily so configuring a gateway takes effect without an app restart.
  function resolveDefaultTextModel(): { gatewayId: string; modelId: string } | null {
    try {
      const catalog = getGatewayModelCatalog()
      const textModel = catalog.models.text.find((model) => model.enabled && model.gatewayId !== 'stub-main')
      if (textModel) {
        return { gatewayId: textModel.gatewayId, modelId: textModel.id }
      }
    } catch {
      // Fall back to "no model configured" when the catalog cannot be read.
    }
    return null
  }
  const planner = options.planner ?? (options.agentPlannerMode === 'gateway'
    ? createGatewayAgentPlanner({
      gateways,
      tools: toolRuntime,
      listTools: () => toolRuntime.list(),
      resolveDefaultModel: resolveDefaultTextModel,
      resolveGatewayType: (gatewayId) => getGatewayConfig(gatewayId)?.type,
      fallbackGatewayId: 'stub-main',
      fallbackModelId: 'stub-text'
    })
    : createDefaultOrchestratorPlanner())
  const orchestrator = createOrchestratorRuntime({
    queue: autoQueue,
    events: jobEvents,
    chatMessages: createChatMessageRepository(db),
    planEvents,
    workflowId: 'default',
    planner,
    registry: agentRegistry,
    listTools: () => toolRuntime.list(),
    getCanvasGraph: (workflowId) => graphStore.getGraph(workflowId),
    agentRuns,
    skillRegistry,
    knowledgeStore,
    idFactory: options.messageIdFactory ?? ((prefix) => `${prefix}-${crypto.randomUUID()}`),
    planIdFactory: options.planIdFactory ?? (() => `plan-${crypto.randomUUID()}`),
    clock
  })
  const childRunner = createChildAgentRunner({
    toolRuntime,
    listTools: () => toolRuntime.list()
  })
  // Register the spawn tool now that the planner is available.
  registerAgentSpawnTool(planner)
  worker = createJobWorker({
    jobs,
    events: jobEvents,
    leaseOwner: 'main-runtime-worker',
    clock,
    handlers: {
      'agent.run': orchestrator.createJobHandler(),
      'canvas.generateAudio': (job) => ({ kind: 'report', summary: 'Queued local audio generation stub.', data: { nodeId: job.targetId ?? null } }),
      'canvas.polishText': (job) => {
        const content = typeof job.payload.content === 'string' ? job.payload.content : ''
        const polished = content.trim().length > 0 ? content.trim() : 'Polished text'
        return { kind: 'text', text: polished }
      },
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
    },
    onCompletedAsset: (job, assetId, emittedAt) => {
      assets.addReference({
        id: `asset-ref-${job.id}`,
        assetId,
        refType: 'job',
        refId: job.id,
        createdAt: emittedAt
      })
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
    styles,
    assetUrlResolver: createWorkflowAssetResolver({
      getStorageConfig: getCurrentStorageConfig,
      createStorageProvider: (config) => storageFactory.create(config),
      cloudUrlService: assetCloudUrls
    }),
    modelCatalog: getGatewayModelCatalog
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
  registerAgentHandlers(options.ipcMain, {
    registry: agentRegistry,
    runtime: orchestrator,
    spawnSubAgent: (input) => {
      const parentAgent = agentRegistry.get('general-purpose')
      const allowedTools = parentAgent?.allowedTools ?? '*'
      const allowedSkills = parentAgent?.allowedSkills ?? '*'

      return spawnSubAgent(input, {
        parentRunId: `ipc-spawn-${crypto.randomUUID()}`,
        parentTraceId: 'ipc-spawn',
        allowedTools,
        allowedSkills
      }, { runChild: childRunner })
    }
  })
  registerSkillHandlers(options.ipcMain, { registry: skillRegistry, service: skillService, agents: agentRegistry })
  registerKnowledgeHandlers(options.ipcMain, { store: knowledgeStore, repo: knowledgeRepo })
  registerAuditHandlers(options.ipcMain, {
    audit: auditService,
    dbReady: () => true,
    toolRuntime,
    skillRegistry,
    knowledgeReady: () => knowledgeRepo.listDocuments().length >= 0,
    clock
  })
  registerToolHandlers(options.ipcMain, { runtime: toolRuntime, currentUserId: options.currentUserId ?? 'user-local' })
  registerStorageHandlers(options.ipcMain, {
    repository: storageConfigs,
    ...(options.storageSafeStorage ? { safeStorage: options.storageSafeStorage } : {}),
    clock
  })

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
