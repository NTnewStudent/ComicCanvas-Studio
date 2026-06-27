// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'

import { readFileSync } from 'node:fs'

import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import ProjectsListPage from '../desktop/src/renderer/src/projects/ProjectsListPage'
import type { ComicCanvasApi } from '../desktop/src/preload'

const exportedWorkflow = {
  schemaVersion: 1 as const,
  name: 'Storyboard',
  graph: {
    nodes: [],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 }
  }
}

function createApi(overrides: Partial<ComicCanvasApi> = {}): ComicCanvasApi {
  return {
    listWorkflows: vi.fn().mockResolvedValue([
      { id: 'wf-storyboard', name: 'Storyboard', updatedAt: new Date().toISOString(), nodeCount: 2 }
    ]),
    createWorkflow: vi.fn().mockResolvedValue({ id: 'wf-new', name: 'New workflow' }),
    renameWorkflow: vi.fn().mockResolvedValue({ id: 'wf-storyboard', name: 'Storyboard renamed' }),
    deleteWorkflow: vi.fn().mockResolvedValue({ id: 'wf-storyboard', deleted: true }),
    exportWorkflow: vi.fn().mockResolvedValue(exportedWorkflow),
    importWorkflow: vi.fn().mockResolvedValue({ workflowId: 'wf-imported', graphVersion: 'graph-imported', dropped: [] }),
    ...overrides
  } as unknown as ComicCanvasApi
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('REQ-091 workflow import/export renderer bridge', () => {
  it('exposes workflow import/export through the sandboxed preload bridge', () => {
    const source = readFileSync('desktop/src/preload/index.ts', 'utf8')

    expect(source).toContain('exportWorkflow')
    expect(source).toContain('importWorkflow')
    expect(source).toContain("invokeMain('canvas.exportWorkflow'")
    expect(source).toContain("invokeMain('canvas.importWorkflow'")
    expect(source).toContain("function invokeMain<TChannel extends 'canvas.exportWorkflow'>")
    expect(source).toContain("function invokeMain<TChannel extends 'canvas.importWorkflow'>")
  })

  it('exports a workflow from the projects page as formatted JSON', async () => {
    const api = createApi()
    window.comicCanvas = api

    render(
      <MemoryRouter>
        <ProjectsListPage />
      </MemoryRouter>
    )

    await screen.findByText('Storyboard')
    fireEvent.click(screen.getByRole('button', { name: '导出 Storyboard' }))

    await waitFor(() => expect(api.exportWorkflow).toHaveBeenCalledWith({ workflowId: 'wf-storyboard' }))
    const textbox = screen.getByRole('textbox', { name: '工作流 JSON' })
    expect(textbox).toHaveValue(JSON.stringify(exportedWorkflow, null, 2))
    expect(screen.getByText('已导出 Storyboard，可复制 JSON。')).toBeInTheDocument()
  })

  it('imports workflow JSON, refreshes the list, and reports dropped records', async () => {
    const api = createApi({
      importWorkflow: vi.fn().mockResolvedValue({
        workflowId: 'wf-imported',
        graphVersion: 'graph-imported',
        dropped: ['node:legacy:unsupported_type']
      })
    })
    window.comicCanvas = api

    render(
      <MemoryRouter>
        <ProjectsListPage />
      </MemoryRouter>
    )

    fireEvent.click(await screen.findByRole('button', { name: '导入工作流' }))
    fireEvent.change(screen.getByRole('textbox', { name: '工作流 JSON' }), {
      target: { value: JSON.stringify(exportedWorkflow) }
    })
    fireEvent.change(screen.getByRole('textbox', { name: '导入名称' }), {
      target: { value: 'Imported storyboard' }
    })
    fireEvent.click(screen.getByRole('button', { name: '确认导入' }))

    await waitFor(() =>
      expect(api.importWorkflow).toHaveBeenCalledWith({
        json: JSON.stringify(exportedWorkflow),
        name: 'Imported storyboard'
      })
    )
    expect(api.listWorkflows).toHaveBeenCalledTimes(2)
    expect(screen.getByText('已导入工作流，清理 1 项不兼容内容。')).toBeInTheDocument()
  })

  it('shows a Chinese import error when the main process rejects unsafe JSON', async () => {
    const api = createApi({
      importWorkflow: vi.fn().mockResolvedValue({
        errorClass: 'unsafe_workflow_json',
        message: 'Workflow import JSON cannot contain absolute file paths.',
        retryable: false
      })
    })
    window.comicCanvas = api

    render(
      <MemoryRouter>
        <ProjectsListPage />
      </MemoryRouter>
    )

    fireEvent.click(await screen.findByRole('button', { name: '导入工作流' }))
    fireEvent.change(screen.getByRole('textbox', { name: '工作流 JSON' }), {
      target: { value: '{"name":"Unsafe","graph":{"nodes":[],"edges":[],"viewport":{"x":0,"y":0,"zoom":1}}}' }
    })
    fireEvent.click(screen.getByRole('button', { name: '确认导入' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('导入失败：Workflow import JSON cannot contain absolute file paths.')
  })
})
