/**
 * Job IPC handler skeleton.
 * @see docs/api-contracts/jobs.md
 */

import type { JobRecord, JobTicket } from '../../../../shared/jobs'
import type { IpcRegistrar } from './types'

function createPendingTicket(jobId: string): JobTicket {
  return {
    jobId,
    status: 'pending',
    createdAt: 1
  }
}

/**
 * Registers job invoke handlers.
 * @param ipcMain - Electron-compatible IPC registrar.
 * @returns void.
 * @throws Error when the registrar rejects handler registration.
 * @see docs/api-contracts/jobs.md
 */
export function registerJobHandlers(ipcMain: IpcRegistrar): void {
  ipcMain.handle('job.enqueue', (_event, request) => {
    const targetId = typeof request === 'object' && request !== null && 'targetId' in request ? String(request.targetId) : 'job'

    return createPendingTicket(`job-${targetId}`)
  })
  ipcMain.handle('job.get', (_event, request): JobRecord => {
    const jobId = typeof request === 'object' && request !== null && 'jobId' in request ? String(request.jobId) : 'job-unknown'

    return {
      id: jobId,
      type: 'canvas.generateImage',
      status: 'pending',
      progress: 0,
      createdAt: 1,
      updatedAt: 1
    }
  })
  ipcMain.handle('job.list', () => [])
}
