/**
 * Canvas IPC handler skeleton.
 * @see docs/api-contracts/canvas-plan.md
 */

import type { JobTicket } from '../../../../shared/jobs'
import type { IpcRegistrar } from './types'

function createPendingTicket(jobId: string): JobTicket {
  return {
    jobId,
    status: 'pending',
    createdAt: 1
  }
}

/**
 * Registers canvas invoke handlers.
 * @param ipcMain - Electron-compatible IPC registrar.
 * @returns void.
 * @throws Error when the registrar rejects handler registration.
 * @see docs/api-contracts/canvas-plan.md
 */
export function registerCanvasHandlers(ipcMain: IpcRegistrar): void {
  ipcMain.handle('canvas.runNode', (_event, request) => {
    const nodeId = typeof request === 'object' && request !== null && 'nodeId' in request ? String(request.nodeId) : 'unknown'

    return createPendingTicket(`job-${nodeId}`)
  })
}
