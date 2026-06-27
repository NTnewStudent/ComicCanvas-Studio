/**
 * Local asset and file-library contracts shared across ComicCanvas surfaces.
 * @see docs/api-contracts/assets-files.md
 */

import type { Orientation } from './nodes'

export type AssetMediaType = 'image' | 'video' | 'audio' | 'text' | 'document' | 'other'

export type AssetStatus = 'pending' | 'ready' | 'failed' | 'trashed' | 'tombstoned'

export type AssetFolderType = 'image' | 'video' | 'mixed'

export type AssetCategoryKind = 'image'

export interface AssetMetadata {
  width?: number
  height?: number
  durationMs?: number
  orientation?: Orientation
  mimeType?: string
  sizeBytes?: number
  hash?: string
}

export interface AssetRecord {
  id: string
  displayName?: string
  mediaType: AssetMediaType
  status: AssetStatus
  relativePath: string
  safeUrl: string
  metadata: AssetMetadata
  /** Cloud URL (primary access address, set when uploaded to S3) */
  url?: string
  /** S3 object key (for delete/management, set when uploaded to S3) */
  s3Key?: string
  folderId?: string
  categoryIds?: string[]
  tags?: string[]
  createdAt: number
  updatedAt: number
}

export interface AssetRef {
  assetId: string
  mediaType: AssetMediaType
}

/** Percentage crop rectangle used by image edit intents. */
export interface ImageCropRect {
  /** Left offset as a 0-100 percentage of source width. */
  x: number
  /** Top offset as a 0-100 percentage of source height. */
  y: number
  /** Crop width as a 0-100 percentage of source width. */
  width: number
  /** Crop height as a 0-100 percentage of source height. */
  height: number
}

/** Structured image edit request emitted by renderer UI and later consumed by media tools. */
export interface ImageEditIntent {
  /** Canvas node whose image is being edited. */
  nodeId: string
  /** Source asset selected for editing. */
  assetId: string
  /** Safe renderer URL used for preview only. */
  safeUrl: string
  /** Percentage crop rectangle. */
  crop: ImageCropRect
  /** Clockwise rotation in degrees. */
  rotationDeg: 0 | 90 | 180 | 270
  /** Target orientation after applying the edit. */
  orientation: Orientation
  /** Whether the edit should update only the node binding or derive/update the asset record. */
  applyTarget: 'node' | 'asset'
}

export interface AssetReference {
  assetId: string
  refType: 'node' | 'job' | 'chatMessage' | 'knowledgeDocument' | 'category'
  refId: string
}

export interface AssetCategory {
  id: string
  name: string
  slug: string
  kind: AssetCategoryKind
  description?: string
  color: string
  icon: string
  sortOrder: number
  builtIn: boolean
  enabled: boolean
  createdAt: number
  updatedAt: number
  deletedAt?: number
}

export interface AssetFolder {
  id: string
  name: string
  parentId: string | null
  type: AssetFolderType
  relativePath: string
  createdAt: number
  updatedAt?: number
  deletedAt?: number
}

export interface AssetImportRequest {
  sourcePath: string
  folderId?: string
  mediaType: AssetMediaType
  categoryIds?: string[]
  tags?: string[]
}

export interface AssetListRequest {
  folderId?: string | null
  mediaType?: AssetMediaType
  keyword?: string
  categoryId?: string
  tags?: string[]
}

export interface AssetMoveRequest {
  assetId: string
  folderId: string | null
}

export interface AssetRenameRequest {
  assetId: string
  displayName: string
}

export interface AssetTrashRequest {
  assetId: string
  mode: 'safe' | 'force-tombstone'
}

export interface AssetTrashResponse {
  assetId: string
  status: 'trashed' | 'tombstoned' | 'rejected'
  blockingReferences: AssetReference[]
}

export interface AssetFolderCreateRequest {
  name: string
  parentId: string | null
  type: AssetFolderType
}

export interface AssetCategoryCreateRequest {
  name: string
  description?: string
  color?: string
  icon?: string
  sortOrder?: number
}

export interface AssetCategoryUpdateRequest {
  categoryId: string
  name?: string
  description?: string | null
  color?: string
  icon?: string
  sortOrder?: number
  enabled?: boolean
}

export interface AssetCategoryAssignRequest {
  assetId: string
  categoryId: string
}

export interface AssetFolderDeleteRequest {
  folderId: string
  mode: 'safe' | 'force-tombstone'
}

export interface AssetFolderDeleteResponse {
  folderId: string
  status: 'deleted' | 'rejected'
  affectedAssetIds: string[]
  tombstonedAssetIds: string[]
  blockingReferences: AssetReference[]
}
