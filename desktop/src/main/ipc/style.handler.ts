/**
 * Style preset IPC handlers.
 * @see docs/api-contracts/styles.md
 */

import type { IpcRequestMap, IpcResponseMap } from '../../../../shared/ipc'
import type { StyleRepository } from '../db/repositories/style.repo'
import type { IpcRegistrar } from './types'

export interface StyleHandlerOptions {
  styles?: StyleRepository
  clock?: () => number
  idFactory?: () => string
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function fallbackList(): IpcResponseMap['style.list'] {
  return []
}

/**
 * Registers style management invoke handlers.
 * @param ipcMain - Electron-compatible IPC registrar.
 * @param options - Optional style repository and deterministic test dependencies.
 * @returns void.
 * @throws Error when the registrar rejects handler registration.
 * @see docs/api-contracts/styles.md
 */
export function registerStyleHandlers(ipcMain: IpcRegistrar, options: StyleHandlerOptions = {}): void {
  const clock = options.clock ?? Date.now

  ipcMain.handle('style.list', (_event, request) => {
    if (!options.styles) return fallbackList()
    const includeDisabled = isObject(request) && request.includeDisabled === true
    return options.styles.list({ includeDisabled })
  })

  ipcMain.handle('style.save', (_event, request) => {
    if (!options.styles) {
      return request
    }
    return options.styles.save(request as IpcRequestMap['style.save'], clock(), options.idFactory)
  })

  ipcMain.handle('style.delete', (_event, request) => {
    const stylePresetId = isObject(request) && typeof request.stylePresetId === 'string' ? request.stylePresetId : ''
    options.styles?.delete(stylePresetId, clock())
    return { stylePresetId, deleted: true as const }
  })

  ipcMain.handle('style.setProjectDefault', (_event, request) => {
    const input = request as IpcRequestMap['style.setProjectDefault']
    options.styles?.setProjectDefault(input.workflowId, input.stylePresetId)
    return { workflowId: input.workflowId, stylePresetId: input.stylePresetId }
  })

  ipcMain.handle('style.getProjectDefault', (_event, request) => {
    const workflowId = isObject(request) && typeof request.workflowId === 'string' ? request.workflowId : ''
    return { workflowId, stylePresetId: options.styles?.getProjectDefault(workflowId) ?? null }
  })
}
