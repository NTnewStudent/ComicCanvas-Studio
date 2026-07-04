// @vitest-environment jsdom

import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { WorkflowPanel } from '../desktop/src/renderer/src/canvas/components/WorkflowPanel'
import type { CanvasSnippetView } from '../shared/snippets'

const snippet: CanvasSnippetView = {
  id: 'snippet-rain',
  schemaVersion: 1,
  name: 'Rain alley setup',
  description: 'Text prompt into image setup',
  scope: 'my',
  ownerId: 'user-local',
  ownedByCurrentUser: true,
  tags: ['rain', 'alley'],
  thumbnailUrl: 'cc-asset://asset/snippet-cover',
  nodeCount: 2,
  edgeCount: 1,
  nodes: [],
  edges: [],
  createdAt: 1,
  updatedAt: 2,
}

describe('Task 48 WorkflowPanel snippet parity', () => {
  it('renders snippet scope metadata, detail fragment, and owned delete action', () => {
    const onSelectSnippet = vi.fn()
    const onDeleteSnippet = vi.fn()

    render(
      <WorkflowPanel
        open
        snippets={[snippet, { ...snippet, id: 'snippet-public', name: 'Public camera rig', scope: 'public', ownerId: 'team', ownedByCurrentUser: false }]}
        selectedSnippetId="snippet-rain"
        onSelectSnippet={onSelectSnippet}
        onInsertSnippet={vi.fn()}
        onSaveSnippet={vi.fn()}
        onDeleteSnippet={onDeleteSnippet}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByText('Rain alley setup')).toBeTruthy()
    expect(screen.getByText('我的片段')).toBeTruthy()
    expect(screen.getAllByText('2 nodes / 1 edges')).toHaveLength(2)
    expect(screen.getAllByText('Text prompt into image setup')).toHaveLength(2)
    expect(screen.getAllByText('rain')).toHaveLength(2)
    expect(screen.getByRole('img', { name: 'Rain alley setup thumbnail' }).getAttribute('src')).toBe('cc-asset://asset/snippet-cover')
    expect(screen.getByRole('button', { name: '删除片段 Rain alley setup' })).not.toHaveProperty('disabled', true)
    expect(screen.getByRole('button', { name: '删除片段 Public camera rig' })).toHaveProperty('disabled', true)

    fireEvent.click(screen.getByRole('button', { name: '删除片段 Rain alley setup' }))
    expect(onDeleteSnippet).toHaveBeenCalledWith('snippet-rain')
  })
})
