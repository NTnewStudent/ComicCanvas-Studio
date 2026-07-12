// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import {
  NodeAssetBar,
  NodeEditorFooter,
  NodeFrame,
  NodeHeader,
  NodePreview,
  NodeSelectionEditor,
  NodeSummaryRows,
} from '../desktop/src/renderer/src/canvas/components/NodePrimitives'

afterEach(() => cleanup())

describe('cloud paper canvas node primitives', () => {
  it('renders a compact frame, header, preview, and scan rows', () => {
    render(
      <NodeFrame selected={false} data-testid="frame">
        <NodeHeader
          icon={<span aria-hidden="true">图</span>}
          title="首帧生成"
          meta="Seedream 4.0"
          actions={<button type="button" aria-label="更多操作">···</button>}
        />
        <NodePreview data-testid="preview">预览</NodePreview>
        <NodeSummaryRows rows={[{ label: '画幅', value: '9:16 · 3K' }]} />
      </NodeFrame>,
    )

    expect(screen.getByTestId('frame')).toHaveClass('cc-node-frame')
    expect(screen.getByText('首帧生成')).toHaveClass('cc-node-title')
    expect(screen.getByText('Seedream 4.0')).toHaveClass('cc-node-meta')
    expect(screen.getByTestId('preview')).toHaveClass('cc-node-preview')
    expect(screen.getByText('画幅').closest('div')).toHaveClass('cc-node-summary-row')
    expect(screen.getByRole('button', { name: '更多操作' })).toBeEnabled()
  })

  it('does not mount a closed selection editor', () => {
    render(<NodeSelectionEditor open={false}>编辑内容</NodeSelectionEditor>)

    expect(screen.queryByText('编辑内容')).not.toBeInTheDocument()
    expect(document.querySelector('[data-node-editor]')).toBeNull()
  })

  it('renders asset actions and editor controls only inside an open editor', () => {
    render(
      <NodeSelectionEditor open testId="image-editor">
        <NodeAssetBar>
          <button type="button">上传</button>
        </NodeAssetBar>
        <div>画面描述</div>
        <NodeEditorFooter>
          <button type="button">生成图片</button>
        </NodeEditorFooter>
      </NodeSelectionEditor>,
    )

    const editor = screen.getByTestId('image-editor')
    expect(editor).toHaveAttribute('data-node-editor')
    expect(editor).toHaveClass('cc-node-editor-anchor', 'nodrag', 'nowheel')
    expect(editor.firstElementChild).toHaveClass('cc-node-editor')
    expect(screen.getByText('上传').closest('div')).toHaveClass('cc-node-asset-bar')
    expect(screen.getByText('生成图片').closest('footer')).toHaveClass('cc-node-editor-footer')
  })
})
