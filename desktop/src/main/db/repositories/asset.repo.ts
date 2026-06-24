/**
 * Asset repository boundary for generated and imported media records.
 * @see docs/api-contracts/assets-files.md
 */

import type { Database as BetterSqliteDatabase } from 'better-sqlite3'

import type { AssetMediaType, AssetMetadata, AssetRecord, AssetStatus } from '../../../../../shared/assets'

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
}

export interface AssetRepository {
  create(record: AssetCreateRecord): void
  getById(id: string): AssetRecord | null
}

/**
 * Creates a repository for asset metadata.
 * @param db - Open SQLite database handle.
 * @returns Asset repository API.
 * @throws Error when repository SQL statements cannot be prepared.
 * @see docs/api-contracts/assets-files.md
 */
export function createAssetRepository(db: BetterSqliteDatabase): AssetRepository {
  const insert = db.prepare(`
    INSERT INTO assets (
      id, media_type, status, rel_path, safe_url, width, height, duration_ms, orientation,
      mime_type, size_bytes, hash, folder_id, created_at, updated_at
    ) VALUES (
      @id, @mediaType, @status, @relativePath, @safeUrl, @width, @height, @durationMs, @orientation,
      @mimeType, @sizeBytes, @hash, @folderId, @createdAt, @updatedAt
    )
  `)
  const select = db.prepare('SELECT * FROM assets WHERE id = ?')

  return {
    create(record) {
      insert.run({
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
      const row = select.get(id) as AssetRow | undefined

      if (!row) {
        return null
      }

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

      if (row.folder_id) {
        asset.folderId = row.folder_id
      }

      return asset
    }
  }
}
