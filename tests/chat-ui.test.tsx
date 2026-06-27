// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'

import { readFileSync } from 'node:fs'

import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ChatPanel, type ChatPanelApi } from '../desktop/src/renderer/src/chat/ChatPanel'
import { PlanCard } from '../desktop/src/renderer/src/chat/PlanCard'
import type { AgentDefinition } from '../shared/agents'
import type { CanvasPlan } from '../shared/plan'

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

const orchestratorAgent: AgentDefinition = {
  id: 'orchestrator',
  source: 'builtin',
  name: 'Orchestrator',
  description: 'Turns natural language into declarative CanvasPlan JSON.',
  instructions: 'Analyze the user request and produce safe ComicCanvas plans.',
  allowedTools: '*',
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
  ...orchestratorAgent,
  id: 'canvas',
  name: 'Canvas',
  description: 'Handles canvas nodes, edges, and graph edits.',
  gatewayPolicy: { allowedChannels: ['text'] },
  permissionPolicy: { allowedPermissionKinds: ['canvas.read', 'canvas.write'], requireAskForDestructive: true },
  maxTurns: 6
}

function createApi(overrides: Partial<ChatPanelApi> = {}): ChatPanelApi {
  return {
    sendCanvasChat: vi.fn().mockResolvedValue({ jobId: 'job-agent-1', messageId: 'message-1', status: 'pending' }),
    getCanvasPlan: vi.fn().mockResolvedValue(samplePlan),
    listAgents: vi.fn().mockResolvedValue([orchestratorAgent, canvasAgent]),
    onCanvasPlanReady: vi.fn().mockImplementation((handler: (event: { messageId: string; planId: string }) => void) => {
      setTimeout(() => handler({ messageId: 'message-1', planId: 'plan-1' }), 0)
      return vi.fn()
    }),
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

    await waitFor(() => expect(api.sendCanvasChat).toHaveBeenCalledWith({ message: '生成一个宇宙飞船图片节点', agentId: 'orchestrator' }))
    expect(textbox).toHaveValue('')
    expect(screen.getByText('计划已排队：job-agent-1')).toBeInTheDocument()
    await waitFor(() => expect(api.getCanvasPlan).toHaveBeenCalledWith({ messageId: 'message-1' }))
    expect(await screen.findByText('生成宇宙飞船首帧并转成短视频。')).toBeInTheDocument()
  })

  it('applies the fetched plan with autoExecute enabled and unsubscribes planReady on unmount', async () => {
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
    fireEvent.click(screen.getByRole('switch', { name: '自动执行计划运行步骤' }))
    fireEvent.click(screen.getByRole('button', { name: '发送画布消息' }))

    await screen.findByText('生成宇宙飞船首帧并转成短视频。')
    fireEvent.click(screen.getByRole('button', { name: '应用计划' }))

    expect(onApplyPlan).toHaveBeenCalledWith(samplePlan, { autoExecute: true })

    unmount()
    expect(unsubscribe).toHaveBeenCalledTimes(1)
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
    expect(screen.getByRole('option', { name: /Orchestrator/ })).toHaveAttribute('aria-selected', 'true')

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
