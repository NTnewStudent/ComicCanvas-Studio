import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import type { IpcInvokeChannel } from '../shared/ipc'
import { createAgentRegistry } from '../desktop/src/main/agent/registry'
import type { AgentRepository } from '../desktop/src/main/db/repositories/agent.repo'
import { registerAgentHandlers } from '../desktop/src/main/ipc/agent.handler'
import { registerAssetHandlers } from '../desktop/src/main/ipc/asset.handler'
import { registerCanvasHandlers } from '../desktop/src/main/ipc/canvas.handler'
import { createSafeErrorEnvelope, registerGatewayHandlers } from '../desktop/src/main/ipc/gateway.handler'
import { registerJobHandlers } from '../desktop/src/main/ipc/job.handler'
import { registerToolHandlers } from '../desktop/src/main/ipc/tool.handler'
import { createToolRuntime } from '../desktop/src/main/tools/runtime'

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

function createAgentRepo(): AgentRepository {
  return {
    list: () => [],
    upsert: (agent) => agent,
    delete: () => false
  }
}

describe('M1 IPC skeleton', () => {
  it('registers canvas, job, asset, gateway, and agent invoke handlers', () => {
    const { ipcMain, handlers } = createFakeIpcMain()
    const agentRegistry = createAgentRegistry({ agents: createAgentRepo() })

    registerCanvasHandlers(ipcMain)
    registerJobHandlers(ipcMain)
    registerAssetHandlers(ipcMain)
    registerGatewayHandlers(ipcMain)
    registerAgentHandlers(ipcMain, { registry: agentRegistry })
    registerToolHandlers(ipcMain, { runtime: createToolRuntime(), currentUserId: 'user-local' })

    expect(Array.from(handlers.keys()).sort()).toEqual([
      'agent.delete',
      'agent.list',
      'agent.save',
      'asset.createFolder',
      'asset.deleteFolder',
      'asset.get',
      'asset.getFolders',
      'asset.import',
      'asset.list',
      'asset.move',
      'asset.trash',
      'canvas.chatGetPlan',
      'canvas.chatSend',
      'canvas.loadGraph',
      'canvas.runNode',
      'canvas.saveGraph',
      'gateway.delete',
      'gateway.list',
      'gateway.reload',
      'gateway.save',
      'gateway.test',
      'job.enqueue',
      'job.get',
      'job.list',
      'tool.disable',
      'tool.enable',
      'tool.invoke',
      'tool.list'
    ] satisfies IpcInvokeChannel[])
  })

  it('returns safe error envelopes without stack traces or raw errors', () => {
    const error = createSafeErrorEnvelope(new Error('provider key sk-test-secret failed'), 'trace-1')

    expect(error).toEqual({
      errorClass: 'internal_error',
      message: 'Request failed',
      traceId: 'trace-1',
      retryable: false
    })
    expect(JSON.stringify(error)).not.toContain('sk-test-secret')
    expect(JSON.stringify(error)).not.toContain('stack')
  })

  it('keeps synchronous IPC responses free of bytes and filesystem paths', async () => {
    const { ipcMain, handlers } = createFakeIpcMain()
    registerCanvasHandlers(ipcMain)
    registerGatewayHandlers(ipcMain)
    registerAssetHandlers(ipcMain)

    const runNode = await handlers.get('canvas.runNode')?.({}, { nodeId: 'image-1' })
    const gatewayTest = await handlers.get('gateway.test')?.({}, { gatewayId: 'stub-main', channel: 'image' })
    const assetGet = await handlers.get('asset.get')?.({}, { assetId: 'asset-1' })
    const serialized = JSON.stringify({ runNode, gatewayTest, assetGet })

    expect(runNode).toMatchObject({ status: 'pending' })
    expect(gatewayTest).toMatchObject({ status: 'pending' })
    expect(assetGet).toMatchObject({
      id: 'asset-1',
      safeUrl: 'cc-asset://asset/asset-1',
      relativePath: 'generated/image/asset-1.png'
    })
    expect(serialized).not.toMatch(/bytes|data:|[A-Za-z]:\\\\|\/tmp\/|provider_/u)
  })

  it('routes canvas chat IPC through an injected orchestrator runtime', () => {
    const { ipcMain, handlers } = createFakeIpcMain()
    const plan = {
      kind: 'clarify' as const,
      summary: 'Need more information',
      nodes: [],
      edges: [],
      runSteps: [],
      question: '请补充画面主体。',
      dropped: []
    }

    registerCanvasHandlers(ipcMain, {
      orchestrator: {
        chatSend(input) {
          expect(input).toEqual({ message: '生成宇宙飞船', agentId: 'orchestrator', requestedBy: 'user-local' })
          return { jobId: 'job-agent-1', messageId: 'message-1', status: 'pending' }
        },
        getPlan(messageId) {
          expect(messageId).toBe('message-1')
          return plan
        }
      }
    })

    expect(handlers.get('canvas.chatSend')?.({}, { message: '生成宇宙飞船', agentId: 'orchestrator' })).toEqual({
      jobId: 'job-agent-1',
      messageId: 'message-1',
      status: 'pending'
    })
    expect(handlers.get('canvas.chatGetPlan')?.({}, { messageId: 'message-1' })).toEqual(plan)
  })

  it('enqueues canvas.runNode through the injected durable queue when available', () => {
    const { ipcMain, handlers } = createFakeIpcMain()
    const enqueueCalls: unknown[] = []

    registerCanvasHandlers(ipcMain, {
      currentUserId: 'user-1',
      queue: {
        enqueue(input) {
          enqueueCalls.push(input)
          return { jobId: 'job-image-1', status: 'pending', createdAt: 1_783_200_000_000 }
        }
      }
    })

    expect(handlers.get('canvas.runNode')?.({}, { nodeId: 'image-1' })).toEqual({
      jobId: 'job-image-1',
      status: 'pending',
      createdAt: 1_783_200_000_000
    })
    expect(enqueueCalls).toEqual([
      {
        type: 'canvas.generateImage',
        targetId: 'image-1',
        payload: { nodeId: 'image-1' },
        requestedBy: { type: 'user', id: 'user-1' }
      }
    ])
  })

  it('documents every new IPC handler with API contract anchors', () => {
    for (const file of ['canvas.handler.ts', 'job.handler.ts', 'asset.handler.ts', 'gateway.handler.ts', 'agent.handler.ts', 'tool.handler.ts']) {
      const source = readFileSync(`desktop/src/main/ipc/${file}`, 'utf8')

      expect(source, `${file} must link to an API contract`).toMatch(/@see docs\/api-contracts\//u)
    }
  })
})
