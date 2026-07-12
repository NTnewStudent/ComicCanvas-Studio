// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'

import { ReactFlowProvider } from '@xyflow/react'
import { cleanup, render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, describe, expect, it } from 'vitest'

import type { CharacterNodeData, SceneNodeData } from '../shared/nodes'
import { NodeEditorProvider } from '../desktop/src/renderer/src/canvas/components/NodeEditorContext'
import { CharacterNode } from '../desktop/src/renderer/src/canvas/nodes/CharacterNode'
import { SceneNode } from '../desktop/src/renderer/src/canvas/nodes/SceneNode'

const characterData = {
  label: 'Mika',
  description: 'brave pilot with blue coat',
  assetId: 'asset-character',
  url: 'cc-asset://asset/asset-character',
  tags: ['lead', 'pilot']
} satisfies CharacterNodeData

const sceneData = {
  label: 'Rain Alley',
  description: 'neon street after rain',
  assetId: 'asset-scene',
  url: 'cc-asset://asset/asset-scene',
  category: 'exterior'
} satisfies SceneNodeData

function renderWithSelection(selectedNodeIds: readonly string[], element: ReactElement): void {
  render(
    <ReactFlowProvider>
      <NodeEditorProvider selectedNodeIds={selectedNodeIds}>{element}</NodeEditorProvider>
    </ReactFlowProvider>
  )
}

afterEach(cleanup)

describe('context node selection editors', () => {
  it('keeps character editing controls unmounted while collapsed', () => {
    renderWithSelection([], <CharacterNode id="character-1" data={characterData} />)

    expect(screen.getByRole('group', { name: '角色节点 Mika' })).toBeInTheDocument()
    expect(screen.getByText('brave pilot with blue coat')).toBeInTheDocument()
    expect(screen.queryByTestId('character-node-editor')).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '查看角色资产' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '生成单视图角色图' })).not.toBeInTheDocument()
  })

  it('mounts character controls only for the single active context', () => {
    renderWithSelection(['character-1'], <CharacterNode id="character-1" data={characterData} selected />)

    expect(screen.getByTestId('character-node-editor')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: '角色名称' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: '角色描述' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: '角色标签' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '查看角色资产' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '生成单视图角色图' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '生成多视图角色图' })).toBeInTheDocument()
  })

  it('keeps scene editing controls unmounted while collapsed', () => {
    renderWithSelection([], <SceneNode id="scene-1" data={sceneData} />)

    expect(screen.getByRole('group', { name: '场景节点 Rain Alley' })).toBeInTheDocument()
    expect(screen.getByText('neon street after rain')).toBeInTheDocument()
    expect(screen.queryByTestId('scene-node-editor')).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '查看场景资产' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '生成场景参考图' })).not.toBeInTheDocument()
  })

  it('mounts scene controls only for the single active context', () => {
    renderWithSelection(['scene-1'], <SceneNode id="scene-1" data={sceneData} selected />)

    expect(screen.getByTestId('scene-node-editor')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: '场景名称' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: '场景分类' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: '场景描述' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '查看场景资产' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '生成场景参考图' })).toBeInTheDocument()
  })
})
