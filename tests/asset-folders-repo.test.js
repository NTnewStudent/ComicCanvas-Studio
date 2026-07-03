import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { migrateDatabaseAtPath, openDatabaseAtPath } from '../desktop/src/main/db/migrate';
import { createAssetRepository } from '../desktop/src/main/db/repositories/asset.repo';
describe('M5 asset folder repository', () => {
    it('creates nested folders, moves assets, and tombstones referenced assets when a parent folder is deleted', () => {
        const tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-asset-folders-'));
        const dbPath = join(tempDir, 'assets.sqlite');
        migrateDatabaseAtPath(dbPath);
        const db = openDatabaseAtPath(dbPath);
        try {
            const assets = createAssetRepository(db);
            const now = 1_783_500_000_000;
            assets.createFolder({
                id: 'folder-scenes',
                name: 'Scenes',
                parentId: null,
                type: 'mixed',
                relativePath: 'scenes',
                createdAt: now,
                updatedAt: now
            });
            assets.createFolder({
                id: 'folder-shots',
                name: 'Shots',
                parentId: 'folder-scenes',
                type: 'image',
                relativePath: 'scenes/shots',
                createdAt: now + 1,
                updatedAt: now + 1
            });
            assets.create({
                id: 'asset-free',
                mediaType: 'image',
                status: 'ready',
                relativePath: 'generated/image/free.png',
                safeUrl: 'cc-asset://asset/asset-free',
                metadata: { width: 1280, height: 720, orientation: 'landscape' },
                folderId: 'folder-shots',
                createdAt: now + 2,
                updatedAt: now + 2
            });
            assets.create({
                id: 'asset-referenced',
                mediaType: 'image',
                status: 'ready',
                relativePath: 'generated/image/referenced.png',
                safeUrl: 'cc-asset://asset/asset-referenced',
                metadata: { width: 1024, height: 1024, orientation: 'square' },
                folderId: 'folder-shots',
                createdAt: now + 3,
                updatedAt: now + 3
            });
            assets.addReference({
                id: 'ref-node-1',
                assetId: 'asset-referenced',
                refType: 'node',
                refId: 'image-node-1',
                createdAt: now + 4
            });
            expect(assets.listFolders()).toEqual([
                expect.objectContaining({ id: 'folder-scenes', parentId: null, name: 'Scenes' }),
                expect.objectContaining({ id: 'folder-shots', parentId: 'folder-scenes', name: 'Shots' })
            ]);
            expect(assets.list({ folderId: 'folder-shots', mediaType: 'image' }).map((asset) => asset.id)).toEqual(['asset-referenced', 'asset-free']);
            expect(assets.moveAsset({ assetId: 'asset-free', folderId: 'folder-scenes' }, now + 5)).toMatchObject({
                id: 'asset-free',
                folderId: 'folder-scenes',
                updatedAt: now + 5
            });
            expect(assets.trashAsset({ assetId: 'asset-referenced', mode: 'safe' }, now + 6)).toEqual({
                assetId: 'asset-referenced',
                status: 'rejected',
                blockingReferences: [{ assetId: 'asset-referenced', refType: 'node', refId: 'image-node-1' }]
            });
            expect(assets.deleteFolder({ folderId: 'folder-scenes', mode: 'force-tombstone' }, now + 7)).toEqual({
                folderId: 'folder-scenes',
                status: 'deleted',
                affectedAssetIds: ['asset-referenced', 'asset-free'],
                tombstonedAssetIds: ['asset-referenced'],
                blockingReferences: []
            });
            expect(assets.getById('asset-free')).toMatchObject({ status: 'trashed' });
            expect(assets.getById('asset-referenced')).toMatchObject({ status: 'tombstoned' });
            expect(assets.listReferences('asset-referenced')).toEqual([{ assetId: 'asset-referenced', refType: 'node', refId: 'image-node-1' }]);
            expect(assets.listFolders()).toEqual([]);
        }
        finally {
            db.close();
            rmSync(tempDir, { recursive: true, force: true });
        }
    });
});
