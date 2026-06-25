import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { migrateDatabaseAtPath, openDatabaseAtPath } from '../desktop/src/main/db/migrate'
import { createAssetRepository } from '../desktop/src/main/db/repositories/asset.repo'
import { registerAssetHandlers } from '../desktop/src/main/ipc/asset.handler'
import type { IpcInvokeChannel } from '../shared/ipc'

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

describe('M5 asset folder IPC', () => {
  it('registers asset folder, move, trash, and delete handlers', () => {
    const { ipcMain, handlers } = createFakeIpcMain()

    registerAssetHandlers(ipcMain)

    expect(Array.from(handlers.keys()).sort()).toEqual([
      'asset.createFolder',
      'asset.deleteFolder',
      'asset.get',
      'asset.getFolders',
      'asset.import',
      'asset.list',
      'asset.move',
      'asset.trash'
    ] satisfies IpcInvokeChannel[])
  })

  it('creates nested folders and keeps referenced assets as tombstones when deleting a parent folder', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-asset-ipc-'))
    const dbPath = join(tempDir, 'assets.sqlite')
    migrateDatabaseAtPath(dbPath)
    const db = openDatabaseAtPath(dbPath)
    const { ipcMain, handlers } = createFakeIpcMain()

    try {
      const assets = createAssetRepository(db)
      let nextId = 0
      registerAssetHandlers(ipcMain, {
        assets,
        clock: () => 1_783_600_000_000 + nextId,
        idFactory: (prefix) => `${prefix}-${(nextId += 1)}`
      })

      const root = await handlers.get('asset.createFolder')?.({}, { name: 'Scenes', parentId: null, type: 'mixed' })
      const child = await handlers.get('asset.createFolder')?.({}, { name: 'Shots', parentId: 'folder-1', type: 'image' })
      expect(root).toMatchObject({ id: 'folder-1', name: 'Scenes', parentId: null, relativePath: 'scenes' })
      expect(child).toMatchObject({ id: 'folder-2', name: 'Shots', parentId: 'folder-1', relativePath: 'scenes/shots' })

      assets.create({
        id: 'asset-frame',
        mediaType: 'image',
        status: 'ready',
        relativePath: 'generated/image/frame.png',
        safeUrl: 'cc-asset://asset/asset-frame',
        metadata: { width: 1280, height: 720, orientation: 'landscape' },
        folderId: 'folder-2',
        createdAt: 1,
        updatedAt: 1
      })
      assets.addReference({ id: 'ref-1', assetId: 'asset-frame', refType: 'node', refId: 'image-1', createdAt: 2 })

      expect(await handlers.get('asset.getFolders')?.({}, {})).toEqual([
        expect.objectContaining({ id: 'folder-1', name: 'Scenes' }),
        expect.objectContaining({ id: 'folder-2', name: 'Shots' })
      ])
      expect(await handlers.get('asset.list')?.({}, { folderId: 'folder-2', mediaType: 'image' })).toEqual([
        expect.objectContaining({ id: 'asset-frame', folderId: 'folder-2' })
      ])
      expect(await handlers.get('asset.move')?.({}, { assetId: 'asset-frame', folderId: 'folder-1' })).toMatchObject({
        id: 'asset-frame',
        folderId: 'folder-1'
      })
      expect(await handlers.get('asset.trash')?.({}, { assetId: 'asset-frame', mode: 'safe' })).toMatchObject({
        assetId: 'asset-frame',
        status: 'rejected',
        blockingReferences: [{ assetId: 'asset-frame', refType: 'node', refId: 'image-1' }]
      })
      expect(await handlers.get('asset.deleteFolder')?.({}, { folderId: 'folder-1', mode: 'force-tombstone' })).toMatchObject({
        folderId: 'folder-1',
        status: 'deleted',
        tombstonedAssetIds: ['asset-frame']
      })
    } finally {
      db.close()
      rmSync(tempDir, { recursive: true, force: true })
    }
  })
})
