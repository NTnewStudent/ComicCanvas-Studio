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
import { copyFileSync, mkdirSync, statSync } from 'node:fs'
import { dirname, extname, join } from 'node:path'
import { getCurrentStorageConfig } from './storage.handler'
import { storageFactory } from '../storage/storage-factory'

type AssetIdPrefix = 'asset' | 'folder'

export interface AssetHandlerOptions {
  assets?: AssetRepository
  /** Filesystem root for imported/generated assets. */
  assetRoot?: string
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

function inferMediaType(extension: string): AssetMediaType {
  const ext = extension.toLowerCase()
  if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.svg'].includes(ext)) return 'image'
  if (['.mp4', '.webm', '.mov', '.avi', '.mkv'].includes(ext)) return 'video'
  if (['.txt', '.md', '.json', '.csv'].includes(ext)) return 'text'
  if (['.pdf', '.doc', '.docx'].includes(ext)) return 'document'
  return 'other'
}

function extensionToMime(extension: string): string {
  const ext = extension.toLowerCase()
  const map: Record<string, string> = {
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.webp': 'image/webp', '.gif': 'image/gif', '.bmp': 'image/bmp', '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4', '.webm': 'video/webm', '.mov': 'video/quicktime',
    '.avi': 'video/x-msvideo', '.mkv': 'video/x-matroska',
    '.txt': 'text/plain', '.md': 'text/markdown', '.json': 'application/json',
    '.pdf': 'application/pdf'
  }
  return map[ext] ?? 'application/octet-stream'
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

  ipcMain.handle('asset.import', async (_event, request) => {
    const folderId = nullableStringField(request, 'folderId')
    const mediaType = isRecord(request) ? parseMediaType(request.mediaType) : undefined
    const sourcePath = stringField(request, 'sourcePath')

    if (!sourcePath) {
      // Import requests without a source path cannot resolve the local file.
      throw new Error('asset_source_path_required')
    }

    const now = clock()
    const id = idFactory('asset')
    const extension = extname(sourcePath) || '.png'
    const resolvedMediaType = mediaType ?? inferMediaType(extension)
    const relativePath = join('imported', resolvedMediaType, `${id}${extension}`)

    // Try cloud upload if storage is configured
    const storageConfig = getCurrentStorageConfig()
    if (storageConfig && options.assets) {
      const provider = storageFactory.create(storageConfig)
      const key = `assets/${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}${extension}`

      const url = await provider.upload(sourcePath, key)

      let sizeBytes: number | undefined
      try {
        sizeBytes = statSync(sourcePath).size
      } catch {
        // File stat failures are non-fatal; size is recorded as undefined.
      }

      const record: AssetRecord = {
        id,
        mediaType: resolvedMediaType,
        status: 'ready',
        relativePath,
        safeUrl: `cc-asset://asset/${id}`,
        url,
        s3Key: key,
        metadata: {
          mimeType: extensionToMime(extension),
          ...(sizeBytes !== undefined ? { sizeBytes } : {})
        },
        ...(folderId ? { folderId } : {}),
        createdAt: now,
        updatedAt: now
      }
      options.assets.create(record)
      return record
    }

    // Fallback: no cloud storage configured → local copy (original behavior)
    if (options.assetRoot && options.assets) {
      // Copy the local file into the asset root and register it in the DB.
      const targetDir = join(options.assetRoot, dirname(relativePath))
      mkdirSync(targetDir, { recursive: true })
      copyFileSync(sourcePath, join(options.assetRoot, relativePath))

      let sizeBytes: number | undefined
      try {
        sizeBytes = statSync(sourcePath).size
      } catch {
        // File stat failures are non-fatal; size is recorded as undefined.
      }

      const record: AssetRecord = {
        id,
        mediaType: resolvedMediaType,
        status: 'ready',
        relativePath,
        safeUrl: `cc-asset://asset/${id}`,
        metadata: {
          mimeType: extensionToMime(extension),
          ...(sizeBytes !== undefined ? { sizeBytes } : {})
        },
        ...(folderId ? { folderId } : {}),
        createdAt: now,
        updatedAt: now
      }
      options.assets.create(record)
      return record
    }

    // Fallback: no repository or asset root available (test/dev scaffold).
    return createAssetRecord(id, folderId)
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

  ipcMain.handle('asset.trash', async (_event, request) => {
    const trashRequest = parseTrashRequest(request)
    if (!options.assets) {
      return {
        assetId: trashRequest.assetId,
        status: 'trashed',
        blockingReferences: []
      }
    }

    // Delete S3 object if the asset was uploaded to cloud storage
    const asset = options.assets.getById(trashRequest.assetId)
    if (asset?.s3Key) {
      const storageConfig = getCurrentStorageConfig()
      if (storageConfig) {
        try {
          const provider = storageFactory.create(storageConfig)
          await provider.delete(asset.s3Key)
        } catch (err) {
          console.warn('S3 delete failed for asset', trashRequest.assetId, err)
        }
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
