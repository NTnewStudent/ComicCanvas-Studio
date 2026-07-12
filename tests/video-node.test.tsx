// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'

import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { VideoNodeData } from '../shared/nodes'
import { VideoNode, type VideoNodeProps } from '../desktop/src/renderer/src/canvas/nodes/VideoNode'
import { NodeEditorProvider } from '../desktop/src/renderer/src/canvas/components/NodeEditorContext'

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
  const data = { ...defaultData, ...overrides.data }

  render(
    <ReactFlowProvider>
      <NodeEditorProvider selectedNodeIds={overrides.selected ? [overrides.id ?? 'video-1'] : []}>
        <VideoNode
          {...overrides}
          id={overrides.id ?? 'video-1'}
          data={data}
          assetOptions={
            overrides.assetOptions ?? [
              { assetId: 'asset-video-a', label: 'Motion draft', safeUrl: 'cc-asset://asset/asset-video-a' },
              { assetId: 'asset-video-b', label: 'Final shot', safeUrl: 'cc-asset://asset/asset-video-b' }
            ]
          }
          onChange={overrides.onChange ?? onChange}
        />
      </NodeEditorProvider>
    </ReactFlowProvider>
  )

  return { onChange }
}

afterEach(() => {
  cleanup()
})

describe('M2 VideoNode media reference surface', () => {
  it('renders as a video asset node without generation controls', () => {
    renderVideoNode()

    expect(screen.getByText('未绑定视频')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '选择视频素材' })).not.toBeInTheDocument()
    expect(screen.queryByTestId('video-node-editor')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '生成视频' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '配置视频节点' })).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Prompt 覆盖' })).not.toBeInTheDocument()
    expect(screen.queryByText('时长')).not.toBeInTheDocument()
    expect(screen.queryByText('帧')).not.toBeInTheDocument()
  })

  it('mounts asset actions only in the selected editor', () => {
    renderVideoNode({ selected: true })

    expect(screen.getByTestId('video-node-editor')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '选择视频素材' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '清除视频素材' })).toBeDisabled()
  })

  it('binds safe video assets directly from the media card', () => {
    const { onChange } = renderVideoNode({ selected: true })

    fireEvent.click(screen.getByRole('button', { name: '选择视频素材' }))

    expect(screen.getByRole('dialog', { name: '选择视频资产' })).toBeInTheDocument()
    expect(screen.getByTestId('video-asset-option-asset-video-a')).toHaveAttribute('src', 'cc-asset://asset/asset-video-a')

    fireEvent.click(screen.getByRole('button', { name: '选择视频资产 Motion draft' }))
    expect(onChange).toHaveBeenLastCalledWith('video-1', {
      assetId: 'asset-video-a',
      url: 'cc-asset://asset/asset-video-a',
      status: 'done'
    })
  })

  it('renders completed safe video preview with stable contain layout', () => {
    renderVideoNode({
      selected: true,
      data: { status: 'done', assetId: 'video-asset', orientation: 'portrait' },
      assetSafeUrl: 'cc-asset://asset/video-asset'
    })

    const video = screen.getByTestId('video-preview')
    expect(video).toHaveAttribute('src', 'cc-asset://asset/video-asset')
    expect(video).toHaveClass('object-contain')
    expect(screen.getByTestId('video-preview-frame')).toHaveStyle({ aspectRatio: '9 / 16' })
  })

  it('offers URL copy for bound videos without writeback or run actions', () => {
    renderVideoNode({
      selected: true,
      data: { status: 'done', assetId: 'asset-video-generated', url: 'cc-asset://asset/asset-video-generated' },
      assetSafeUrl: 'cc-asset://asset/asset-video-generated'
    })

    expect(screen.getByRole('button', { name: '复制视频 URL' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '写回视频输出资产' })).not.toBeInTheDocument()
  })
})
