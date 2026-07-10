import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import type { IpcInvokeChannel } from '../shared/ipc'
import { createAgentRegistry } from '../desktop/src/main/agent/registry'
import type { AgentRepository } from '../desktop/src/main/db/repositories/agent.repo'
import { registerAgentHandlers } from '../desktop/src/main/ipc/agent.handler'
import { registerAssetHandlers } from '../desktop/src/main/ipc/asset.handler'
import { registerCanvasHandlers } from '../desktop/src/main/ipc/canvas.handler'
import { registerCanvasSnippetHandlers } from '../desktop/src/main/ipc/canvas-snippet.handler'
import { createSafeErrorEnvelope, registerGatewayHandlers } from '../desktop/src/main/ipc/gateway.handler'
import { registerJobHandlers } from '../desktop/src/main/ipc/job.handler'
import { registerStyleHandlers } from '../desktop/src/main/ipc/style.handler'
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
    registerCanvasSnippetHandlers(ipcMain)
    registerJobHandlers(ipcMain)
    registerAssetHandlers(ipcMain)
    registerGatewayHandlers(ipcMain)
    registerStyleHandlers(ipcMain)
    registerAgentHandlers(ipcMain, { registry: agentRegistry })
    registerToolHandlers(ipcMain, { runtime: createToolRuntime(), currentUserId: 'user-local' })

    expect(Array.from(handlers.keys()).sort()).toEqual([
      'agent.approveTool',
      'agent.delete',
      'agent.denyTool',
      'agent.getRun',
      'agent.list',
      'agent.run',
      'agent.save',
      'agent.spawn',
      'asset.assignCategory',
      'asset.createCategory',
      'asset.createFolder',
      'asset.deleteFolder',
      'asset.get',
      'asset.getCategories',
      'asset.getFolders',
      'asset.import',
      'asset.list',
      'asset.move',
      'asset.pickImportFiles',
      'asset.removeCategory',
      'asset.rename',
      'asset.trash',
      'asset.updateCategory',
      'canvas.applyPlan',
      'canvas.chatGetPlan',
      'canvas.chatSend',
      'canvas.copyWorkflowTemplate',
      'canvas.createWorkflow',
      'canvas.deleteWorkflow',
      'canvas.exportWorkflow',
      'canvas.importWorkflow',
      'canvas.listWorkflowTemplates',
      'canvas.listWorkflowVersions',
      'canvas.listWorkflows',
      'canvas.loadGraph',
      'canvas.publishWorkflowTemplate',
      'canvas.renameWorkflow',
      'canvas.restoreWorkflowVersion',
      'canvas.runNode',
      'canvas.runPlan',
      'canvas.saveGraph',
      'canvas.validateGraph',
      'canvasSnippet.delete',
      'canvasSnippet.get',
      'canvasSnippet.list',
      'canvasSnippet.save',
      'gateway.delete',
      'gateway.fetchModels',
      'gateway.list',
      'gateway.models',
      'gateway.reload',
      'gateway.save',
      'gateway.test',
      'job.enqueue',
      'job.get',
      'job.list',
      'job.recover',
      'style.delete',
      'style.getProjectDefault',
      'style.list',
      'style.save',
      'style.setProjectDefault',
      'tool.disable',
      'tool.enable',
      'tool.invoke',
      'tool.list'
    ] satisfies IpcInvokeChannel[])
  })

  it('routes agent.run and agent.getRun through the injected runtime', () => {
    const { ipcMain, handlers } = createFakeIpcMain()
    const agentRegistry = createAgentRegistry({ agents: createAgentRepo() })
    let denialCalls = 0

    registerAgentHandlers(ipcMain, {
      registry: agentRegistry,
      runtime: {
        agentRun(input) {
          expect(input).toEqual({ agentId: 'orchestrator', message: '规划一组漫画节点' })
          return { runId: 'run-agent-ipc', jobId: 'job-agent-ipc', status: 'pending' }
        },
        approveTool(input) {
          expect(input).toEqual({ runId: 'run-agent-ipc', callId: 'call-1', approvedBy: 'user-local' })
          return { runId: 'run-agent-ipc', jobId: 'job-agent-approval-ipc', status: 'pending' }
        },
        denyTool(input) {
          denialCalls += 1
          expect(input).toEqual({ runId: 'run-agent-ipc', callId: 'call-1', deniedBy: 'user-local' })
          return { runId: 'run-agent-ipc', status: 'aborted', errorClass: 'agent_tool_denied' }
        },
        getRun(runId) {
          expect(runId).toBe('run-agent-ipc')
          return { runId, status: 'pending', trace: { agentId: 'orchestrator' } }
        }
      },
      spawnSubAgent(input) {
        expect(input).toEqual({
          spec: {
            task: 'Summarize graph',
            systemPrompt: 'Read only.',
            allowedTools: ['canvas.queryGraph'],
            maxTurns: 2
          },
          depth: 0
        })

        return {
          output: 'Graph summary',
          status: 'completed',
          turnsUsed: 1,
          droppedTools: [],
          droppedSkills: [],
          trace: {
            runId: 'run-child-ipc',
            parentRunId: 'run-agent-ipc',
            parentTraceId: 'trace-agent-ipc',
            depth: 1,
            startedAt: 1,
            completedAt: 2,
            requestedTools: ['canvas.queryGraph'],
            effectiveTools: ['canvas.queryGraph'],
            requestedSkills: [],
            effectiveSkills: [],
            droppedTools: [],
            droppedSkills: [],
            status: 'completed'
          }
        }
      }
    })

    expect(handlers.get('agent.run')?.({}, { agentId: 'orchestrator', message: '规划一组漫画节点' })).toEqual({
      runId: 'run-agent-ipc',
      jobId: 'job-agent-ipc',
      status: 'pending'
    })
    expect(handlers.get('agent.approveTool')?.({}, { runId: 'run-agent-ipc', callId: 'call-1', approvedBy: 'user-local' })).toEqual({
      runId: 'run-agent-ipc',
      jobId: 'job-agent-approval-ipc',
      status: 'pending'
    })
    expect(handlers.get('agent.denyTool')?.({}, { runId: ' run-agent-ipc ', callId: ' call-1 ', deniedBy: ' user-local ' })).toEqual({
      runId: 'run-agent-ipc',
      status: 'aborted',
      errorClass: 'agent_tool_denied'
    })
    expect(() => handlers.get('agent.denyTool')?.({}, {
      runId: ' ',
      callId: 'call-1',
      deniedBy: 'user-local'
    })).toThrow()
    expect(() => handlers.get('agent.denyTool')?.({}, {
      runId: 'run-agent-ipc',
      callId: 'x'.repeat(257),
      deniedBy: 'user-local'
    })).toThrow()
    expect(denialCalls).toBe(1)
    expect(handlers.get('agent.getRun')?.({}, { runId: 'run-agent-ipc' })).toEqual({
      runId: 'run-agent-ipc',
      status: 'pending',
      trace: { agentId: 'orchestrator' }
    })
    expect(handlers.get('agent.spawn')?.({}, {
      spec: {
        task: 'Summarize graph',
        systemPrompt: 'Read only.',
        allowedTools: ['canvas.queryGraph'],
        maxTurns: 2
      },
      depth: 0
    })).toMatchObject({
      output: 'Graph summary',
      status: 'completed',
      trace: {
        runId: 'run-child-ipc',
        parentRunId: 'run-agent-ipc'
      }
    })
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
          expect(input).toEqual({ message: '生成宇宙飞船', agentId: 'general-purpose', requestedBy: 'user-local' })
          return { runId: 'run-agent-1', jobId: 'job-agent-1', messageId: 'message-1', status: 'pending' }
        },
        getPlan(messageId) {
          expect(messageId).toBe('message-1')
          return plan
        }
      }
    })

    expect(handlers.get('canvas.chatSend')?.({}, { message: '生成宇宙飞船' })).toEqual({
      runId: 'run-agent-1',
      jobId: 'job-agent-1',
      messageId: 'message-1',
      status: 'pending'
    })
    expect(handlers.get('canvas.chatGetPlan')?.({}, { messageId: 'message-1' })).toEqual(plan)
  })

  it('enqueues canvas.runNode through the injected durable queue when available', async () => {
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

    await expect(handlers.get('canvas.runNode')?.({}, { nodeId: 'image-1' })).resolves.toEqual({
      jobId: 'job-image-1',
      status: 'pending',
      createdAt: 1_783_200_000_000
    })
    expect(enqueueCalls).toEqual([
      {
        type: 'canvas.generateImage',
        targetId: 'image-1',
        payload: { nodeId: 'image-1', references: [] },
        requestedBy: { type: 'user', id: 'user-1' }
      }
    ])
  })

  it('documents every new IPC handler with API contract anchors', () => {
    for (const file of ['canvas.handler.ts', 'canvas-snippet.handler.ts', 'job.handler.ts', 'asset.handler.ts', 'gateway.handler.ts', 'style.handler.ts', 'agent.handler.ts', 'tool.handler.ts']) {
      const source = readFileSync(`desktop/src/main/ipc/${file}`, 'utf8')

      expect(source, `${file} must link to an API contract`).toMatch(/@see docs\/api-contracts\//u)
    }
  })
})
