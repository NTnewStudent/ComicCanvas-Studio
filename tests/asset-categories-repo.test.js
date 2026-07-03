import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { migrateDatabaseAtPath, openDatabaseAtPath } from '../desktop/src/main/db/migrate';
import { createAssetRepository } from '../desktop/src/main/db/repositories/asset.repo';
describe('Phase A asset category repository', () => {
    it('creates starter categories, custom categories, assignments, tags, and filtered lists', () => {
        const tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-asset-categories-'));
        const dbPath = join(tempDir, 'assets.sqlite');
        migrateDatabaseAtPath(dbPath);
        const db = openDatabaseAtPath(dbPath);
        try {
            const assets = createAssetRepository(db);
            const now = 1_783_800_000_000;
            expect(assets.ensureStarterCategories(now).map((category) => category.slug)).toEqual([
                'role',
                'scene',
                'prop',
                'creature'
            ]);
            const category = assets.createCategory({
                name: '主角参考',
                description: 'Reusable hero images',
                color: '#16a34a',
                icon: 'user-round',
                sortOrder: 50
            }, now + 1, () => 'category-hero');
            assets.create({
                id: 'asset-hero',
                mediaType: 'image',
                status: 'ready',
                relativePath: 'imported/image/hero.png',
                safeUrl: 'cc-asset://asset/asset-hero',
                metadata: { width: 800, height: 800, orientation: 'square', mimeType: 'image/png' },
                categoryIds: [category.id, 'category-role'],
                tags: ['hero', 'green-coat'],
                createdAt: now + 2,
                updatedAt: now + 2
            });
            assets.assignCategory({ assetId: 'asset-hero', categoryId: 'category-scene' }, now + 3);
            expect(assets.getById('asset-hero')).toMatchObject({
                id: 'asset-hero',
                categoryIds: ['category-hero', 'category-role', 'category-scene'],
                tags: ['hero', 'green-coat']
            });
            expect(assets.list({ categoryId: 'category-role' }).map((asset) => asset.id)).toEqual(['asset-hero']);
            expect(assets.list({ tags: ['hero'] }).map((asset) => asset.id)).toEqual(['asset-hero']);
            expect(assets.updateCategory({ categoryId: category.id, enabled: false }, now + 4)).toMatchObject({
                id: 'category-hero',
                enabled: false
            });
            expect(assets.listCategories()).not.toEqual(expect.arrayContaining([expect.objectContaining({ id: 'category-hero' })]));
            expect(assets.listCategories({ includeDisabled: true })).toEqual(expect.arrayContaining([expect.objectContaining({ id: 'category-hero' })]));
            assets.removeCategory({ assetId: 'asset-hero', categoryId: 'category-scene' });
            expect(assets.listAssetCategoryIds('asset-hero')).toEqual(['category-hero', 'category-role']);
        }
        finally {
            db.close();
            rmSync(tempDir, { recursive: true, force: true });
        }
    });
});
