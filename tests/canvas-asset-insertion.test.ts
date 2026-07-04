import { describe, expect, it } from 'vitest'

import {
  buildAssetNodeInsertion,
  buildReferenceAssetPatch,
  type AssetNodeInsertMode
} from '../desktop/src/renderer/src/canvas/lib/asset-node-insertion'
import type { AssetRecord } from '../shared/assets'

const categorizedImage: AssetRecord = {
  id: 'asset-character',
  mediaType: 'image',
  status: 'ready',
  relativePath: 'imported/image/hero.png',
  safeUrl: 'cc-asset://asset/asset-character',
  metadata: { width: 1024, height: 1024, orientation: 'square' },
  displayName: '主角参考',
  categoryIds: ['category-role'],
  createdAt: 1,
  updatedAt: 1
}

describe('canvas asset node insertion', () => {
  it.each<AssetNodeInsertMode>(['image', 'character', 'scene'])(
    'maps categorized image assets into %s canvas nodes without duplicating the asset',
    (mode) => {
      const insertion = buildAssetNodeInsertion({
        asset: categorizedImage,
        mode,
        sequence: 2
      })

      expect(insertion.assetId).toBe('asset-character')
      expect(insertion.safeUrl).toBe('cc-asset://asset/asset-character')
      expect(insertion.node.type).toBe(mode)
      expect(insertion.node.data).toMatchObject({
        label: '主角参考',
        assetId: 'asset-character',
        url: 'cc-asset://asset/asset-character'
      })
    }
  )

  it('maps categorized image assets into reference input patches for video nodes', () => {
    expect(
      buildReferenceAssetPatch({
        currentReferences: [{ id: 'asset-existing', url: 'cc-asset://asset/asset-existing', type: 'image', name: 'Existing' }],
        asset: categorizedImage
      })
    ).toEqual({
      referenceAssets: [
        { id: 'asset-existing', url: 'cc-asset://asset/asset-existing', type: 'image', name: 'Existing' },
        { id: 'asset-character', url: 'cc-asset://asset/asset-character', type: 'image', name: '主角参考' }
      ]
    })
  })
})
