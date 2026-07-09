// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'

import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import CanvasChatBox from '../desktop/src/renderer/src/canvas/components/CanvasChatBox'
import { AgentPermissionModal } from '../desktop/src/renderer/src/chat/agent/AgentPermissionModal'
import type { AgentDefinition } from '../shared/agents'

type ProgressHandler = (event: { jobId: string; message?: string; progress: number }) => void

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
    maxContextTokens: 8000,
  },
  permissionPolicy: { allowedPermissionKinds: ['canvas.read', 'canvas.write', 'provider.spend'], requireAskForDestructive: true },
  triggerPolicy: { allowedTriggers: ['manual', 'mention', 'canvasChat'], defaultTrigger: 'canvasChat', autoRun: false },
  maxTurns: 8,
  effort: 'high',
  enabled: true,
}

const canvasAgent: AgentDefinition = {
  ...generalAgent,
  id: 'canvas',
  name: 'Canvas',
  description: 'Handles canvas nodes and graph edits.',
  gatewayPolicy: { allowedChannels: ['text'] },
}

afterEach(() => {
  cleanup()
})

describe('CanvasChatBox', () => {
  it('keeps the permission modal clickable inside the on-canvas pointer-events shell', () => {
    const approve = vi.fn()

    render(
      <div className="pointer-events-none">
        <AgentPermissionModal
          request={{
            runId: 'run-permission',
            callId: 'call-web-search',
            toolId: 'web.search',
            reason: 'Search requires approval.'
          }}
          onApprove={approve}
          onDismiss={vi.fn()}
        />
      </div>
    )

    const approveButton = screen.getByRole('button', { name: '批准并继续' })
    const modalOverlay = approveButton.closest('.fixed')

    expect(modalOverlay).toHaveClass('pointer-events-auto')
  })

  it('is enabled on-canvas, supports @agent routing, and sends through canvas chat IPC', async () => {
    const progress = { handler: null as ProgressHandler | null }
    const sendCanvasChat = vi.fn().mockResolvedValue({ runId: 'run-agent-1', jobId: 'job-agent-1', messageId: 'message-1', status: 'pending' })
    const getAgentRun = vi.fn().mockResolvedValue({
      runId: 'run-agent-1',
      status: 'pending',
      trace: {
        intentAnalysis: {
          summary: '用户提出了明确的画布或生成工作流需求。',
          requirements: ['生成一个角色和首帧'],
          missing: [],
          executionMode: 'plan',
          complexity: 'high',
          recommendedAgentId: 'canvas-orchestrator',
        },
        capabilityCheck: {
          localCapabilities: ['canvas.queryGraph', 'canvas.proposePlan'],
          selectedAgentId: 'canvas-orchestrator',
        },
      },
    })
    window.comicCanvas = {
      listAgents: vi.fn().mockResolvedValue([generalAgent, canvasAgent]),
      sendCanvasChat,
      getAgentRun,
      getCanvasPlan: vi.fn(),
      onCanvasPlanReady: vi.fn().mockReturnValue(vi.fn()),
      onAgentResponseReady: vi.fn().mockReturnValue(vi.fn()),
      onJobProgress: vi.fn((handler) => {
        progress.handler = handler as ProgressHandler
        return vi.fn()
      }),
    } as unknown as Window['comicCanvas']

    render(<CanvasChatBox open onToggle={vi.fn()} onApplyPlan={vi.fn()} />)

    const textbox = await screen.findByRole('textbox', { name: 'Canvas floating agent message' })
    expect(textbox).toBeEnabled()

    fireEvent.change(textbox, { target: { value: '@' } })
    expect(await screen.findByRole('listbox', { name: 'Agent 提及选择器' })).toBeInTheDocument()

    fireEvent.keyDown(textbox, { key: 'ArrowDown' })
    fireEvent.keyDown(textbox, { key: 'Enter' })
    expect(screen.getByText('@Canvas')).toBeInTheDocument()

    fireEvent.change(textbox, { target: { value: '@Canvas 生成一个角色和首帧' } })
    fireEvent.keyDown(textbox, { key: 'Enter' })

    await waitFor(() => expect(sendCanvasChat).toHaveBeenCalledWith({
      message: '生成一个角色和首帧',
      agentId: 'canvas',
    }))
    expect(await screen.findByText('Agent 已排队：job-agent-1')).toBeInTheDocument()
    await waitFor(() => expect(getAgentRun).toHaveBeenCalledWith({ runId: 'run-agent-1' }))
    expect(await screen.findByText('理解输入：用户提出了明确的画布或生成工作流需求。')).toBeInTheDocument()
    expect(await screen.findByText('拆解需求：生成一个角色和首帧')).toBeInTheDocument()
    expect(await screen.findByText('检查本地能力：canvas.queryGraph、canvas.proposePlan')).toBeInTheDocument()
    expect(await screen.findByText('执行模式：plan；推荐 Agent：canvas-orchestrator。')).toBeInTheDocument()

    expect(progress.handler).not.toBeNull()
    const emitProgress = progress.handler as ProgressHandler
    emitProgress({ jobId: 'job-agent-1', progress: 20, message: '理解用户输入' })
    emitProgress({ jobId: 'job-agent-1', progress: 40, message: '拆解需求并检查本地能力' })

    expect(await screen.findByText('理解用户输入')).toBeInTheDocument()
    expect(await screen.findByText('拆解需求并检查本地能力')).toBeInTheDocument()
  })

  it('renders ordinary Agent answers from responseReady without requesting a plan', async () => {
    const sendCanvasChat = vi.fn().mockResolvedValue({ runId: 'run-agent-1', jobId: 'job-agent-1', messageId: 'message-1', status: 'pending' })
    const getCanvasPlan = vi.fn()
    const responseReadyHandlers: Array<(event: {
      runId: string
      messageId: string
      response: {
        type: 'answer'
        summary: string
        text: string
        dropped: string[]
      }
    }) => void> = []
    window.comicCanvas = {
      listAgents: vi.fn().mockResolvedValue([generalAgent]),
      sendCanvasChat,
      getAgentRun: vi.fn().mockResolvedValue({ runId: 'run-agent-1', status: 'pending', trace: {} }),
      getCanvasPlan,
      onCanvasPlanReady: vi.fn().mockReturnValue(vi.fn()),
      onAgentResponseReady: vi.fn((handler: (event: {
        runId: string
        messageId: string
        response: {
          type: 'answer'
          summary: string
          text: string
          dropped: string[]
        }
      }) => void) => {
        responseReadyHandlers.push(handler)
        return vi.fn()
      }),
      onJobProgress: vi.fn().mockReturnValue(vi.fn()),
    } as unknown as Window['comicCanvas']

    render(<CanvasChatBox open onToggle={vi.fn()} onApplyPlan={vi.fn()} />)

    const textbox = await screen.findByRole('textbox', { name: 'Canvas floating agent message' })
    fireEvent.change(textbox, { target: { value: '今天星期几' } })
    fireEvent.keyDown(textbox, { key: 'Enter' })

    await waitFor(() => expect(sendCanvasChat).toHaveBeenCalled())
    const responseReadyHandler = responseReadyHandlers[0]
    if (!responseReadyHandler) {
      throw new Error('expected_response_ready_subscription')
    }

    responseReadyHandler({
      runId: 'run-agent-1',
      messageId: 'message-1',
      response: {
        type: 'answer',
        summary: '用户提出了普通问题，应由通用 Agent 直接回答。',
        text: '今天是星期二。',
        dropped: [],
      },
    })

    expect(await screen.findByText('今天是星期二。')).toBeInTheDocument()
    expect(getCanvasPlan).not.toHaveBeenCalled()
    expect(screen.queryByText('计划已就绪：plan-1')).not.toBeInTheDocument()
  })

  it('recovers a fast Agent answer when responseReady arrives before the floating chat ticket settles', async () => {
    const responseReadyHandlers: Array<(event: {
      runId: string
      messageId: string
      response: {
        type: 'answer'
        summary: string
        text: string
        dropped: string[]
      }
    }) => void> = []
    const sendCanvasChat = vi.fn().mockImplementation(() => {
      responseReadyHandlers[0]?.({
        runId: 'run-fast',
        messageId: 'message-fast',
        response: {
          type: 'answer',
          summary: '用户提出了普通寒暄。',
          text: '你好，我是 ComicCanvas 的通用 Agent。',
          dropped: [],
        },
      })
      return Promise.resolve({ runId: 'run-fast', jobId: 'job-fast', messageId: 'message-fast', status: 'pending' })
    })
    window.comicCanvas = {
      listAgents: vi.fn().mockResolvedValue([generalAgent]),
      sendCanvasChat,
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
            dropped: [],
          },
        },
      }),
      getCanvasPlan: vi.fn(),
      onCanvasPlanReady: vi.fn().mockReturnValue(vi.fn()),
      onAgentResponseReady: vi.fn((handler: (event: {
        runId: string
        messageId: string
        response: {
          type: 'answer'
          summary: string
          text: string
          dropped: string[]
        }
      }) => void) => {
        responseReadyHandlers.push(handler)
        return vi.fn()
      }),
      onJobProgress: vi.fn().mockReturnValue(vi.fn()),
    } as unknown as Window['comicCanvas']

    render(<CanvasChatBox open onToggle={vi.fn()} onApplyPlan={vi.fn()} />)

    const textbox = await screen.findByRole('textbox', { name: 'Canvas floating agent message' })
    fireEvent.change(textbox, { target: { value: '你好' } })
    fireEvent.keyDown(textbox, { key: 'Enter' })

    expect(await screen.findByText('你好，我是 ComicCanvas 的通用 Agent。')).toBeInTheDocument()
  })

  it('shows a visible assistant error when the floating chat Agent job fails', async () => {
    const failedHandlers: Array<(event: { channel: 'job.failed'; jobId: string; error: { errorClass: string; message: string; retryable: boolean }; emittedAt: number }) => void> = []
    const sendCanvasChat = vi.fn().mockResolvedValue({ runId: 'run-agent-1', jobId: 'job-agent-1', messageId: 'message-1', status: 'pending' })
    window.comicCanvas = {
      listAgents: vi.fn().mockResolvedValue([generalAgent]),
      sendCanvasChat,
      getAgentRun: vi.fn().mockResolvedValue({ runId: 'run-agent-1', status: 'pending', trace: {} }),
      getCanvasPlan: vi.fn(),
      onCanvasPlanReady: vi.fn().mockReturnValue(vi.fn()),
      onAgentResponseReady: vi.fn().mockReturnValue(vi.fn()),
      onJobProgress: vi.fn().mockReturnValue(vi.fn()),
      onJobFailed: vi.fn((handler: (event: { channel: 'job.failed'; jobId: string; error: { errorClass: string; message: string; retryable: boolean }; emittedAt: number }) => void) => {
        failedHandlers.push(handler)
        return vi.fn()
      }),
    } as unknown as Window['comicCanvas']

    render(<CanvasChatBox open onToggle={vi.fn()} onApplyPlan={vi.fn()} />)

    const textbox = await screen.findByRole('textbox', { name: 'Canvas floating agent message' })
    fireEvent.change(textbox, { target: { value: '你好' } })
    fireEvent.keyDown(textbox, { key: 'Enter' })

    await waitFor(() => expect(sendCanvasChat).toHaveBeenCalled())
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
})
