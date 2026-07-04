// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'

import { ReactFlowProvider } from '@xyflow/react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import ImageConfigV2Node from '../desktop/src/renderer/src/canvas/nodes/ImageConfigV2Node'
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

function renderImageConfig(onRun?: (id: string) => void): void {
  canvasStore.getState().setNodes([
    {
      id: 'reference-image',
      type: 'image',
      position: { x: 0, y: 0 },
      data: {
        label: 'Hero reference',
        promptOverride: '',
        modelId: 'stub-image',
        orientation: 'landscape',
        assetId: 'asset-reference',
        status: 'done',
        url: 'cc-asset://asset/asset-reference'
      }
    },
    {
      id: 'image-config',
      type: 'imageConfigV2',
      position: { x: 360, y: 0 },
      data: {
        label: 'Image Config',
        promptOverride: '',
        prompt: 'rainy hero key art',
        modelId: 'sd-xl',
        orientation: 'landscape',
        ratio: '16:9',
        stylePresetId: 'style-ink',
        urls: ['cc-asset://asset/result-a', 'cc-asset://asset/result-b'],
        selectedIndex: 0,
        assetId: 'asset-result-a',
        url: 'cc-asset://asset/result-a',
        status: 'done'
      }
    }
  ])
  canvasStore.getState().setEdges([
    {
      id: 'edge-reference',
      source: 'reference-image',
      target: 'image-config',
      data: { edgeType: 'imageOrder', imageOrder: 1, createdAt: 1 }
    }
  ])

  render(
    <ReactFlowProvider>
      <ImageConfigV2Node
        id="image-config"
        selected
        data={{
          label: 'Image Config',
          promptOverride: '',
          prompt: 'rainy hero key art',
          modelId: 'sd-xl',
          orientation: 'landscape',
          ratio: '16:9',
          stylePresetId: 'style-ink',
          urls: ['cc-asset://asset/result-a', 'cc-asset://asset/result-b'],
          selectedIndex: 0,
          assetId: 'asset-result-a',
          url: 'cc-asset://asset/result-a',
          status: 'done'
        }}
        {...(onRun ? { onRun } : {})}
      />
    </ReactFlowProvider>
  )
}

describe('Task 30 imageConfigV2 parity', () => {
  it('shows prompt/model/style/ratio controls for image generation config', async () => {
    renderImageConfig()

    expect(screen.getByRole('textbox')).toHaveValue('rainy hero key art')
    expect(await screen.findByText(/Industrial Ink/u)).toBeInTheDocument()
    expect(screen.getByText(/16:9/u)).toBeInTheDocument()

    fireEvent.click(screen.getByText(/SDXL/u))
    expect(screen.getByText('Flux Pro')).toBeInTheDocument()
  })

  it('renders upstream image references and selectable result writeback', async () => {
    renderImageConfig()

    expect(await screen.findByText('Hero reference')).toBeInTheDocument()

    const secondResult = screen.getByRole('button', { name: '选择图片结果 2' })
    expect(secondResult).toHaveAttribute('aria-pressed', 'false')
    fireEvent.click(secondResult)

    await waitFor(() => {
      const node = canvasStore.getState().nodes.find((candidate) => candidate.id === 'image-config')
      expect(node?.data).toMatchObject({
        selectedIndex: 1,
        url: 'cc-asset://asset/result-b'
      })
    })

    const writeback = screen.getByRole('button', { name: '写回生图结果资产' })
    fireEvent.click(writeback)

    await waitFor(() => {
      const node = canvasStore.getState().nodes.find((candidate) => candidate.id === 'image-config')
      expect(node?.data).toMatchObject({
        assetId: 'asset-result-b',
        status: 'done'
      })
    })
  })

  it('delegates generation to the injected onRun callback instead of mutating state synchronously', () => {
    const onRun = vi.fn()
    renderImageConfig(onRun)

    fireEvent.click(screen.getByTestId('image-config-v2-generate-btn'))

    expect(onRun).toHaveBeenCalledWith('image-config')
    // 组件不再自行写入 pending/running 状态，真实调度交给 onRun（由 CanvasPage 的
    // handleRunNode 负责设置 status 并调用 window.comicCanvas.runCanvasNode）。
    const node = canvasStore.getState().nodes.find((candidate) => candidate.id === 'image-config')
    expect(node?.data).toMatchObject({ status: 'done' })
  })
})
