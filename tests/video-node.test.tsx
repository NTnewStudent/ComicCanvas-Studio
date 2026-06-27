// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'

import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { VideoNodeData } from '../shared/nodes'
import { VideoNode, type VideoNodeProps } from '../desktop/src/renderer/src/canvas/nodes/VideoNode'

const defaultData: VideoNodeData = {
  label: 'Video 1',
  promptOverride: '',
  modelId: 'stub-video',
  orientation: 'landscape',
  durationSeconds: 3,
  firstFrameAssetId: null,
  lastFrameAssetId: null,
  assetId: null,
  status: 'idle'
}

type VideoNodeRenderOverrides = Omit<Partial<VideoNodeProps>, 'data'> & {
  data?: Partial<VideoNodeData>
}

function renderVideoNode(overrides: VideoNodeRenderOverrides = {}) {
  const onChange = vi.fn()
  const onRun = vi.fn()
  const data = { ...defaultData, ...overrides.data }

  render(
    <ReactFlowProvider>
      <VideoNode
        {...overrides}
        id={overrides.id ?? 'video-1'}
        data={data}
        modelOptions={
          overrides.modelOptions ?? [
            { id: 'stub-video', label: 'Stub video' },
            { id: 'cinematic-video', label: 'Cinematic video' }
          ]
        }
        frameOptions={
          overrides.frameOptions ?? [
            { assetId: 'first-asset', label: 'Opening panel', safeUrl: 'cc-asset://asset/first-asset' },
            { assetId: 'last-asset', label: 'Closing panel', safeUrl: 'cc-asset://asset/last-asset' }
          ]
        }
        assetOptions={
          overrides.assetOptions ?? [
            { assetId: 'asset-video-a', label: 'Motion draft', safeUrl: 'cc-asset://asset/asset-video-a' },
            { assetId: 'asset-video-b', label: 'Final shot', safeUrl: 'cc-asset://asset/asset-video-b' }
          ]
        }
        onChange={overrides.onChange ?? onChange}
        onRun={overrides.onRun ?? onRun}
      />
    </ReactFlowProvider>
  )

  return { onChange, onRun }
}

afterEach(() => {
  cleanup()
})

describe('M2 VideoNode', () => {
  it('renders idle preview and expands prompt, model, orientation, duration, and frame controls', () => {
    const { onChange } = renderVideoNode()

    expect(screen.getByRole('button', { name: '配置视频节点' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText('暂无视频')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '配置视频节点' }))

    expect(screen.getByRole('button', { name: '配置视频节点' })).toHaveAttribute('aria-expanded', 'true')
    fireEvent.change(screen.getByRole('textbox', { name: 'Prompt 覆盖' }), {
      target: { value: 'slow camera push into the alley' }
    })
    expect(onChange).toHaveBeenLastCalledWith('video-1', { promptOverride: 'slow camera push into the alley' })

    fireEvent.click(screen.getByRole('button', { name: 'Use model Cinematic video' }))
    expect(onChange).toHaveBeenLastCalledWith('video-1', { modelId: 'cinematic-video' })

    fireEvent.click(screen.getByRole('button', { name: 'Use portrait orientation' }))
    expect(onChange).toHaveBeenLastCalledWith('video-1', { orientation: 'portrait' })

    fireEvent.click(screen.getByRole('button', { name: 'Use 8 seconds duration' }))
    expect(onChange).toHaveBeenLastCalledWith('video-1', { durationSeconds: 8 })

    fireEvent.click(screen.getByRole('button', { name: 'Use Opening panel as first frame' }))
    expect(onChange).toHaveBeenLastCalledWith('video-1', { firstFrameAssetId: 'first-asset' })

    fireEvent.click(screen.getByRole('button', { name: 'Use Closing panel as last frame' }))
    expect(onChange).toHaveBeenLastCalledWith('video-1', { lastFrameAssetId: 'last-asset' })
  })

  it('renders pending and running states without enabling duplicate generation', () => {
    renderVideoNode({ data: { status: 'pending' } })

    expect(screen.getByRole('status', { name: 'Video generation pending' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '生成视频' })).toBeDisabled()

    cleanup()
    renderVideoNode({ data: { status: 'running' } })

    expect(screen.getByRole('status', { name: 'Video generation running' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '生成视频' })).toBeDisabled()
  })

  it('renders completed safe video preview and error recovery state', () => {
    renderVideoNode({
      data: { status: 'done', assetId: 'video-asset', orientation: 'portrait' },
      assetSafeUrl: 'cc-asset://asset/video-asset'
    })

    const video = screen.getByTestId('video-preview')
    expect(video).toHaveAttribute('src', 'cc-asset://asset/video-asset')
    expect(video).toHaveStyle({ objectFit: 'contain' })
    expect(screen.getByTestId('video-preview-frame')).toHaveStyle({ aspectRatio: '9 / 16' })

    cleanup()
    renderVideoNode({ data: { status: 'error' } })

    expect(screen.getByRole('alert')).toHaveTextContent('生成失败')
  })

  it('invokes runNode through the run callback', () => {
    const { onRun } = renderVideoNode()

    fireEvent.click(screen.getByRole('button', { name: '生成视频' }))

    expect(onRun).toHaveBeenCalledWith('video-1')
  })

  it('binds safe video assets, exposes edit entry, and writes generated output back', () => {
    const onEditAsset = vi.fn()
    const onWriteOutputAsset = vi.fn()
    const { onChange } = renderVideoNode({
      data: { status: 'done', assetId: 'asset-video-generated', url: 'cc-asset://asset/asset-video-generated' },
      assetSafeUrl: 'cc-asset://asset/asset-video-generated',
      onEditAsset,
      onWriteOutputAsset
    })

    fireEvent.click(screen.getByRole('button', { name: '配置视频节点' }))
    fireEvent.click(screen.getByRole('button', { name: '从资产库选择视频' }))

    expect(screen.getByRole('dialog', { name: '选择视频资产' })).toBeInTheDocument()
    expect(screen.getByTestId('video-asset-option-asset-video-a')).toHaveAttribute('src', 'cc-asset://asset/asset-video-a')

    fireEvent.click(screen.getByRole('button', { name: '选择视频资产 Motion draft' }))
    expect(onChange).toHaveBeenLastCalledWith('video-1', {
      assetId: 'asset-video-a',
      url: 'cc-asset://asset/asset-video-a',
      status: 'done'
    })

    fireEvent.click(screen.getByRole('button', { name: '编辑视频资产' }))
    expect(onEditAsset).toHaveBeenCalledWith('asset-video-generated')

    fireEvent.click(screen.getByRole('button', { name: '写回视频输出资产' }))
    expect(onWriteOutputAsset).toHaveBeenCalledWith('video-1', 'asset-video-generated')
  })
})
