// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'

import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ChatPanel, type ChatPanelApi } from '../desktop/src/renderer/src/chat/ChatPanel'
import type {
  AgentRunEventPayloadMap,
  AgentRunEventRecord,
  AgentRunEventType,
  AgentRunSnapshot,
  PermissionDecision,
  PermissionGrantScope,
} from '../shared/agent-run-events'
import { projectAgentRunSnapshot } from '../shared/agent-run-projector'
import type {
  AgentDefinition,
  AgentNonCanvasResponse,
  AgentRunStatus,
  AgentRunViewResponse,
} from '../shared/agents'
import type { ChatTurn } from '../shared/chat-blocks'
import type { CanvasPlan } from '../shared/plan'
import type { ToolPermission } from '../shared/tools'

const workflowId = 'workbench-flow-tests'

const generalAgent: AgentDefinition = {
  id: 'general-purpose',
  source: 'builtin',
  name: 'General Purpose',
  description: 'Answers ordinary questions and coordinates local tools.',
  instructions: 'Understand the request and respond with the smallest useful action.',
  allowedTools: '*',
  allowedSkills: '*',
  gatewayPolicy: { allowedChannels: ['text', 'image', 'video'] },
  contextPolicy: {
    includeCanvasGraph: true,
    includeSelectedAssets: true,
    includeRecentMessages: true,
    includeKnowledge: false,
    maxContextTokens: 8000,
  },
  permissionPolicy: {
    allowedPermissionKinds: ['canvas.read', 'canvas.write', 'network'],
    requireAskForDestructive: true,
  },
  triggerPolicy: {
    allowedTriggers: ['canvasChat'],
    defaultTrigger: 'canvasChat',
    autoRun: false,
  },
  maxTurns: 8,
  effort: 'high',
  enabled: true,
}

const samplePlan: CanvasPlan = {
  kind: 'plan',
  summary: '生成雨夜侦探分镜并制作短视频。',
  nodes: [
    { ref: 'story', type: 'text', title: '分镜提示词', data: { content: '雨夜里的侦探走进霓虹巷口' } },
    { ref: 'keyframe', type: 'imageConfigV2', title: '关键帧', data: { promptOverride: '雨夜霓虹侦探', status: 'idle' } },
    { ref: 'clip', type: 'videoConfigV2', title: '短视频', data: { promptOverride: '镜头缓慢推进', status: 'idle' } },
  ],
  edges: [
    { source: 'story', target: 'keyframe', edgeType: 'promptOrder' },
    { source: 'keyframe', target: 'clip', edgeType: 'imageRole', imageRole: 'first_frame' },
  ],
  runSteps: [
    { ref: 'keyframe', action: 'imageRun' },
    { ref: 'clip', action: 'videoRun' },
  ],
  question: null,
  dropped: [],
}

function userTurn(runId: string, messageId: string, markdown: string): ChatTurn {
  return {
    id: messageId,
    role: 'user',
    runId,
    blocks: [{ kind: 'text', markdown, streaming: false }],
    status: 'completed',
    createdAt: 1,
  }
}

type RunEventDescriptor = {
  [Type in AgentRunEventType]: {
    type: Type
    payload: AgentRunEventPayloadMap[Type]
  }
}[AgentRunEventType]

function runCreated(messageId: string, jobId?: string): RunEventDescriptor {
  return {
    type: 'run.created',
    payload: {
      threadId: 'thread-workbench',
      workflowId,
      agentId: generalAgent.id,
      trigger: 'canvasChat',
      messageId,
      ...(jobId ? { jobId } : {}),
      policyProfileId: 'local-default',
      modelId: 'local-model',
    },
  }
}

function runStarted(jobId?: string): RunEventDescriptor {
  return {
    type: 'run.started',
    payload: { status: 'running', ...(jobId ? { jobId } : {}) },
  }
}

function permissionRequested(input: {
  callId: string
  toolId: string
  reason: string
  requiredPermissions: ToolPermission[]
}): RunEventDescriptor {
  return {
    type: 'permission.requested',
    payload: input,
  }
}

function permissionResolved(input: {
  callId: string
  decision: PermissionDecision
  scope: PermissionGrantScope
}): RunEventDescriptor {
  return {
    type: 'permission.resolved',
    payload: input,
  }
}

function responseReady(messageId: string, response: AgentNonCanvasResponse): RunEventDescriptor {
  return {
    type: 'response.ready',
    payload: { messageId, response },
  }
}

function planReady(messageId: string, planId: string): RunEventDescriptor {
  return {
    type: 'plan.ready',
    payload: { messageId, planId },
  }
}

function runFailed(errorClass: string, message: string, retryable: boolean): RunEventDescriptor {
  return {
    type: 'run.failed',
    payload: { errorClass, message, retryable },
  }
}

function runCompleted(): RunEventDescriptor {
  return {
    type: 'run.completed',
    payload: { status: 'completed' },
  }
}

function createRunView<TStatus extends AgentRunStatus>(input: {
  runId: string
  messageId: string
  status: TStatus
  jobId?: string
  events: RunEventDescriptor[]
}): AgentRunViewResponse & { status: TStatus } {
  const snapshot: AgentRunSnapshot = {
    run: {
      id: input.runId,
      threadId: 'thread-workbench',
      workflowId,
      agentId: generalAgent.id,
      status: input.status,
      trigger: 'canvasChat',
      messageId: input.messageId,
      ...(input.jobId ? { jobId: input.jobId } : {}),
      policyProfileId: 'local-default',
      modelId: 'local-model',
      trace: {},
      createdAt: 1,
      updatedAt: 2,
    },
    events: input.events.map((event, index): AgentRunEventRecord => ({
      id: `${input.runId}-event-${index + 1}`,
      runId: input.runId,
      sequence: index + 1,
      ...event,
      createdAt: index + 1,
    })),
    artifacts: [],
    permissionGrants: [],
    childTasks: [],
  }

  return {
    runId: input.runId,
    status: input.status,
    trace: {},
    snapshot,
    projection: projectAgentRunSnapshot(snapshot),
  }
}

type ResponseReadyHandler = Parameters<ChatPanelApi['onAgentResponseReady']>[0]

interface PersistedHarnessOptions {
  history?: ChatTurn[]
  runs?: Record<string, AgentRunViewResponse>
  plansByMessageId?: Record<string, CanvasPlan>
  sendTicket?: { runId: string; jobId: string; messageId: string; status: 'pending' }
  approveToIntermediateRunView?: AgentRunViewResponse & { status: 'pending' | 'running' }
}

interface RequestCall {
  method: string
  input: unknown
}

function createPersistedHarness(options: PersistedHarnessOptions = {}): {
  api: ChatPanelApi
  requestCalls: RequestCall[]
  activeResponseSubscriptions(): number
  responseSubscriptionCleanupCount(): number
  emitResponse(event: Parameters<ResponseReadyHandler>[0]): void
} {
  const requestCalls: RequestCall[] = []
  const runs = { ...(options.runs ?? {}) }
  const responseReadyHandlers = new Set<ResponseReadyHandler>()
  let responseCleanupCount = 0
  const sendTicket = options.sendTicket ?? {
    runId: 'run-live',
    jobId: 'job-live',
    messageId: 'message-live',
    status: 'pending' as const,
  }

  function recordRequest(method: string, input: unknown): void {
    requestCalls.push({ method, input: structuredClone(input) })
  }

  const api: ChatPanelApi = {
    sendCanvasChat: vi.fn((input: Parameters<ChatPanelApi['sendCanvasChat']>[0]) => {
      recordRequest('canvas.chatSend', input)
      if (!runs[sendTicket.runId]) {
        runs[sendTicket.runId] = createRunView({
          runId: sendTicket.runId,
          messageId: sendTicket.messageId,
          jobId: sendTicket.jobId,
          status: 'running',
          events: [
            runCreated(sendTicket.messageId, sendTicket.jobId),
            runStarted(sendTicket.jobId),
          ],
        })
      }
      return Promise.resolve(sendTicket)
    }),
    getCanvasPlan: vi.fn((input: Parameters<ChatPanelApi['getCanvasPlan']>[0]) => {
      recordRequest('canvas.chatGetPlan', input)
      return Promise.resolve(options.plansByMessageId?.[input.messageId] ?? samplePlan)
    }),
    listAgents: vi.fn(() => {
      recordRequest('agent.list', null)
      return Promise.resolve([generalAgent])
    }),
    getAgentRun: vi.fn((input: Parameters<NonNullable<ChatPanelApi['getAgentRun']>>[0]) => {
      recordRequest('agent.getRun', input)
      return Promise.resolve(runs[input.runId] ?? createRunView({
        runId: input.runId,
        messageId: sendTicket.messageId,
        jobId: sendTicket.jobId,
        status: 'running',
        events: [
          runCreated(sendTicket.messageId, sendTicket.jobId),
          runStarted(sendTicket.jobId),
        ],
      }))
    }),
    approveAgentTool: vi.fn((input: Parameters<NonNullable<ChatPanelApi['approveAgentTool']>>[0]) => {
      recordRequest('agent.approveTool', input)
      if (options.approveToIntermediateRunView) {
        runs[input.runId] = options.approveToIntermediateRunView
      }
      return Promise.resolve({ runId: input.runId, jobId: 'job-resumed', status: 'pending' as const })
    }),
    getChatHistory: vi.fn((input: Parameters<NonNullable<ChatPanelApi['getChatHistory']>>[0]) => {
      recordRequest('chat.history', input)
      if (input.workflowId !== workflowId) {
        return Promise.reject(new Error(`unexpected_workflow:${input.workflowId}`))
      }
      return Promise.resolve(structuredClone(options.history ?? []))
    }),
    onCanvasPlanReady: vi.fn().mockReturnValue(vi.fn()),
    onAgentResponseReady: vi.fn((handler: ResponseReadyHandler) => {
      responseReadyHandlers.add(handler)
      return () => {
        if (responseReadyHandlers.delete(handler)) {
          responseCleanupCount += 1
        }
      }
    }),
  }

  return {
    api,
    requestCalls,
    activeResponseSubscriptions: () => responseReadyHandlers.size,
    responseSubscriptionCleanupCount: () => responseCleanupCount,
    emitResponse(event) {
      act(() => {
        for (const handler of responseReadyHandlers) {
          handler(event)
        }
      })
    },
  }
}

afterEach(() => {
  cleanup()
})

describe('Local Agent Platform workbench flows', () => {
  it.each(['hi', '你好'])('completes ordinary chat for "%s" without requesting a CanvasPlan', async (message) => {
    const harness = createPersistedHarness()
    render(<ChatPanel api={harness.api} workflowId={workflowId} onApplyPlan={vi.fn()} />)
    const textbox = screen.getByRole('textbox', { name: 'Canvas agent message' })

    fireEvent.change(textbox, { target: { value: message } })
    fireEvent.click(screen.getByRole('button', { name: '发送画布消息' }))

    await screen.findByText('Agent 已排队：job-live')
    harness.emitResponse({
      runId: 'run-live',
      messageId: 'message-live',
      response: {
        type: 'answer',
        summary: '普通寒暄',
        text: '你好，我在。',
        dropped: [],
      },
    })

    expect(await screen.findByText('你好，我在。')).toBeInTheDocument()
    expect(screen.getByText('就绪')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '停止 Agent' })).not.toBeInTheDocument()
    expect(harness.api.getCanvasPlan).not.toHaveBeenCalled()

    fireEvent.change(textbox, { target: { value: '下一条消息' } })
    expect(screen.getByRole('button', { name: '发送画布消息' })).toBeEnabled()
  })

  it('replays a persisted ordinary answer after unmount and remount', async () => {
    const runId = 'run-answer'
    const messageId = 'message-answer'
    const answerView = createRunView({
      runId,
      messageId,
      status: 'completed',
      events: [
        runCreated(messageId),
        responseReady(messageId, {
          type: 'answer',
          summary: '恢复普通回答',
          text: '这是重启后恢复的最终回答。',
          dropped: [],
        }),
        runCompleted(),
      ],
    })
    const harness = createPersistedHarness({
      history: [userTurn(runId, messageId, '恢复普通回答')],
      runs: { [runId]: answerView },
    })

    const first = render(<ChatPanel api={harness.api} workflowId={workflowId} onApplyPlan={vi.fn()} />)
    expect(await screen.findByText('这是重启后恢复的最终回答。')).toBeInTheDocument()
    expect(harness.activeResponseSubscriptions()).toBe(1)
    expect(harness.api.getChatHistory).toHaveBeenCalledWith({ workflowId })
    first.unmount()
    expect(harness.activeResponseSubscriptions()).toBe(0)
    expect(harness.responseSubscriptionCleanupCount()).toBe(1)

    render(<ChatPanel api={harness.api} workflowId={workflowId} onApplyPlan={vi.fn()} />)
    expect(await screen.findByText('这是重启后恢复的最终回答。')).toBeInTheDocument()
    expect(harness.activeResponseSubscriptions()).toBe(1)
    expect(harness.api.getChatHistory).toHaveBeenCalledTimes(2)
    expect(harness.api.getChatHistory).toHaveBeenCalledWith({ workflowId })
    expect(screen.getByText('就绪')).toBeInTheDocument()
  })

  it('resumes a persisted approval-required run and replaces the action with the resolved approval plus answer', async () => {
    const runId = 'run-permission'
    const messageId = 'message-permission'
    const permission = {
      callId: 'call-web-search',
      toolId: 'web.search',
      reason: '联网搜索需要授权。',
      requiredPermissions: [{ kind: 'network', reason: '访问互联网' }],
    } satisfies Parameters<typeof permissionRequested>[0]
    const approvalView = createRunView({
      runId,
      messageId,
      jobId: 'job-approval',
      status: 'approval_required',
      events: [
        runCreated(messageId, 'job-approval'),
        runStarted('job-approval'),
        permissionRequested(permission),
      ],
    })
    const approvedRunningView = createRunView({
      runId,
      messageId,
      jobId: 'job-resumed',
      status: 'running',
      events: [
        runCreated(messageId, 'job-approval'),
        runStarted('job-approval'),
        permissionRequested(permission),
        permissionResolved({
          callId: permission.callId,
          decision: 'approved',
          scope: 'session',
        }),
        runStarted('job-resumed'),
      ],
    })
    const harness = createPersistedHarness({
      history: [userTurn(runId, messageId, '你知道 Java 么')],
      runs: { [runId]: approvalView },
      approveToIntermediateRunView: approvedRunningView,
    })

    const first = render(<ChatPanel api={harness.api} workflowId={workflowId} onApplyPlan={vi.fn()} />)
    expect(await screen.findByRole('button', { name: '批准并继续' })).toBeEnabled()
    expect(harness.api.getChatHistory).toHaveBeenCalledWith({ workflowId })
    first.unmount()

    render(<ChatPanel api={harness.api} workflowId={workflowId} onApplyPlan={vi.fn()} />)
    fireEvent.click(await screen.findByRole('button', { name: '批准并继续' }))

    await waitFor(() => expect(harness.api.approveAgentTool).toHaveBeenCalledWith({
      runId,
      callId: 'call-web-search',
      approvedBy: 'chat-user',
      scope: 'session',
    }))
    expect(await screen.findByText('已批准 · 本次会话')).toBeInTheDocument()
    expect(screen.queryByText('Java 是一门通用编程语言。')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '批准并继续' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: '停止 Agent' })).toBeEnabled()
    expect(screen.getByText('等待 Agent 回复...')).toBeInTheDocument()

    harness.emitResponse({
      runId,
      messageId,
      response: {
        type: 'answer',
        summary: 'Java 回答',
        text: 'Java 是一门通用编程语言。',
        dropped: [],
      },
    })

    expect(await screen.findByText('Java 是一门通用编程语言。')).toBeInTheDocument()
    expect(screen.getByText('就绪')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '停止 Agent' })).not.toBeInTheDocument()
    expect(harness.api.getChatHistory).toHaveBeenCalledWith({ workflowId })
    const textbox = screen.getByRole('textbox', { name: 'Canvas agent message' })
    fireEvent.change(textbox, { target: { value: '继续' } })
    expect(screen.getByRole('button', { name: '发送画布消息' })).toBeEnabled()
  })

  it('hydrates a persisted plan preview after restart and keeps the Apply gate', async () => {
    const runId = 'run-plan'
    const messageId = 'message-plan'
    const planView = createRunView({
      runId,
      messageId,
      status: 'completed',
      events: [
        runCreated(messageId),
        planReady(messageId, 'plan-restart'),
        runCompleted(),
      ],
    })
    const onApplyPlan = vi.fn()
    const harness = createPersistedHarness({
      history: [userTurn(runId, messageId, '生成雨夜侦探分镜')],
      runs: { [runId]: planView },
      plansByMessageId: { [messageId]: samplePlan },
    })

    const first = render(<ChatPanel api={harness.api} workflowId={workflowId} onApplyPlan={onApplyPlan} />)
    expect(await screen.findByText(samplePlan.summary)).toBeInTheDocument()
    expect(harness.api.getChatHistory).toHaveBeenCalledWith({ workflowId })
    first.unmount()

    render(<ChatPanel api={harness.api} workflowId={workflowId} onApplyPlan={onApplyPlan} />)
    expect(await screen.findByText(samplePlan.summary)).toBeInTheDocument()
    expect(screen.getByText('3 个节点')).toBeInTheDocument()
    expect(screen.getByText('2 条边')).toBeInTheDocument()
    expect(screen.getByText('2 个运行步骤')).toBeInTheDocument()
    expect(screen.getByText('生图配置')).toBeInTheDocument()
    expect(screen.getByText('视频生成')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '应用计划' })).toBeEnabled()
    expect(onApplyPlan).not.toHaveBeenCalled()
    expect(harness.api.getCanvasPlan).toHaveBeenCalledWith({ messageId })
    expect(harness.api.getChatHistory).toHaveBeenCalledWith({ workflowId })
  })

  it('replays a stable failure block after restart and leaves the composer reusable', async () => {
    const runId = 'run-error'
    const messageId = 'message-error'
    const errorView = createRunView({
      runId,
      messageId,
      status: 'failed',
      events: [
        runCreated(messageId),
        runStarted(),
        runFailed('gateway_timeout', '模型网关响应超时。', true),
      ],
    })
    const harness = createPersistedHarness({
      history: [userTurn(runId, messageId, '生成失败示例')],
      runs: { [runId]: errorView },
      sendTicket: {
        runId: 'run-retry',
        jobId: 'job-retry',
        messageId: 'message-retry',
        status: 'pending',
      },
    })

    const first = render(<ChatPanel api={harness.api} workflowId={workflowId} onApplyPlan={vi.fn()} />)
    expect(await within(screen.getByLabelText('对话记录')).findByText('gateway_timeout')).toBeInTheDocument()
    expect(harness.api.getChatHistory).toHaveBeenCalledWith({ workflowId })
    first.unmount()

    render(<ChatPanel api={harness.api} workflowId={workflowId} onApplyPlan={vi.fn()} />)
    const transcript = screen.getByLabelText('对话记录')
    expect(await within(transcript).findByText('模型网关响应超时。')).toBeInTheDocument()
    expect(within(transcript).getByText('gateway_timeout')).toBeInTheDocument()
    expect(screen.getByText('就绪')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '停止 Agent' })).not.toBeInTheDocument()
    expect(harness.api.getChatHistory).toHaveBeenCalledWith({ workflowId })

    const textbox = screen.getByRole('textbox', { name: 'Canvas agent message' })
    fireEvent.change(textbox, { target: { value: '重新发送' } })
    fireEvent.click(screen.getByRole('button', { name: '发送画布消息' }))

    await waitFor(() => expect(harness.api.sendCanvasChat).toHaveBeenCalledWith({
      message: '重新发送',
      agentId: 'general-purpose',
      workflowId,
    }))
  })

  it('clears only the current view and restores persisted history on remount without a delete IPC', async () => {
    const invalidWorkflowHarness = createPersistedHarness()
    await expect(invalidWorkflowHarness.api.getChatHistory?.({ workflowId: 'unexpected-workflow' }))
      .rejects.toThrow('unexpected_workflow:unexpected-workflow')

    const persistedTurns: ChatTurn[] = [
      {
        id: 'history-user',
        role: 'user',
        blocks: [{ kind: 'text', markdown: '保留在持久层的问题', streaming: false }],
        status: 'completed',
        createdAt: 1,
      },
      {
        id: 'history-assistant',
        role: 'assistant',
        blocks: [{ kind: 'text', markdown: '保留在持久层的回答', streaming: false }],
        status: 'completed',
        createdAt: 2,
      },
    ]
    const harness = createPersistedHarness({ history: persistedTurns })
    const first = render(<ChatPanel api={harness.api} workflowId={workflowId} onApplyPlan={vi.fn()} />)

    expect(await screen.findByText('保留在持久层的回答')).toBeInTheDocument()
    expect(harness.api.getChatHistory).toHaveBeenCalledWith({ workflowId })
    const callsBeforeClear = structuredClone(harness.requestCalls)

    fireEvent.click(screen.getByRole('button', { name: '清空对话' }))

    expect(screen.queryByText('保留在持久层的问题')).not.toBeInTheDocument()
    expect(screen.queryByText('保留在持久层的回答')).not.toBeInTheDocument()
    expect(harness.requestCalls).toEqual(callsBeforeClear)
    first.unmount()

    render(<ChatPanel api={harness.api} workflowId={workflowId} onApplyPlan={vi.fn()} />)
    expect(await screen.findByText('保留在持久层的回答')).toBeInTheDocument()
    expect(harness.api.getChatHistory).toHaveBeenCalledTimes(2)
    expect(harness.api.getChatHistory).toHaveBeenCalledWith({ workflowId })
    expect(persistedTurns).toHaveLength(2)
  })
})
