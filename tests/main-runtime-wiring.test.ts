import { createHash } from 'node:crypto'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import type { JobRecord, JobTerminalEvent } from '../shared/jobs'
import type { AssetRecord } from '../shared/assets'
import type { CanvasGraphSnapshot } from '../shared/graph'
import type { GatewayRequest } from '../shared/gateway'
import type { GatewayResult } from '../shared/gateway'
import { createMainProcessRuntime } from '../desktop/src/main/runtime'
import type { MainProcessRuntime } from '../desktop/src/main/runtime'
import { createStubProvider } from '../desktop/src/main/providers/stub.provider'

type Handler = (_event: unknown, request: unknown) => unknown

interface FakeIpcMain {
  handle(channel: string, handler: Handler): void
}

function createFakeIpcMain(): { ipcMain: FakeIpcMain; handlers: Map<string, Handler> } {
  const handlers = new Map<string, Handler>()

  return {
    handlers,
    ipcMain: {
      handle(channel, handler) {
        handlers.set(channel, handler)
      }
    }
  }
}

function createWindow() {
  return {
    isDestroyed: () => false,
    webContents: {
      send: vi.fn()
    }
  }
}

function findCompletedEvent(window: ReturnType<typeof createWindow>, jobId: string): Extract<JobTerminalEvent, { channel: 'job.completed' }> | null {
  for (const call of window.webContents.send.mock.calls) {
    const [channel, payload] = call as [string, unknown]

    if (
      channel === 'job.completed' &&
      typeof payload === 'object' &&
      payload !== null &&
      'jobId' in payload &&
      payload.jobId === jobId
    ) {
      return payload as Extract<JobTerminalEvent, { channel: 'job.completed' }>
    }
  }

  return null
}

function isPromiseLike<T>(value: T | Promise<T>): value is Promise<T> {
  return typeof value === 'object' && value !== null && 'then' in value
}

function completedAssetId(window: ReturnType<typeof createWindow>, jobId: string): string {
  const completed = findCompletedEvent(window, jobId)
  if (completed?.result.kind !== 'asset') {
    throw new Error(`job ${jobId} did not complete with an asset result`)
  }

  return completed.result.assetId
}

function expectedStubImageHash(input: Pick<GatewayRequest, 'prompt' | 'idempotencyKey' | 'parameters'>): string {
  const provider = createStubProvider({ id: 'stub-main' })
  const result = provider.invoke({
    channel: 'image',
    modelKey: 'stub-image',
    references: [],
    ...input,
  })

  if (isPromiseLike<GatewayResult>(result)) {
    throw new Error('stub_provider_unexpected_async')
  }
  if (result.kind !== 'assetBytes') {
    throw new Error('stub_provider_unexpected_result')
  }

  return createHash('md5').update(result.bytes).digest('hex')
}

describe('main process runtime wiring', () => {
  it('registers product IPC handlers and drains agent/runNode jobs through local services', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-main-runtime-'))
    const dbPath = join(tempDir, 'runtime.sqlite')
    const assetRoot = join(tempDir, 'assets')
    const { ipcMain, handlers } = createFakeIpcMain()
    const window = createWindow()
    let runtime: MainProcessRuntime | null = null

    try {
      runtime = createMainProcessRuntime({
        ipcMain,
        dbPath,
        assetRoot,
        getWindows: () => [window],
        currentUserId: 'user-1',
        clock: (() => {
          let now = 1_783_300_000_000
          return () => now++
        })(),
        idFactory: (() => {
          let index = 0
          return () => `job-${++index}`
        })(),
        assetIdFactory: () => 'asset-runtime-1',
        messageIdFactory: (prefix) => `${prefix}-1`,
        planIdFactory: () => 'plan-1'
      })

      expect(Array.from(handlers.keys())).toEqual(
        expect.arrayContaining([
          'canvas.chatSend',
          'canvas.chatGetPlan',
          'canvas.runNode',
          'asset.get',
          'gateway.list',
          'job.get'
        ])
      )

      const chatTicket = await handlers.get('canvas.chatSend')?.({}, { message: '生成一个图片节点，内容是：宇宙飞船', agentId: 'orchestrator' })
      expect(chatTicket).toMatchObject({ jobId: 'job-1', status: 'pending' })
      expect(JSON.stringify(chatTicket)).not.toMatch(/asset|bytes|cc-asset|[A-Za-z]:\\\\/u)

      await runtime.waitForIdleForTests()
      expect(window.webContents.send).toHaveBeenCalledWith('canvas.planReady', { messageId: 'message-1', planId: 'plan-1' })

      const plan = await handlers.get('canvas.chatGetPlan')?.({}, { messageId: 'message-1' })
      expect(plan).toMatchObject({
        kind: 'plan',
        nodes: [{ ref: 'image-1', type: 'image' }],
        runSteps: [{ ref: 'image-1', action: 'imageRun' }]
      })

      const runTicket = await handlers.get('canvas.runNode')?.({}, { nodeId: 'image-runtime-1' })
      expect(runTicket).toMatchObject({ jobId: 'job-2', status: 'pending' })
      expect(JSON.stringify(runTicket)).not.toMatch(/asset|bytes|cc-asset|[A-Za-z]:\\\\/u)

      await runtime.waitForIdleForTests()
      const completed = findCompletedEvent(window, 'job-2')

      expect(completed?.result).toMatchObject({ kind: 'asset', assetId: 'asset-runtime-1' })
      expect(completed?.result.kind === 'asset' ? completed.result.metadata : null).toMatchObject({ safeUrl: 'cc-asset://asset/asset-runtime-1' })
    } finally {
      runtime?.close()
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('uses the built-in comic-drama planner through chat IPC when no external planner is injected', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-main-runtime-comic-plan-'))
    const dbPath = join(tempDir, 'runtime-comic-plan.sqlite')
    const assetRoot = join(tempDir, 'assets')
    const { ipcMain, handlers } = createFakeIpcMain()
    const window = createWindow()
    let runtime: MainProcessRuntime | null = null

    try {
      runtime = createMainProcessRuntime({
        ipcMain,
        dbPath,
        assetRoot,
        getWindows: () => [window],
        currentUserId: 'user-1',
        clock: (() => {
          let now = 1_783_300_100_000
          return () => now++
        })(),
        idFactory: (() => {
          let index = 0
          return () => `job-comic-plan-${++index}`
        })(),
        messageIdFactory: (prefix) => `${prefix}-comic`,
        planIdFactory: () => 'plan-comic'
      })

      await handlers.get('canvas.chatSend')?.({}, {
        message: '做一个雨夜侦探漫画短剧，包含角色、场景、图片、配音、视频合成和音视频合成',
        agentId: 'orchestrator',
      })
      await runtime.waitForIdleForTests()

      const plan = await handlers.get('canvas.chatGetPlan')?.({}, { messageId: 'message-comic' }) as {
        nodes: Array<{ ref: string; type: string }>
        runSteps: Array<{ ref: string; action: string }>
      }

      expect(plan.nodes.map((node) => node.type)).toEqual([
        'text',
        'character',
        'scene',
        'mjImage',
        'audio',
        'videoCompose',
        'muxAudioVideo',
      ])
      expect(plan.runSteps).toEqual([
        { ref: 'key-image', action: 'mjImageRun' },
        { ref: 'voice', action: 'audioRun' },
        { ref: 'compose', action: 'videoComposeRun' },
        { ref: 'mux', action: 'muxAudioVideoRun' },
      ])
      expect(window.webContents.send).toHaveBeenCalledWith('canvas.planReady', { messageId: 'message-comic', planId: 'plan-comic' })
    } finally {
      runtime?.close()
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('passes persisted project styles into runNode generation jobs', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-runtime-style-'))
    const dbPath = join(tempDir, 'runtime-style.sqlite')
    const assetRoot = join(tempDir, 'assets')
    const { ipcMain, handlers } = createFakeIpcMain()
    const window = createWindow()
    let runtime: MainProcessRuntime | null = null

    try {
      runtime = createMainProcessRuntime({
        ipcMain,
        dbPath,
        assetRoot,
        getWindows: () => [window],
        currentUserId: 'user-1',
        clock: (() => {
          let now = 1_783_301_000_000
          return () => now++
        })(),
        idFactory: (() => {
          let index = 0
          return () => `job-style-${++index}`
        })(),
        assetIdFactory: (() => {
          let index = 0
          return () => `asset-style-${++index}`
        })(),
      })

      const graph: CanvasGraphSnapshot = {
        nodes: [
          { id: 'text-1', type: 'text', position: { x: 0, y: 0 }, data: { label: 'Prompt', content: 'city at dusk' } },
          {
            id: 'image-1',
            type: 'image',
            position: { x: 240, y: 0 },
            data: {
              label: 'Image',
              promptOverride: 'wide establishing shot',
              modelId: 'stub-image',
              orientation: 'landscape',
              assetId: null,
              status: 'idle',
            },
          },
        ],
        edges: [{ id: 'edge-1', source: 'text-1', target: 'image-1', data: { edgeType: 'promptOrder', createdAt: 1 } }],
        viewport: { x: 0, y: 0, zoom: 1 },
      }

      await handlers.get('canvas.saveGraph')?.({}, { projectId: 'default', graph })
      await handlers.get('style.save')?.({}, {
        id: 'style-runtime',
        code: 'runtime',
        name: 'Runtime style',
        promptBefore: 'cinematic ink wash',
        promptAfter: 'soft rim light',
        enabled: true,
      })

      const baselineTicket = await handlers.get('canvas.runNode')?.({}, { nodeId: 'image-1' }) as { jobId: string }
      await runtime.waitForIdleForTests()
      const baselineAsset = await handlers.get('asset.get')?.({}, {
        assetId: completedAssetId(window, baselineTicket.jobId),
      }) as AssetRecord

      await handlers.get('style.setProjectDefault')?.({}, { workflowId: 'default', stylePresetId: 'style-runtime' })
      const styledTicket = await handlers.get('canvas.runNode')?.({}, { nodeId: 'image-1' }) as { jobId: string }
      await runtime.waitForIdleForTests()
      const styledAsset = await handlers.get('asset.get')?.({}, {
        assetId: completedAssetId(window, styledTicket.jobId),
      }) as AssetRecord
      const styledExpectedHash = expectedStubImageHash({
        prompt: 'cinematic ink wash\ncity at dusk\nwide establishing shot\nsoft rim light',
        idempotencyKey: styledTicket.jobId,
        parameters: { orientation: 'landscape' },
      })
      const unstyledExpectedHash = expectedStubImageHash({
        prompt: 'city at dusk\nwide establishing shot',
        idempotencyKey: styledTicket.jobId,
        parameters: { orientation: 'landscape' },
      })

      expect(baselineAsset.metadata?.hash).toBeDefined()
      expect(styledAsset.metadata?.hash).toBeDefined()
      expect(styledAsset.metadata?.hash).not.toBe(baselineAsset.metadata?.hash)
      expect(styledAsset.metadata?.hash).toBe(styledExpectedHash)
      expect(styledAsset.metadata?.hash).not.toBe(unstyledExpectedHash)
    } finally {
      runtime?.close()
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('exposes persisted runNode job state through job.get before and after execution', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-runtime-job-state-'))
    const dbPath = join(tempDir, 'runtime-job-state.sqlite')
    const assetRoot = join(tempDir, 'assets')
    const { ipcMain, handlers } = createFakeIpcMain()
    const window = createWindow()
    let runtime: MainProcessRuntime | null = null

    try {
      runtime = createMainProcessRuntime({
        ipcMain,
        dbPath,
        assetRoot,
        getWindows: () => [window],
        currentUserId: 'user-1',
        clock: (() => {
          let now = 1_783_303_000_000
          return () => now++
        })(),
        idFactory: (() => {
          let index = 0
          return () => `job-observable-${++index}`
        })(),
        assetIdFactory: () => 'asset-observable-1',
      })

      const graph: CanvasGraphSnapshot = {
        nodes: [
          { id: 'text-observable', type: 'text', position: { x: 0, y: 0 }, data: { label: 'Prompt', content: 'quiet observatory' } },
          {
            id: 'image-observable',
            type: 'image',
            position: { x: 240, y: 0 },
            data: {
              label: 'Image',
              promptOverride: 'moonlit telescope',
              modelId: 'stub-image',
              orientation: 'square',
              assetId: null,
              status: 'idle',
            },
          },
        ],
        edges: [{ id: 'edge-observable', source: 'text-observable', target: 'image-observable', data: { edgeType: 'promptOrder', createdAt: 1 } }],
        viewport: { x: 0, y: 0, zoom: 1 },
      }

      await handlers.get('canvas.saveGraph')?.({}, { projectId: 'default', graph })

      const ticket = await handlers.get('canvas.runNode')?.({}, { nodeId: 'image-observable' }) as { jobId: string }
      const queued = await handlers.get('job.get')?.({}, { jobId: ticket.jobId }) as JobRecord & { payload?: Record<string, unknown> }

      expect(queued).toMatchObject({
        id: ticket.jobId,
        type: 'canvas.generateImage',
        targetId: 'image-observable',
        progress: 0,
      })
      expect(['pending', 'processing']).toContain(queued.status)
      expect(queued.payload).toMatchObject({
        nodeId: 'image-observable',
        prompt: 'quiet observatory\nmoonlit telescope',
        parameters: { orientation: 'square' },
      })

      await runtime.waitForIdleForTests()
      const completed = await handlers.get('job.get')?.({}, { jobId: ticket.jobId }) as JobRecord

      expect(completed).toMatchObject({
        id: ticket.jobId,
        status: 'completed',
        progress: 100,
        result: { kind: 'asset', assetId: 'asset-observable-1' },
      })
    } finally {
      await runtime?.waitForIdleForTests()
      runtime?.close()
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('exposes persisted runNode jobs through filtered job.list IPC', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-runtime-job-list-'))
    const dbPath = join(tempDir, 'runtime-job-list.sqlite')
    const assetRoot = join(tempDir, 'assets')
    const { ipcMain, handlers } = createFakeIpcMain()
    const window = createWindow()
    let runtime: MainProcessRuntime | null = null

    try {
      runtime = createMainProcessRuntime({
        ipcMain,
        dbPath,
        assetRoot,
        getWindows: () => [window],
        currentUserId: 'user-1',
        clock: (() => {
          let now = 1_783_304_000_000
          return () => now++
        })(),
        idFactory: (() => {
          let index = 0
          return () => `job-list-ipc-${++index}`
        })(),
        assetIdFactory: (() => {
          let index = 0
          return () => `asset-list-ipc-${++index}`
        })(),
      })

      const graph: CanvasGraphSnapshot = {
        nodes: [
          {
            id: 'image-list-a',
            type: 'image',
            position: { x: 0, y: 0 },
            data: {
              label: 'Image A',
              promptOverride: 'first queued image',
              modelId: 'stub-image',
              orientation: 'square',
              assetId: null,
              status: 'idle',
            },
          },
          {
            id: 'image-list-b',
            type: 'image',
            position: { x: 240, y: 0 },
            data: {
              label: 'Image B',
              promptOverride: 'second queued image',
              modelId: 'stub-image',
              orientation: 'portrait',
              assetId: null,
              status: 'idle',
            },
          },
        ],
        edges: [],
        viewport: { x: 0, y: 0, zoom: 1 },
      }

      await handlers.get('canvas.saveGraph')?.({}, { projectId: 'default', graph })

      const first = await handlers.get('canvas.runNode')?.({}, { nodeId: 'image-list-a' }) as { jobId: string }
      const second = await handlers.get('canvas.runNode')?.({}, { nodeId: 'image-list-b' }) as { jobId: string }
      const latestImages = await handlers.get('job.list')?.({}, { type: 'canvas.generateImage', limit: 2 }) as JobRecord[]
      const targetOnly = await handlers.get('job.list')?.({}, { targetId: 'image-list-a' }) as JobRecord[]

      expect(latestImages.map((job) => job.id)).toEqual([second.jobId, first.jobId])
      expect(targetOnly.map((job) => job.id)).toEqual([first.jobId])
      expect(targetOnly[0]).toMatchObject({
        targetId: 'image-list-a',
        type: 'canvas.generateImage',
      })
    } finally {
      await runtime?.waitForIdleForTests()
      runtime?.close()
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('uses the requested workflow graph and default style when runNode includes workflowId', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-runtime-workflow-style-'))
    const dbPath = join(tempDir, 'runtime-workflow-style.sqlite')
    const assetRoot = join(tempDir, 'assets')
    const { ipcMain, handlers } = createFakeIpcMain()
    const window = createWindow()
    let runtime: MainProcessRuntime | null = null

    try {
      runtime = createMainProcessRuntime({
        ipcMain,
        dbPath,
        assetRoot,
        getWindows: () => [window],
        currentUserId: 'user-1',
        clock: (() => {
          let now = 1_783_302_000_000
          return () => now++
        })(),
        idFactory: (() => {
          let index = 0
          return () => `job-workflow-style-${++index}`
        })(),
        assetIdFactory: (() => {
          let index = 0
          return () => `asset-workflow-style-${++index}`
        })(),
      })

      const workflow = await handlers.get('canvas.createWorkflow')?.({}, { name: 'Styled episode' }) as { id: string }
      const graph: CanvasGraphSnapshot = {
        nodes: [
          { id: 'text-workflow', type: 'text', position: { x: 0, y: 0 }, data: { label: 'Prompt', content: 'rainy alley' } },
          {
            id: 'image-workflow',
            type: 'image',
            position: { x: 240, y: 0 },
            data: {
              label: 'Image',
              promptOverride: 'detective silhouette',
              modelId: 'stub-image',
              orientation: 'portrait',
              assetId: null,
              status: 'idle',
            },
          },
        ],
        edges: [{ id: 'edge-workflow', source: 'text-workflow', target: 'image-workflow', data: { edgeType: 'promptOrder', createdAt: 1 } }],
        viewport: { x: 0, y: 0, zoom: 1 },
      }

      await handlers.get('canvas.saveGraph')?.({}, { projectId: workflow.id, graph })
      await handlers.get('style.save')?.({}, {
        id: 'style-workflow-runtime',
        code: 'workflow-runtime',
        name: 'Workflow runtime style',
        promptBefore: 'noir manga frames',
        promptAfter: 'wet neon reflections',
        enabled: true,
      })
      await handlers.get('style.setProjectDefault')?.({}, { workflowId: workflow.id, stylePresetId: 'style-workflow-runtime' })

      const ticket = await handlers.get('canvas.runNode')?.({}, { workflowId: workflow.id, nodeId: 'image-workflow' }) as { jobId: string }
      await runtime.waitForIdleForTests()
      const asset = await handlers.get('asset.get')?.({}, {
        assetId: completedAssetId(window, ticket.jobId),
      }) as AssetRecord
      const expectedHash = expectedStubImageHash({
        prompt: 'noir manga frames\nrainy alley\ndetective silhouette\nwet neon reflections',
        idempotencyKey: ticket.jobId,
        parameters: { orientation: 'portrait' },
      })

      expect(asset.metadata?.hash).toBe(expectedHash)
    } finally {
      runtime?.close()
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('drains text polish runNode jobs as terminal text results', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-runtime-text-polish-'))
    const dbPath = join(tempDir, 'runtime-text-polish.sqlite')
    const assetRoot = join(tempDir, 'assets')
    const { ipcMain, handlers } = createFakeIpcMain()
    const window = createWindow()
    let runtime: MainProcessRuntime | null = null

    try {
      runtime = createMainProcessRuntime({
        ipcMain,
        dbPath,
        assetRoot,
        getWindows: () => [window],
        currentUserId: 'user-1',
        clock: (() => {
          let now = 1_783_303_000_000
          return () => now++
        })(),
        idFactory: (() => {
          let index = 0
          return () => `job-text-polish-runtime-${++index}`
        })(),
      })

      await handlers.get('canvas.saveGraph')?.({}, {
        projectId: 'default',
        graph: {
          nodes: [
            {
              id: 'text-polish-runtime',
              type: 'text',
              position: { x: 0, y: 0 },
              data: { label: 'Beat', content: ' rough line ' },
            },
          ],
          edges: [],
          viewport: { x: 0, y: 0, zoom: 1 },
        },
      })

      const ticket = await handlers.get('canvas.runNode')?.({}, { nodeId: 'text-polish-runtime' }) as { jobId: string }
      await runtime.waitForIdleForTests()
      const completed = findCompletedEvent(window, ticket.jobId)

      expect(completed?.result).toEqual({ kind: 'text', text: 'rough line' })
    } finally {
      runtime?.close()
      rmSync(tempDir, { recursive: true, force: true })
    }
  })

  it('is installed by the Electron main entrypoint', () => {
    const mainSource = readFileSync('desktop/src/main/index.ts', 'utf8')

    expect(mainSource).toContain('createMainProcessRuntime')
    expect(mainSource).toContain('ipcMain')
    expect(mainSource).toContain('app.getPath')
  })
})
