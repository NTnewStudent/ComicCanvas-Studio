import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it, vi } from 'vitest'

import type { JobTerminalEvent } from '../shared/jobs'
import { createMainProcessRuntime } from '../desktop/src/main/runtime'
import type { MainProcessRuntime } from '../desktop/src/main/runtime'

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

  it('is installed by the Electron main entrypoint', () => {
    const mainSource = readFileSync('desktop/src/main/index.ts', 'utf8')

    expect(mainSource).toContain('createMainProcessRuntime')
    expect(mainSource).toContain('ipcMain')
    expect(mainSource).toContain('app.getPath')
  })
})
