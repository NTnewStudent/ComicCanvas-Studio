// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'

import { ReactFlowProvider } from '@xyflow/react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ImageNodeData } from '../shared/nodes'
import { ImageInpaintModal } from '../desktop/src/renderer/src/canvas/components/ImageInpaintModal'
import { ImageNode } from '../desktop/src/renderer/src/canvas/nodes/ImageNode'

afterEach(() => {
  vi.restoreAllMocks()
  cleanup()
})

const imageData: ImageNodeData = {
  label: 'Hero Image',
  promptOverride: '',
  modelId: 'stub-image',
  orientation: 'landscape',
  assetId: 'asset-hero',
  url: 'cc-asset://asset/asset-hero',
  status: 'done'
}

describe('Task 38 image inpaint gate parity', () => {
  it('shows a clear unavailable gate instead of fake inpaint execution', () => {
    const onClose = vi.fn()

    render(
      <ImageInpaintModal
        label="Hero Image"
        assetId="asset-hero"
        safeUrl="cc-asset://asset/asset-hero"
        onClose={onClose}
      />
    )

    expect(screen.getByRole('dialog', { name: '局部重绘暂不可用 Hero Image' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Hero Image inpaint preview' })).toHaveAttribute('src', 'cc-asset://asset/asset-hero')
    expect(screen.getByText('当前本地版本尚未接入蒙版编辑和局部重绘执行能力。')).toBeInTheDocument()
    expect(screen.getByText('后续需要接入 media.inpaint tool、蒙版数据模型和支持 inpaint 的图片网关后再开放。')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '运行局部重绘' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '关闭局部重绘提示' }))
    expect(onClose).toHaveBeenCalled()
  })

  it('opens the unavailable inpaint gate from ImageNode configuration', () => {
    render(
      <ReactFlowProvider>
        <ImageNode
          id="image-1"
          data={imageData}
          selected
          assetSafeUrl="cc-asset://asset/asset-hero"
        />
      </ReactFlowProvider>
    )

    fireEvent.click(screen.getByRole('button', { name: '局部重绘图片资产' }))

    expect(screen.getByRole('dialog', { name: '局部重绘暂不可用 Hero Image' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '局部重绘图片资产' })).toHaveAttribute('aria-disabled', 'false')
  })
})
