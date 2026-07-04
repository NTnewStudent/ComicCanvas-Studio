// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'

import { ReactFlowProvider } from '@xyflow/react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { CharacterNodeData, SceneNodeData } from '../shared/nodes'
import { CharacterNode } from '../desktop/src/renderer/src/canvas/nodes/CharacterNode'
import { SceneNode } from '../desktop/src/renderer/src/canvas/nodes/SceneNode'

function renderInFlow(element: React.ReactElement): void {
  render(<ReactFlowProvider>{element}</ReactFlowProvider>)
}

afterEach(() => {
  vi.restoreAllMocks()
  cleanup()
})

describe('Task 32 character and scene node parity', () => {
  it('edits structured character fields, exposes asset viewing, generation intents, and prompt contribution', () => {
    const onChange = vi.fn()
    const onViewAsset = vi.fn()
    const onGenerate = vi.fn()

    renderInFlow(
      <CharacterNode
        id="character-1"
        selected
        data={{
          label: 'Mika',
          description: 'brave pilot with blue coat',
          assetId: 'asset-character',
          url: 'cc-asset://asset/asset-character',
          tags: ['lead', 'pilot'],
          categoryId: 'cat-character',
          viewMode: 'multi'
        } satisfies CharacterNodeData}
        onChange={onChange}
        onViewAsset={onViewAsset}
        onGenerate={onGenerate}
      />
    )

    expect(screen.getByRole('group', { name: '角色节点 Mika' })).toBeInTheDocument()
    expect(screen.getByText('角色 Prompt')).toBeInTheDocument()
    expect(screen.getByText('角色 Mika：brave pilot with blue coat')).toBeInTheDocument()

    fireEvent.change(screen.getByRole('textbox', { name: '角色名称' }), { target: { value: 'Nia' } })
    fireEvent.change(screen.getByRole('textbox', { name: '角色描述' }), {
      target: { value: 'older detective in graphite coat' }
    })
    fireEvent.change(screen.getByRole('textbox', { name: '角色标签' }), { target: { value: 'lead / noir / coat' } })

    expect(onChange).toHaveBeenCalledWith('character-1', { label: 'Nia' })
    expect(onChange).toHaveBeenCalledWith('character-1', { description: 'older detective in graphite coat' })
    expect(onChange).toHaveBeenCalledWith('character-1', { tags: ['lead', 'noir', 'coat'] })

    fireEvent.click(screen.getByRole('button', { name: '查看角色资产' }))
    fireEvent.click(screen.getByRole('button', { name: '生成单视图角色图' }))
    fireEvent.click(screen.getByRole('button', { name: '生成多视图角色图' }))

    expect(onViewAsset).toHaveBeenCalledWith('asset-character')
    expect(onGenerate).toHaveBeenNthCalledWith(1, 'character-1', 'single')
    expect(onGenerate).toHaveBeenNthCalledWith(2, 'character-1', 'multi')
  })

  it('edits structured scene fields, exposes asset viewing, generation intent, and prompt contribution', () => {
    const onChange = vi.fn()
    const onViewAsset = vi.fn()
    const onGenerate = vi.fn()

    renderInFlow(
      <SceneNode
        id="scene-1"
        selected
        data={{
          label: 'Rain Alley',
          description: 'neon street after rain',
          assetId: 'asset-scene',
          url: 'cc-asset://asset/asset-scene',
          category: 'exterior',
          categoryId: 'cat-scene'
        } satisfies SceneNodeData}
        onChange={onChange}
        onViewAsset={onViewAsset}
        onGenerate={onGenerate}
      />
    )

    expect(screen.getByRole('group', { name: '场景节点 Rain Alley' })).toBeInTheDocument()
    expect(screen.getByText('场景 Prompt')).toBeInTheDocument()
    expect(screen.getByText('场景 Rain Alley：neon street after rain')).toBeInTheDocument()

    fireEvent.change(screen.getByRole('textbox', { name: '场景名称' }), { target: { value: 'Subway Dawn' } })
    fireEvent.change(screen.getByRole('textbox', { name: '场景分类' }), { target: { value: 'interior' } })
    fireEvent.change(screen.getByRole('textbox', { name: '场景描述' }), {
      target: { value: 'quiet station platform at dawn' }
    })

    expect(onChange).toHaveBeenCalledWith('scene-1', { label: 'Subway Dawn' })
    expect(onChange).toHaveBeenCalledWith('scene-1', { category: 'interior' })
    expect(onChange).toHaveBeenCalledWith('scene-1', { description: 'quiet station platform at dawn' })

    fireEvent.click(screen.getByRole('button', { name: '查看场景资产' }))
    fireEvent.click(screen.getByRole('button', { name: '生成场景参考图' }))

    expect(onViewAsset).toHaveBeenCalledWith('asset-scene')
    expect(onGenerate).toHaveBeenCalledWith('scene-1', 'single')
  })
})
