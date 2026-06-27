import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import type { GatewayConfigInput } from '../shared/gateway'
import type { IpcInvokeChannel } from '../shared/ipc'
import { registerCanvasHandlers } from '../desktop/src/main/ipc/canvas.handler'
import type { CanvasGraphSnapshot } from '../shared/graph'
import { registerGatewayHandlers } from '../desktop/src/main/ipc/gateway.handler'

type Handler = (_event: unknown, request: unknown) => unknown

function createFakeIpcMain(): { handlers: Map<string, Handler>; ipcMain: { handle(channel: string, handler: Handler): void } } {
  const handlers = new Map<string, Handler>()

  return {
    handlers,
    ipcMain: {
      handle(channel, handler) {
        handlers.set(channel, handler)
      },
    },
  }
}

const gatewayInput: GatewayConfigInput = {
  id: 'gw-task-51',
  name: 'Task 51 Gateway',
  type: 'stub',
  baseUrl: 'local://task-51',
  auth: { mode: 'apiKey', secret: 'should-not-render' },
  capabilities: ['text', 'image'],
  modelMap: { text: 'task-text', image: 'task-image' },
  enabled: true,
}

describe('Task 51 model catalog IPC', () => {
  it('exposes model catalog through the sandboxed preload bridge', () => {
    const source = readFileSync('desktop/src/preload/index.ts', 'utf8')

    expect(source).toContain('listGatewayModels')
    expect(source).toContain("invokeMain('gateway.models'")
    expect(source).toContain("function invokeMain<TChannel extends 'gateway.models'>")
  })

  it('registers and returns renderer-safe model catalog from enabled gateways', async () => {
    const { ipcMain, handlers } = createFakeIpcMain()
    registerGatewayHandlers(ipcMain)

    expect(Array.from(handlers.keys()).sort()).toContain('gateway.models' satisfies IpcInvokeChannel)

    await handlers.get('gateway.save')?.({}, gatewayInput)
    const catalog = await handlers.get('gateway.models')?.({}, {})
    const serialized = JSON.stringify(catalog)

    expect(catalog).toMatchObject({
      models: {
        text: expect.arrayContaining([expect.objectContaining({ id: 'task-text', channel: 'text', gatewayId: 'gw-task-51', gatewayName: 'Task 51 Gateway', enabled: true })]),
        image: expect.arrayContaining([expect.objectContaining({ id: 'task-image', channel: 'image', gatewayId: 'gw-task-51', gatewayName: 'Task 51 Gateway', enabled: true })]),
      },
      capabilityFlags: {
        text: true,
        image: true,
      },
    })
    expect(serialized).not.toContain('should-not-render')
    expect(serialized).not.toContain('vault:')
  })

  it('feeds the current model catalog into strict canvas validation dynamically', async () => {
    const { ipcMain, handlers } = createFakeIpcMain()
    registerGatewayHandlers(ipcMain)
    registerCanvasHandlers(ipcMain, {
      modelCatalog: () => handlers.get('gateway.models')?.({}, {}) as { availableModelIds: string[] },
    })
    const graph: CanvasGraphSnapshot = {
      nodes: [
        {
          id: 'image-1',
          type: 'image',
          position: { x: 0, y: 0 },
          data: {
            label: 'Image',
            promptOverride: 'city',
            modelId: 'fresh-image-model',
            orientation: 'landscape',
            status: 'idle',
          },
        },
      ],
      edges: [],
      viewport: { x: 0, y: 0, zoom: 1 },
    }

    const before = await handlers.get('canvas.validateGraph')?.({}, {
      graph,
      mode: 'strict',
    }) as { valid: boolean; issues: Array<{ code: string; refId?: string }> }
    expect(before).toMatchObject({
      valid: false,
      issues: [{ code: 'unavailable_model', refId: 'fresh-image-model' }],
    })

    await handlers.get('gateway.save')?.({}, {
      ...gatewayInput,
      id: 'gw-fresh-model',
      modelMap: { image: 'fresh-image-model' },
      capabilities: ['image'],
    })

    const after = await handlers.get('canvas.validateGraph')?.({}, {
      graph,
      mode: 'strict',
    }) as { valid: boolean; issues: Array<{ code: string }> }
    expect(after.valid).toBe(true)
    expect(after.issues).toEqual([])
  })
})
