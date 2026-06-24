/**
 * Gateway IPC handler skeleton.
 * @see docs/api-contracts/gateway-providers.md
 */

import type { JobTicket } from '../../../../shared/jobs'
import { createSafeErrorEnvelope } from './safe-error'
import type { IpcRegistrar } from './types'

function createGatewayTicket(gatewayId: string): JobTicket {
  return {
    jobId: `job-gateway-${gatewayId}`,
    status: 'pending',
    createdAt: 1
  }
}

/**
 * Registers gateway invoke handlers.
 * @param ipcMain - Electron-compatible IPC registrar.
 * @returns void.
 * @throws Error when the registrar rejects handler registration.
 * @see docs/api-contracts/gateway-providers.md
 */
export function registerGatewayHandlers(ipcMain: IpcRegistrar): void {
  ipcMain.handle('gateway.test', (_event, request) => {
    const gatewayId = typeof request === 'object' && request !== null && 'gatewayId' in request ? String(request.gatewayId) : 'unknown'

    return createGatewayTicket(gatewayId)
  })
}

export { createSafeErrorEnvelope }
