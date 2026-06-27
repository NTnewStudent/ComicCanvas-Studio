// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'

import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { ImageNodeData } from '../shared/nodes'
import { ImageNode, type ImageNodeProps } from '../desktop/src/renderer/src/canvas/nodes/ImageNode'

const defaultData: ImageNodeData = {
  label: 'Image 1',
  promptOverride: '',
  modelId: 'stub-image',
  orientation: 'landscape',
  assetId: null,
  status: 'idle'
}

type ImageNodeRenderOverrides = Omit<Partial<ImageNodeProps>, 'data'> & {
  data?: Partial<ImageNodeData>
}

function renderImageNode(overrides: ImageNodeRenderOverrides = {}) {
  const onChange = vi.fn()
  const data = { ...defaultData, ...overrides.data }

  render(
    <ReactFlowProvider>
      <ImageNode
        {...overrides}
        id={overrides.id ?? 'image-1'}
        data={data}
        assetOptions={
          overrides.assetOptions ?? [
            { assetId: 'asset-image-a', label: 'Hero still', safeUrl: 'cc-asset://asset/asset-image-a' },
            { assetId: 'asset-image-b', label: 'Rain alley', safeUrl: 'cc-asset://asset/asset-image-b' }
          ]
        }
        onChange={overrides.onChange ?? onChange}
      />
    </ReactFlowProvider>
  )

  return { onChange }
}

afterEach(() => {
  cleanup()
})

describe('M2 ImageNode media reference surface', () => {
  it('renders as an image asset node without generation controls', () => {
    renderImageNode()

    expect(screen.getByText('未绑定图片')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '选择图片素材' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '清除图片素材' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: '生成图片' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '配置图片节点' })).not.toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: 'Prompt 覆盖' })).not.toBeInTheDocument()
    expect(screen.queryByText('模型')).not.toBeInTheDocument()
  })

  it('binds safe image assets directly from the media card', () => {
    const { onChange } = renderImageNode()

    fireEvent.click(screen.getByRole('button', { name: '选择图片素材' }))

    expect(screen.getByRole('dialog', { name: '选择图片资产' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Hero still thumbnail' })).toHaveAttribute('src', 'cc-asset://asset/asset-image-a')

    fireEvent.click(screen.getByRole('button', { name: '选择图片资产 Hero still' }))
    expect(onChange).toHaveBeenLastCalledWith('image-1', {
      assetId: 'asset-image-a',
      url: 'cc-asset://asset/asset-image-a',
      status: 'done'
    })
  })

  it('renders completed safe asset preview with stable contain layout', () => {
    renderImageNode({
      data: { status: 'done', assetId: 'asset-1', orientation: 'square' },
      assetSafeUrl: 'cc-asset://asset/asset-1'
    })

    const image = screen.getByRole('img', { name: 'Image 1 preview' })
    expect(image).toHaveAttribute('src', 'cc-asset://asset/asset-1')
    expect(image).toHaveClass('object-contain')
    expect(screen.getByTestId('image-preview-frame')).toHaveStyle({ aspectRatio: '1 / 1' })
  })

  it('keeps image edit and inpaint entries on the media node instead of generation config', () => {
    renderImageNode({
      data: { status: 'done', assetId: 'asset-generated', url: 'cc-asset://asset/asset-generated' },
      assetSafeUrl: 'cc-asset://asset/asset-generated'
    })

    expect(screen.getByRole('button', { name: '编辑图片资产' })).toBeEnabled()
    expect(screen.getByRole('button', { name: '局部重绘图片资产' })).toHaveAttribute('aria-disabled', 'false')
    expect(screen.queryByRole('button', { name: '写回图片输出资产' })).not.toBeInTheDocument()
  })
})
