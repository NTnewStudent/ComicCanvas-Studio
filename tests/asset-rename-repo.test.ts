import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { migrateDatabaseAtPath, openDatabaseAtPath } from '../desktop/src/main/db/migrate'
import { createAssetRepository } from '../desktop/src/main/db/repositories/asset.repo'

describe('Phase A asset rename repository', () => {
  it('renames the asset display name without changing storage paths or safe URLs', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-asset-rename-'))
    const dbPath = join(tempDir, 'assets.sqlite')
    migrateDatabaseAtPath(dbPath)
    const db = openDatabaseAtPath(dbPath)

    try {
      const assets = createAssetRepository(db)
      const now = 1_784_000_000_000

      assets.create({
        id: 'asset-hero',
        mediaType: 'image',
        status: 'ready',
        relativePath: 'imported/image/asset-hero.png',
        safeUrl: 'cc-asset://asset/asset-hero',
        metadata: { width: 512, height: 512, orientation: 'square' },
        createdAt: now,
        updatedAt: now
      })

      expect(assets.renameAsset({ assetId: 'asset-hero', displayName: '主角定稿' }, now + 1)).toMatchObject({
        id: 'asset-hero',
        displayName: '主角定稿',
        relativePath: 'imported/image/asset-hero.png',
        safeUrl: 'cc-asset://asset/asset-hero',
        updatedAt: now + 1
      })
      expect(assets.getById('asset-hero')).toMatchObject({
        displayName: '主角定稿',
        relativePath: 'imported/image/asset-hero.png',
        safeUrl: 'cc-asset://asset/asset-hero'
      })
    } finally {
      db.close()
      rmSync(tempDir, { recursive: true, force: true })
    }
  })
})
