// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'

import { ReactFlowProvider } from '@xyflow/react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { AudioNodeData } from '../shared/nodes'
import { AudioNode } from '../desktop/src/renderer/src/canvas/nodes/AudioNode'

function renderInFlow(element: React.ReactElement): void {
  render(<ReactFlowProvider>{element}</ReactFlowProvider>)
}

afterEach(() => {
  vi.restoreAllMocks()
  cleanup()
})

describe('Task 33 audio node parity', () => {
  it('supports import/playback, duration display, mux input, and reference semantics', () => {
    const onChange = vi.fn()
    const onImport = vi.fn()
    const onViewAsset = vi.fn()

    renderInFlow(
      <AudioNode
        id="audio-1"
        selected
        data={{
          label: 'Theme',
          assetId: 'asset-audio',
          url: 'cc-asset://asset/asset-audio',
          durationSeconds: 42,
          status: 'idle',
          referenceRole: 'music'
        } satisfies AudioNodeData}
        onChange={onChange}
        onImport={onImport}
        onViewAsset={onViewAsset}
      />
    )

    expect(screen.getByRole('group', { name: 'Audio node Theme' })).toBeInTheDocument()
    expect(screen.getByTestId('audio-node-player')).toHaveAttribute('src', 'cc-asset://asset/asset-audio')
    expect(screen.getByText('42s')).toBeInTheDocument()
    expect(screen.getByText('Mux 输入')).toBeInTheDocument()
    expect(screen.getByText('音频引用：music')).toBeInTheDocument()

    fireEvent.change(screen.getByRole('textbox', { name: '音频名称' }), { target: { value: 'Narration' } })
    fireEvent.change(screen.getByRole('combobox', { name: '音频引用语义' }), { target: { value: 'voice' } })
    fireEvent.change(screen.getByRole('textbox', { name: '音频资产 ID' }), { target: { value: 'asset-voice' } })

    expect(onChange).toHaveBeenCalledWith('audio-1', { label: 'Narration' })
    expect(onChange).toHaveBeenCalledWith('audio-1', { referenceRole: 'voice' })
    expect(onChange).toHaveBeenCalledWith('audio-1', { assetId: 'asset-voice' })

    fireEvent.click(screen.getByRole('button', { name: '导入音频资产' }))
    fireEvent.click(screen.getByRole('button', { name: '查看音频资产' }))

    expect(onImport).toHaveBeenCalledWith('audio-1')
    expect(onViewAsset).toHaveBeenCalledWith('asset-audio')
  })
})
