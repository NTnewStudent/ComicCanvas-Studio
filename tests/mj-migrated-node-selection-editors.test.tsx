// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'

import { ReactFlowProvider } from '@xyflow/react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { NodeEditorProvider } from '../desktop/src/renderer/src/canvas/components/NodeEditorContext'
import { MigratedNode } from '../desktop/src/renderer/src/canvas/nodes/MigratedNode'
import { MjImageNode } from '../desktop/src/renderer/src/canvas/nodes/MjImageNode'
import type { CanvasNodeData, MjImageNodeData } from '../shared/nodes'

const mjData = {
  label: 'MJ Sheet',
  prompt: 'cinematic rainy alley',
  modelId: 'mj-v6',
  ratio: '16:9',
  urls: ['cc-asset://asset/mj-1', 'cc-asset://asset/mj-2'],
  selectedIndex: 1,
  assetId: null,
  status: 'done'
} satisfies MjImageNodeData

const migratedData = {
  label: 'Detective',
  description: 'calm lead character',
  assetId: null,
  tags: ['lead']
} as CanvasNodeData

function renderWithSelection(selectedNodeIds: readonly string[], element: ReactElement): void {
  render(
    <ReactFlowProvider>
      <NodeEditorProvider selectedNodeIds={selectedNodeIds}>{element}</NodeEditorProvider>
    </ReactFlowProvider>
  )
}

afterEach(cleanup)

describe('MJ and migrated node selection editors', () => {
  it('keeps MJ controls and result actions unmounted while collapsed', () => {
    renderWithSelection([], <MjImageNode id="mj-1" data={mjData} />)

    expect(screen.getByRole('group', { name: 'MJ Image node MJ Sheet' })).toBeInTheDocument()
    expect(screen.getByText('cinematic rainy alley')).toBeInTheDocument()
    expect(screen.queryByTestId('mj-image-node-editor')).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'MJ Prompt' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '选择 MJ 结果 1' })).not.toBeInTheDocument()
  })

  it('preserves MJ result selection inside the active editor', () => {
    const onChange = vi.fn()
    renderWithSelection(
      ['mj-1'],
      <MjImageNode id="mj-1" data={mjData} selected onChange={onChange} />
    )

    expect(screen.getByTestId('mj-image-node-editor')).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'MJ Prompt' })).toHaveValue('cinematic rainy alley')
    expect(screen.getByRole('button', { name: '选择 MJ 结果 2' })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: '选择 MJ 结果 1' }))
    expect(onChange).toHaveBeenLastCalledWith('mj-1', {
      selectedIndex: 0,
      url: 'cc-asset://asset/mj-1'
    })
  })

  it('keeps generic migrated data controls unmounted while collapsed', () => {
    renderWithSelection(
      [],
      <MigratedNode id="character-1" type="character" data={migratedData} />
    )

    expect(screen.getByRole('group', { name: '角色节点 Detective' })).toBeInTheDocument()
    expect(screen.getByText('calm lead character')).toBeInTheDocument()
    expect(screen.queryByTestId('migrated-node-editor')).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: '描述' })).not.toBeInTheDocument()
  })

  it('preserves generic migrated updates inside the active editor', () => {
    const onChange = vi.fn()
    renderWithSelection(
      ['character-1'],
      <MigratedNode
        id="character-1"
        type="character"
        data={migratedData}
        selected
        onChange={onChange}
      />
    )

    expect(screen.getByTestId('migrated-node-editor')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: '描述' }), {
      target: { value: 'older detective with graphite coat' }
    })
    expect(onChange).toHaveBeenLastCalledWith('character-1', {
      description: 'older detective with graphite coat'
    })
  })
})
