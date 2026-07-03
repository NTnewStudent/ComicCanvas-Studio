import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { migrateDatabaseAtPath, openDatabaseAtPath } from '../desktop/src/main/db/migrate';
import { createAssetRepository } from '../desktop/src/main/db/repositories/asset.repo';
import { syncCanvasAssetReferences } from '../desktop/src/main/assets/asset-reference-sync';
function createAsset(assets, id, createdAt) {
    assets.create({
        id,
        mediaType: 'image',
        status: 'ready',
        relativePath: `generated/image/${id}.png`,
        safeUrl: `cc-asset://asset/${id}`,
        metadata: { width: 512, height: 512, orientation: 'square' },
        createdAt,
        updatedAt: createdAt
    });
}
const graph = {
    nodes: [
        {
            id: 'character-node',
            type: 'character',
            position: { x: 0, y: 0 },
            data: { label: 'Hero', description: '', assetId: 'asset-character', url: 'cc-asset://asset/asset-character', tags: [] }
        },
        {
            id: 'video-node',
            type: 'videoConfigV2',
            position: { x: 320, y: 0 },
            data: {
                label: 'Video',
                promptOverride: '',
                modelId: 'stub-video',
                orientation: 'landscape',
                durationSeconds: 3,
                firstFrameAssetId: null,
                lastFrameAssetId: null,
                assetId: null,
                status: 'idle',
                referenceAssets: [{ id: 'asset-reference', url: 'cc-asset://asset/asset-reference', type: 'image', name: 'Ref' }]
            }
        }
    ],
    edges: [],
    viewport: { x: 0, y: 0, zoom: 1 }
};
const completedJob = {
    id: 'job-image',
    type: 'canvas.generateImage',
    status: 'completed',
    targetId: 'image-node',
    progress: 100,
    result: { kind: 'asset', assetId: 'asset-generated' },
    createdAt: 10,
    updatedAt: 20
};
describe('Phase A asset reference sync', () => {
    it('writes canvas node and completed job asset references so safe delete is blocked', () => {
        const tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-asset-ref-sync-'));
        const dbPath = join(tempDir, 'asset-ref-sync.sqlite');
        migrateDatabaseAtPath(dbPath);
        const db = openDatabaseAtPath(dbPath);
        try {
            const assets = createAssetRepository(db);
            createAsset(assets, 'asset-character', 1);
            createAsset(assets, 'asset-reference', 2);
            createAsset(assets, 'asset-generated', 3);
            const report = syncCanvasAssetReferences({
                assets,
                graph,
                jobs: [completedJob],
                clock: () => 1_784_000_000_000,
                idFactory: (index) => `ref-sync-${index}`
            });
            expect(report).toEqual({ inserted: 3, skipped: 0 });
            expect(assets.trashAsset({ assetId: 'asset-character', mode: 'safe' }, 30)).toMatchObject({
                status: 'rejected',
                blockingReferences: [{ assetId: 'asset-character', refType: 'node', refId: 'character-node' }]
            });
            expect(assets.trashAsset({ assetId: 'asset-reference', mode: 'safe' }, 31)).toMatchObject({
                status: 'rejected',
                blockingReferences: [{ assetId: 'asset-reference', refType: 'node', refId: 'video-node' }]
            });
            expect(assets.trashAsset({ assetId: 'asset-generated', mode: 'safe' }, 32)).toMatchObject({
                status: 'rejected',
                blockingReferences: [{ assetId: 'asset-generated', refType: 'job', refId: 'job-image' }]
            });
        }
        finally {
            db.close();
            rmSync(tempDir, { recursive: true, force: true });
        }
    });
});
