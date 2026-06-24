// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'

import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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
  const onRun = vi.fn()
  const data = { ...defaultData, ...overrides.data }

  render(
    <ImageNode
      {...overrides}
      id={overrides.id ?? 'image-1'}
      data={data}
      modelOptions={
        overrides.modelOptions ?? [
          { id: 'stub-image', label: 'Stub image' },
          { id: 'cinematic', label: 'Cinematic' }
        ]
      }
      onChange={overrides.onChange ?? onChange}
      onRun={overrides.onRun ?? onRun}
    />
  )

  return { onChange, onRun }
}

afterEach(() => {
  cleanup()
})

describe('M2 ImageNode', () => {
  it('renders idle preview and expands prompt, model, and orientation controls', () => {
    const { onChange } = renderImageNode()

    expect(screen.getByRole('button', { name: 'Configure image node' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText('No image yet')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Configure image node' }))

    expect(screen.getByRole('button', { name: 'Configure image node' })).toHaveAttribute('aria-expanded', 'true')
    fireEvent.change(screen.getByRole('textbox', { name: 'Prompt override' }), {
      target: { value: 'wide panel city at dusk' }
    })
    expect(onChange).toHaveBeenLastCalledWith('image-1', { promptOverride: 'wide panel city at dusk' })

    fireEvent.click(screen.getByRole('button', { name: 'Use model Cinematic' }))
    expect(onChange).toHaveBeenLastCalledWith('image-1', { modelId: 'cinematic' })

    fireEvent.click(screen.getByRole('button', { name: 'Use portrait orientation' }))
    expect(onChange).toHaveBeenLastCalledWith('image-1', { orientation: 'portrait' })
  })

  it('renders pending and running states without enabling duplicate generation', () => {
    renderImageNode({ data: { status: 'pending' } })

    expect(screen.getByRole('status', { name: 'Image generation pending' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Generate image' })).toBeDisabled()

    cleanup()
    renderImageNode({ data: { status: 'running' } })

    expect(screen.getByRole('status', { name: 'Image generation running' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Generate image' })).toBeDisabled()
  })

  it('renders completed safe asset preview and error recovery state', () => {
    renderImageNode({
      data: { status: 'done', assetId: 'asset-1', orientation: 'square' },
      assetSafeUrl: 'cc-asset://asset/asset-1'
    })

    const image = screen.getByRole('img', { name: 'Image 1 preview' })
    expect(image).toHaveAttribute('src', 'cc-asset://asset/asset-1')
    expect(image).toHaveStyle({ objectFit: 'contain' })
    expect(screen.getByTestId('image-preview-frame')).toHaveStyle({ aspectRatio: '1 / 1' })

    cleanup()
    renderImageNode({ data: { status: 'error' } })

    expect(screen.getByRole('alert')).toHaveTextContent('Generation failed')
  })

  it('invokes runNode through the run callback', () => {
    const { onRun } = renderImageNode()

    fireEvent.click(screen.getByRole('button', { name: 'Generate image' }))

    expect(onRun).toHaveBeenCalledWith('image-1')
  })
})
