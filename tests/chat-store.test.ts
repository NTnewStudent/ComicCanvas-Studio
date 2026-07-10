import { describe, expect, it, vi } from 'vitest'

import { createChatStore, type ChatStoreApi } from '../desktop/src/renderer/src/chat/store/chat.store'
import type { AgentRunEventPayload, AgentRunEventType } from '../shared/agent-run-events'
import type { AgentRunViewResponse } from '../shared/agents'
import type { ChatTurn } from '../shared/chat-blocks'
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

function eventPayload(type: AgentRunEventType): AgentRunEventPayload {
  switch (type) {
    case 'run.created':
      return {
        threadId: 'thread-1',
        workflowId: 'default',
        agentId: 'general-purpose',
        trigger: 'canvasChat',
        messageId: 'message-1',
        policyProfileId: 'local-default'
      }
    case 'tool.started':
      return { callId: 'call-1', toolId: 'canvas.queryGraph', inputSummary: '读取画布' }
    case 'tool.completed':
      return { callId: 'call-1', toolId: 'canvas.queryGraph', status: 'completed', summary: '读取完成' }
    case 'permission.requested':
      return {
        callId: 'call-2',
        toolId: 'web.search',
        reason: '联网搜索需要授权',
        requiredPermissions: [{ kind: 'network', reason: '访问互联网' }]
      }
    default:
      return {}
  }
}

function createRunView(eventTypes: AgentRunEventType[]): AgentRunViewResponse {
  const latestEventType = eventTypes[eventTypes.length - 1]
  const permissionRequested = eventTypes.includes('permission.requested')
  const toolCompleted = eventTypes.includes('tool.completed')
  const toolStarted = eventTypes.includes('tool.started')
  const status = permissionRequested ? 'approval_required' : 'running'

  return {
    runId: 'run-1',
    status,
    trace: {},
    snapshot: {
      run: {
        id: 'run-1',
        threadId: 'thread-1',
        workflowId: 'default',
        agentId: 'general-purpose',
        status,
        trigger: 'canvasChat',
        messageId: 'message-1',
        policyProfileId: 'local-default',
        trace: {},
        createdAt: 1,
        updatedAt: eventTypes.length
      },
      events: eventTypes.map((type, index) => ({
        id: `event-${index + 1}`,
        runId: 'run-1',
        sequence: index + 1,
        type,
        payload: eventPayload(type),
        createdAt: index + 1
      })),
      artifacts: [],
      permissionGrants: [],
      childTasks: []
    },
    projection: {
      chatTurn: {
        id: 'run-1-assistant',
        role: 'assistant',
        runId: 'run-1',
        messageId: 'message-1',
        blocks: [
          ...(toolStarted ? [{
            kind: 'toolCall' as const,
            callId: 'call-1',
            toolId: 'canvas.queryGraph',
            status: toolCompleted ? 'completed' as const : 'running' as const,
            inputSummary: '读取画布',
            ...(toolCompleted ? { resultSummary: '读取完成' } : {}),
            isSubAgent: false
          }] : []),
          ...(permissionRequested ? [{
            kind: 'permission' as const,
            callId: 'call-2',
            toolId: 'web.search',
            reason: '联网搜索需要授权',
            requiredPermissions: [{ kind: 'network' as const, reason: '访问互联网' }],
            resolved: false
          }] : [])
        ],
        status: 'streaming',
        createdAt: 1
      },
      taskTree: [],
      inspector: {
        runId: 'run-1',
        status,
        agentId: 'general-purpose',
        workflowId: 'default',
        trigger: 'canvasChat',
        modelLabel: 'local',
        ...(latestEventType ? { latestEventType } : {}),
        tools: toolStarted ? [{
          callId: 'call-1',
          toolId: 'canvas.queryGraph',
          status: toolCompleted ? 'completed' : 'running',
          ...(toolCompleted ? { summary: '读取完成' } : {})
        }] : [],
        permissions: permissionRequested ? [{
          callId: 'call-2',
          toolId: 'web.search',
          reason: '联网搜索需要授权',
          resolved: false
        }] : [],
        artifacts: [],
        childTasks: []
      },
      artifacts: []
    }
  }
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
        decision: 'approved',
        scope: 'run'
      },
    )
    expect(store.getState().busy).toBe(true)
  })

  it('keeps an approval pending when approval cannot be queued', async () => {
    const approveAgentTool = vi.fn().mockResolvedValue({
      errorClass: 'agent_approval_policy_changed',
      message: 'Agent or tool policy changed after this approval was requested.',
      retryable: false
    })
    const { api, handlers } = createFakeApi({ approveAgentTool })
    const { store } = createChatStore({ api })

    await store.getState().send({ message: '读取网页', agentId: 'general-purpose' })
    handlers.permissionRequired?.({
      runId: 'run-1',
      messageId: 'message-1',
      callId: 'call-9',
      toolId: 'web.search',
      reason: '联网搜索需要确认'
    })

    await store.getState().approvePermission('call-9', 'session')

    expect(store.getState().pending).toMatchObject({
      runId: 'run-1',
      messageId: 'message-1',
      jobId: 'job-1'
    })
    expect(store.getState().busy).toBe(true)
    expect(store.getState().turns[1]!.blocks).toContainEqual(
      expect.objectContaining({
        kind: 'permission',
        callId: 'call-9',
        resolved: false
      })
    )
    expect(store.getState().turns[1]!.blocks).toContainEqual(
      expect.objectContaining({
        kind: 'error',
        errorClass: 'agent_approval_failed',
        retryable: true
      })
    )
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

  it('refreshes the active run projection on tool and permission lifecycle events', async () => {
    const getAgentRun = vi.fn()
      .mockResolvedValueOnce(createRunView(['run.created']))
      .mockResolvedValueOnce(createRunView(['run.created', 'tool.started']))
      .mockResolvedValueOnce(createRunView(['run.created', 'tool.started', 'permission.requested']))
    const { api, handlers } = createFakeApi({ getAgentRun })
    const { store } = createChatStore({ api })

    await store.getState().send({ message: '读取画布并搜索', agentId: 'general-purpose' })
    await flush()
    handlers.toolStarted?.({ runId: 'run-1', messageId: 'message-1', callId: 'call-1', toolId: 'canvas.queryGraph', inputSummary: '读取画布' })
    await flush()
    handlers.permissionRequired?.({ runId: 'run-1', messageId: 'message-1', callId: 'call-2', toolId: 'web.search', reason: '联网搜索需要授权' })
    await flush()

    expect(getAgentRun).toHaveBeenCalledTimes(3)
    expect(store.getState().activeRunView?.snapshot?.events).toHaveLength(3)
    expect(store.getState().activeRunView?.projection?.inspector.permissions).toEqual([
      expect.objectContaining({ callId: 'call-2', resolved: false })
    ])
  })

  it('does not let a late stale snapshot overwrite a newer run projection', async () => {
    let resolveOlder: ((view: AgentRunViewResponse) => void) | undefined
    let resolveNewer: ((view: AgentRunViewResponse) => void) | undefined
    const getAgentRun = vi.fn()
      .mockResolvedValueOnce(createRunView(['run.created']))
      .mockImplementationOnce(() => new Promise<AgentRunViewResponse>((resolve) => { resolveOlder = resolve }))
      .mockImplementationOnce(() => new Promise<AgentRunViewResponse>((resolve) => { resolveNewer = resolve }))
    const { api, handlers } = createFakeApi({ getAgentRun })
    const { store } = createChatStore({ api })

    await store.getState().send({ message: '读取画布', agentId: 'general-purpose' })
    await flush()
    handlers.toolStarted?.({ runId: 'run-1', messageId: 'message-1', callId: 'call-1', toolId: 'canvas.queryGraph', inputSummary: '读取画布' })
    handlers.toolCompleted?.({ runId: 'run-1', messageId: 'message-1', callId: 'call-1', toolId: 'canvas.queryGraph', invocationId: 'inv-1', status: 'completed', summary: '读取完成' })

    resolveNewer?.(createRunView(['run.created', 'tool.started', 'tool.completed']))
    await flush()
    resolveOlder?.(createRunView(['run.created', 'tool.started']))
    await flush()

    expect(store.getState().activeRunView?.snapshot?.events).toHaveLength(3)
    expect(store.getState().activeRunView?.projection?.inspector.latestEventType).toBe('tool.completed')
  })

  it('does not let a running snapshot reopen a run after a live terminal response', async () => {
    let resolveSnapshot: ((view: AgentRunViewResponse) => void) | undefined
    const snapshotPromise = new Promise<AgentRunViewResponse>((resolve) => {
      resolveSnapshot = resolve
    })
    const { api, handlers } = createFakeApi({
      getAgentRun: vi.fn().mockImplementation(() => snapshotPromise)
    })
    const { store } = createChatStore({ api })

    await store.getState().send({ message: '你好', agentId: 'general-purpose' })
    handlers.responseReady?.({
      runId: 'run-1',
      messageId: 'message-1',
      response: { type: 'answer', summary: '寒暄', text: '你好，我在。', dropped: [] }
    })
    resolveSnapshot?.(createRunView(['run.created']))
    await flush()

    expect(store.getState().turns[1]?.status).toBe('completed')
    expect(store.getState().turns[1]?.blocks).toContainEqual(
      expect.objectContaining({ kind: 'text', markdown: '你好，我在。', streaming: false })
    )
    expect(store.getState().busy).toBe(false)
    expect(store.getState().pending).toBeNull()
    expect(store.getState().activeRunView?.status).not.toBe('running')
  })

  it('restores an empty running projection with an assistant turn that can receive later events', async () => {
    const running = createRunView(['run.created'])
    running.snapshot!.run.jobId = 'job-running'
    const { api } = createFakeApi({
      getAgentRun: vi.fn().mockResolvedValue(running),
      getChatHistory: vi.fn().mockResolvedValue([
        {
          id: 'message-1',
          role: 'user',
          runId: 'run-1',
          blocks: [{ kind: 'text', markdown: '继续处理', streaming: false }],
          status: 'completed',
          createdAt: 1
        }
      ])
    })
    const { store } = createChatStore({ api })

    await store.getState().restore('workflow-1')

    expect(store.getState().busy).toBe(true)
    expect(store.getState().pending).toMatchObject({
      runId: 'run-1',
      messageId: 'message-1',
      jobId: 'job-running'
    })
    expect(store.getState().turns).toHaveLength(2)
    expect(store.getState().turns[1]).toMatchObject({
      role: 'assistant',
      runId: 'run-1',
      messageId: 'message-1',
      status: 'streaming',
      blocks: []
    })
  })

  it('hydrates plan blocks projected from a reconciled run snapshot', async () => {
    const projectedPlanRun = createRunView(['run.created'])
    projectedPlanRun.status = 'completed'
    projectedPlanRun.snapshot!.run.status = 'completed'
    projectedPlanRun.projection!.chatTurn = {
      ...projectedPlanRun.projection!.chatTurn,
      status: 'completed',
      blocks: [{ kind: 'plan', planId: 'plan-projected' }]
    }
    const getCanvasPlan = vi.fn().mockResolvedValue(samplePlan)
    const { api } = createFakeApi({
      getAgentRun: vi.fn().mockResolvedValue(projectedPlanRun),
      getCanvasPlan
    })
    const { store } = createChatStore({ api })

    await store.getState().send({ message: '生成图片', agentId: 'general-purpose' })
    await flush()

    expect(getCanvasPlan).toHaveBeenCalledWith({ messageId: 'message-1' })
    expect(store.getState().plansById['plan-projected']).toEqual(samplePlan)
  })

  it('ignores a stale plan fetch after the view is cleared and a new run starts', async () => {
    let resolvePlan: ((plan: CanvasPlan) => void) | undefined
    const getCanvasPlan = vi.fn().mockImplementation(() => new Promise<CanvasPlan>((resolve) => {
      resolvePlan = resolve
    }))
    const sendCanvasChat = vi.fn()
      .mockResolvedValueOnce({ runId: 'run-1', jobId: 'job-1', messageId: 'message-1', status: 'pending' })
      .mockResolvedValueOnce({ runId: 'run-2', jobId: 'job-2', messageId: 'message-2', status: 'pending' })
    const applyPlan = vi.fn()
    const { api, handlers } = createFakeApi({ getCanvasPlan, sendCanvasChat })
    const { store } = createChatStore({ api, applyPlan })

    store.getState().setAutoExecute(true)
    await store.getState().send({ message: '旧计划', agentId: 'general-purpose' })
    handlers.planReady?.({ messageId: 'message-1', planId: 'plan-old' })
    store.getState().clearView()
    await store.getState().send({ message: '新问题', agentId: 'general-purpose' })
    resolvePlan?.(samplePlan)
    await flush()

    expect(store.getState().plansById).not.toHaveProperty('plan-old')
    expect(applyPlan).not.toHaveBeenCalled()
    expect(store.getState().pending).toMatchObject({
      runId: 'run-2',
      jobId: 'job-2',
      messageId: 'message-2'
    })
    expect(store.getState().busy).toBe(true)
  })

  it('fails the turn with agent_tool_denied when the user denies a permission', async () => {
    const denyAgentTool = vi.fn().mockResolvedValue({
      runId: 'run-1',
      status: 'aborted',
      errorClass: 'agent_tool_denied'
    })
    const { api, handlers } = createFakeApi({ denyAgentTool })
    const { store } = createChatStore({ api })

    await store.getState().send({ message: '删掉节点', agentId: 'general-purpose' })
    handlers.permissionRequired?.({ runId: 'run-1', messageId: 'message-1', callId: 'call-9', toolId: 'canvas.deleteNode', reason: '删除需要确认' })
    await store.getState().denyPermission('call-9')

    const assistant = store.getState().turns[1]!
    expect(denyAgentTool).toHaveBeenCalledWith({
      runId: 'run-1',
      callId: 'call-9',
      deniedBy: 'chat-user'
    })
    expect(assistant.status).toBe('failed')
    expect(assistant.blocks).toContainEqual(expect.objectContaining({ kind: 'error', errorClass: 'agent_tool_denied' }))
    expect(store.getState().busy).toBe(false)
  })

  it('keeps an approval pending when the denial cannot be persisted', async () => {
    const denyAgentTool = vi.fn().mockResolvedValue({
      errorClass: 'agent_denial_failed',
      message: '拒绝操作未保存',
      retryable: true
    })
    const { api, handlers } = createFakeApi({ denyAgentTool })
    const { store } = createChatStore({ api })

    await store.getState().send({ message: '删掉节点', agentId: 'general-purpose' })
    handlers.permissionRequired?.({ runId: 'run-1', messageId: 'message-1', callId: 'call-9', toolId: 'canvas.deleteNode', reason: '删除需要确认' })
    await store.getState().denyPermission('call-9')

    expect(store.getState().pending).toMatchObject({ runId: 'run-1' })
    expect(store.getState().busy).toBe(true)
    expect(store.getState().turns[1]!.blocks).toContainEqual(
      expect.objectContaining({ kind: 'permission', callId: 'call-9', resolved: false })
    )
    expect(store.getState().turns[1]!.blocks).toContainEqual(
      expect.objectContaining({ kind: 'error', errorClass: 'agent_denial_failed', retryable: true })
    )
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

  it('restores the latest persisted run projection for the Workbench inspector', async () => {
    const getAgentRun = vi.fn().mockResolvedValue(createRunView(['run.created', 'tool.started', 'tool.completed']))
    const { api } = createFakeApi({
      getAgentRun,
      getChatHistory: vi.fn().mockResolvedValue([
        { id: 'user-1', role: 'user', blocks: [{ kind: 'text', markdown: '读取画布', streaming: false }], status: 'completed', createdAt: 1 },
        {
          id: 'assistant-1',
          role: 'assistant',
          runId: 'run-1',
          messageId: 'message-1',
          blocks: [{ kind: 'text', markdown: '读取完成', streaming: false }],
          status: 'completed',
          createdAt: 2
        },
      ]),
    })
    const { store } = createChatStore({ api })

    await store.getState().restore('workflow-1')

    expect(getAgentRun).toHaveBeenCalledWith({ runId: 'run-1' })
    expect(store.getState().activeRunId).toBe('run-1')
    expect(store.getState().activeRunView?.snapshot?.events).toHaveLength(3)
  })

  it('restores an approval-required run so the user can approve after restart', async () => {
    const approvalRun = createRunView(['run.created', 'permission.requested'])
    approvalRun.snapshot!.run.jobId = 'job-approval'
    const approveAgentTool = vi.fn().mockResolvedValue({ runId: 'run-1', jobId: 'job-resumed', status: 'pending' })
    const { api } = createFakeApi({
      getAgentRun: vi.fn().mockResolvedValue(approvalRun),
      getChatHistory: vi.fn().mockResolvedValue([
        {
          id: 'message-1',
          role: 'user',
          runId: 'run-1',
          blocks: [{ kind: 'text', markdown: '联网搜索', streaming: false }],
          status: 'completed',
          createdAt: 1
        },
      ]),
      approveAgentTool,
    })
    const { store } = createChatStore({ api })

    await store.getState().restore('workflow-1')
    expect(store.getState().busy).toBe(true)
    expect(store.getState().pending).toMatchObject({
      runId: 'run-1',
      messageId: 'message-1',
      jobId: 'job-approval'
    })
    expect(store.getState().turns).toHaveLength(2)
    expect(store.getState().turns[1]).toMatchObject({
      role: 'assistant',
      runId: 'run-1',
      blocks: [expect.objectContaining({ kind: 'permission', callId: 'call-2', resolved: false })]
    })

    await store.getState().approvePermission('call-2', 'session')

    expect(approveAgentTool).toHaveBeenCalledWith({
      runId: 'run-1',
      callId: 'call-2',
      approvedBy: 'chat-user',
      scope: 'session'
    })
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

  it('does not let late history restore erase a message sent while restore was loading', async () => {
    let resolveHistory: ((turns: ChatTurn[]) => void) | undefined
    const { api } = createFakeApi({
      getChatHistory: vi.fn().mockImplementation(() => new Promise<ChatTurn[]>((resolve) => {
        resolveHistory = resolve
      }))
    })
    const { store } = createChatStore({ api, clock: () => 1_784_100_000_500 })

    const restoring = store.getState().restore('workflow-1')
    await store.getState().send({ message: '新的问题', agentId: 'general-purpose' })
    resolveHistory?.([
      { id: 'history-user', role: 'user', blocks: [{ kind: 'text', markdown: '旧问题', streaming: false }], status: 'completed', createdAt: 1 },
      { id: 'history-assistant', role: 'assistant', blocks: [{ kind: 'text', markdown: '旧回答', streaming: false }], status: 'completed', createdAt: 2 }
    ])
    await restoring

    expect(store.getState().pending).toMatchObject({ runId: 'run-1', messageId: 'message-1' })
    expect(store.getState().turns.map((turn) => turn.blocks[0])).toEqual([
      { kind: 'text', markdown: '新的问题', streaming: false },
      { kind: 'thinking', lines: ['Agent 已排队：job-1'] }
    ])
  })

  it('ignores an older workflow history response that resolves after the latest restore', async () => {
    let resolveFirstHistory: ((turns: ChatTurn[]) => void) | undefined
    const workflowTwoTurns: ChatTurn[] = [
      { id: 'workflow-2-user', role: 'user', blocks: [{ kind: 'text', markdown: '工作流二', streaming: false }], status: 'completed', createdAt: 2 }
    ]
    const { api } = createFakeApi({
      getChatHistory: vi.fn().mockImplementation(({ workflowId }: { workflowId: string }) => {
        if (workflowId === 'workflow-1') {
          return new Promise<ChatTurn[]>((resolve) => {
            resolveFirstHistory = resolve
          })
        }
        return Promise.resolve(workflowTwoTurns)
      })
    })
    const { store } = createChatStore({ api })

    const firstRestore = store.getState().restore('workflow-1')
    await store.getState().restore('workflow-2')
    resolveFirstHistory?.([
      { id: 'workflow-1-user', role: 'user', blocks: [{ kind: 'text', markdown: '工作流一', streaming: false }], status: 'completed', createdAt: 1 }
    ])
    await firstRestore

    expect(store.getState().turns).toEqual(workflowTwoTurns)
  })
})
