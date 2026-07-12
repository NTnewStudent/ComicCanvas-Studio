// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'

import { ReactFlowProvider } from '@xyflow/react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { MuxAudioVideoNodeData, SuperResolutionNodeData, VideoComposeNodeData } from '../shared/nodes'
import { NodeEditorProvider } from '../desktop/src/renderer/src/canvas/components/NodeEditorContext'
import { MuxAudioVideoNode } from '../desktop/src/renderer/src/canvas/nodes/MuxAudioVideoNode'
import { SuperResolutionNode } from '../desktop/src/renderer/src/canvas/nodes/SuperResolutionNode'
import { VideoComposeNode } from '../desktop/src/renderer/src/canvas/nodes/VideoComposeNode'

const composeData = {
  label: 'Scene Stitch',
  inputOrder: ['video-a', 'video-b'],
  transitionName: 'cut',
  modelId: 'compose-local',
  assetId: 'asset-compose-result',
  url: 'cc-asset://asset/asset-compose-result',
  status: 'done'
} satisfies VideoComposeNodeData

const superResolutionData = {
  label: 'Upscale Hero Shot',
  inputVideoId: 'video-source-1',
  scene: 'aigc',
  resolution: '1080p',
  fps: 30,
  assetId: 'asset-super-result',
  url: 'cc-asset://asset/asset-super-result',
  status: 'done'
} satisfies SuperResolutionNodeData

const muxData = {
  label: 'Final Mux',
  modelId: 'mux-local',
  videoInputId: 'video-final',
  audioInputId: 'audio-voice',
  assetId: 'asset-mux-result',
  url: 'cc-asset://asset/asset-mux-result',
  status: 'done'
} satisfies MuxAudioVideoNodeData

function renderWithSelection(selectedNodeIds: readonly string[], element: ReactElement): void {
  render(
    <ReactFlowProvider>
      <NodeEditorProvider selectedNodeIds={selectedNodeIds}>{element}</NodeEditorProvider>
    </ReactFlowProvider>
  )
}

afterEach(() => {
  vi.restoreAllMocks()
  cleanup()
})

describe('post-production node selection editors', () => {
  it('keeps video compose controls unmounted while collapsed', () => {
    renderWithSelection([], <VideoComposeNode id="compose-1" data={composeData} />)

    expect(screen.getByTestId('video-compose-output')).toBeInTheDocument()
    expect(screen.queryByTestId('video-compose-node-editor')).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: '转场' })).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: '合成模型' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '运行视频合成' })).not.toBeInTheDocument()
  })

  it('mounts video compose controls and preserves callbacks for the active node', () => {
    const onChange = vi.fn()
    const onRun = vi.fn()
    const onWriteOutputAsset = vi.fn()
    renderWithSelection(
      ['compose-1'],
      <VideoComposeNode id="compose-1" data={composeData} selected onChange={onChange} onRun={onRun} onWriteOutputAsset={onWriteOutputAsset} />
    )

    expect(screen.getByTestId('video-compose-node-editor')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('combobox', { name: '转场' }), { target: { value: 'crossfade' } })
    fireEvent.change(screen.getByRole('textbox', { name: '合成模型' }), { target: { value: 'compose-fast' } })
    fireEvent.click(screen.getByRole('button', { name: '运行视频合成' }))
    fireEvent.click(screen.getByRole('button', { name: '写回合成输出资产' }))

    expect(onChange).toHaveBeenCalledWith('compose-1', { transitionName: 'crossfade' })
    expect(onChange).toHaveBeenCalledWith('compose-1', { modelId: 'compose-fast' })
    expect(onChange).toHaveBeenCalledWith('compose-1', { status: 'running', url: '' })
    expect(onRun).toHaveBeenCalledWith('compose-1')
    expect(onWriteOutputAsset).toHaveBeenCalledWith('compose-1', 'asset-compose-result')
  })

  it('keeps super-resolution controls unmounted while collapsed', () => {
    renderWithSelection([], <SuperResolutionNode id="super-1" data={superResolutionData} />)

    expect(screen.getByTestId('super-resolution-output')).toBeInTheDocument()
    expect(screen.queryByTestId('super-resolution-node-editor')).not.toBeInTheDocument()
    expect(screen.queryByRole('combobox', { name: '超分场景' })).not.toBeInTheDocument()
    expect(screen.queryByRole('spinbutton', { name: 'FPS' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '运行视频超分' })).not.toBeInTheDocument()
  })

  it('mounts super-resolution controls and preserves callbacks for the active node', () => {
    const onChange = vi.fn()
    const onRun = vi.fn()
    const onWriteOutputAsset = vi.fn()
    renderWithSelection(
      ['super-1'],
      <SuperResolutionNode id="super-1" data={superResolutionData} selected onChange={onChange} onRun={onRun} onWriteOutputAsset={onWriteOutputAsset} />
    )

    expect(screen.getByTestId('super-resolution-node-editor')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: '输入视频节点' }), { target: { value: 'video-clean' } })
    fireEvent.change(screen.getByRole('combobox', { name: '目标分辨率' }), { target: { value: '4k' } })
    fireEvent.change(screen.getByRole('spinbutton', { name: 'FPS' }), { target: { value: '60' } })
    fireEvent.click(screen.getByRole('button', { name: '运行视频超分' }))
    fireEvent.click(screen.getByRole('button', { name: '写回超分输出资产' }))

    expect(onChange).toHaveBeenCalledWith('super-1', { inputVideoId: 'video-clean' })
    expect(onChange).toHaveBeenCalledWith('super-1', { resolution: '4k' })
    expect(onChange).toHaveBeenCalledWith('super-1', { fps: 60 })
    expect(onChange).toHaveBeenCalledWith('super-1', { status: 'running', url: '' })
    expect(onRun).toHaveBeenCalledWith('super-1')
    expect(onWriteOutputAsset).toHaveBeenCalledWith('super-1', 'asset-super-result')
  })

  it('keeps mux controls unmounted while collapsed', () => {
    renderWithSelection([], <MuxAudioVideoNode id="mux-1" data={muxData} />)

    expect(screen.getByTestId('mux-output')).toBeInTheDocument()
    expect(screen.queryByTestId('mux-audio-video-node-editor')).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: '音视频合成模型' })).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: '视频输入节点' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '运行音视频合成' })).not.toBeInTheDocument()
  })

  it('mounts mux controls and preserves callbacks for the active node', () => {
    const onChange = vi.fn()
    const onRun = vi.fn()
    const onWriteOutputAsset = vi.fn()
    renderWithSelection(
      ['mux-1'],
      <MuxAudioVideoNode id="mux-1" data={muxData} selected onChange={onChange} onRun={onRun} onWriteOutputAsset={onWriteOutputAsset} />
    )

    expect(screen.getByTestId('mux-audio-video-node-editor')).toBeInTheDocument()
    fireEvent.change(screen.getByRole('textbox', { name: '音视频合成模型' }), { target: { value: 'mux-fast' } })
    fireEvent.change(screen.getByRole('textbox', { name: '视频输入节点' }), { target: { value: 'video-clean' } })
    fireEvent.change(screen.getByRole('textbox', { name: '音频输入节点' }), { target: { value: 'audio-clean' } })
    fireEvent.click(screen.getByRole('button', { name: '运行音视频合成' }))
    fireEvent.click(screen.getByRole('button', { name: '写回音视频输出资产' }))

    expect(onChange).toHaveBeenCalledWith('mux-1', { modelId: 'mux-fast' })
    expect(onChange).toHaveBeenCalledWith('mux-1', { videoInputId: 'video-clean' })
    expect(onChange).toHaveBeenCalledWith('mux-1', { audioInputId: 'audio-clean' })
    expect(onChange).toHaveBeenCalledWith('mux-1', { status: 'running', url: '' })
    expect(onRun).toHaveBeenCalledWith('mux-1')
    expect(onWriteOutputAsset).toHaveBeenCalledWith('mux-1', 'asset-mux-result')
  })
})
