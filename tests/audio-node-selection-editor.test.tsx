// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'

import { ReactFlowProvider } from '@xyflow/react'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { AudioNodeData } from '../shared/nodes'
import { NodeEditorProvider } from '../desktop/src/renderer/src/canvas/components/NodeEditorContext'
import { AudioNode } from '../desktop/src/renderer/src/canvas/nodes/AudioNode'

const audioData = {
  label: 'Theme',
  assetId: 'asset-audio',
  url: 'cc-asset://asset/asset-audio',
  durationSeconds: 42,
  status: 'idle',
  referenceRole: 'music'
} satisfies AudioNodeData

function renderAudioNode(selectedNodeIds: readonly string[] = [], props: Partial<React.ComponentProps<typeof AudioNode>> = {}) {
  const onChange = vi.fn()
  const onImport = vi.fn()
  const onViewAsset = vi.fn()

  render(
    <ReactFlowProvider>
      <NodeEditorProvider selectedNodeIds={selectedNodeIds}>
        <AudioNode
          id="audio-1"
          data={audioData}
          selected={selectedNodeIds.includes('audio-1')}
          onChange={onChange}
          onImport={onImport}
          onViewAsset={onViewAsset}
          {...props}
        />
      </NodeEditorProvider>
    </ReactFlowProvider>
  )

  return { onChange, onImport, onViewAsset }
}

afterEach(() => {
  cleanup()
})

describe('AudioNode cloud-paper selection editor', () => {
  it('keeps edit controls unmounted while collapsed', () => {
    renderAudioNode()

    expect(screen.getByRole('group', { name: '音频节点 Theme' })).toBeInTheDocument()
    expect(screen.getByTestId('audio-node-player')).toHaveAttribute('src', audioData.url)
    expect(screen.getByText('42s')).toBeInTheDocument()
    expect(screen.getByText('音频引用：音乐')).toBeInTheDocument()
    expect(screen.queryByTestId('audio-node-editor')).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: '音频名称' })).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: '音频资产 ID' })).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: '音频引用语义' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '选择音频素材' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '导入音频资产' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '查看音频资产' })).not.toBeInTheDocument()
  })

  it('opens every existing edit control for the single selected node and preserves callbacks', () => {
    const { onChange, onImport, onViewAsset } = renderAudioNode(['audio-1'])
    const editor = screen.getByTestId('audio-node-editor')

    expect(editor).toHaveAttribute('data-node-editor')
    expect(within(editor).getByRole('textbox', { name: '音频名称' })).toBeInTheDocument()
    expect(within(editor).getByRole('textbox', { name: '音频资产 ID' })).toBeInTheDocument()
    expect(within(editor).getByRole('combobox', { name: '音频引用语义' })).toBeInTheDocument()
    expect(within(editor).getByRole('button', { name: '选择音频素材' })).toBeInTheDocument()
    expect(within(editor).getByRole('button', { name: '清除音频素材' })).toBeInTheDocument()
    expect(within(editor).getByRole('button', { name: '使用外部 URL 作为音频素材' })).toBeInTheDocument()

    fireEvent.change(within(editor).getByRole('textbox', { name: '音频名称' }), { target: { value: 'Narration' } })
    fireEvent.change(within(editor).getByRole('textbox', { name: '音频资产 ID' }), { target: { value: 'asset-voice' } })
    fireEvent.change(within(editor).getByRole('combobox', { name: '音频引用语义' }), { target: { value: 'voice' } })
    fireEvent.click(within(editor).getByRole('button', { name: '导入音频资产' }))
    fireEvent.click(within(editor).getByRole('button', { name: '查看音频资产' }))

    expect(onChange).toHaveBeenCalledWith('audio-1', { label: 'Narration' })
    expect(onChange).toHaveBeenCalledWith('audio-1', { assetId: 'asset-voice' })
    expect(onChange).toHaveBeenCalledWith('audio-1', { referenceRole: 'voice' })
    expect(onImport).toHaveBeenCalledWith('audio-1')
    expect(onViewAsset).toHaveBeenCalledWith('asset-audio')
  })
})
