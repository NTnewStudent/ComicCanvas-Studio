// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, type Mock, vi } from 'vitest'

import { SkillList, type SkillSettingsApi } from '../desktop/src/renderer/src/settings/SkillList'
import type { SkillDefinition } from '../shared/skills'

const builtinSkill: SkillDefinition = {
  id: 'canvas-node-designer',
  source: 'builtin',
  version: '1.0.0',
  name: 'Canvas Node Designer',
  description: 'Designs new canvas node types consistently.',
  entry: '.claude/skills/canvas-node-designer/SKILL.md',
  references: [
    {
      id: 'canvas-node-designer-entry',
      path: '.claude/skills/canvas-node-designer/SKILL.md',
      kind: 'instructions',
      required: true,
    },
  ],
  requiredTools: [],
  requiredPermissions: [],
  enabled: true,
}

function createApi(overrides: Partial<SkillSettingsApi> = {}): SkillSettingsApi {
  return {
    listSkills: vi.fn().mockResolvedValue([builtinSkill]),
    reloadSkills: vi.fn().mockResolvedValue({ reloadedSkillIds: ['canvas-node-designer'] }),
    enableSkill: vi.fn().mockResolvedValue(builtinSkill),
    disableSkill: vi.fn().mockResolvedValue({ ...builtinSkill, enabled: false }),
    ...overrides,
  }
}

function mockOf<T extends (...args: never[]) => unknown>(fn: T): Mock {
  return fn as unknown as Mock
}

afterEach(() => {
  cleanup()
})

describe('M5 Skill management UI', () => {
  it('renders skill metadata with source and version badges', async () => {
    render(<SkillList api={createApi()} />)

    expect(await screen.findByText('Canvas Node Designer')).toBeInTheDocument()
    expect(screen.getByText('内置')).toBeInTheDocument()
    expect(screen.getByText('v1.0.0')).toBeInTheDocument()
    expect(screen.getByText('canvas-node-designer')).toBeInTheDocument()
  })

  it('reloads skills through typed preload actions', async () => {
    const api = createApi()
    render(<SkillList api={api} />)

    fireEvent.click(await screen.findByRole('button', { name: '重新加载' }))

    await waitFor(() => expect(mockOf(api.reloadSkills)).toHaveBeenCalledWith({}))
    expect(screen.getByText('已重新加载 1 个技能')).toBeInTheDocument()
  })

  it('expands metadata detail without loading instruction bodies in the list call', async () => {
    const api = createApi()
    render(<SkillList api={api} />)

    fireEvent.click(await screen.findByRole('button', { name: '查看元数据' }))

    expect(screen.getByText(/"id": "canvas-node-designer"/)).toBeInTheDocument()
    expect(mockOf(api.listSkills)).toHaveBeenCalledTimes(1)
  })
})
