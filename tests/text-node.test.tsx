// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'

import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { TextNodeData } from '../shared/nodes'
import { TextNode, type TextNodeProps } from '../desktop/src/renderer/src/canvas/nodes/TextNode'

function renderTextNode(overrides: Partial<TextNodeProps> = {}) {
  const data: TextNodeData = {
    label: 'Text 1',
    content: 'hello canvas'
  }
  const onChange = vi.fn()
  const onRename = vi.fn()

  render(<ReactFlowProvider><TextNode id="text-1" data={data} onChange={onChange} onRename={onRename} {...overrides} /></ReactFlowProvider>)

  return { onChange, onRename }
}

afterEach(() => {
  cleanup()
})

describe('M2 TextNode', () => {
  it('renders collapsed label and content preview by default', () => {
    renderTextNode()

    expect(screen.getByRole('button', { name: 'Text 1' })).toBeInTheDocument()
    expect(screen.getByText('hello canvas')).toBeInTheDocument()
    expect(screen.queryByRole('textbox', { name: '文本内容' })).not.toBeInTheDocument()
  })

  it('expands to a textarea on click, edits content, and collapses on blur', () => {
    const { onChange } = renderTextNode()

    fireEvent.click(screen.getByRole('button', { name: 'Text 1' }))
    const textbox = screen.getByRole('textbox', { name: '文本内容' })

    fireEvent.change(textbox, { target: { value: 'new script beat' } })
    expect(onChange).toHaveBeenLastCalledWith('text-1', { content: 'new script beat' })

    fireEvent.blur(textbox)
    expect(screen.queryByRole('textbox', { name: '文本内容' })).not.toBeInTheDocument()
    expect(screen.getByText('new script beat')).toBeInTheDocument()
  })

  it('collapses expanded editing when the user clicks outside the node', () => {
    renderTextNode()

    fireEvent.click(screen.getByRole('button', { name: 'Text 1' }))
    expect(screen.getByRole('textbox', { name: '文本内容' })).toBeInTheDocument()

    fireEvent.mouseDown(document.body)

    expect(screen.queryByRole('textbox', { name: '文本内容' })).not.toBeInTheDocument()
    expect(screen.getByText('hello canvas')).toBeInTheDocument()
  })

  it('supports inline rename with Enter save, Escape cancel, and empty rejection', () => {
    const { onRename } = renderTextNode()

    fireEvent.doubleClick(screen.getByRole('button', { name: 'Text 1' }))
    const renameInput = screen.getByRole('textbox', { name: '重命名文本节点' })

    fireEvent.change(renameInput, { target: { value: 'Opening beat' } })
    fireEvent.keyDown(renameInput, { key: 'Enter' })
    expect(onRename).toHaveBeenLastCalledWith('text-1', 'Opening beat')

    fireEvent.doubleClick(screen.getByRole('button', { name: 'Opening beat' }))
    const secondInput = screen.getByRole('textbox', { name: '重命名文本节点' })
    fireEvent.change(secondInput, { target: { value: '' } })
    fireEvent.keyDown(secondInput, { key: 'Enter' })
    expect(onRename).toHaveBeenCalledTimes(1)

    fireEvent.change(secondInput, { target: { value: 'Discard me' } })
    fireEvent.keyDown(secondInput, { key: 'Escape' })
    expect(screen.getByRole('button', { name: 'Opening beat' })).toBeInTheDocument()
  })
})
