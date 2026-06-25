/**
 * Local asset and file-library contracts shared across ComicCanvas surfaces.
 * @see docs/api-contracts/assets-files.md
 */

import type { Orientation } from './nodes'

export type AssetMediaType = 'image' | 'video' | 'text' | 'document' | 'other'

export type AssetStatus = 'pending' | 'ready' | 'failed' | 'trashed' | 'tombstoned'

export type AssetFolderType = 'image' | 'video' | 'mixed'

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
  createdAt: number
  updatedAt: number
}

export interface AssetRef {
  assetId: string
  mediaType: AssetMediaType
}

export interface AssetReference {
  assetId: string
  refType: 'node' | 'job' | 'chatMessage' | 'knowledgeDocument'
  refId: string
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
}

export interface AssetMoveRequest {
  assetId: string
  folderId: string | null
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
