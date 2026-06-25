import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { registerToolHandlers } from '../desktop/src/main/ipc/tool.handler'
import { createToolRuntime, defineTool } from '../desktop/src/main/tools/runtime'
import type { IpcInvokeChannel } from '../shared/ipc'

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

function createRuntime() {
  return createToolRuntime({
    idFactory: () => 'invoke-tool-1',
    clock: () => 1_783_400_000_000,
    tools: [
      defineTool({
        descriptor: {
          id: 'canvas.queryGraph',
          name: 'Query Canvas Graph',
          description: 'Reads the current canvas graph snapshot.',
          category: 'canvas',
          owner: { kind: 'builtin', id: 'core' },
          inputSchemaRef: 'canvas.queryGraph.input',
          outputSchemaRef: 'canvas.graph.output',
          permissions: [{ kind: 'canvas.read', reason: 'Reads the current canvas graph.' }],
          concurrency: 'readonly',
          enabled: true
        },
        inputSchema: z.object({}),
        outputSchema: z.object({ ok: z.boolean() }),
        renderToolUseMessage: () => 'Query canvas graph',
        call() {
          return { ok: true }
        }
      })
    ]
  })
}

describe('M5 tool management IPC', () => {
  it('registers tool list, invoke, enable, and disable handlers', () => {
    const { ipcMain, handlers } = createFakeIpcMain()

    registerToolHandlers(ipcMain, { runtime: createRuntime(), currentUserId: 'user-1' })

    expect(Array.from(handlers.keys()).sort()).toEqual([
      'tool.disable',
      'tool.enable',
      'tool.invoke',
      'tool.list'
    ] satisfies IpcInvokeChannel[])
  })

  it('lists disabled tools and prevents disabled invocations through ToolRuntime', async () => {
    const { ipcMain, handlers } = createFakeIpcMain()
    registerToolHandlers(ipcMain, { runtime: createRuntime(), currentUserId: 'user-1' })

    expect(await handlers.get('tool.list')?.({}, {})).toEqual([
      expect.objectContaining({ id: 'canvas.queryGraph', enabled: true, concurrency: 'readonly' })
    ])

    expect(await handlers.get('tool.disable')?.({}, { toolId: 'canvas.queryGraph' })).toMatchObject({
      id: 'canvas.queryGraph',
      enabled: false
    })
    expect(await handlers.get('tool.list')?.({}, { includeDisabled: true })).toEqual([
      expect.objectContaining({ id: 'canvas.queryGraph', enabled: false })
    ])

    const denied = await handlers.get('tool.invoke')?.({}, { toolId: 'canvas.queryGraph', input: {}, traceId: 'trace-disabled' })

    expect(denied).toMatchObject({
      invocationId: 'invoke-tool-1',
      toolId: 'canvas.queryGraph',
      status: 'failed'
    })
  })
})
