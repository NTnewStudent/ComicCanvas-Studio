// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'

import { ReactFlowProvider } from '@xyflow/react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import VideoConfigV2Node from '../desktop/src/renderer/src/canvas/nodes/VideoConfigV2Node'
import { canvasStore } from '../desktop/src/renderer/src/canvas/store/canvas.store'
import type { StylePresetView } from '../shared/styles'

const inkStyle: StylePresetView = {
  id: 'style-ink',
  code: 'ink',
  name: 'Industrial Ink',
  description: 'Monochrome comic ink',
  promptBefore: 'ink comic',
  promptAfter: 'paper texture',
  legacyPromptPreset: null,
  negativePrompt: null,
  coverAssetId: null,
  coverUrl: null,
  tags: ['comic'],
  enabled: true,
  sortOrder: 1,
  createdAt: 1,
  updatedAt: 1
}

beforeEach(() => {
  canvasStore.getState().setNodes([])
  canvasStore.getState().setEdges([])
  canvasStore.getState().setViewport({ x: 0, y: 0, zoom: 1 })
  window.comicCanvas = {
    listStyles: vi.fn().mockResolvedValue([inkStyle])
  } as unknown as Window['comicCanvas']
})

afterEach(() => {
  vi.restoreAllMocks()
  cleanup()
})

function renderVideoConfig(onRun?: (id: string) => void): void {
  const data = {
    label: 'Video Config',
    promptOverride: '',
    prompt: 'slow push through rainy alley',
    modelId: 'stub-video',
    orientation: 'landscape' as const,
    durationSeconds: 5,
    duration: 8,
    ratio: '16:9' as const,
    resolution: '720p' as const,
    stylePresetId: 'style-ink',
    firstFrameAssetId: 'asset-first-frame',
    lastFrameAssetId: 'asset-last-frame',
    firstFrameAssetV2Id: 'asset-first-frame',
    lastFrameAssetV2Id: 'asset-last-frame',
    referenceAssets: [
      {
        id: 'asset-first-frame',
        type: 'image' as const,
        name: 'Opening frame',
        url: 'cc-asset://asset/asset-first-frame'
      },
      {
        id: 'asset-last-frame',
        type: 'image' as const,
        name: 'Ending frame',
        url: 'cc-asset://asset/asset-last-frame'
      },
      {
        id: 'asset-motion-ref',
        type: 'video' as const,
        name: 'Motion reference',
        url: 'cc-asset://asset/asset-motion-ref'
      }
    ],
    assetId: 'asset-video-result',
    url: 'cc-asset://asset/asset-video-result',
    status: 'done' as const
  }

  canvasStore.getState().setNodes([
    {
      id: 'video-config',
      type: 'videoConfigV2',
      position: { x: 0, y: 0 },
      data
    }
  ])

  render(
    <ReactFlowProvider>
      <VideoConfigV2Node
        {...({
          id: 'video-config',
          type: 'videoConfigV2',
          selected: true,
          zIndex: 0,
          draggable: true,
          dragging: false,
          selectable: true,
          deletable: true,
          isConnectable: true,
          positionAbsoluteX: 0,
          positionAbsoluteY: 0,
          data
        })}
        {...(onRun ? { onRun } : {})}
      />
    </ReactFlowProvider>
  )
}

describe('Task 31 videoConfigV2 parity', () => {
  it('shows prompt/model/style/duration/ratio/resolution controls', async () => {
    renderVideoConfig()

    expect(screen.getByRole('textbox')).toHaveValue('slow push through rainy alley')
    expect(await screen.findByText(/Industrial Ink/u)).toBeInTheDocument()
    expect(screen.getByText(/16:9/u)).toBeInTheDocument()
    expect(screen.getByText('8s')).toBeInTheDocument()
    expect(screen.getByText(/720p/u)).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /Stub Video/u }))
    fireEvent.click(screen.getByText('Runway Gen-3'))

    await waitFor(() => {
      const node = canvasStore.getState().nodes.find((candidate) => candidate.id === 'video-config')
      expect(node?.data).toMatchObject({ modelId: 'runway-gen3' })
    })
  })

  it('renders first frame, last frame, and reference assets with video writeback', () => {
    renderVideoConfig()

    expect(screen.getByText('首帧 ✓')).toBeInTheDocument()
    expect(screen.getByText('尾帧 ✓')).toBeInTheDocument()
    expect(screen.getByText('Opening frame')).toBeInTheDocument()
    expect(screen.getByText('Ending frame')).toBeInTheDocument()
    expect(screen.getByText('Motion reference')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '写回视频结果资产' }))

    const node = canvasStore.getState().nodes.find((candidate) => candidate.id === 'video-config')
    expect(node?.data).toMatchObject({
      assetId: 'asset-video-result',
      status: 'done',
      url: 'cc-asset://asset/asset-video-result'
    })
  })

  it('delegates generation to the injected onRun callback instead of mutating state synchronously', () => {
    const onRun = vi.fn()
    renderVideoConfig(onRun)

    fireEvent.click(screen.getByTestId('video-v2-generate-btn'))

    expect(onRun).toHaveBeenCalledWith('video-config')
    // 组件不再自行写入 running 状态，真实调度交给 onRun（由 CanvasPage 的
    // handleRunNode 负责设置 status 并调用 window.comicCanvas.runCanvasNode）。
    const node = canvasStore.getState().nodes.find((candidate) => candidate.id === 'video-config')
    expect(node?.data).toMatchObject({ status: 'done' })
  })
})
