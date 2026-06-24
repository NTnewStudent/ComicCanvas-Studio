/**
 * Asset IPC handler skeleton.
 * @see docs/api-contracts/assets-files.md
 */

import type { AssetRecord } from '../../../../shared/assets'
import type { IpcRegistrar } from './types'

function createAssetRecord(assetId: string): AssetRecord {
  return {
    id: assetId,
    mediaType: 'image',
    status: 'ready',
    relativePath: `generated/image/${assetId}.png`,
    safeUrl: `cc-asset://asset/${assetId}`,
    metadata: {
      width: 1,
      height: 1,
      orientation: 'square',
      mimeType: 'image/png'
    },
    createdAt: 1,
    updatedAt: 1
  }
}

/**
 * Registers asset invoke handlers.
 * @param ipcMain - Electron-compatible IPC registrar.
 * @returns void.
 * @throws Error when the registrar rejects handler registration.
 * @see docs/api-contracts/assets-files.md
 */
export function registerAssetHandlers(ipcMain: IpcRegistrar): void {
  ipcMain.handle('asset.import', () => createAssetRecord('imported-asset'))
  ipcMain.handle('asset.get', (_event, request) => {
    const assetId = typeof request === 'object' && request !== null && 'assetId' in request ? String(request.assetId) : 'asset-unknown'

    return createAssetRecord(assetId)
  })
  ipcMain.handle('asset.list', () => [])
}
