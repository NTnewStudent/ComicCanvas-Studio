import type { AssetRecord } from '../../../../../../shared/assets'
import type { CanvasNodeData, NodeType, ReferenceAsset } from '../../../../../../shared/nodes'

export type AssetNodeInsertMode = 'image' | 'character' | 'scene'

export interface AssetNodeInsertionRequest {
  asset: AssetRecord
  mode: AssetNodeInsertMode
  sequence: number
}

export interface AssetNodeInsertion {
  assetId: string
  safeUrl: string
  node: {
    type: Extract<NodeType, 'image' | 'character' | 'scene'>
    data: CanvasNodeData
  }
}

export interface ReferenceAssetPatchRequest {
  currentReferences: ReferenceAsset[]
  asset: AssetRecord
}

export interface ReferenceAssetPatch {
  referenceAssets: ReferenceAsset[]
}

function basename(path: string): string {
  const fileName = path.split(/[\\/]/u).pop() ?? path
  return fileName.replace(/\.[^.]+$/u, '')
}

function assetName(asset: AssetRecord): string {
  return asset.displayName ?? basename(asset.relativePath) ?? asset.id
}

/**
 * Converts one image asset into node data for a canvas insertion mode.
 * @param request - Image asset, target mode, and per-node-type sequence number.
 * @returns Node type/data plus stable asset reference metadata.
 * @throws Error when a non-image asset is inserted as an image semantic node.
 */
export function buildAssetNodeInsertion(request: AssetNodeInsertionRequest): AssetNodeInsertion {
  const { asset, mode, sequence } = request
  if (asset.mediaType !== 'image') {
    // Task 11 only supports categorized image insertion into image/character/scene nodes.
    throw new Error('asset_insert_requires_image')
  }

  const label = assetName(asset) || `${mode} ${sequence}`
  if (mode === 'character') {
    return {
      assetId: asset.id,
      safeUrl: asset.safeUrl,
      node: {
        type: 'character',
        data: {
          label,
          description: '',
          assetId: asset.id,
          url: asset.safeUrl,
          tags: []
        }
      }
    }
  }

  if (mode === 'scene') {
    return {
      assetId: asset.id,
      safeUrl: asset.safeUrl,
      node: {
        type: 'scene',
        data: {
          label,
          description: '',
          assetId: asset.id,
          url: asset.safeUrl,
          category: ''
        }
      }
    }
  }

  return {
    assetId: asset.id,
    safeUrl: asset.safeUrl,
    node: {
      type: 'image',
      data: {
        label,
        promptOverride: '',
        modelId: 'stub-image',
        orientation: asset.metadata.orientation ?? 'landscape',
        assetId: asset.id,
        status: 'done',
        url: asset.safeUrl
      }
    }
  }
}

/**
 * Builds a patch that appends one image asset as a video reference input.
 * Existing references are kept stable and duplicate asset IDs are not appended.
 * @param request - Existing references and the image asset to reference.
 * @returns Video node data patch containing the next reference asset list.
 * @throws Error when a non-image asset is inserted as an image reference.
 */
export function buildReferenceAssetPatch(request: ReferenceAssetPatchRequest): ReferenceAssetPatch {
  const { currentReferences, asset } = request
  if (asset.mediaType !== 'image') {
    // Reference input here means image reference for image-to-video workflows.
    throw new Error('asset_reference_requires_image')
  }
  if (currentReferences.some((reference) => reference.id === asset.id)) {
    return { referenceAssets: currentReferences }
  }

  return {
    referenceAssets: [
      ...currentReferences,
      {
        id: asset.id,
        url: asset.safeUrl,
        type: 'image',
        name: assetName(asset)
      }
    ]
  }
}
