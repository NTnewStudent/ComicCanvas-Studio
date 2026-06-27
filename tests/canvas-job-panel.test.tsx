// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { CanvasJobPanel, type CanvasJobPanelApi } from '../desktop/src/renderer/src/canvas/components/CanvasJobPanel'
import type { JobRecord, JobTerminalEvent } from '../shared/jobs'

const queuedJob: JobRecord = {
  id: 'job-queued',
  type: 'canvas.generateImage',
  status: 'pending',
  targetId: 'image-node-1',
  progress: 0,
  createdAt: 1,
  updatedAt: 1,
}

const failedJob: JobRecord = {
  id: 'job-failed',
  type: 'canvas.generateVideo',
  status: 'failed',
  targetId: 'video-node-1',
  progress: 40,
  error: { errorClass: 'provider_error', message: 'Provider failed', retryable: false },
  createdAt: 2,
  updatedAt: 3,
}

function createApi(overrides: Partial<CanvasJobPanelApi> = {}): CanvasJobPanelApi {
  return {
    listJobs: vi.fn().mockResolvedValue([failedJob, queuedJob]),
    onJobCompleted: vi.fn().mockReturnValue(() => undefined),
    onJobFailed: vi.fn().mockReturnValue(() => undefined),
    ...overrides,
  }
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('REQ-096 canvas job panel', () => {
  it('loads recent jobs with localized status, target, and refresh controls', async () => {
    const listJobs = vi.fn().mockResolvedValue([failedJob, queuedJob])
    render(<CanvasJobPanel api={createApi({ listJobs })} />)

    expect(await screen.findByRole('heading', { name: '运行任务' })).toBeInTheDocument()
    expect(listJobs).toHaveBeenCalledWith({ limit: 8 })
    expect(screen.getByText('job-failed')).toBeInTheDocument()
    expect(screen.getByText('失败')).toBeInTheDocument()
    expect(screen.getByText('Provider failed')).toBeInTheDocument()
    expect(screen.getByText('video-node-1')).toBeInTheDocument()
    expect(screen.getByText('job-queued')).toBeInTheDocument()
    expect(screen.getByText('排队中')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '刷新运行任务' }))
    await waitFor(() => expect(listJobs).toHaveBeenCalledTimes(2))
  })

  it('reloads the list when terminal job events arrive without polling', async () => {
    const completedHandlers: Array<(event: Extract<JobTerminalEvent, { channel: 'job.completed' }>) => void> = []
    const failedHandlers: Array<(event: Extract<JobTerminalEvent, { channel: 'job.failed' }>) => void> = []
    const listJobs = vi.fn()
      .mockResolvedValueOnce([queuedJob])
      .mockResolvedValueOnce([{ ...queuedJob, status: 'completed', progress: 100 }])
      .mockResolvedValueOnce([failedJob])
    const api = createApi({
      listJobs,
      onJobCompleted: vi.fn((handler) => {
        completedHandlers.push(handler)
        return () => undefined
      }),
      onJobFailed: vi.fn((handler) => {
        failedHandlers.push(handler)
        return () => undefined
      }),
    })

    render(<CanvasJobPanel api={api} />)
    expect(await screen.findByText('job-queued')).toBeInTheDocument()

    completedHandlers[0]?.({
      channel: 'job.completed',
      jobId: 'job-queued',
      result: { kind: 'asset', assetId: 'asset-1' },
      emittedAt: 4,
    })
    expect(await screen.findByText('已完成')).toBeInTheDocument()

    failedHandlers[0]?.({
      channel: 'job.failed',
      jobId: 'job-failed',
      error: { errorClass: 'provider_error', message: 'Provider failed', retryable: false },
      emittedAt: 5,
    })
    expect(await screen.findByText('job-failed')).toBeInTheDocument()
    expect(listJobs).toHaveBeenCalledTimes(3)
  })
})
