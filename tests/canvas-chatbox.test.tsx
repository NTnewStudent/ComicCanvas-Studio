// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'

import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import CanvasChatBox from '../desktop/src/renderer/src/canvas/components/CanvasChatBox'
import type { AgentDefinition } from '../shared/agents'

const orchestratorAgent: AgentDefinition = {
  id: 'orchestrator',
  source: 'builtin',
  name: 'Orchestrator',
  description: 'Turns natural language into CanvasPlan JSON.',
  instructions: 'Analyze requests and produce safe ComicCanvas plans.',
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
  permissionPolicy: { allowedPermissionKinds: ['canvas.read', 'canvas.write', 'provider.spend'], requireAskForDestructive: true },
  triggerPolicy: { allowedTriggers: ['manual', 'mention', 'canvasChat'], defaultTrigger: 'canvasChat', autoRun: false },
  maxTurns: 8,
  effort: 'high',
  enabled: true,
}

const canvasAgent: AgentDefinition = {
  ...orchestratorAgent,
  id: 'canvas',
  name: 'Canvas',
  description: 'Handles canvas nodes and graph edits.',
  gatewayPolicy: { allowedChannels: ['text'] },
}

afterEach(() => {
  cleanup()
})

describe('CanvasChatBox', () => {
  it('is enabled on-canvas, supports @agent routing, and sends through canvas chat IPC', async () => {
    const sendCanvasChat = vi.fn().mockResolvedValue({ jobId: 'job-agent-1', messageId: 'message-1', status: 'pending' })
    window.comicCanvas = {
      listAgents: vi.fn().mockResolvedValue([orchestratorAgent, canvasAgent]),
      sendCanvasChat,
      getCanvasPlan: vi.fn(),
      onCanvasPlanReady: vi.fn().mockReturnValue(vi.fn()),
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
    expect(await screen.findByText('计划已排队：job-agent-1')).toBeInTheDocument()
  })
})
