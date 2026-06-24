/**
 * Renderer realtime invalidation bridge for canvas job and asset updates.
 * @see docs/api-contracts/jobs.md
 * @see docs/api-contracts/assets-files.md
 */

import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import type { ComicCanvasApi } from '../../../../preload'

/** Minimal query invalidation surface consumed by the realtime bridge. */
export interface CanvasQueryInvalidator {
  /**
   * Invalidates cached query data for an event-derived key.
   * @param options - Query invalidation request.
   * @returns Optional promise from TanStack Query.
   * @throws Error when the query client rejects invalidation.
   */
  invalidateQueries(options: { queryKey: readonly unknown[] }): unknown
}

/** Query keys used by the renderer canvas realtime bridge. */
export const canvasRealtimeQueryKeys = {
  /** All asset records. */
  assets: ['assets'] as const,
  /** Specific asset record. */
  asset: (assetId: string) => ['assets', assetId] as const,
  /** Specific job record. */
  job: (jobId: string) => ['jobs', jobId] as const
}

/**
 * Registers event-driven query invalidation for canvas job and asset updates.
 * @param api - Typed preload bridge.
 * @param invalidator - Query invalidation adapter.
 * @returns Cleanup callback that removes all registered event listeners.
 * @throws Error when a preload subscription cannot be registered.
 * @see docs/api-contracts/jobs.md
 * @see docs/api-contracts/assets-files.md
 */
export function registerCanvasRealtimeInvalidation(
  api: Pick<ComicCanvasApi, 'onJobCompleted' | 'onJobFailed' | 'onAssetChanged'>,
  invalidator: CanvasQueryInvalidator
): () => void {
  const unsubscribeCompleted = api.onJobCompleted((event) => {
    void invalidator.invalidateQueries({ queryKey: canvasRealtimeQueryKeys.job(event.jobId) })

    if (event.result.kind === 'asset') {
      void invalidator.invalidateQueries({ queryKey: canvasRealtimeQueryKeys.asset(event.result.assetId) })
    }
  })
  const unsubscribeFailed = api.onJobFailed((event) => {
    void invalidator.invalidateQueries({ queryKey: canvasRealtimeQueryKeys.job(event.jobId) })
  })
  const unsubscribeAsset = api.onAssetChanged((event) => {
    void invalidator.invalidateQueries({ queryKey: canvasRealtimeQueryKeys.assets })
    void invalidator.invalidateQueries({ queryKey: canvasRealtimeQueryKeys.asset(event.assetId) })
  })

  return () => {
    unsubscribeCompleted()
    unsubscribeFailed()
    unsubscribeAsset()
  }
}

/**
 * Connects canvas realtime IPC events to TanStack Query invalidation.
 * @returns void.
 * @throws Error never intentionally; preload/query errors propagate through their own callbacks.
 * @see docs/api-contracts/jobs.md
 * @see docs/api-contracts/assets-files.md
 */
export function useCanvasRealtime(): void {
  const queryClient = useQueryClient()

  useEffect(() => registerCanvasRealtimeInvalidation(window.comicCanvas, queryClient), [queryClient])
}
