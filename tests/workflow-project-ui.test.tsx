// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'

import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import ProjectsListPage from '../desktop/src/renderer/src/projects/ProjectsListPage'
import type { ComicCanvasApi } from '../desktop/src/preload'
import type { WorkflowSummaryView } from '../shared/ipc'

const workflowSummary = (overrides: Partial<WorkflowSummaryView> = {}): WorkflowSummaryView => ({
  id: 'wf-storyboard',
  name: 'Storyboard',
  scope: 'draft',
  published: false,
  description: null,
  visibility: 'private',
  ownerId: 'user-local',
  ownedByCurrentUser: true,
  tags: [],
  thumbnailUrl: null,
  updatedAt: '2026-06-27T08:00:00.000Z',
  nodeCount: 3,
  edgeCount: 2,
  coverAssetId: 'asset-cover',
  latestRunStatus: 'running',
  defaultStylePresetId: 'style-cinematic',
  archived: false,
  versionChecksum: 'a'.repeat(64),
  warningSummary: {
    unsupportedNodes: 1,
    invalidEdges: 0,
  },
  ...overrides,
})

function createApi(overrides: Partial<ComicCanvasApi> = {}): ComicCanvasApi {
  return {
    listWorkflows: vi.fn().mockResolvedValue([
      workflowSummary(),
      workflowSummary({
        id: 'wf-archived',
        name: 'Archived Cut',
        coverAssetId: null,
        nodeCount: 4,
        edgeCount: 1,
        latestRunStatus: 'error',
        archived: true,
        warningSummary: { unsupportedNodes: 1, invalidEdges: 1 },
      }),
    ]),
    createWorkflow: vi.fn().mockResolvedValue({ id: 'wf-new', name: 'New workflow' }),
    renameWorkflow: vi.fn().mockResolvedValue({ id: 'wf-storyboard', name: 'Storyboard renamed' }),
    deleteWorkflow: vi.fn().mockResolvedValue({ id: 'wf-storyboard', deleted: true }),
    exportWorkflow: vi.fn(),
    importWorkflow: vi.fn(),
    listWorkflowTemplates: vi.fn().mockResolvedValue([]),
    copyWorkflowTemplate: vi.fn().mockResolvedValue({ workflowId: 'wf-copy', graphVersion: 'version-copy', name: 'Template copy' }),
    publishWorkflowTemplate: vi.fn(),
    listWorkflowVersions: vi.fn().mockResolvedValue([]),
    restoreWorkflowVersion: vi.fn().mockResolvedValue({
      workflowId: 'wf-storyboard',
      graphVersion: 'version-restored',
      restoredFromVersionId: 'version-old',
      checksum: 'b'.repeat(64),
      warningSummary: { unsupportedNodes: 0, invalidEdges: 0 },
    }),
    ...overrides,
  } as unknown as ComicCanvasApi
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('Phase A workflow project list UI parity', () => {
  it('shows hjwall-style tabs, project card metadata, and public template empty state', async () => {
    window.comicCanvas = createApi()

    render(
      <MemoryRouter>
        <ProjectsListPage />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('tab', { name: '我的项目 2' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tab', { name: '公共模板' })).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Storyboard 封面' })).toHaveAttribute('src', 'cc-asset://asset/asset-cover')
    expect(screen.getByText('3 节点')).toBeInTheDocument()
    expect(screen.getByText('2 连线')).toBeInTheDocument()
    expect(screen.getByText('运行中')).toBeInTheDocument()
    expect(screen.getByText('1 个警告')).toBeInTheDocument()
    expect(screen.getByText('已归档')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: '公共模板' }))

    expect(await screen.findByText('暂无公共模板')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '复制模板' })).toBeDisabled()
  })

  it('lists public templates and copies a selected template into a draft workflow', async () => {
    const listWorkflowTemplates = vi.fn().mockResolvedValue([
      workflowSummary({
        id: 'template-public',
        name: 'Cinematic storyboard',
        scope: 'template',
        published: true,
        coverAssetId: 'asset-template-cover',
        description: 'Two-scene cinematic storyboard starter.',
        visibility: 'public',
        ownerId: 'template-admin',
        ownedByCurrentUser: false,
        tags: ['cinematic', 'storyboard'],
        thumbnailUrl: 'cc-asset://asset/asset-template-cover',
      }),
    ])
    const copyWorkflowTemplate = vi.fn().mockResolvedValue({
      workflowId: 'wf-template-copy',
      graphVersion: 'version-template-copy',
      name: 'Cinematic storyboard copy',
    })
    window.comicCanvas = createApi({ listWorkflowTemplates, copyWorkflowTemplate })

    render(
      <MemoryRouter>
        <ProjectsListPage />
      </MemoryRouter>,
    )

    fireEvent.click(await screen.findByRole('tab', { name: '公共模板' }))

    expect(await screen.findByText('Cinematic storyboard')).toBeInTheDocument()
    expect(screen.getByRole('img', { name: 'Cinematic storyboard 封面' })).toHaveAttribute('src', 'cc-asset://asset/asset-template-cover')
    expect(screen.getByText('Two-scene cinematic storyboard starter.')).toBeInTheDocument()
    expect(screen.getByText('cinematic')).toBeInTheDocument()
    expect(screen.getByText('storyboard')).toBeInTheDocument()
    expect(screen.getByText('公共')).toBeInTheDocument()
    expect(screen.getByText('template-admin')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '复制模板 Cinematic storyboard' }))

    await waitFor(() => expect(listWorkflowTemplates).toHaveBeenCalledWith({ scope: 'public' }))
    await waitFor(() => expect(copyWorkflowTemplate).toHaveBeenCalledWith({ templateId: 'template-public' }))
  })

  it('keeps delete confirmation on the project card before removing the workflow', async () => {
    const deleteWorkflow = vi.fn().mockResolvedValue({ id: 'wf-storyboard', deleted: true })
    const listWorkflows = vi.fn().mockResolvedValue([workflowSummary()])
    const api = createApi({ deleteWorkflow, listWorkflows })
    window.comicCanvas = api

    render(
      <MemoryRouter>
        <ProjectsListPage />
      </MemoryRouter>,
    )

    await screen.findByText('Storyboard')
    fireEvent.click(screen.getByRole('button', { name: '删除 Storyboard' }))
    expect(screen.getByText('确定删除此项目？')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '删除' }))

    await waitFor(() => expect(deleteWorkflow).toHaveBeenCalledWith({ workflowId: 'wf-storyboard' }))
    expect(listWorkflows).toHaveBeenCalledTimes(2)
  })

  it('opens workflow version debug metadata and restores a historical version', async () => {
    const listWorkflowVersions = vi.fn().mockResolvedValue([
      {
        id: 'version-new',
        createdAt: '2026-06-27T08:30:00.000Z',
        createdBy: 'user-b',
        nodeCount: 3,
        edgeCount: 2,
        checksum: 'b'.repeat(64),
        restoreSourceVersionId: null,
        warningSummary: { unsupportedNodes: 1, invalidEdges: 0 },
      },
      {
        id: 'version-old',
        createdAt: '2026-06-27T08:00:00.000Z',
        createdBy: 'user-a',
        nodeCount: 1,
        edgeCount: 0,
        checksum: 'a'.repeat(64),
        restoreSourceVersionId: null,
        warningSummary: { unsupportedNodes: 0, invalidEdges: 0 },
      },
    ])
    const restoreWorkflowVersion = vi.fn().mockResolvedValue({
      workflowId: 'wf-storyboard',
      graphVersion: 'version-restored',
      restoredFromVersionId: 'version-old',
      checksum: 'c'.repeat(64),
      warningSummary: { unsupportedNodes: 0, invalidEdges: 0 },
    })
    const listWorkflows = vi.fn().mockResolvedValue([workflowSummary()])
    window.comicCanvas = createApi({ listWorkflowVersions, restoreWorkflowVersion, listWorkflows })

    render(
      <MemoryRouter>
        <ProjectsListPage />
      </MemoryRouter>,
    )

    await screen.findByText('Storyboard')
    fireEvent.click(screen.getByRole('button', { name: '版本 Storyboard' }))

    await waitFor(() => expect(listWorkflowVersions).toHaveBeenCalledWith({ workflowId: 'wf-storyboard', limit: 20 }))
    expect(screen.getByText('版本和调试信息')).toBeInTheDocument()
    expect(screen.getByText('version-new')).toBeInTheDocument()
    expect(screen.getByText('校验 bbbbbbbb')).toBeInTheDocument()
    expect(screen.getAllByText('1 个警告').length).toBeGreaterThanOrEqual(2)

    fireEvent.click(screen.getByRole('button', { name: '恢复 version-old' }))

    await waitFor(() => expect(restoreWorkflowVersion).toHaveBeenCalledWith({ workflowId: 'wf-storyboard', versionId: 'version-old' }))
    expect(listWorkflows).toHaveBeenCalledTimes(2)
    expect(listWorkflowVersions).toHaveBeenCalledTimes(2)
    expect(await screen.findByText('已恢复版本 version-old，新版本 version-restored。')).toBeInTheDocument()
  })
})
