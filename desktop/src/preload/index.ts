/**
 * Sandboxed preload bridge for renderer-safe APIs.
 * @see docs/api-contracts/audit-observability.md
 */

import { contextBridge, ipcRenderer } from 'electron'

export interface ComicCanvasApi {
  health(): Promise<{ status: 'ok' | 'degraded' | 'failed'; checkedAt: number }>
}

const api: ComicCanvasApi = {
  /**
   * Checks that the main process IPC bridge is reachable.
   * @returns A health status from the main process.
   * @throws Error when the main process rejects the health request.
   * @see docs/api-contracts/audit-observability.md
   */
  health: () => ipcRenderer.invoke('app.health') as Promise<{ status: 'ok' | 'degraded' | 'failed'; checkedAt: number }>
}

contextBridge.exposeInMainWorld('comicCanvas', api)
