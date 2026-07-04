/**
 * Cloud URL assurance for local assets used by provider runtime payloads.
 * @see docs/api-contracts/assets-files.md
 * @see docs/api-contracts/storage-config.md
 */

import { randomUUID } from 'node:crypto'
import { extname, join } from 'node:path'

import type { AssetRecord } from '../../../../shared/assets'
import type { AssetRepository } from '../db/repositories/asset.repo'
import type { StorageConfig } from '../storage/storage-config'
import type { StorageProvider } from '../storage/storage-provider'

export interface EnsureAssetCloudUrlResult {
  asset: AssetRecord
  url: string
  source: 'cloud'
  action: 'queried' | 'uploaded'
  s3Key: string
}

export interface AssetCloudUrlServiceOptions {
  assetRoot: string
  assets: Pick<AssetRepository, 'getById' | 'updateUrl'>
  getStorageConfig: () => StorageConfig | null
  createStorageProvider: (config: StorageConfig) => StorageProvider
}

export interface AssetCloudUrlService {
  ensureAssetCloudUrl(assetId: string): Promise<EnsureAssetCloudUrlResult | null>
  ensureAssetRecordCloudUrl(asset: AssetRecord): Promise<EnsureAssetCloudUrlResult | null>
}

function inferExtension(asset: AssetRecord): string {
  const fromPath = extname(asset.relativePath)
  if (fromPath) return fromPath
  if (asset.metadata.mimeType === 'image/png') return '.png'
  if (asset.metadata.mimeType === 'image/jpeg') return '.jpg'
  if (asset.metadata.mimeType === 'image/webp') return '.webp'
  if (asset.metadata.mimeType === 'video/mp4') return '.mp4'
  if (asset.metadata.mimeType === 'audio/mpeg') return '.mp3'
  return '.bin'
}

function createObjectKey(asset: AssetRecord): string {
  const month = new Date().toISOString().slice(0, 7)
  return `assets/${asset.mediaType}/${month}/${asset.id}-${randomUUID()}${inferExtension(asset)}`
}

/**
 * Creates a service that uploads local assets to configured S3-compatible storage when needed.
 * @param options - Asset repository, asset root, storage config, and provider factory.
 * @returns Cloud URL assurance service.
 * @throws Error never intentionally during construction; service methods return null when storage is unconfigured.
 * @see docs/api-contracts/assets-files.md
 */
export function createAssetCloudUrlService(options: AssetCloudUrlServiceOptions): AssetCloudUrlService {
  async function ensureAssetRecordCloudUrl(asset: AssetRecord): Promise<EnsureAssetCloudUrlResult | null> {
    const config = options.getStorageConfig()
    if (!config) {
      return null
    }

    const provider = options.createStorageProvider(config)

    if (asset.s3Key) {
      const url = await provider.query(asset.s3Key)
      return { asset, url, source: 'cloud', action: 'queried', s3Key: asset.s3Key }
    }

    const s3Key = createObjectKey(asset)
    const localPath = join(options.assetRoot, asset.relativePath)
    const url = await provider.upload(localPath, s3Key)
    options.assets.updateUrl(asset.id, url, s3Key)
    const updated = options.assets.getById(asset.id) ?? { ...asset, url, s3Key }

    return { asset: updated, url, source: 'cloud', action: 'uploaded', s3Key }
  }

  return {
    async ensureAssetCloudUrl(assetId) {
      const asset = options.assets.getById(assetId)
      if (!asset) {
        return null
      }

      return ensureAssetRecordCloudUrl(asset)
    },
    ensureAssetRecordCloudUrl
  }
}
