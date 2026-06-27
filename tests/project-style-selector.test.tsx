// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ProjectStyleSelector, type ProjectStyleSelectorApi } from '../desktop/src/renderer/src/canvas/components/ProjectStyleSelector'
import type { StylePresetView } from '../shared/styles'

const inkStyle: StylePresetView = {
  id: 'style-ink',
  code: 'ink',
  name: 'Industrial Ink',
  description: 'Monochrome comic ink',
  promptBefore: 'ink comic',
  promptAfter: 'paper texture',
  legacyPromptPreset: null,
  negativePrompt: null,
  coverAssetId: null,
  coverUrl: null,
  tags: ['comic'],
  enabled: true,
  sortOrder: 1,
  createdAt: 1,
  updatedAt: 1,
}

const watercolorStyle: StylePresetView = {
  ...inkStyle,
  id: 'style-watercolor',
  code: 'watercolor',
  name: 'Quiet Watercolor',
  promptBefore: 'soft watercolor',
  tags: ['soft'],
}

function createApi(overrides: Partial<ProjectStyleSelectorApi> = {}): ProjectStyleSelectorApi {
  return {
    listStyles: vi.fn().mockResolvedValue([inkStyle, watercolorStyle]),
    getProjectDefaultStyle: vi.fn().mockResolvedValue({ workflowId: 'workflow-1', stylePresetId: 'style-ink' }),
    setProjectDefaultStyle: vi.fn().mockResolvedValue({ workflowId: 'workflow-1', stylePresetId: 'style-watercolor' }),
    ...overrides,
  }
}

afterEach(() => {
  cleanup()
})

describe('REQ-094 project default style selector', () => {
  it('loads the current workflow default style and persists a changed selection', async () => {
    const listStyles = vi.fn().mockResolvedValue([inkStyle, watercolorStyle])
    const getProjectDefaultStyle = vi.fn().mockResolvedValue({ workflowId: 'workflow-1', stylePresetId: 'style-ink' })
    const setProjectDefaultStyle = vi.fn().mockResolvedValue({ workflowId: 'workflow-1', stylePresetId: 'style-watercolor' })
    const api = createApi({ listStyles, getProjectDefaultStyle, setProjectDefaultStyle })
    render(<ProjectStyleSelector workflowId="workflow-1" api={api} />)

    expect(await screen.findByRole('button', { name: /项目风格：Industrial Ink/u })).toBeInTheDocument()
    expect(listStyles).toHaveBeenCalledWith({ includeDisabled: false })
    expect(getProjectDefaultStyle).toHaveBeenCalledWith({ workflowId: 'workflow-1' })

    fireEvent.click(screen.getByRole('button', { name: /项目风格：Industrial Ink/u }))
    fireEvent.click(await screen.findByRole('button', { name: 'Quiet Watercolor' }))

    await waitFor(() => expect(setProjectDefaultStyle).toHaveBeenCalledWith({
      workflowId: 'workflow-1',
      stylePresetId: 'style-watercolor',
    }))
    expect(await screen.findByRole('button', { name: /项目风格：Quiet Watercolor/u })).toBeInTheDocument()
  })

  it('can clear the project default style without changing node overrides', async () => {
    const setProjectDefaultStyle = vi.fn().mockResolvedValue({ workflowId: 'workflow-1', stylePresetId: null })
    const api = createApi({
      setProjectDefaultStyle,
    })
    render(<ProjectStyleSelector workflowId="workflow-1" api={api} />)

    fireEvent.click(await screen.findByRole('button', { name: /项目风格：Industrial Ink/u }))
    fireEvent.click(screen.getByRole('button', { name: '不使用项目风格' }))

    await waitFor(() => expect(setProjectDefaultStyle).toHaveBeenCalledWith({
      workflowId: 'workflow-1',
      stylePresetId: null,
    }))
    expect(await screen.findByRole('button', { name: /项目风格：无/u })).toBeInTheDocument()
  })
})
