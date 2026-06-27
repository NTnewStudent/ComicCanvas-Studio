import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { migrateDatabaseAtPath, openDatabaseAtPath } from '../desktop/src/main/db/migrate'
import { createAssetRepository } from '../desktop/src/main/db/repositories/asset.repo'
import { registerAssetHandlers } from '../desktop/src/main/ipc/asset.handler'

type Handler = (_event: unknown, request: unknown) => unknown

interface FakeIpcMain {
  handle(channel: string, handler: Handler): void
}

function createFakeIpcMain(): { ipcMain: FakeIpcMain; handlers: Map<string, Handler> } {
  const handlers = new Map<string, Handler>()

  return {
    handlers,
    ipcMain: {
      handle(channel, handler) {
        handlers.set(channel, handler)
      }
    }
  }
}

describe('Phase A asset category IPC', () => {
  it('lists starter categories and assigns imported assets to custom categories', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-asset-category-ipc-'))
    const dbPath = join(tempDir, 'assets.sqlite')
    migrateDatabaseAtPath(dbPath)
    const db = openDatabaseAtPath(dbPath)
    const { ipcMain, handlers } = createFakeIpcMain()

    try {
      const assets = createAssetRepository(db)
      let nextId = 0
      registerAssetHandlers(ipcMain, {
        assets,
        clock: () => 1_783_900_000_000 + nextId,
        idFactory: (prefix) => `${prefix}-${(nextId += 1)}`
      })

      expect(await handlers.get('asset.getCategories')?.({}, {})).toEqual([
        expect.objectContaining({ id: 'category-role', name: '角色', builtIn: true }),
        expect.objectContaining({ id: 'category-scene', name: '场景', builtIn: true }),
        expect.objectContaining({ id: 'category-prop', name: '道具', builtIn: true }),
        expect.objectContaining({ id: 'category-creature', name: '生物', builtIn: true })
      ])

      const custom = await handlers.get('asset.createCategory')?.({}, {
        name: '主角图',
        color: '#15803d',
        icon: 'user-round',
        sortOrder: 5
      })
      expect(custom).toMatchObject({ id: 'category-1', name: '主角图', builtIn: false })

      assets.create({
        id: 'asset-1',
        mediaType: 'image',
        status: 'ready',
        relativePath: 'imported/image/asset-1.png',
        safeUrl: 'cc-asset://asset/asset-1',
        metadata: { width: 512, height: 512, orientation: 'square' },
        tags: ['hero'],
        createdAt: 1,
        updatedAt: 1
      })

      expect(await handlers.get('asset.assignCategory')?.({}, { assetId: 'asset-1', categoryId: 'category-1' })).toEqual({
        assetId: 'asset-1',
        categoryId: 'category-1',
        assigned: true
      })
      expect(await handlers.get('asset.list')?.({}, { categoryId: 'category-1', tags: ['hero'] })).toEqual([
        expect.objectContaining({ id: 'asset-1', categoryIds: ['category-1'], tags: ['hero'] })
      ])
      expect(await handlers.get('asset.updateCategory')?.({}, { categoryId: 'category-1', enabled: false })).toMatchObject({
        id: 'category-1',
        enabled: false
      })
      expect(await handlers.get('asset.removeCategory')?.({}, { assetId: 'asset-1', categoryId: 'category-1' })).toEqual({
        assetId: 'asset-1',
        categoryId: 'category-1',
        removed: true
      })
    } finally {
      db.close()
      rmSync(tempDir, { recursive: true, force: true })
    }
  })
})
