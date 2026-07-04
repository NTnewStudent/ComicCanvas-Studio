/**
 * Asset IPC handlers.
 * @see docs/api-contracts/assets-files.md
 */

import type {
  AssetFolder,
  AssetCategoryAssignRequest,
  AssetCategoryCreateRequest,
  AssetCategoryUpdateRequest,
  AssetFolderCreateRequest,
  AssetFolderDeleteRequest,
  AssetMediaType,
  AssetMoveRequest,
  AssetRecord,
  AssetRenameRequest,
  AssetTrashRequest
} from '../../../../shared/assets'
import type { AssetCreateFolderRecord, AssetRepository } from '../db/repositories/asset.repo'
import type { IpcRegistrar } from './types'
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, extname, join, posix } from 'node:path'
import { dialog } from 'electron'
import { getCurrentStorageConfig } from './storage.handler'
import { storageFactory } from '../storage/storage-factory'
import { inferImportedAssetMetadata } from '../assets/import-metadata'

type AssetIdPrefix = 'asset' | 'folder' | 'category'

export interface AssetHandlerOptions {
  assets?: AssetRepository
  /** Filesystem root for imported/generated assets. */
  assetRoot?: string
  clock?: () => number
  idFactory?: (prefix: AssetIdPrefix) => string
}

const mediaTypes = new Set<AssetMediaType>(['image', 'video', 'audio', 'text', 'document', 'other'])
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

function optionalStringArrayField(request: unknown, key: string): string[] | undefined {
  if (!isRecord(request)) {
    return undefined
  }

  const value = request[key]
  if (!Array.isArray(value)) {
    return undefined
  }

  const strings = value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
  return strings.length > 0 ? strings : undefined
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

function parseRenameRequest(request: unknown): AssetRenameRequest {
  const assetId = stringField(request, 'assetId')
  const displayName = stringField(request, 'displayName')?.trim()
  if (!assetId || !displayName) {
    // Rename requests must target one asset and provide a non-empty display label.
    throw new Error('asset_rename_required')
  }

  return { assetId, displayName }
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

function parseCreateCategoryRequest(request: unknown): AssetCategoryCreateRequest {
  const name = stringField(request, 'name')?.trim()
  if (!name) {
    // Category creation requires a display name for filtering and canvas insertion.
    throw new Error('asset_category_name_required')
  }

  return {
    name,
    ...(stringField(request, 'description') ? { description: stringField(request, 'description') as string } : {}),
    ...(stringField(request, 'color') ? { color: stringField(request, 'color') as string } : {}),
    ...(stringField(request, 'icon') ? { icon: stringField(request, 'icon') as string } : {}),
    ...(isRecord(request) && typeof request.sortOrder === 'number' ? { sortOrder: request.sortOrder } : {})
  }
}

function parseUpdateCategoryRequest(request: unknown): AssetCategoryUpdateRequest {
  const categoryId = stringField(request, 'categoryId')
  if (!categoryId) {
    // Category updates must target one active category.
    throw new Error('asset_category_id_required')
  }

  return {
    categoryId,
    ...(stringField(request, 'name') ? { name: stringField(request, 'name') as string } : {}),
    ...(isRecord(request) && 'description' in request ? { description: typeof request.description === 'string' ? request.description : null } : {}),
    ...(stringField(request, 'color') ? { color: stringField(request, 'color') as string } : {}),
    ...(stringField(request, 'icon') ? { icon: stringField(request, 'icon') as string } : {}),
    ...(isRecord(request) && typeof request.sortOrder === 'number' ? { sortOrder: request.sortOrder } : {}),
    ...(isRecord(request) && typeof request.enabled === 'boolean' ? { enabled: request.enabled } : {})
  }
}

function parseCategoryAssignRequest(request: unknown): AssetCategoryAssignRequest {
  const assetId = stringField(request, 'assetId')
  const categoryId = stringField(request, 'categoryId')
  if (!assetId || !categoryId) {
    // Category assignment requires both sides so reference integrity remains explicit.
    throw new Error('asset_category_assignment_required')
  }

  return { assetId, categoryId }
}

function inferMediaType(extension: string): AssetMediaType {
  const ext = extension.toLowerCase()
  if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.svg'].includes(ext)) return 'image'
  if (['.mp4', '.webm', '.mov', '.avi', '.mkv'].includes(ext)) return 'video'
  if (['.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg'].includes(ext)) return 'audio'
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
    '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.m4a': 'audio/mp4',
    '.aac': 'audio/aac', '.flac': 'audio/flac', '.ogg': 'audio/ogg',
    '.txt': 'text/plain', '.md': 'text/markdown', '.json': 'application/json',
    '.pdf': 'application/pdf'
  }
  return map[ext] ?? 'application/octet-stream'
}

function assertSupportedImportExtension(extension: string): void {
  if (extensionToMime(extension) === 'application/octet-stream') {
    // Rejecting unknown binaries before copying keeps local asset storage inspectable and contract-bound.
    throw new Error('asset_unsupported_extension')
  }
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

  ipcMain.handle('asset.pickImportFiles', async () => {
    const result = await dialog.showOpenDialog({
      title: '选择资产文件',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: '资产文件', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'svg', 'mp4', 'webm', 'mov', 'avi', 'mkv', 'mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg', 'txt', 'md', 'json', 'pdf'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    })
    return { paths: result.canceled ? [] : result.filePaths }
  })

  ipcMain.handle('asset.import', async (_event, request) => {
    const folderId = nullableStringField(request, 'folderId')
    const mediaType = isRecord(request) ? parseMediaType(request.mediaType) : undefined
    const sourcePath = stringField(request, 'sourcePath')
    const categoryIds = optionalStringArrayField(request, 'categoryIds')
    const tags = optionalStringArrayField(request, 'tags')

    if (!sourcePath) {
      // Import requests without a source path cannot resolve the local file.
      throw new Error('asset_source_path_required')
    }

    const now = clock()
    const id = idFactory('asset')
    const extension = (extname(sourcePath) || '.png').toLowerCase()
    assertSupportedImportExtension(extension)
    const resolvedMediaType = mediaType ?? inferMediaType(extension)
    const mimeType = extensionToMime(extension)
    const bytes = readFileSync(sourcePath)
    const metadata = inferImportedAssetMetadata({
      mediaType: resolvedMediaType,
      bytes,
      mimeType,
      sizeBytes: bytes.byteLength
    })
    const relativePath = posix.join('imported', resolvedMediaType, `${id}${extension}`)

    // Try cloud upload if storage is configured
    const storageConfig = getCurrentStorageConfig()
    if (storageConfig && options.assets) {
      const provider = storageFactory.create(storageConfig)
      const key = `assets/${new Date().toISOString().slice(0, 7)}/${crypto.randomUUID()}${extension}`

      const url = await provider.upload(sourcePath, key)

      const record: AssetRecord = {
        id,
        mediaType: resolvedMediaType,
        status: 'ready',
        relativePath,
        safeUrl: `cc-asset://asset/${id}`,
        url,
        s3Key: key,
        metadata,
        ...(categoryIds ? { categoryIds } : {}),
        ...(tags ? { tags } : {}),
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

      const record: AssetRecord = {
        id,
        mediaType: resolvedMediaType,
        status: 'ready',
        relativePath,
        safeUrl: `cc-asset://asset/${id}`,
        metadata,
        ...(categoryIds ? { categoryIds } : {}),
        ...(tags ? { tags } : {}),
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
    const categoryId = stringField(request, 'categoryId') ?? undefined
    const tags = optionalStringArrayField(request, 'tags')

    return options.assets.list({
      ...(isRecord(request) && 'folderId' in request ? { folderId } : {}),
      ...(mediaType ? { mediaType } : {}),
      ...(keyword ? { keyword } : {}),
      ...(categoryId ? { categoryId } : {}),
      ...(tags ? { tags } : {})
    })
  })

  ipcMain.handle('asset.move', (_event, request) => {
    const moveRequest = parseMoveRequest(request)
    if (!options.assets) {
      return createAssetRecord(moveRequest.assetId, moveRequest.folderId)
    }

    return options.assets.moveAsset(moveRequest, clock())
  })

  ipcMain.handle('asset.rename', (_event, request) => {
    const renameRequest = parseRenameRequest(request)
    if (!options.assets) {
      return {
        ...createAssetRecord(renameRequest.assetId),
        displayName: renameRequest.displayName,
        updatedAt: clock()
      }
    }

    return options.assets.renameAsset(renameRequest, clock())
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

  ipcMain.handle('asset.getCategories', (_event, request) => {
    if (!options.assets) {
      return []
    }

    const includeDisabled = isRecord(request) && request.includeDisabled === true
    options.assets.ensureStarterCategories(clock())
    return options.assets.listCategories({ includeDisabled })
  })

  ipcMain.handle('asset.createCategory', (_event, request) => {
    const categoryRequest = parseCreateCategoryRequest(request)
    if (!options.assets) {
      return {
        id: idFactory('category'),
        name: categoryRequest.name,
        slug: categoryRequest.name.toLowerCase(),
        kind: 'image',
        color: categoryRequest.color ?? '#22c55e',
        icon: categoryRequest.icon ?? 'image',
        sortOrder: categoryRequest.sortOrder ?? 100,
        builtIn: false,
        enabled: true,
        createdAt: clock(),
        updatedAt: clock()
      }
    }

    options.assets.ensureStarterCategories(clock())
    return options.assets.createCategory(categoryRequest, clock(), () => idFactory('category'))
  })

  ipcMain.handle('asset.updateCategory', (_event, request) => {
    const categoryRequest = parseUpdateCategoryRequest(request)
    if (!options.assets) {
      throw new Error('asset_repository_unavailable')
    }

    options.assets.ensureStarterCategories(clock())
    return options.assets.updateCategory(categoryRequest, clock())
  })

  ipcMain.handle('asset.assignCategory', (_event, request) => {
    const assignRequest = parseCategoryAssignRequest(request)
    if (options.assets) {
      options.assets.ensureStarterCategories(clock())
      options.assets.assignCategory(assignRequest, clock())
    }

    return { ...assignRequest, assigned: true as const }
  })

  ipcMain.handle('asset.removeCategory', (_event, request) => {
    const assignRequest = parseCategoryAssignRequest(request)
    options.assets?.removeCategory(assignRequest)
    return { ...assignRequest, removed: true as const }
  })
}
