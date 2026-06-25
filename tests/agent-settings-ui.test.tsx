// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, type Mock, vi } from 'vitest'

import type { AgentDefinition } from '../shared/agents'
import { AgentForm } from '../desktop/src/renderer/src/settings/AgentForm'
import { AgentList, type AgentSettingsApi } from '../desktop/src/renderer/src/settings/AgentList'

const builtinAgent: AgentDefinition = {
  id: 'orchestrator',
  source: 'builtin',
  name: 'Orchestrator',
  description: 'Plans canvas workflows.',
  instructions: 'Create safe CanvasPlan JSON.',
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
  permissionPolicy: { allowedPermissionKinds: ['canvas.read', 'canvas.write'], requireAskForDestructive: true },
  maxTurns: 8,
  effort: 'high',
  enabled: true
}

const customAgent: AgentDefinition = {
  id: 'agent-storyboard',
  source: 'user',
  name: 'Storyboard agent',
  description: 'Breaks prompts into panels.',
  instructions: 'Create concise storyboards.',
  allowedTools: ['canvas.queryGraph'],
  allowedSkills: ['storyboard'],
  gatewayPolicy: { allowedChannels: ['text'], modelId: 'stub-text' },
  contextPolicy: {
    includeCanvasGraph: true,
    includeSelectedAssets: false,
    includeRecentMessages: true,
    includeKnowledge: false,
    maxContextTokens: 4000
  },
  permissionPolicy: { allowedPermissionKinds: ['canvas.read'], requireAskForDestructive: true },
  maxTurns: 4,
  effort: 'medium',
  enabled: true
}

function createApi(overrides: Partial<AgentSettingsApi> = {}): AgentSettingsApi {
  return {
    listAgents: vi.fn().mockResolvedValue([builtinAgent, customAgent]),
    saveAgent: vi.fn().mockImplementation((input: AgentDefinition) => Promise.resolve(input)),
    deleteAgent: vi.fn().mockResolvedValue({ agentId: 'agent-storyboard', deleted: true }),
    ...overrides
  }
}

function mockOf<T extends (...args: never[]) => unknown>(fn: T): Mock {
  return fn as unknown as Mock
}

afterEach(() => {
  cleanup()
})

describe('M5 custom Agent settings UI', () => {
  it('renders built-in and custom agents with read-only protection', async () => {
    render(<AgentList api={createApi()} />)

    expect(await screen.findByText('Orchestrator')).toBeInTheDocument()
    expect(screen.getByText('Storyboard agent')).toBeInTheDocument()
    expect(screen.getByText('builtin')).toBeInTheDocument()
    expect(screen.getByText('user')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete Orchestrator' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit Storyboard agent' })).toBeInTheDocument()
  })

  it('saves a new custom agent with selected tools and skills', async () => {
    const api = createApi({ listAgents: vi.fn().mockResolvedValue([builtinAgent]) })
    render(<AgentList api={api} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Add agent' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Agent name' }), { target: { value: 'Panel planner' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Description' }), { target: { value: 'Plans panel beats.' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Instructions' }), { target: { value: 'Plan text-image-video panels.' } })
    fireEvent.click(screen.getByRole('checkbox', { name: 'canvas.queryGraph' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Allowed skills' }), { target: { value: 'storyboard, shot-list' } })
    fireEvent.change(screen.getByRole('spinbutton', { name: 'Max turns' }), { target: { value: '7' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save agent' }))

    const saveAgent = mockOf(api.saveAgent)
    await waitFor(() => expect(saveAgent).toHaveBeenCalledTimes(1))
    expect(saveAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 'agent-panel-planner',
        source: 'user',
        name: 'Panel planner',
        description: 'Plans panel beats.',
        instructions: 'Plan text-image-video panels.',
        allowedTools: ['canvas.queryGraph'],
        allowedSkills: ['storyboard', 'shot-list'],
        maxTurns: 7,
        effort: 'medium',
        enabled: true
      })
    )
  })

  it('edits and deletes user agents through typed API actions', async () => {
    const api = createApi()
    render(<AgentList api={api} />)

    await screen.findByText('Storyboard agent')
    fireEvent.click(screen.getByRole('button', { name: 'Edit Storyboard agent' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Agent name' }), { target: { value: 'Storyboard director' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save agent' }))

    await waitFor(() =>
      expect(mockOf(api.saveAgent)).toHaveBeenCalledWith(expect.objectContaining({ id: 'agent-storyboard', name: 'Storyboard director' }))
    )

    fireEvent.click(screen.getByRole('button', { name: 'Delete Storyboard director' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirm delete' }))

    await waitFor(() => expect(mockOf(api.deleteAgent)).toHaveBeenCalledWith({ agentId: 'agent-storyboard' }))
  })

  it('validates required custom agent fields before submit', () => {
    const onSubmit = vi.fn()
    render(<AgentForm onSubmit={onSubmit} onCancel={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: 'Save agent' }))

    expect(screen.getByText('Name and instructions are required.')).toBeInTheDocument()
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
