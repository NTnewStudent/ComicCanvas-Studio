// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { StyleLibrary, type StyleLibraryApi } from '../desktop/src/renderer/src/settings/StyleLibrary'
import type { StylePresetSaveInput, StylePresetView } from '../shared/styles'

const inkStyle: StylePresetView = {
  id: 'style-ink',
  code: 'ink',
  name: 'Industrial Ink',
  description: 'Monochrome comic ink',
  promptBefore: 'ink comic',
  promptAfter: 'paper texture',
  legacyPromptPreset: null,
  negativePrompt: 'low detail',
  coverAssetId: 'asset-cover-ink',
  coverUrl: 'cc-asset://asset/asset-cover-ink',
  tags: ['comic', 'ink'],
  enabled: true,
  sortOrder: 1,
  createdAt: 1,
  updatedAt: 1,
}

function createApi(overrides: Partial<StyleLibraryApi> = {}): StyleLibraryApi {
  return {
    listStyles: vi.fn().mockResolvedValue([inkStyle]),
    saveStyle: vi.fn().mockImplementation((input: StylePresetSaveInput) =>
      Promise.resolve({
        ...inkStyle,
        id: input.id ?? 'style-neon',
        code: input.code,
        name: input.name,
        description: input.description ?? null,
        promptBefore: input.promptBefore ?? null,
        promptAfter: input.promptAfter ?? null,
        negativePrompt: input.negativePrompt ?? null,
        tags: input.tags ?? [],
        enabled: input.enabled ?? true,
      } satisfies StylePresetView),
    ),
    deleteStyle: vi.fn().mockResolvedValue({ stylePresetId: 'style-ink', deleted: true }),
    ...overrides,
  }
}

afterEach(() => {
  cleanup()
})

describe('REQ-094 style library UI', () => {
  it('uses Chinese production copy for style management controls', async () => {
    render(<StyleLibrary api={createApi()} />)

    expect(await screen.findByRole('heading', { name: '风格库' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '新增风格' })).toBeInTheDocument()
    expect(screen.getByText('管理项目默认风格和节点覆盖风格使用的前置、后置提示词。')).toBeInTheDocument()
  })

  it('renders style presets with prompt summary, tags, and enabled state', async () => {
    render(<StyleLibrary api={createApi()} />)

    expect(await screen.findByText('Industrial Ink')).toBeInTheDocument()
    expect(screen.getByText('ink comic')).toBeInTheDocument()
    expect(screen.getByText('paper texture')).toBeInTheDocument()
    expect(screen.getByText('comic')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Industrial Ink enabled' })).toBeChecked()
    expect(screen.getByRole('img', { name: 'Industrial Ink 封面' })).toHaveAttribute('src', 'cc-asset://asset/asset-cover-ink')
  })

  it('creates and deletes styles through typed preload actions', async () => {
    const saveStyle = vi.fn().mockImplementation((input: StylePresetSaveInput) =>
      Promise.resolve({
        ...inkStyle,
        id: input.id ?? 'style-neon',
        code: input.code,
        name: input.name,
        description: input.description ?? null,
        promptBefore: input.promptBefore ?? null,
        promptAfter: input.promptAfter ?? null,
        negativePrompt: input.negativePrompt ?? null,
        tags: input.tags ?? [],
        enabled: input.enabled ?? true,
      } satisfies StylePresetView),
    )
    const deleteStyle = vi.fn().mockResolvedValue({ stylePresetId: 'style-ink', deleted: true })
    const api = createApi({ listStyles: vi.fn().mockResolvedValue([]), saveStyle, deleteStyle })
    render(<StyleLibrary api={api} />)

    fireEvent.click(await screen.findByRole('button', { name: '新增风格' }))
    fireEvent.change(screen.getByRole('textbox', { name: '风格名称' }), { target: { value: 'Neon Noir' } })
    fireEvent.change(screen.getByRole('textbox', { name: '风格编码' }), { target: { value: 'neon-noir' } })
    fireEvent.change(screen.getByRole('textbox', { name: '前置提示词' }), { target: { value: 'neon ink' } })
    fireEvent.change(screen.getByRole('textbox', { name: '后置提示词' }), { target: { value: 'rain reflections' } })
    fireEvent.change(screen.getByRole('textbox', { name: '封面资产 ID' }), { target: { value: 'asset-neon-cover' } })
    fireEvent.change(screen.getByRole('textbox', { name: '标签' }), { target: { value: 'comic, night' } })
    fireEvent.click(screen.getByRole('button', { name: '保存风格' }))

    await waitFor(() => expect(saveStyle).toHaveBeenCalledWith({
      code: 'neon-noir',
      name: 'Neon Noir',
      description: '',
      promptBefore: 'neon ink',
      promptAfter: 'rain reflections',
      negativePrompt: '',
      coverAssetId: 'asset-neon-cover',
      tags: ['comic', 'night'],
      enabled: true,
      sortOrder: 0,
    }))

    fireEvent.click(await screen.findByRole('button', { name: '删除 Neon Noir' }))
    fireEvent.click(screen.getByRole('button', { name: '确认删除风格' }))

    await waitFor(() => expect(deleteStyle).toHaveBeenCalledWith({ stylePresetId: 'style-neon' }))
  })
})
