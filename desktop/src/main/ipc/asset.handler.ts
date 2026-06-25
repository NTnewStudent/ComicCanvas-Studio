/**
 * Asset IPC handlers.
 * @see docs/api-contracts/assets-files.md
 */

import type {
  AssetFolder,
  AssetFolderCreateRequest,
  AssetFolderDeleteRequest,
  AssetMediaType,
  AssetMoveRequest,
  AssetRecord,
  AssetTrashRequest
} from '../../../../shared/assets'
import type { AssetCreateFolderRecord, AssetRepository } from '../db/repositories/asset.repo'
import type { IpcRegistrar } from './types'

type AssetIdPrefix = 'asset' | 'folder'

export interface AssetHandlerOptions {
  assets?: AssetRepository
  clock?: () => number
  idFactory?: (prefix: AssetIdPrefix) => string
}

const mediaTypes = new Set<AssetMediaType>(['image', 'video', 'text', 'document', 'other'])
const folderTypes = new Set<AssetFolder['type']>(['image', 'video', 'mixed'])

function createAssetRecord(assetId: string, folderId?: string | null): AssetRecord {
  const record: AssetRecord = {
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

  if (folderId) {
    record.folderId = folderId
  }

  return record
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function stringField(request: unknown, key: string): string | null {
  if (!isRecord(request)) {
    return null
  }

  const value = request[key]
  return typeof value === 'string' ? value : null
}

function nullableStringField(request: unknown, key: string): string | null {
  if (!isRecord(request)) {
    return null
  }

  const value = request[key]
  return typeof value === 'string' ? value : null
}

function slugifyFolderName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')

  return slug || 'folder'
}

function parseMediaType(value: unknown): AssetMediaType | undefined {
  return typeof value === 'string' && mediaTypes.has(value as AssetMediaType) ? (value as AssetMediaType) : undefined
}

function parseFolderType(value: unknown): AssetFolder['type'] {
  return typeof value === 'string' && folderTypes.has(value as AssetFolder['type']) ? (value as AssetFolder['type']) : 'mixed'
}

function parseCreateFolderRequest(request: unknown): AssetFolderCreateRequest {
  const name = stringField(request, 'name')?.trim()
  if (!name) {
    // Folder creation requires a stable display name for path generation and UI recovery.
    throw new Error('asset_folder_name_required')
  }

  return {
    name,
    parentId: nullableStringField(request, 'parentId'),
    type: isRecord(request) ? parseFolderType(request.type) : 'mixed'
  }
}

function parseMoveRequest(request: unknown): AssetMoveRequest {
  const assetId = stringField(request, 'assetId')
  if (!assetId) {
    // Move requests without an asset ID cannot be resolved safely.
    throw new Error('asset_id_required')
  }

  return {
    assetId,
    folderId: nullableStringField(request, 'folderId')
  }
}

function parseTrashRequest(request: unknown): AssetTrashRequest {
  const assetId = stringField(request, 'assetId')
  if (!assetId) {
    // Trash requests without an asset ID cannot be reference-checked.
    throw new Error('asset_id_required')
  }

  const mode = isRecord(request) && request.mode === 'force-tombstone' ? 'force-tombstone' : 'safe'
  return { assetId, mode }
}

function parseDeleteFolderRequest(request: unknown): AssetFolderDeleteRequest {
  const folderId = stringField(request, 'folderId')
  if (!folderId) {
    // Folder deletion must target one concrete active folder.
    throw new Error('asset_folder_id_required')
  }

  const mode = isRecord(request) && request.mode === 'safe' ? 'safe' : 'force-tombstone'
  return { folderId, mode }
}

/**
 * Registers asset invoke handlers.
 * @param ipcMain - Electron-compatible IPC registrar.
 * @param options - Optional repository and deterministic test dependencies.
 * @returns void.
 * @throws Error when the registrar rejects handler registration or handler validation fails.
 * @see docs/api-contracts/assets-files.md
 */
export function registerAssetHandlers(ipcMain: IpcRegistrar, options: AssetHandlerOptions = {}): void {
  const clock = options.clock ?? Date.now
  const idFactory = options.idFactory ?? ((prefix: AssetIdPrefix) => `${prefix}-${crypto.randomUUID()}`)

  ipcMain.handle('asset.import', (_event, request) => {
    const folderId = nullableStringField(request, 'folderId')
    const mediaType = isRecord(request) ? parseMediaType(request.mediaType) : undefined
    const imported = createAssetRecord('imported-asset', folderId)

    return mediaType ? { ...imported, mediaType } satisfies AssetRecord : imported
  })

  ipcMain.handle('asset.get', (_event, request) => {
    const assetId = stringField(request, 'assetId') ?? 'asset-unknown'
    if (!options.assets) {
      return createAssetRecord(assetId)
    }

    const asset = options.assets.getById(assetId)
    if (!asset) {
      // Missing assets are reported as contract errors instead of leaking storage details.
      throw new Error('asset_not_found')
    }

    return asset
  })

  ipcMain.handle('asset.list', (_event, request) => {
    if (!options.assets) {
      return []
    }

    const folderId = nullableStringField(request, 'folderId')
    const mediaType = isRecord(request) ? parseMediaType(request.mediaType) : undefined
    const keyword = isRecord(request) && typeof request.keyword === 'string' ? request.keyword : undefined

    return options.assets.list({
      ...(isRecord(request) && 'folderId' in request ? { folderId } : {}),
      ...(mediaType ? { mediaType } : {}),
      ...(keyword ? { keyword } : {})
    })
  })

  ipcMain.handle('asset.move', (_event, request) => {
    const moveRequest = parseMoveRequest(request)
    if (!options.assets) {
      return createAssetRecord(moveRequest.assetId, moveRequest.folderId)
    }

    return options.assets.moveAsset(moveRequest, clock())
  })

  ipcMain.handle('asset.trash', (_event, request) => {
    const trashRequest = parseTrashRequest(request)
    if (!options.assets) {
      return {
        assetId: trashRequest.assetId,
        status: 'trashed',
        blockingReferences: []
      }
    }

    return options.assets.trashAsset(trashRequest, clock())
  })

  ipcMain.handle('asset.getFolders', () => options.assets?.listFolders() ?? [])

  ipcMain.handle('asset.createFolder', (_event, request) => {
    const folderRequest = parseCreateFolderRequest(request)
    const now = clock()
    const id = idFactory('folder')
    const parent = folderRequest.parentId && options.assets ? options.assets.getFolderById(folderRequest.parentId) : null
    if (folderRequest.parentId && options.assets && !parent) {
      // A child folder cannot be created under a missing parent because its path would be ambiguous.
      throw new Error('asset_folder_not_found')
    }

    const relativePath = [parent?.relativePath, slugifyFolderName(folderRequest.name)].filter(Boolean).join('/')
    const folder: AssetCreateFolderRecord = {
      id,
      name: folderRequest.name,
      parentId: folderRequest.parentId,
      type: folderRequest.type,
      relativePath,
      createdAt: now,
      updatedAt: now
    }

    return options.assets ? options.assets.createFolder(folder) : folder
  })

  ipcMain.handle('asset.deleteFolder', (_event, request) => {
    const deleteRequest = parseDeleteFolderRequest(request)
    if (!options.assets) {
      return {
        folderId: deleteRequest.folderId,
        status: 'deleted',
        affectedAssetIds: [],
        tombstonedAssetIds: [],
        blockingReferences: []
      }
    }

    return options.assets.deleteFolder(deleteRequest, clock())
  })
}
