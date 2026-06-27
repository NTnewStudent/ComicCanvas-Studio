/**
 * Asset repository boundary for generated and imported media records.
 * @see docs/api-contracts/assets-files.md
 */

import type { Database as BetterSqliteDatabase } from 'better-sqlite3'

import type {
  AssetFolder,
  AssetFolderDeleteRequest,
  AssetFolderDeleteResponse,
  AssetCategory,
  AssetCategoryAssignRequest,
  AssetCategoryCreateRequest,
  AssetCategoryUpdateRequest,
  AssetMediaType,
  AssetMetadata,
  AssetMoveRequest,
  AssetRecord,
  AssetRenameRequest,
  AssetReference,
  AssetStatus,
  AssetTrashRequest,
  AssetTrashResponse
} from '../../../../../shared/assets'
import { decodeJson, encodeJson } from './json'

export interface AssetCreateRecord {
  id: string
  displayName?: string
  mediaType: AssetMediaType
  status: AssetStatus
  relativePath: string
  safeUrl: string
  metadata: AssetMetadata
  /** Cloud URL from S3 upload (optional, set when cloud storage is configured) */
  url?: string
  /** S3 object key (optional, set when cloud storage is configured) */
  s3Key?: string
  folderId?: string
  categoryIds?: string[]
  tags?: string[]
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
  keyword?: string
  categoryId?: string
  tags?: string[]
}

interface AssetRow {
  id: string
  display_name: string | null
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
  url: string | null
  s3_key: string | null
  folder_id: string | null
  tags_json: string
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

interface AssetCategoryAssignmentRow {
  category_id: string
}

interface AssetCategoryRow {
  id: string
  name: string
  slug: string
  kind: AssetCategory['kind']
  description: string | null
  color: string
  icon: string
  sort_order: number
  built_in: number
  enabled: number
  created_at: number
  updated_at: number
  deleted_at: number | null
}

const starterCategories: Array<Pick<AssetCategory, 'id' | 'name' | 'slug' | 'color' | 'icon' | 'sortOrder'>> = [
  { id: 'category-role', name: '角色', slug: 'role', color: '#22c55e', icon: 'user-round', sortOrder: 10 },
  { id: 'category-scene', name: '场景', slug: 'scene', color: '#38bdf8', icon: 'landmark', sortOrder: 20 },
  { id: 'category-prop', name: '道具', slug: 'prop', color: '#f59e0b', icon: 'package', sortOrder: 30 },
  { id: 'category-creature', name: '生物', slug: 'creature', color: '#a78bfa', icon: 'sparkles', sortOrder: 40 }
]

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
  /** Renames an asset display name without changing storage paths. */
  renameAsset(request: AssetRenameRequest, updatedAt: number): AssetRecord
  /** Adds a reference edge from another domain object to an asset. */
  addReference(record: AssetReferenceCreateRecord): void
  /** Lists references that currently block safe destructive actions. */
  listReferences(assetId: string): AssetReference[]
  /** Trashes or tombstones an asset according to reference safety mode. */
  trashAsset(request: AssetTrashRequest, updatedAt: number): AssetTrashResponse
  /** Updates the cloud URL and S3 key for an existing asset. */
  updateUrl(assetId: string, url: string, s3Key: string): void
  /** Deletes a folder tree and safely trashes or tombstones contained assets. */
  deleteFolder(request: AssetFolderDeleteRequest, updatedAt: number): AssetFolderDeleteResponse
  /** Ensures built-in image starter categories exist. */
  ensureStarterCategories(timestamp: number): AssetCategory[]
  /** Lists image asset categories. */
  listCategories(options?: { includeDisabled?: boolean }): AssetCategory[]
  /** Creates a user-defined image asset category. */
  createCategory(request: AssetCategoryCreateRequest, timestamp: number, idFactory: () => string): AssetCategory
  /** Updates an image asset category. */
  updateCategory(request: AssetCategoryUpdateRequest, timestamp: number): AssetCategory
  /** Assigns an asset to one category. */
  assignCategory(request: AssetCategoryAssignRequest, timestamp: number): void
  /** Removes one asset/category assignment. */
  removeCategory(request: AssetCategoryAssignRequest): void
  /** Lists category IDs assigned to an asset. */
  listAssetCategoryIds(assetId: string): string[]
}

function safeTags(value: string): string[] {
  const decoded = decodeJson<unknown>(value)
  return Array.isArray(decoded) ? decoded.filter((item): item is string => typeof item === 'string') : []
}

function mapAsset(row: AssetRow, categoryIds: string[] = []): AssetRecord {
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

  if (row.display_name !== null) asset.displayName = row.display_name
  if (row.url !== null) asset.url = row.url
  if (row.s3_key !== null) asset.s3Key = row.s3_key
  const tags = safeTags(row.tags_json)
  if (tags.length > 0) asset.tags = tags
  if (categoryIds.length > 0) asset.categoryIds = categoryIds
  if (row.folder_id !== null) {
    asset.folderId = row.folder_id
  }

  return asset
}

function mapCategory(row: AssetCategoryRow): AssetCategory {
  const category: AssetCategory = {
    id: row.id,
    name: row.name,
    slug: row.slug,
    kind: row.kind,
    color: row.color,
    icon: row.icon,
    sortOrder: row.sort_order,
    builtIn: Boolean(row.built_in),
    enabled: Boolean(row.enabled),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }

  if (row.description !== null) category.description = row.description
  if (row.deleted_at !== null) category.deletedAt = row.deleted_at
  return category
}

function slugifyCategoryName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, '-')
    .replace(/^-+|-+$/gu, '')

  return slug || 'category'
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
      id, display_name, media_type, status, rel_path, safe_url, width, height, duration_ms, orientation,
      mime_type, size_bytes, hash, url, s3_key, folder_id, tags_json, created_at, updated_at
    ) VALUES (
      @id, @displayName, @mediaType, @status, @relativePath, @safeUrl, @width, @height, @durationMs, @orientation,
      @mimeType, @sizeBytes, @hash, @url, @s3Key, @folderId, @tagsJson, @createdAt, @updatedAt
    )
  `)
  const selectAsset = db.prepare('SELECT * FROM assets WHERE id = ?')
  const selectActiveAssets = db.prepare(`
    SELECT * FROM assets
    WHERE deleted_at IS NULL
      AND status NOT IN ('trashed', 'tombstoned')
    ORDER BY created_at DESC, id ASC
  `)
  const updateAssetFolder = db.prepare('UPDATE assets SET folder_id = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL')
  const updateAssetDisplayName = db.prepare('UPDATE assets SET display_name = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL')
  const updateAssetStatus = db.prepare('UPDATE assets SET status = ?, updated_at = ?, deleted_at = ? WHERE id = ?')
  const updateAssetUrl = db.prepare('UPDATE assets SET url = ?, s3_key = ? WHERE id = ?')
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
  const upsertCategory = db.prepare(`
    INSERT INTO asset_categories (
      id, name, slug, kind, description, color, icon, sort_order, built_in, enabled, created_at, updated_at
    ) VALUES (
      @id, @name, @slug, @kind, @description, @color, @icon, @sortOrder, @builtIn, @enabled, @createdAt, @updatedAt
    )
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      slug = excluded.slug,
      kind = excluded.kind,
      description = excluded.description,
      color = excluded.color,
      icon = excluded.icon,
      sort_order = excluded.sort_order,
      built_in = excluded.built_in,
      enabled = excluded.enabled,
      updated_at = excluded.updated_at,
      deleted_at = NULL
  `)
  const selectCategory = db.prepare('SELECT * FROM asset_categories WHERE id = ? AND deleted_at IS NULL')
  const selectCategories = db.prepare('SELECT * FROM asset_categories WHERE deleted_at IS NULL ORDER BY sort_order ASC, name ASC, id ASC')
  const updateCategoryRow = db.prepare(`
    UPDATE asset_categories SET
      name = COALESCE(@name, name),
      description = @description,
      color = COALESCE(@color, color),
      icon = COALESCE(@icon, icon),
      sort_order = COALESCE(@sortOrder, sort_order),
      enabled = COALESCE(@enabled, enabled),
      updated_at = @updatedAt
    WHERE id = @categoryId AND deleted_at IS NULL
  `)
  const insertCategoryAssignment = db.prepare(`
    INSERT OR IGNORE INTO asset_category_assignments (asset_id, category_id, created_at)
    VALUES (@assetId, @categoryId, @createdAt)
  `)
  const deleteCategoryAssignment = db.prepare('DELETE FROM asset_category_assignments WHERE asset_id = ? AND category_id = ?')
  const selectAssetCategoryIds = db.prepare('SELECT category_id FROM asset_category_assignments WHERE asset_id = ? ORDER BY created_at ASC, category_id ASC')

  function findAsset(id: string): AssetRecord | null {
    const row = selectAsset.get(id) as AssetRow | undefined
    return row ? mapAsset(row, listCategoryIds(id)) : null
  }

  function listCategoryIds(assetId: string): string[] {
    return (selectAssetCategoryIds.all(assetId) as AssetCategoryAssignmentRow[]).map((row) => row.category_id)
  }

  function listActiveFolders(): AssetFolder[] {
    return (selectActiveFolders.all() as AssetFolderRow[]).map(mapFolder)
  }

  function listBlockingReferences(assetId: string): AssetReference[] {
    return (selectReferences.all(assetId) as AssetReferenceRow[]).map(mapReference)
  }

  function findCategory(categoryId: string): AssetCategory {
    const row = selectCategory.get(categoryId) as AssetCategoryRow | undefined
    if (!row) {
      // Category mutations must target active categories so assignments remain meaningful.
      throw new Error('asset_category_not_found')
    }

    return mapCategory(row)
  }

  const createAssetTransaction = db.transaction((record: AssetCreateRecord): void => {
    insertAsset.run({
      ...record,
      displayName: record.displayName ?? null,
      width: record.metadata.width ?? null,
      height: record.metadata.height ?? null,
      durationMs: record.metadata.durationMs ?? null,
      orientation: record.metadata.orientation ?? null,
      mimeType: record.metadata.mimeType ?? null,
      sizeBytes: record.metadata.sizeBytes ?? null,
      hash: record.metadata.hash ?? null,
      url: record.url ?? null,
      s3Key: record.s3Key ?? null,
      folderId: record.folderId ?? null,
      tagsJson: encodeJson(record.tags ?? [])
    })

    for (const categoryId of record.categoryIds ?? []) {
      insertCategoryAssignment.run({ assetId: record.id, categoryId, createdAt: record.createdAt })
    }
  })

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
      createAssetTransaction(record)
    },
    getById(id) {
      return findAsset(id)
    },
    list(filter = {}) {
      const keyword = filter.keyword?.trim().toLowerCase()
      const requiredTags = new Set(filter.tags ?? [])
      return (selectActiveAssets.all() as AssetRow[])
        .filter((row) => !('folderId' in filter) || row.folder_id === (filter.folderId ?? null))
        .filter((row) => !filter.mediaType || row.media_type === filter.mediaType)
        .filter((row) => !keyword || row.rel_path.toLowerCase().includes(keyword) || row.display_name?.toLowerCase().includes(keyword))
        .map((row) => mapAsset(row, listCategoryIds(row.id)))
        .filter((asset) => !filter.categoryId || asset.categoryIds?.includes(filter.categoryId))
        .filter((asset) => requiredTags.size === 0 || [...requiredTags].every((tag) => asset.tags?.includes(tag)))
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
    renameAsset(request, updatedAt) {
      const displayName = request.displayName.trim()
      if (!displayName) {
        // Asset display names must remain non-empty so previews and search stay stable.
        throw new Error('asset_display_name_required')
      }

      const result = updateAssetDisplayName.run(displayName, updatedAt, request.assetId)
      if (result.changes === 0) {
        // Renaming a missing or already-deleted asset indicates a stale renderer action.
        throw new Error('asset_not_found')
      }

      const renamed = findAsset(request.assetId)
      if (!renamed) {
        // The update succeeded, so a missing follow-up read would indicate local database corruption.
        throw new Error('asset_not_found')
      }

      return renamed
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
    updateUrl(assetId, url, s3Key) {
      updateAssetUrl.run(url, s3Key, assetId)
    },
    deleteFolder(request, updatedAt) {
      return deleteFolderTransaction(request, updatedAt)
    },
    ensureStarterCategories(timestamp) {
      for (const category of starterCategories) {
        upsertCategory.run({
          id: category.id,
          name: category.name,
          slug: category.slug,
          kind: 'image',
          description: null,
          color: category.color,
          icon: category.icon,
          sortOrder: category.sortOrder,
          builtIn: 1,
          enabled: 1,
          createdAt: timestamp,
          updatedAt: timestamp
        })
      }

      return this.listCategories({ includeDisabled: true })
    },
    listCategories(options = {}) {
      return (selectCategories.all() as AssetCategoryRow[])
        .map(mapCategory)
        .filter((category) => options.includeDisabled || category.enabled)
    },
    createCategory(request, timestamp, idFactory) {
      const name = request.name.trim()
      if (!name) {
        // Category creation requires a stable display name for filtering and review rows.
        throw new Error('asset_category_name_required')
      }

      const id = idFactory()
      const slugBase = slugifyCategoryName(name)
      upsertCategory.run({
        id,
        name,
        slug: `${slugBase}-${id}`,
        kind: 'image',
        description: request.description ?? null,
        color: request.color ?? '#22c55e',
        icon: request.icon ?? 'image',
        sortOrder: request.sortOrder ?? 100,
        builtIn: 0,
        enabled: 1,
        createdAt: timestamp,
        updatedAt: timestamp
      })

      return findCategory(id)
    },
    updateCategory(request, timestamp) {
      const existing = findCategory(request.categoryId)
      const result = updateCategoryRow.run({
        categoryId: request.categoryId,
        name: request.name?.trim() || null,
        description: 'description' in request ? request.description : (existing.description ?? null),
        color: request.color ?? null,
        icon: request.icon ?? null,
        sortOrder: request.sortOrder ?? null,
        enabled: request.enabled === undefined ? null : request.enabled ? 1 : 0,
        updatedAt: timestamp
      })

      if (result.changes === 0) {
        // If the category vanished between read and update, surface a stable domain error.
        throw new Error('asset_category_not_found')
      }

      return findCategory(request.categoryId)
    },
    assignCategory(request, timestamp) {
      if (!findAsset(request.assetId)) {
        // Assignment cannot target a missing asset because later safe delete depends on the relation.
        throw new Error('asset_not_found')
      }
      findCategory(request.categoryId)
      insertCategoryAssignment.run({ assetId: request.assetId, categoryId: request.categoryId, createdAt: timestamp })
    },
    removeCategory(request) {
      deleteCategoryAssignment.run(request.assetId, request.categoryId)
    },
    listAssetCategoryIds(assetId) {
      return listCategoryIds(assetId)
    }
  }
}
