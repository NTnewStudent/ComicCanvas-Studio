/**
 * Generated asset persistence pipeline.
 * @see docs/api-contracts/assets-files.md
 */

import { createHash, randomUUID } from 'node:crypto'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

import type { AssetMediaType, AssetMetadata, AssetRecord } from '../../../../shared/assets'
import type { Orientation } from '../../../../shared/nodes'
import type { AssetRepository } from '../db/repositories/asset.repo'
import { resolveAssetProtocolPath } from './protocol'

export interface SaveGeneratedBytesInput {
  mediaType: Extract<AssetMediaType, 'image' | 'video'>
  bytes: Uint8Array
  metadata: AssetMetadata
}

export interface AssetPipelineOptions {
  assetRoot: string
  assets: AssetRepository
  idFactory?: () => string
  clock?: () => number
}

export interface AssetPipeline {
  saveGeneratedBytes(input: SaveGeneratedBytesInput): AssetRecord
}

function mimeExtension(mimeType: string | undefined, mediaType: SaveGeneratedBytesInput['mediaType']): string {
  if (mimeType === 'image/jpeg') return '.jpg'
  if (mimeType === 'image/webp') return '.webp'
  if (mimeType === 'video/mp4') return '.mp4'
  if (mimeType === 'image/png') return '.png'

  return mediaType === 'video' ? '.mp4' : '.png'
}

function normalizeRelativePath(parts: string[]): string {
  return parts.join('/')
}

/**
 * Classifies media dimensions into the shared orientation enum.
 * @param width - Positive integer media width.
 * @param height - Positive integer media height.
 * @returns Orientation derived from width and height.
 * @throws Error when dimensions are missing, non-finite, or non-positive.
 * @see docs/api-contracts/assets-files.md
 */
export function classifyOrientation(width: number, height: number): Orientation {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error('asset_metadata_invalid')
  }

  if (width > height) return 'landscape'
  if (width < height) return 'portrait'
  return 'square'
}

/**
 * Creates the local asset pipeline that saves bytes and repository metadata atomically enough for M1.
 * @param options - Asset root, repository, ID factory, and clock dependencies.
 * @returns Asset pipeline API.
 * @throws Error when metadata is invalid or the asset root cannot be written.
 * @see docs/api-contracts/assets-files.md
 */
export function createAssetPipeline(options: AssetPipelineOptions): AssetPipeline {
  const idFactory = options.idFactory ?? randomUUID
  const clock = options.clock ?? Date.now

  return {
    saveGeneratedBytes(input) {
      const width = input.metadata.width
      const height = input.metadata.height

      if (width === undefined || height === undefined) {
        throw new Error('asset_metadata_invalid')
      }

      const orientation = classifyOrientation(width, height)
      const hash = createHash('md5').update(input.bytes).digest('hex')
      const id = idFactory()
      const createdAt = clock()
      const extension = mimeExtension(input.metadata.mimeType, input.mediaType)
      const relativePath = normalizeRelativePath([
        'generated',
        input.mediaType,
        hash.slice(0, 2),
        hash.slice(2),
        `generated-${input.mediaType}-${id}${extension}`
      ])
      const record: AssetRecord = {
        id,
        mediaType: input.mediaType,
        status: 'ready',
        relativePath,
        safeUrl: `cc-asset://asset/${id}`,
        metadata: {
          ...input.metadata,
          orientation,
          sizeBytes: input.bytes.byteLength,
          hash
        },
        createdAt,
        updatedAt: createdAt
      }
      const targetPath = resolveAssetProtocolPath(options.assetRoot, record)

      mkdirSync(dirname(targetPath), { recursive: true })
      writeFileSync(targetPath, input.bytes)
      options.assets.create(record)

      return record
    }
  }
}
