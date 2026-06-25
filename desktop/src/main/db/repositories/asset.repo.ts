/**
 * Asset repository boundary for generated and imported media records.
 * @see docs/api-contracts/assets-files.md
 */

import type { Database as BetterSqliteDatabase } from 'better-sqlite3'

import type {
  AssetFolder,
  AssetFolderDeleteRequest,
  AssetFolderDeleteResponse,
  AssetMediaType,
  AssetMetadata,
  AssetMoveRequest,
  AssetRecord,
  AssetReference,
  AssetStatus,
  AssetTrashRequest,
  AssetTrashResponse
} from '../../../../../shared/assets'

export interface AssetCreateRecord {
  id: string
  mediaType: AssetMediaType
  status: AssetStatus
  relativePath: string
  safeUrl: string
  metadata: AssetMetadata
  folderId?: string
  createdAt: number
  updatedAt: number
}

export interface AssetCreateFolderRecord {
  id: string
  name: string
  parentId: string | null
  type: AssetFolder['type']
  relativePath: string
  createdAt: number
  updatedAt: number
}

export interface AssetReferenceCreateRecord {
  id: string
  assetId: string
  refType: AssetReference['refType']
  refId: string
  createdAt: number
}

export interface AssetListFilter {
  folderId?: string | null
  mediaType?: AssetMediaType
}

interface AssetRow {
  id: string
  media_type: AssetMediaType
  status: AssetStatus
  rel_path: string
  safe_url: string
  width: number | null
  height: number | null
  duration_ms: number | null
  orientation: NonNullable<AssetMetadata['orientation']> | null
  mime_type: string | null
  size_bytes: number | null
  hash: string | null
  folder_id: string | null
  created_at: number
  updated_at: number
  deleted_at: number | null
}

interface AssetFolderRow {
  id: string
  parent_id: string | null
  name: string
  type: AssetFolder['type']
  rel_path: string
  created_at: number
  updated_at: number
  deleted_at: number | null
}

interface AssetReferenceRow {
  asset_id: string
  ref_type: AssetReference['refType']
  ref_id: string
}

export interface AssetRepository {
  /** Stores a generated or imported asset record. */
  create(record: AssetCreateRecord): void
  /** Finds an asset by ID, including trashed and tombstoned records. */
  getById(id: string): AssetRecord | null
  /** Lists active assets, optionally scoped to a folder and media type. */
  list(filter?: AssetListFilter): AssetRecord[]
  /** Creates an active asset folder. */
  createFolder(record: AssetCreateFolderRecord): AssetFolder
  /** Finds an active asset folder by ID. */
  getFolderById(id: string): AssetFolder | null
  /** Lists active asset folders in path order. */
  listFolders(): AssetFolder[]
  /** Moves an asset into a folder or back to the library root. */
  moveAsset(request: AssetMoveRequest, updatedAt: number): AssetRecord
  /** Adds a reference edge from another domain object to an asset. */
  addReference(record: AssetReferenceCreateRecord): void
  /** Lists references that currently block safe destructive actions. */
  listReferences(assetId: string): AssetReference[]
  /** Trashes or tombstones an asset according to reference safety mode. */
  trashAsset(request: AssetTrashRequest, updatedAt: number): AssetTrashResponse
  /** Deletes a folder tree and safely trashes or tombstones contained assets. */
  deleteFolder(request: AssetFolderDeleteRequest, updatedAt: number): AssetFolderDeleteResponse
}

function mapAsset(row: AssetRow): AssetRecord {
  const metadata: AssetMetadata = {}
  if (row.width !== null) metadata.width = row.width
  if (row.height !== null) metadata.height = row.height
  if (row.duration_ms !== null) metadata.durationMs = row.duration_ms
  if (row.orientation !== null) metadata.orientation = row.orientation
  if (row.mime_type !== null) metadata.mimeType = row.mime_type
  if (row.size_bytes !== null) metadata.sizeBytes = row.size_bytes
  if (row.hash !== null) metadata.hash = row.hash

  const asset: AssetRecord = {
    id: row.id,
    mediaType: row.media_type,
    status: row.status,
    relativePath: row.rel_path,
    safeUrl: row.safe_url,
    metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }

  if (row.folder_id !== null) {
    asset.folderId = row.folder_id
  }

  return asset
}

function mapFolder(row: AssetFolderRow): AssetFolder {
  const folder: AssetFolder = {
    id: row.id,
    name: row.name,
    parentId: row.parent_id,
    type: row.type,
    relativePath: row.rel_path,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }

  if (row.deleted_at !== null) {
    folder.deletedAt = row.deleted_at
  }

  return folder
}

function mapReference(row: AssetReferenceRow): AssetReference {
  return {
    assetId: row.asset_id,
    refType: row.ref_type,
    refId: row.ref_id
  }
}

/**
 * Creates a repository for asset metadata, folder trees, and reference-safe destructive actions.
 * @param db - Open SQLite database handle.
 * @returns Asset repository API.
 * @throws Error when repository SQL statements cannot be prepared or write constraints fail.
 * @see docs/api-contracts/assets-files.md
 */
export function createAssetRepository(db: BetterSqliteDatabase): AssetRepository {
  const insertAsset = db.prepare(`
    INSERT INTO assets (
      id, media_type, status, rel_path, safe_url, width, height, duration_ms, orientation,
      mime_type, size_bytes, hash, folder_id, created_at, updated_at
    ) VALUES (
      @id, @mediaType, @status, @relativePath, @safeUrl, @width, @height, @durationMs, @orientation,
      @mimeType, @sizeBytes, @hash, @folderId, @createdAt, @updatedAt
    )
  `)
  const selectAsset = db.prepare('SELECT * FROM assets WHERE id = ?')
  const selectActiveAssets = db.prepare(`
    SELECT * FROM assets
    WHERE deleted_at IS NULL
      AND status NOT IN ('trashed', 'tombstoned')
    ORDER BY created_at ASC, id ASC
  `)
  const updateAssetFolder = db.prepare('UPDATE assets SET folder_id = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL')
  const updateAssetStatus = db.prepare('UPDATE assets SET status = ?, updated_at = ?, deleted_at = ? WHERE id = ?')
  const insertFolder = db.prepare(`
    INSERT INTO asset_folders (
      id, parent_id, name, type, rel_path, created_at, updated_at
    ) VALUES (
      @id, @parentId, @name, @type, @relativePath, @createdAt, @updatedAt
    )
  `)
  const selectActiveFolder = db.prepare('SELECT * FROM asset_folders WHERE id = ? AND deleted_at IS NULL')
  const selectActiveFolders = db.prepare('SELECT * FROM asset_folders WHERE deleted_at IS NULL ORDER BY rel_path ASC, created_at ASC, id ASC')
  const deleteFolderById = db.prepare('UPDATE asset_folders SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL')
  const insertReference = db.prepare(`
    INSERT INTO asset_references (
      id, asset_id, ref_type, ref_id, created_at
    ) VALUES (
      @id, @assetId, @refType, @refId, @createdAt
    )
  `)
  const selectReferences = db.prepare('SELECT asset_id, ref_type, ref_id FROM asset_references WHERE asset_id = ? ORDER BY created_at ASC, id ASC')

  function findAsset(id: string): AssetRecord | null {
    const row = selectAsset.get(id) as AssetRow | undefined
    return row ? mapAsset(row) : null
  }

  function listActiveFolders(): AssetFolder[] {
    return (selectActiveFolders.all() as AssetFolderRow[]).map(mapFolder)
  }

  function listBlockingReferences(assetId: string): AssetReference[] {
    return (selectReferences.all(assetId) as AssetReferenceRow[]).map(mapReference)
  }

  function collectFolderIds(folderId: string): string[] {
    const folders = listActiveFolders()
    const ids: string[] = [folderId]

    for (let index = 0; index < ids.length; index += 1) {
      const parentId = ids[index]
      for (const folder of folders) {
        if (folder.parentId === parentId && !ids.includes(folder.id)) {
          ids.push(folder.id)
        }
      }
    }

    return ids
  }

  const trashAssetTransaction = db.transaction((request: AssetTrashRequest, updatedAt: number): AssetTrashResponse => {
    const asset = findAsset(request.assetId)
    if (!asset) {
      // A stale UI or corrupted request tried to mutate a record that is not in the local library.
      throw new Error('asset_not_found')
    }

    const blockingReferences = listBlockingReferences(request.assetId)
    if (blockingReferences.length > 0 && request.mode === 'safe') {
      return {
        assetId: request.assetId,
        status: 'rejected',
        blockingReferences
      }
    }

    const nextStatus: AssetTrashResponse['status'] = blockingReferences.length > 0 ? 'tombstoned' : 'trashed'
    updateAssetStatus.run(nextStatus, updatedAt, updatedAt, request.assetId)

    return {
      assetId: request.assetId,
      status: nextStatus,
      blockingReferences: []
    }
  })

  const deleteFolderTransaction = db.transaction((request: AssetFolderDeleteRequest, updatedAt: number): AssetFolderDeleteResponse => {
    const folder = selectActiveFolder.get(request.folderId) as AssetFolderRow | undefined
    if (!folder) {
      // Folder deletion must only operate on active folders to avoid double-deleting stale UI selections.
      throw new Error('asset_folder_not_found')
    }

    const folderIds = collectFolderIds(request.folderId)
    const folderIdSet = new Set(folderIds)
    const affectedAssets = (selectActiveAssets.all() as AssetRow[]).filter((row) => row.folder_id !== null && folderIdSet.has(row.folder_id))
    const blockingReferences = affectedAssets.flatMap((asset) => listBlockingReferences(asset.id))

    if (blockingReferences.length > 0 && request.mode === 'safe') {
      return {
        folderId: request.folderId,
        status: 'rejected',
        affectedAssetIds: affectedAssets.map((asset) => asset.id),
        tombstonedAssetIds: [],
        blockingReferences
      }
    }

    const tombstonedAssetIds: string[] = []
    for (const asset of affectedAssets) {
      const references = listBlockingReferences(asset.id)
      const nextStatus: AssetStatus = references.length > 0 ? 'tombstoned' : 'trashed'
      if (nextStatus === 'tombstoned') {
        tombstonedAssetIds.push(asset.id)
      }
      updateAssetStatus.run(nextStatus, updatedAt, updatedAt, asset.id)
    }

    for (const id of folderIds) {
      deleteFolderById.run(updatedAt, updatedAt, id)
    }

    return {
      folderId: request.folderId,
      status: 'deleted',
      affectedAssetIds: affectedAssets.map((asset) => asset.id),
      tombstonedAssetIds,
      blockingReferences: []
    }
  })

  return {
    create(record) {
      insertAsset.run({
        ...record,
        width: record.metadata.width ?? null,
        height: record.metadata.height ?? null,
        durationMs: record.metadata.durationMs ?? null,
        orientation: record.metadata.orientation ?? null,
        mimeType: record.metadata.mimeType ?? null,
        sizeBytes: record.metadata.sizeBytes ?? null,
        hash: record.metadata.hash ?? null,
        folderId: record.folderId ?? null
      })
    },
    getById(id) {
      return findAsset(id)
    },
    list(filter = {}) {
      return (selectActiveAssets.all() as AssetRow[])
        .filter((row) => !('folderId' in filter) || row.folder_id === (filter.folderId ?? null))
        .filter((row) => !filter.mediaType || row.media_type === filter.mediaType)
        .map(mapAsset)
    },
    createFolder(record) {
      insertFolder.run(record)
      return mapFolder(selectActiveFolder.get(record.id) as AssetFolderRow)
    },
    getFolderById(id) {
      const row = selectActiveFolder.get(id) as AssetFolderRow | undefined
      return row ? mapFolder(row) : null
    },
    listFolders() {
      return listActiveFolders()
    },
    moveAsset(request, updatedAt) {
      const result = updateAssetFolder.run(request.folderId, updatedAt, request.assetId)
      if (result.changes === 0) {
        // Moving a missing or already-deleted asset indicates a stale renderer action.
        throw new Error('asset_not_found')
      }

      const moved = findAsset(request.assetId)
      if (!moved) {
        // The update succeeded, so a missing follow-up read would indicate local database corruption.
        throw new Error('asset_not_found')
      }

      return moved
    },
    addReference(record) {
      insertReference.run(record)
    },
    listReferences(assetId) {
      return listBlockingReferences(assetId)
    },
    trashAsset(request, updatedAt) {
      return trashAssetTransaction(request, updatedAt)
    },
    deleteFolder(request, updatedAt) {
      return deleteFolderTransaction(request, updatedAt)
    }
  }
}
