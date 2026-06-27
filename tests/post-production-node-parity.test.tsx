// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'

import { ReactFlowProvider } from '@xyflow/react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { MuxAudioVideoNodeData, VideoComposeNodeData } from '../shared/nodes'
import { MuxAudioVideoNode } from '../desktop/src/renderer/src/canvas/nodes/MuxAudioVideoNode'
import { VideoComposeNode } from '../desktop/src/renderer/src/canvas/nodes/VideoComposeNode'

function renderInFlow(element: React.ReactElement): void {
  render(<ReactFlowProvider>{element}</ReactFlowProvider>)
}

afterEach(() => {
  vi.restoreAllMocks()
  cleanup()
})

describe('Task 34 video compose and mux node parity', () => {
  it('keeps ordered video inputs, transition/model controls, ticket-only run, and writeback for compose', () => {
    const onChange = vi.fn()
    const onRun = vi.fn()
    const onWriteOutputAsset = vi.fn()

    renderInFlow(
      <VideoComposeNode
        id="compose-1"
        selected
        data={{
          label: 'Scene Stitch',
          inputOrder: ['video-a', 'video-b'],
          transitionName: 'cut',
          modelId: 'compose-local',
          assetId: 'asset-compose-result',
          url: 'cc-asset://asset/asset-compose-result',
          status: 'done'
        } satisfies VideoComposeNodeData}
        onChange={onChange}
        onRun={onRun}
        onWriteOutputAsset={onWriteOutputAsset}
      />
    )

    expect(screen.getByText('video-a')).toBeInTheDocument()
    expect(screen.getByText('video-b')).toBeInTheDocument()
    expect(screen.getByTestId('video-compose-output')).toHaveAttribute('src', 'cc-asset://asset/asset-compose-result')

    fireEvent.change(screen.getByRole('combobox', { name: '转场' }), { target: { value: 'crossfade' } })
    fireEvent.change(screen.getByRole('textbox', { name: '合成模型' }), { target: { value: 'compose-fast' } })

    expect(onChange).toHaveBeenCalledWith('compose-1', { transitionName: 'crossfade' })
    expect(onChange).toHaveBeenCalledWith('compose-1', { modelId: 'compose-fast' })

    fireEvent.click(screen.getByRole('button', { name: '运行视频合成' }))
    expect(onRun).toHaveBeenCalledWith('compose-1')
    expect(onChange).toHaveBeenCalledWith('compose-1', { status: 'running', url: '' })

    fireEvent.click(screen.getByRole('button', { name: '写回合成输出资产' }))
    expect(onWriteOutputAsset).toHaveBeenCalledWith('compose-1', 'asset-compose-result')
  })

  it('keeps video/audio inputs, mux model, ticket-only run, and writeback for mux', () => {
    const onChange = vi.fn()
    const onRun = vi.fn()
    const onWriteOutputAsset = vi.fn()

    renderInFlow(
      <MuxAudioVideoNode
        id="mux-1"
        selected
        data={{
          label: 'Final Mux',
          modelId: 'mux-local',
          videoInputId: 'video-final',
          audioInputId: 'audio-voice',
          assetId: 'asset-mux-result',
          url: 'cc-asset://asset/asset-mux-result',
          status: 'done'
        } satisfies MuxAudioVideoNodeData}
        onChange={onChange}
        onRun={onRun}
        onWriteOutputAsset={onWriteOutputAsset}
      />
    )

    expect(screen.getByText('video-final')).toBeInTheDocument()
    expect(screen.getByText('audio-voice')).toBeInTheDocument()
    expect(screen.getByTestId('mux-output')).toHaveAttribute('src', 'cc-asset://asset/asset-mux-result')

    fireEvent.change(screen.getByRole('textbox', { name: 'Mux 模型' }), { target: { value: 'mux-fast' } })
    fireEvent.change(screen.getByRole('textbox', { name: '视频输入节点' }), { target: { value: 'video-clean' } })
    fireEvent.change(screen.getByRole('textbox', { name: '音频输入节点' }), { target: { value: 'audio-clean' } })

    expect(onChange).toHaveBeenCalledWith('mux-1', { modelId: 'mux-fast' })
    expect(onChange).toHaveBeenCalledWith('mux-1', { videoInputId: 'video-clean' })
    expect(onChange).toHaveBeenCalledWith('mux-1', { audioInputId: 'audio-clean' })

    fireEvent.click(screen.getByRole('button', { name: '运行音视频合成' }))
    expect(onRun).toHaveBeenCalledWith('mux-1')
    expect(onChange).toHaveBeenCalledWith('mux-1', { status: 'running', url: '' })

    fireEvent.click(screen.getByRole('button', { name: '写回音视频输出资产' }))
    expect(onWriteOutputAsset).toHaveBeenCalledWith('mux-1', 'asset-mux-result')
  })
})
