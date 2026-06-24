import { describe, expect, it, vi } from 'vitest'

import type { AssetChangedEvent } from '../shared/ipc'
import type { JobTerminalEvent } from '../shared/jobs'
import type { ComicCanvasApi } from '../desktop/src/preload'
import type { CanvasQueryInvalidator } from '../desktop/src/renderer/src/canvas/hooks/use-canvas-realtime'
import { registerCanvasRealtimeInvalidation } from '../desktop/src/renderer/src/canvas/hooks/use-canvas-realtime'

type JobCompletedEvent = Extract<JobTerminalEvent, { channel: 'job.completed' }>
type JobFailedEvent = Extract<JobTerminalEvent, { channel: 'job.failed' }>
type UnsubscribeMock = ReturnType<typeof vi.fn>

function createApi(): {
  api: Pick<ComicCanvasApi, 'onJobCompleted' | 'onJobFailed' | 'onAssetChanged'>
  emitJobCompleted(event: JobCompletedEvent): void
  emitJobFailed(event: JobFailedEvent): void
  emitAssetChanged(event: AssetChangedEvent): void
  unsubscribes: [UnsubscribeMock, UnsubscribeMock, UnsubscribeMock]
} {
  let jobCompleted: Parameters<ComicCanvasApi['onJobCompleted']>[0] | null = null
  let jobFailed: Parameters<ComicCanvasApi['onJobFailed']>[0] | null = null
  let assetChanged: Parameters<ComicCanvasApi['onAssetChanged']>[0] | null = null
  const unsubscribes: [UnsubscribeMock, UnsubscribeMock, UnsubscribeMock] = [vi.fn(), vi.fn(), vi.fn()]

  return {
    api: {
      onJobCompleted(handler) {
        jobCompleted = handler
        return unsubscribes[0]
      },
      onJobFailed(handler) {
        jobFailed = handler
        return unsubscribes[1]
      },
      onAssetChanged(handler) {
        assetChanged = handler
        return unsubscribes[2]
      }
    },
    emitJobCompleted(event) {
      jobCompleted?.(event)
    },
    emitJobFailed(event) {
      jobFailed?.(event)
    },
    emitAssetChanged(event) {
      assetChanged?.(event)
    },
    unsubscribes
  }
}

describe('M2 canvas realtime invalidation', () => {
  it('invalidates job and asset queries from IPC events and unsubscribes on cleanup', () => {
    const fixture = createApi()
    const invalidateQueries = vi.fn()
    const invalidator: CanvasQueryInvalidator = { invalidateQueries }

    const cleanup = registerCanvasRealtimeInvalidation(fixture.api, invalidator)

    fixture.emitJobCompleted({
      channel: 'job.completed',
      jobId: 'job-1',
      result: { kind: 'asset', assetId: 'asset-1' },
      emittedAt: 10
    })
    fixture.emitJobFailed({
      channel: 'job.failed',
      jobId: 'job-2',
      error: { errorClass: 'provider_error', message: 'failed', retryable: false },
      emittedAt: 11
    })
    fixture.emitAssetChanged({ assetId: 'asset-1', change: 'updated' })

    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['jobs', 'job-1'] })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['assets', 'asset-1'] })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['jobs', 'job-2'] })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['assets'] })

    cleanup()

    for (const unsubscribe of fixture.unsubscribes) {
      expect(unsubscribe).toHaveBeenCalledTimes(1)
    }
  })
})
