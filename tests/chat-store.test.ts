import { describe, expect, it, vi } from 'vitest'

import { createChatStore, type ChatStoreApi } from '../desktop/src/renderer/src/chat/store/chat.store'
import type { CanvasPlan } from '../shared/plan'

const samplePlan: CanvasPlan = {
  kind: 'plan',
  summary: '生成一个图片节点。',
  nodes: [{ ref: 'image-1', type: 'imageConfigV2', title: '图片', data: { modelId: 'stub-image', orientation: 'landscape' } }],
  edges: [],
  runSteps: [{ ref: 'image-1', action: 'imageRun' }],
  question: null,
  dropped: [],
}

type Handler<T> = (event: T) => void

interface CapturedHandlers {
  planReady: Handler<{ messageId: string; planId: string }> | null
  responseReady: Handler<{ runId: string; messageId: string; response: { type: 'answer'; summary: string; text: string; dropped: string[] } }> | null
  delta: Handler<{ runId: string; messageId: string; delta: string }> | null
  toolStarted: Handler<{ runId: string; messageId: string; callId: string; toolId: string; inputSummary: string }> | null
  toolCompleted: Handler<{ runId: string; messageId: string; callId: string; toolId: string; invocationId: string; status: 'completed' | 'failed' | 'denied'; summary: string }> | null
  permissionRequired: Handler<{ runId: string; messageId: string; callId: string; toolId: string; reason: string }> | null
  jobProgress: Handler<{ jobId: string; progress: number; message?: string }> | null
  jobCompleted: Handler<{ jobId: string; result: { kind: string; runId?: string; response?: { type: 'answer'; summary: string; text: string; dropped: string[] } } }> | null
  jobFailed: Handler<{ jobId: string; error: { errorClass: string; message: string; retryable: boolean; details?: Record<string, unknown> } }> | null
}

function createFakeApi(overrides: Partial<ChatStoreApi> = {}): { api: ChatStoreApi; handlers: CapturedHandlers } {
  const handlers: CapturedHandlers = {
    planReady: null,
    responseReady: null,
    delta: null,
    toolStarted: null,
    toolCompleted: null,
    permissionRequired: null,
    jobProgress: null,
    jobCompleted: null,
    jobFailed: null,
  }

  const api: ChatStoreApi = {
    sendCanvasChat: vi.fn().mockResolvedValue({ runId: 'run-1', jobId: 'job-1', messageId: 'message-1', status: 'pending' }),
    getCanvasPlan: vi.fn().mockResolvedValue(samplePlan),
    approveAgentTool: vi.fn().mockResolvedValue({ runId: 'run-1', jobId: 'job-2', status: 'pending' }),
    onCanvasPlanReady: (handler) => { handlers.planReady = handler; return vi.fn() },
    onAgentResponseReady: (handler) => { handlers.responseReady = handler; return vi.fn() },
    onAgentDelta: (handler) => { handlers.delta = handler; return vi.fn() },
    onAgentToolStarted: (handler) => { handlers.toolStarted = handler; return vi.fn() },
    onAgentToolCompleted: (handler) => { handlers.toolCompleted = handler; return vi.fn() },
    onAgentPermissionRequired: (handler) => { handlers.permissionRequired = handler; return vi.fn() },
    onJobProgress: (handler) => { handlers.jobProgress = handler; return vi.fn() },
    onJobCompleted: (handler) => { handlers.jobCompleted = handler; return vi.fn() },
    onJobFailed: (handler) => { handlers.jobFailed = handler; return vi.fn() },
    ...overrides,
  }

  return { api, handlers }
}

async function flush(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

describe('chat store', () => {
  it('appends a user turn immediately and a pending assistant turn after the ticket resolves', async () => {
    const { api } = createFakeApi()
    const { store } = createChatStore({ api, clock: () => 1_784_100_000_000 })

    await store.getState().send({ message: '生成一个图片节点', agentId: 'general-purpose' })

    const turns = store.getState().turns
    expect(turns).toHaveLength(2)
    expect(turns[0]).toMatchObject({ role: 'user', blocks: [{ kind: 'text', markdown: '生成一个图片节点' }] })
    expect(turns[1]).toMatchObject({ role: 'assistant', messageId: 'message-1', runId: 'run-1' })
    expect(turns[1]!.blocks).toContainEqual({ kind: 'thinking', lines: ['Agent 已排队：job-1'] })
    expect(store.getState().busy).toBe(true)
  })

  it('routes delta, tool, and progress events into the pending assistant turn blocks', async () => {
    const { api, handlers } = createFakeApi()
    const { store } = createChatStore({ api })

    await store.getState().send({ message: 'hi', agentId: 'general-purpose' })

    handlers.jobProgress?.({ jobId: 'job-1', progress: 10, message: '理解用户输入' })
    handlers.delta?.({ runId: 'run-1', messageId: 'message-1', delta: '你好' })
    handlers.toolStarted?.({ runId: 'run-1', messageId: 'message-1', callId: 'call-1', toolId: 'canvas.queryGraph', inputSummary: '{}' })
    handlers.toolCompleted?.({ runId: 'run-1', messageId: 'message-1', callId: 'call-1', toolId: 'canvas.queryGraph', invocationId: 'inv-1', status: 'completed', summary: '3 nodes' })
    handlers.delta?.({ runId: 'run-1', messageId: 'other-message', delta: '不该出现' })

    const assistant = store.getState().turns[1]!
    expect(assistant.blocks).toEqual([
      { kind: 'thinking', lines: ['Agent 已排队：job-1', '理解用户输入'] },
      { kind: 'text', markdown: '你好', streaming: true },
      { kind: 'toolCall', callId: 'call-1', toolId: 'canvas.queryGraph', status: 'completed', inputSummary: '{}', resultSummary: '3 nodes', isSubAgent: false },
    ])
  })

  it('completes the turn on job.completed when responseReady was missed', async () => {
    const { api, handlers } = createFakeApi()
    const { store } = createChatStore({ api })

    await store.getState().send({ message: '你好啊', agentId: 'general-purpose' })
    handlers.jobCompleted?.({
      jobId: 'job-1',
      result: {
        kind: 'agentRun',
        runId: 'run-1',
        response: { type: 'answer', summary: '寒暄', text: '你好，我在。', dropped: [] },
      },
    })

    const assistant = store.getState().turns[1]!
    expect(assistant.status).toBe('completed')
    expect(assistant.blocks).toContainEqual({ kind: 'text', markdown: '你好，我在。', streaming: false })
    expect(store.getState().busy).toBe(false)
  })

  it('completes the turn on responseReady and clears busy', async () => {
    const { api, handlers } = createFakeApi()
    const { store } = createChatStore({ api })

    await store.getState().send({ message: '今天星期几', agentId: 'general-purpose' })
    handlers.responseReady?.({ runId: 'run-1', messageId: 'message-1', response: { type: 'answer', summary: 's', text: '星期三。', dropped: [] } })

    const assistant = store.getState().turns[1]!
    expect(assistant.status).toBe('completed')
    expect(assistant.blocks).toContainEqual({ kind: 'text', markdown: '星期三。', streaming: false })
    expect(store.getState().busy).toBe(false)
  })

  it('fetches the plan on planReady, stores it by ID, and auto-applies when autoExecute is on', async () => {
    const applyPlan = vi.fn()
    const getCanvasPlan = vi.fn().mockResolvedValue(samplePlan)
    const { api, handlers } = createFakeApi({ getCanvasPlan })
    const { store } = createChatStore({ api, applyPlan })

    store.getState().setAutoExecute(true)
    await store.getState().send({ message: '生成图片', agentId: 'general-purpose' })
    handlers.planReady?.({ messageId: 'message-1', planId: 'plan-1' })
    await flush()

    expect(getCanvasPlan).toHaveBeenCalledWith({ messageId: 'message-1' })
    expect(store.getState().plansById['plan-1']).toEqual(samplePlan)
    expect(applyPlan).toHaveBeenCalledWith(samplePlan, { autoExecute: true })
    expect(store.getState().appliedPlanIds).toContain('plan-1')

    const assistant = store.getState().turns[1]!
    expect(assistant.status).toBe('completed')
    expect(assistant.blocks).toContainEqual({ kind: 'plan', planId: 'plan-1' })
    expect(store.getState().busy).toBe(false)
  })

  it('keeps the plan manual when autoExecute is off', async () => {
    const applyPlan = vi.fn()
    const { api, handlers } = createFakeApi()
    const { store } = createChatStore({ api, applyPlan })

    await store.getState().send({ message: '生成图片', agentId: 'general-purpose' })
    handlers.planReady?.({ messageId: 'message-1', planId: 'plan-1' })
    await flush()

    expect(applyPlan).not.toHaveBeenCalled()
    expect(store.getState().plansById['plan-1']).toEqual(samplePlan)
    expect(store.getState().appliedPlanIds).not.toContain('plan-1')

    store.getState().markPlanApplied('plan-1')
    expect(store.getState().appliedPlanIds).toContain('plan-1')
  })

  it('stops waiting without clearing the transcript', async () => {
    const { api } = createFakeApi()
    const { store } = createChatStore({ api })

    await store.getState().send({ message: 'hi', agentId: 'general-purpose' })
    expect(store.getState().busy).toBe(true)

    store.getState().stopWaiting()
    expect(store.getState().busy).toBe(false)
    expect(store.getState().pending).toBeNull()
    expect(store.getState().turns).toHaveLength(2)
  })

  it('tracks permission blocks and resolves them through approvePermission', async () => {
    const approveAgentTool = vi.fn().mockResolvedValue({ runId: 'run-1', jobId: 'job-2', status: 'pending' })
    const { api, handlers } = createFakeApi({ approveAgentTool })
    const { store } = createChatStore({ api })

    await store.getState().send({ message: '删掉节点', agentId: 'general-purpose' })
    handlers.permissionRequired?.({ runId: 'run-1', messageId: 'message-1', callId: 'call-9', toolId: 'canvas.deleteNode', reason: '删除需要确认' })

    expect(store.getState().turns[1]!.blocks).toContainEqual(
      { kind: 'permission', callId: 'call-9', toolId: 'canvas.deleteNode', reason: '删除需要确认', resolved: false },
    )

    await store.getState().approvePermission('call-9', 'run')

    expect(approveAgentTool).toHaveBeenCalledWith({
      runId: 'run-1',
      callId: 'call-9',
      approvedBy: 'chat-user',
      scope: 'run'
    })
    expect(store.getState().turns[1]!.blocks).toContainEqual(
      {
        kind: 'permission',
        callId: 'call-9',
        toolId: 'canvas.deleteNode',
        reason: '删除需要确认',
        resolved: true,
        scope: 'run'
      },
    )
    expect(store.getState().busy).toBe(true)
  })

  it('reconciles a missed terminal response from the persisted run projection', async () => {
    const { api } = createFakeApi({
      getAgentRun: vi.fn().mockResolvedValue({
        runId: 'run-1',
        status: 'completed',
        trace: {},
        projection: {
          chatTurn: {
            id: 'run-1-assistant',
            role: 'assistant',
            runId: 'run-1',
            messageId: 'message-1',
            blocks: [{ kind: 'text', markdown: '你好，我在。', streaming: false }],
            status: 'completed',
            createdAt: 1
          },
          taskTree: [],
          inspector: {
            runId: 'run-1',
            status: 'completed',
            agentId: 'general-purpose',
            workflowId: 'default',
            trigger: 'canvasChat',
            modelLabel: 'local',
            latestEventType: 'run.completed',
            tools: [],
            permissions: [],
            artifacts: [],
            childTasks: []
          },
          artifacts: []
        }
      })
    })
    const { store } = createChatStore({ api })

    await store.getState().send({ message: 'hi', agentId: 'general-purpose' })
    await flush()

    expect(store.getState().turns[1]?.blocks).toEqual([
      { kind: 'text', markdown: '你好，我在。', streaming: false }
    ])
    expect(store.getState().busy).toBe(false)
    expect(store.getState().activeRunView?.projection?.inspector.latestEventType).toBe('run.completed')
  })

  it('fails the turn with agent_tool_denied when the user denies a permission', async () => {
    const { api, handlers } = createFakeApi()
    const { store } = createChatStore({ api })

    await store.getState().send({ message: '删掉节点', agentId: 'general-purpose' })
    handlers.permissionRequired?.({ runId: 'run-1', messageId: 'message-1', callId: 'call-9', toolId: 'canvas.deleteNode', reason: '删除需要确认' })
    store.getState().denyPermission('call-9')

    const assistant = store.getState().turns[1]!
    expect(assistant.status).toBe('failed')
    expect(assistant.blocks).toContainEqual(expect.objectContaining({ kind: 'error', errorClass: 'agent_tool_denied' }))
    expect(store.getState().busy).toBe(false)
  })

  it('synthesizes a permission block from approval-required job failures', async () => {
    const { api, handlers } = createFakeApi()
    const { store } = createChatStore({ api })

    await store.getState().send({ message: '删掉节点', agentId: 'general-purpose' })
    handlers.jobFailed?.({
      jobId: 'job-1',
      error: {
        errorClass: 'agent_tool_approval_required',
        message: '等待批准',
        retryable: true,
        details: { pendingApproval: { callId: 'call-7', toolId: 'canvas.deleteSelection', reason: '批量删除需要确认' } },
      },
    })

    expect(store.getState().turns[1]!.blocks).toContainEqual(
      { kind: 'permission', callId: 'call-7', toolId: 'canvas.deleteSelection', reason: '批量删除需要确认', resolved: false },
    )
    expect(store.getState().busy).toBe(true)
  })

  it('fails the turn with an error block on generic job failure', async () => {
    const { api, handlers } = createFakeApi()
    const { store } = createChatStore({ api })

    await store.getState().send({ message: 'hi', agentId: 'general-purpose' })
    handlers.jobFailed?.({ jobId: 'job-1', error: { errorClass: 'agent_run_failed', message: '运行失败', retryable: false } })

    const assistant = store.getState().turns[1]!
    expect(assistant.status).toBe('failed')
    expect(assistant.blocks).toContainEqual({ kind: 'error', errorClass: 'agent_run_failed', message: '运行失败', retryable: false })
    expect(store.getState().busy).toBe(false)
  })

  it('restores persisted turns and keeps clearView renderer-only', async () => {
    const { api } = createFakeApi({
      getChatHistory: vi.fn().mockResolvedValue([
        { id: 'user-1', role: 'user', blocks: [{ kind: 'text', markdown: '历史消息', streaming: false }], status: 'completed', createdAt: 1 },
        { id: 'assistant-1', role: 'assistant', blocks: [{ kind: 'text', markdown: '历史回答', streaming: false }], status: 'completed', createdAt: 2 },
      ]),
    })
    const { store } = createChatStore({ api })

    await store.getState().restore('workflow-1')
    expect(store.getState().turns).toHaveLength(2)

    store.getState().clearView()
    expect(store.getState().turns).toHaveLength(0)
    expect(store.getState().busy).toBe(false)
  })
})
