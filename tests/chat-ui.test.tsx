// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'

import { readFileSync } from 'node:fs'

import React from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ChatPanel, type ChatPanelApi } from '../desktop/src/renderer/src/chat/ChatPanel'
import { PlanCard } from '../desktop/src/renderer/src/chat/PlanCard'
import type { AgentDefinition } from '../shared/agents'
import type { CanvasPlan } from '../shared/plan'
import type { ToolPermission } from '../shared/tools'

const samplePlan: CanvasPlan = {
  kind: 'plan',
  summary: '生成宇宙飞船首帧并转成短视频。',
  nodes: [
    { ref: 'text-1', type: 'text', title: '提示词', data: { content: '宇宙飞船穿过金色星云' } },
    { ref: 'image-1', type: 'image', title: '首帧', data: { promptOverride: '金色星云里的飞船', modelId: 'stub-image', orientation: 'landscape' } },
    { ref: 'video-1', type: 'video', title: '短视频', data: { promptOverride: '镜头缓慢推进', modelId: 'stub-video', orientation: 'landscape', durationSeconds: 5 } }
  ],
  edges: [
    { source: 'text-1', target: 'image-1', edgeType: 'promptOrder' },
    { source: 'image-1', target: 'video-1', edgeType: 'imageRole', imageRole: 'first_frame' }
  ],
  runSteps: [
    { ref: 'image-1', action: 'imageRun' },
    { ref: 'video-1', action: 'videoRun' }
  ],
  question: null,
  dropped: ['edge:bad->missing:missing_node']
}

const generalAgent: AgentDefinition = {
  id: 'general-purpose',
  source: 'builtin',
  name: 'General Purpose',
  description: 'Understands user input before delegating to local capabilities.',
  instructions: 'First understand the user message, decompose requirements, and inspect local capabilities.',
  allowedTools: ['canvas.queryGraph'],
  allowedSkills: '*',
  gatewayPolicy: { allowedChannels: ['text', 'image', 'video'] },
  contextPolicy: {
    includeCanvasGraph: true,
    includeSelectedAssets: true,
    includeRecentMessages: true,
    includeKnowledge: false,
    maxContextTokens: 8000
  },
  permissionPolicy: { allowedPermissionKinds: ['canvas.read', 'canvas.write', 'provider.spend'], requireAskForDestructive: true },
  triggerPolicy: { allowedTriggers: ['manual', 'mention', 'canvasChat'], defaultTrigger: 'canvasChat', autoRun: false },
  maxTurns: 8,
  effort: 'high',
  enabled: true
}

const canvasAgent: AgentDefinition = {
  ...generalAgent,
  id: 'canvas',
  name: 'Canvas',
  description: 'Handles canvas nodes, edges, and graph edits.',
  gatewayPolicy: { allowedChannels: ['text'] },
  permissionPolicy: { allowedPermissionKinds: ['canvas.read', 'canvas.write'], requireAskForDestructive: true },
  maxTurns: 6
}

function createApi(overrides: Partial<ChatPanelApi> = {}): ChatPanelApi {
  return {
    sendCanvasChat: vi.fn().mockResolvedValue({ runId: 'run-agent-1', jobId: 'job-agent-1', messageId: 'message-1', status: 'pending' }),
    getCanvasPlan: vi.fn().mockResolvedValue(samplePlan),
    getAgentRun: vi.fn().mockResolvedValue({
      runId: 'run-agent-1',
      status: 'pending',
      trace: {
        intentAnalysis: {
          summary: '用户提出了明确的画布或生成工作流需求。',
          requirements: ['生成一个宇宙飞船图片节点'],
          missing: [],
          executionMode: 'plan',
          complexity: 'high',
          recommendedAgentId: 'canvas-orchestrator',
        },
        capabilityCheck: {
          localCapabilities: ['canvas.queryGraph', 'canvas.proposePlan', 'canvas.createNode'],
          selectedAgentId: 'canvas-orchestrator',
        },
      },
    }),
    listAgents: vi.fn().mockResolvedValue([generalAgent, canvasAgent]),
    onCanvasPlanReady: vi.fn().mockImplementation((handler: (event: { messageId: string; planId: string }) => void) => {
      setTimeout(() => handler({ messageId: 'message-1', planId: 'plan-1' }), 0)
      return vi.fn()
    }),
    onAgentResponseReady: vi.fn().mockReturnValue(vi.fn()),
    ...overrides
  }
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('M4 Chat UI', () => {
  it('renders a PlanCard with plan summary, dropped warning, apply button, and auto-execute switch', () => {
    const onApplyPlan = vi.fn()

    render(<PlanCard plan={samplePlan} autoExecute={false} onAutoExecuteChange={vi.fn()} onApplyPlan={onApplyPlan} />)

    expect(screen.getByText('生成宇宙飞船首帧并转成短视频。')).toBeInTheDocument()
    expect(screen.getByText('3 个节点')).toBeInTheDocument()
    expect(screen.getByText('2 条边')).toBeInTheDocument()
    expect(screen.getByText('2 个运行步骤')).toBeInTheDocument()
    expect(screen.getByText('1 项在计划净化过程中被丢弃')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: '自动执行计划运行步骤' })).not.toBeChecked()

    fireEvent.click(screen.getByRole('button', { name: '应用计划' }))

    expect(onApplyPlan).toHaveBeenCalledWith(samplePlan, { autoExecute: false })
  })

  it('renders migrated comic-drama nodes while only summarizing Agent generation run actions', () => {
    const migratedPlan: CanvasPlan = {
      kind: 'plan',
      summary: 'Create a comic-drama workflow.',
      nodes: [
        { ref: 'story', type: 'text', title: 'Story', data: { content: 'rainy detective' } },
        { ref: 'character', type: 'character', title: 'Character', data: { description: 'detective' } },
        { ref: 'scene', type: 'scene', title: 'Scene', data: { description: 'alley' } },
        { ref: 'key-image', type: 'imageConfigV2', title: 'Key image', data: { promptOverride: 'rainy alley', status: 'idle' } },
        { ref: 'video', type: 'videoConfigV2', title: 'Video', data: { promptOverride: 'rainy alley', status: 'idle' } },
        { ref: 'voice', type: 'audio', title: 'Voice', data: { assetId: null, status: 'idle' } },
        { ref: 'compose', type: 'videoCompose', title: 'Compose', data: { status: 'idle' } },
        { ref: 'mux', type: 'muxAudioVideo', title: 'Mux', data: { status: 'idle' } },
      ],
      edges: [],
      runSteps: [
        { ref: 'key-image', action: 'imageRun' },
        { ref: 'video', action: 'videoRun' },
      ],
      question: null,
      dropped: [],
    }

    render(<PlanCard plan={migratedPlan} autoExecute={false} onAutoExecuteChange={vi.fn()} onApplyPlan={vi.fn()} />)

    expect(screen.getByText('角色')).toBeInTheDocument()
    expect(screen.getByText('场景')).toBeInTheDocument()
    expect(screen.getByText('生图配置')).toBeInTheDocument()
    expect(screen.getByText('视频配置')).toBeInTheDocument()
    expect(screen.getByText('图片生成')).toBeInTheDocument()
    expect(screen.getByText('视频生成')).toBeInTheDocument()
    expect(screen.getByText('视频合成')).toBeInTheDocument()
    expect(screen.getByText('音视频合成')).toBeInTheDocument()
    expect(screen.queryByText('MJ 出图')).not.toBeInTheDocument()
  })

  it('sends chat on Enter, keeps Shift+Enter as multiline, then fetches plan after planReady', async () => {
    const api = createApi()

    render(<ChatPanel api={api} onApplyPlan={vi.fn()} />)

    const textbox = screen.getByRole('textbox', { name: 'Canvas agent message' })
    fireEvent.change(textbox, { target: { value: '生成一个宇宙飞船图片节点' } })
    fireEvent.keyDown(textbox, { key: 'Enter', shiftKey: true })

    expect(api.sendCanvasChat).not.toHaveBeenCalled()

    fireEvent.keyDown(textbox, { key: 'Enter' })

    await waitFor(() => expect(api.sendCanvasChat).toHaveBeenCalledWith({ message: '生成一个宇宙飞船图片节点', agentId: 'general-purpose' }))
    expect(textbox).toHaveValue('')
    expect(screen.getByText('Agent 已排队：job-agent-1')).toBeInTheDocument()
    await waitFor(() => expect(api.getAgentRun).toHaveBeenCalledWith({ runId: 'run-agent-1' }))
    expect(await screen.findByText('理解输入：用户提出了明确的画布或生成工作流需求。')).toBeInTheDocument()
    expect(await screen.findByText('拆解需求：生成一个宇宙飞船图片节点')).toBeInTheDocument()
    expect(await screen.findByText('检查本地能力：canvas.queryGraph、canvas.proposePlan、canvas.createNode')).toBeInTheDocument()
    expect(await screen.findByText('执行模式：plan；推荐 Agent：canvas-orchestrator。')).toBeInTheDocument()
    await waitFor(() => expect(api.getCanvasPlan).toHaveBeenCalledWith({ messageId: 'message-1' }))
    expect(await screen.findByText('生成宇宙飞船首帧并转成短视频。')).toBeInTheDocument()
  })

  it('auto-applies the fetched plan when autoExecute is enabled before planReady', async () => {
    const unsubscribe = vi.fn()
    const api = createApi({
      onCanvasPlanReady: vi.fn().mockImplementation((handler: (event: { messageId: string; planId: string }) => void) => {
        setTimeout(() => handler({ messageId: 'message-1', planId: 'plan-1' }), 0)
        return unsubscribe
      })
    })
    const onApplyPlan = vi.fn()
    render(<ChatPanel api={api} onApplyPlan={onApplyPlan} />)

    fireEvent.change(screen.getByRole('textbox', { name: 'Canvas agent message' }), { target: { value: '生成短视频' } })
    fireEvent.click(screen.getByRole('switch', { name: '自动执行计划运行步骤' }))
    fireEvent.click(screen.getByRole('button', { name: '发送画布消息' }))

    await waitFor(() => expect(onApplyPlan).toHaveBeenCalledWith(samplePlan, { autoExecute: true }))
    expect(await screen.findByText('已应用到画布')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '应用计划' })).not.toBeInTheDocument()
  })

  it('applies the fetched plan manually when autoExecute is disabled', async () => {
    const unsubscribe = vi.fn()
    const api = createApi({
      onCanvasPlanReady: vi.fn().mockImplementation((handler: (event: { messageId: string; planId: string }) => void) => {
        setTimeout(() => handler({ messageId: 'message-1', planId: 'plan-1' }), 0)
        return unsubscribe
      })
    })
    const onApplyPlan = vi.fn()
    const { unmount } = render(<ChatPanel api={api} onApplyPlan={onApplyPlan} />)

    fireEvent.change(screen.getByRole('textbox', { name: 'Canvas agent message' }), { target: { value: '生成短视频' } })
    fireEvent.click(screen.getByRole('button', { name: '发送画布消息' }))

    await screen.findByText('生成宇宙飞船首帧并转成短视频。')
    fireEvent.click(screen.getByRole('button', { name: '应用计划' }))

    expect(onApplyPlan).toHaveBeenCalledWith(samplePlan, { autoExecute: false })

    unmount()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('unsubscribes planReady on unmount', async () => {
    const unsubscribe = vi.fn()
    const api = createApi({
      onCanvasPlanReady: vi.fn().mockImplementation((handler: (event: { messageId: string; planId: string }) => void) => {
        setTimeout(() => handler({ messageId: 'message-1', planId: 'plan-1' }), 0)
        return unsubscribe
      })
    })
    const { unmount } = render(<ChatPanel api={api} onApplyPlan={vi.fn()} />)

    fireEvent.change(screen.getByRole('textbox', { name: 'Canvas agent message' }), { target: { value: '生成短视频' } })
    fireEvent.click(screen.getByRole('button', { name: '发送画布消息' }))

    await screen.findByText('生成宇宙飞船首帧并转成短视频。')
    unmount()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('keeps live Agent subscriptions active across React StrictMode effect replay', async () => {
    const permissionHandlers = new Set<(event: {
      runId: string
      messageId: string
      callId: string
      toolId: string
      reason: string
      requiredPermissions: ToolPermission[]
    }) => void>()
    const api = createApi({
      onCanvasPlanReady: vi.fn().mockReturnValue(vi.fn()),
      onAgentResponseReady: vi.fn().mockReturnValue(vi.fn()),
      onAgentPermissionRequired: vi.fn((handler: (event: {
        runId: string
        messageId: string
        callId: string
        toolId: string
        reason: string
        requiredPermissions: ToolPermission[]
      }) => void) => {
        permissionHandlers.add(handler)
        return () => permissionHandlers.delete(handler)
      })
    })

    render(
      <React.StrictMode>
        <ChatPanel api={api} onApplyPlan={vi.fn()} />
      </React.StrictMode>
    )

    fireEvent.change(screen.getByRole('textbox', { name: 'Canvas agent message' }), { target: { value: '你知道 Java 么' } })
    fireEvent.click(screen.getByRole('button', { name: '发送画布消息' }))

    await waitFor(() => expect(api.getAgentRun).toHaveBeenCalledWith({ runId: 'run-agent-1' }))
    expect(permissionHandlers).toHaveLength(1)

    act(() => {
      for (const handler of permissionHandlers) {
        handler({
          runId: 'run-agent-1',
          messageId: 'message-1',
          callId: 'call-web-search',
          toolId: 'web.search',
          reason: 'Search requires user approval.',
          requiredPermissions: [{ kind: 'network', reason: 'Searches the web.' }]
        })
      }
    })

    expect(await screen.findByText('Search requires user approval.')).toBeInTheDocument()
  })

  it('shows clarify plans as questions without an apply action', () => {
    const clarifyPlan: CanvasPlan = {
      kind: 'clarify',
      summary: 'Need more detail',
      nodes: [],
      edges: [],
      runSteps: [],
      question: '请补充分镜主体。',
      dropped: []
    }

    render(<PlanCard plan={clarifyPlan} autoExecute={false} onAutoExecuteChange={vi.fn()} onApplyPlan={vi.fn()} />)

    expect(screen.getByText('请补充分镜主体。')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '应用计划' })).not.toBeInTheDocument()
  })

  it('renders ordinary Agent answers from responseReady without fetching a CanvasPlan', async () => {
    const getCanvasPlan = vi.fn().mockResolvedValue(samplePlan)
    const api = createApi({
      getCanvasPlan,
      onCanvasPlanReady: vi.fn().mockReturnValue(vi.fn()),
      onAgentResponseReady: vi.fn().mockImplementation((handler: (event: { messageId: string; runId: string; response: { type: 'answer'; summary: string; text: string; dropped: string[] } }) => void) => {
        setTimeout(() => handler({
          messageId: 'message-1',
          runId: 'run-agent-1',
          response: {
            type: 'answer',
            summary: '用户提出了普通问题，应由通用 Agent 直接回答。',
            text: '今天是星期二。',
            dropped: []
          }
        }), 0)
        return vi.fn()
      })
    })

    render(<ChatPanel api={api} onApplyPlan={vi.fn()} />)

    fireEvent.change(screen.getByRole('textbox', { name: 'Canvas agent message' }), { target: { value: '今天星期几' } })
    fireEvent.click(screen.getByRole('button', { name: '发送画布消息' }))

    expect(await screen.findByText('今天是星期二。')).toBeInTheDocument()
    expect(getCanvasPlan).not.toHaveBeenCalled()
    expect(screen.queryByText('计划已就绪：plan-1')).not.toBeInTheDocument()
    expect(screen.queryByText('需要澄清。')).not.toBeInTheDocument()
  })

  it('recovers an ordinary Agent answer when responseReady arrives before the chat ticket settles', async () => {
    const responseReadyHandlers: Array<(event: {
      messageId: string
      runId: string
      response: { type: 'answer'; summary: string; text: string; dropped: string[] }
    }) => void> = []
    const api = createApi({
      sendCanvasChat: vi.fn().mockImplementation(() => {
        responseReadyHandlers[0]?.({
          messageId: 'message-fast',
          runId: 'run-fast',
          response: {
            type: 'answer',
            summary: '用户提出了普通寒暄。',
            text: '你好，我是 ComicCanvas 的通用 Agent。',
            dropped: []
          }
        })
        return Promise.resolve({ runId: 'run-fast', jobId: 'job-fast', messageId: 'message-fast', status: 'pending' })
      }),
      getAgentRun: vi.fn().mockResolvedValue({
        runId: 'run-fast',
        status: 'completed',
        trace: {
          messageId: 'message-fast',
          jobId: 'job-fast',
          response: {
            type: 'answer',
            summary: '用户提出了普通寒暄。',
            text: '你好，我是 ComicCanvas 的通用 Agent。',
            dropped: []
          }
        }
      }),
      onCanvasPlanReady: vi.fn().mockReturnValue(vi.fn()),
      onAgentResponseReady: vi.fn((handler: (event: {
        messageId: string
        runId: string
        response: { type: 'answer'; summary: string; text: string; dropped: string[] }
      }) => void) => {
        responseReadyHandlers.push(handler)
        return vi.fn()
      })
    })

    render(<ChatPanel api={api} onApplyPlan={vi.fn()} />)

    fireEvent.change(screen.getByRole('textbox', { name: 'Canvas agent message' }), { target: { value: '你好' } })
    fireEvent.click(screen.getByRole('button', { name: '发送画布消息' }))

    expect(await screen.findByText('你好，我是 ComicCanvas 的通用 Agent。')).toBeInTheDocument()
  })

  it('shows a visible assistant error when the pending Agent job fails', async () => {
    const failedHandlers: Array<(event: { channel: 'job.failed'; jobId: string; error: { errorClass: string; message: string; retryable: boolean }; emittedAt: number }) => void> = []
    const api = createApi({
      onCanvasPlanReady: vi.fn().mockReturnValue(vi.fn()),
      onAgentResponseReady: vi.fn().mockReturnValue(vi.fn()),
      onJobFailed: vi.fn((handler: (event: { channel: 'job.failed'; jobId: string; error: { errorClass: string; message: string; retryable: boolean }; emittedAt: number }) => void) => {
        failedHandlers.push(handler)
        return vi.fn()
      })
    })

    render(<ChatPanel api={api} onApplyPlan={vi.fn()} />)

    fireEvent.change(screen.getByRole('textbox', { name: 'Canvas agent message' }), { target: { value: '你好' } })
    fireEvent.click(screen.getByRole('button', { name: '发送画布消息' }))

    await waitFor(() => expect(api.sendCanvasChat).toHaveBeenCalled())
    const handler = failedHandlers[0]
    if (!handler) throw new Error('expected_job_failed_subscription')

    handler({
      channel: 'job.failed',
      jobId: 'job-agent-1',
      error: { errorClass: 'agent_run_failed', message: 'Agent runtime failed.', retryable: false },
      emittedAt: 1
    })

    expect(await screen.findByText('Agent runtime failed.')).toBeInTheDocument()
    expect(screen.getByText('agent_run_failed')).toBeInTheDocument()
  })

  it('keeps the approval dialog open when an Agent job fails because a tool needs approval', async () => {
    const permissionHandlers: Array<(event: {
      runId: string
      messageId: string
      callId: string
      toolId: string
      reason: string
      requiredPermissions: ToolPermission[]
    }) => void> = []
    const failedHandlers: Array<(event: {
      channel: 'job.failed'
      jobId: string
      error: {
        errorClass: string
        message: string
        retryable: boolean
        details?: Record<string, unknown>
      }
      emittedAt: number
    }) => void> = []
    const approveAgentTool = vi.fn().mockResolvedValue({ runId: 'run-agent-1', jobId: 'job-agent-2', status: 'pending' })
    const api = createApi({
      onCanvasPlanReady: vi.fn().mockReturnValue(vi.fn()),
      onAgentResponseReady: vi.fn().mockReturnValue(vi.fn()),
      onAgentPermissionRequired: vi.fn((handler: (event: {
        runId: string
        messageId: string
        callId: string
        toolId: string
        reason: string
        requiredPermissions: ToolPermission[]
      }) => void) => {
        permissionHandlers.push(handler)
        return vi.fn()
      }),
      onJobFailed: vi.fn((handler: (event: {
        channel: 'job.failed'
        jobId: string
        error: {
          errorClass: string
          message: string
          retryable: boolean
          details?: Record<string, unknown>
        }
        emittedAt: number
      }) => void) => {
        failedHandlers.push(handler)
        return vi.fn()
      }),
      approveAgentTool
    })

    render(<ChatPanel api={api} onApplyPlan={vi.fn()} />)

    fireEvent.change(screen.getByRole('textbox', { name: 'Canvas agent message' }), { target: { value: '你知道java么' } })
    fireEvent.click(screen.getByRole('button', { name: '发送画布消息' }))

    await waitFor(() => expect(api.sendCanvasChat).toHaveBeenCalled())
    const permissionHandler = permissionHandlers[0]
    const failedHandler = failedHandlers[0]
    if (!permissionHandler || !failedHandler) throw new Error('expected_permission_and_failed_subscriptions')

    act(() => {
      permissionHandler({
        runId: 'run-agent-1',
        messageId: 'message-1',
        callId: 'call-web-search',
        toolId: 'web.search',
        reason: 'Search requires user approval.',
        requiredPermissions: [{ kind: 'network', reason: 'Searches the web.' }]
      })
    })

    expect(await screen.findByText('需要授权')).toBeInTheDocument()
    expect(screen.getByText('Search requires user approval.')).toBeInTheDocument()

    act(() => {
      failedHandler({
        channel: 'job.failed',
        jobId: 'job-agent-1',
        error: {
          errorClass: 'agent_tool_approval_required',
          message: 'Tool requires user approval before execution.',
          retryable: false
        },
        emittedAt: 1
      })
    })

    expect(screen.getByText('需要授权')).toBeInTheDocument()
    expect(screen.queryByText('Tool requires user approval before execution.')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '批准并继续' }))

    await waitFor(() => expect(approveAgentTool).toHaveBeenCalledWith({
      runId: 'run-agent-1',
      callId: 'call-web-search',
      approvedBy: 'chat-user',
      scope: 'session'
    }))
  })

  it('recovers the approved Agent response from the run snapshot when resume events were missed', async () => {
    const permissionHandlers: Array<(event: {
      runId: string
      messageId: string
      callId: string
      toolId: string
      reason: string
      requiredPermissions: ToolPermission[]
    }) => void> = []
    const getAgentRun = vi.fn()
      .mockResolvedValueOnce({ runId: 'run-agent-1', status: 'pending', trace: {} })
      .mockResolvedValue({
        runId: 'run-agent-1',
        status: 'completed',
        trace: {
          messageId: 'message-1',
          jobId: 'job-agent-2',
          response: {
            type: 'answer',
            summary: '联网查询后回答 Java。',
            text: 'Java 是一门面向对象的通用编程语言。',
            dropped: []
          }
        }
      })
    const api = createApi({
      getAgentRun,
      onCanvasPlanReady: vi.fn().mockReturnValue(vi.fn()),
      onAgentResponseReady: vi.fn().mockReturnValue(vi.fn()),
      onAgentPermissionRequired: vi.fn((handler: (event: {
        runId: string
        messageId: string
        callId: string
        toolId: string
        reason: string
        requiredPermissions: ToolPermission[]
      }) => void) => {
        permissionHandlers.push(handler)
        return vi.fn()
      }),
      approveAgentTool: vi.fn().mockResolvedValue({ runId: 'run-agent-1', jobId: 'job-agent-2', status: 'pending' })
    })

    render(<ChatPanel api={api} onApplyPlan={vi.fn()} />)

    fireEvent.change(screen.getByRole('textbox', { name: 'Canvas agent message' }), { target: { value: '你知道java么' } })
    fireEvent.click(screen.getByRole('button', { name: '发送画布消息' }))

    await waitFor(() => expect(api.sendCanvasChat).toHaveBeenCalled())
    const permissionHandler = permissionHandlers[0]
    if (!permissionHandler) throw new Error('expected_permission_subscription')

    act(() => {
      permissionHandler({
        runId: 'run-agent-1',
        messageId: 'message-1',
        callId: 'call-web-search',
        toolId: 'web.search',
        reason: 'Search requires user approval.',
        requiredPermissions: [{ kind: 'network', reason: 'Searches the web.' }]
      })
    })

    fireEvent.click(await screen.findByRole('button', { name: '批准并继续' }))

    expect(await screen.findByText('Java 是一门面向对象的通用编程语言。')).toBeInTheDocument()
  })

  it('uses the Tailwind cn helper and references the pc-client chat implementation baseline', () => {
    const source = readFileSync('desktop/src/renderer/src/chat/ChatPanel.tsx', 'utf8')
    const tasks = readFileSync('specs/milestone-execution-plan/tasks.md', 'utf8')

    expect(source).toContain("from '../lib/cn'")
    expect(source).toContain('cn(')
    expect(source).toContain('bg-bg-card')
    expect(source).toContain('text-text-secondary')
    expect(tasks).toContain('CanvasChatBox.tsx')
    expect(tasks).toContain('MentionTextarea.tsx')
    expect(tasks).toContain('CommandPalette.tsx')
  })

  it('opens the @mention agent selector, selects an agent with keyboard navigation, and routes chat to that agent', async () => {
    const api = createApi()

    render(<ChatPanel api={api} onApplyPlan={vi.fn()} />)

    const textbox = screen.getByRole('textbox', { name: 'Canvas agent message' })
    fireEvent.change(textbox, { target: { value: '@' } })

    expect(await screen.findByRole('listbox', { name: 'Agent 提及选择器' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /General Purpose/ })).toHaveAttribute('aria-selected', 'true')

    fireEvent.keyDown(textbox, { key: 'ArrowDown' })
    expect(screen.getByRole('option', { name: /Canvas/ })).toHaveAttribute('aria-selected', 'true')

    fireEvent.keyDown(textbox, { key: 'Enter' })

    await waitFor(() => expect(screen.queryByRole('listbox', { name: 'Agent 提及选择器' })).not.toBeInTheDocument())
    expect(screen.getByText('@Canvas')).toBeInTheDocument()

    fireEvent.change(textbox, { target: { value: '@Canvas Generate a three-panel comic beat' } })
    fireEvent.keyDown(textbox, { key: 'Enter' })

    await waitFor(() =>
      expect(api.sendCanvasChat).toHaveBeenCalledWith({
        message: 'Generate a three-panel comic beat',
        agentId: 'canvas'
      })
    )
  })
})
