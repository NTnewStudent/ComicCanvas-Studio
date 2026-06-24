/**
 * Sandboxed preload bridge for renderer-safe APIs.
 * @see docs/api-contracts/audit-observability.md
 */

import { contextBridge, ipcRenderer } from 'electron'

import type { AssetChangedEvent, IpcEventChannel, IpcEventMap } from '../../../shared/ipc'
import type { JobTerminalEvent } from '../../../shared/jobs'

export interface ComicCanvasApi {
  health(): Promise<{ status: 'ok' | 'degraded' | 'failed'; checkedAt: number }>
  onJobCompleted(handler: (event: Extract<JobTerminalEvent, { channel: 'job.completed' }>) => void): () => void
  onJobFailed(handler: (event: Extract<JobTerminalEvent, { channel: 'job.failed' }>) => void): () => void
  onAssetChanged(handler: (event: AssetChangedEvent) => void): () => void
}

type SubscribableEventChannel = Extract<IpcEventChannel, 'job.completed' | 'job.failed' | 'asset.changed'>

/**
 * Invokes a whitelisted main-process channel from typed preload APIs only.
 * @param channel - The whitelisted channel name.
 * @returns The typed response for the channel.
 * @throws Error when the main process rejects the invoke request.
 * @see docs/api-contracts/audit-observability.md
 */
function invokeMain<TResponse>(channel: 'app.health'): Promise<TResponse> {
  return ipcRenderer.invoke(channel) as Promise<TResponse>
}

/**
 * Subscribes a renderer-safe handler to a whitelisted main-process event channel.
 * @param channel - The whitelisted event channel.
 * @param handler - Typed event payload handler.
 * @returns Unsubscribe callback that removes the exact listener.
 * @throws Error never intentionally; Electron listener registration errors propagate.
 * @see docs/api-contracts/jobs.md
 * @see docs/api-contracts/assets-files.md
 */
function subscribeMain<TChannel extends SubscribableEventChannel>(
  channel: TChannel,
  handler: (event: IpcEventMap[TChannel]) => void
): () => void {
  const listener = (_event: Electron.IpcRendererEvent, payload: IpcEventMap[TChannel]) => {
    handler(payload)
  }

  ipcRenderer.on(channel, listener)

  return () => {
    ipcRenderer.removeListener(channel, listener)
  }
}

const api: ComicCanvasApi = {
  /**
   * Checks that the main process IPC bridge is reachable.
   * @returns A health status from the main process.
   * @throws Error when the main process rejects the health request.
   * @see docs/api-contracts/audit-observability.md
   */
  health: () => invokeMain<{ status: 'ok' | 'degraded' | 'failed'; checkedAt: number }>('app.health'),
  /**
   * Subscribes to completed job terminal events.
   * @param handler - Event payload handler.
   * @returns Unsubscribe callback.
   * @throws Error when Electron listener registration fails.
   * @see docs/api-contracts/jobs.md
   */
  onJobCompleted: (handler) => subscribeMain('job.completed', handler),
  /**
   * Subscribes to failed job terminal events.
   * @param handler - Event payload handler.
   * @returns Unsubscribe callback.
   * @throws Error when Electron listener registration fails.
   * @see docs/api-contracts/jobs.md
   */
  onJobFailed: (handler) => subscribeMain('job.failed', handler),
  /**
   * Subscribes to asset library change events.
   * @param handler - Event payload handler.
   * @returns Unsubscribe callback.
   * @throws Error when Electron listener registration fails.
   * @see docs/api-contracts/assets-files.md
   */
  onAssetChanged: (handler) => subscribeMain('asset.changed', handler)
}

contextBridge.exposeInMainWorld('comicCanvas', api)
