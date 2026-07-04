import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createAssetCloudUrlService } from '../desktop/src/main/assets/asset-cloud-url';
function asset(overrides = {}) {
    return {
        id: 'asset-image-1',
        mediaType: 'image',
        status: 'ready',
        relativePath: 'generated/image/asset-image-1.png',
        safeUrl: 'cc-asset://asset/asset-image-1',
        metadata: { mimeType: 'image/png' },
        createdAt: 1,
        updatedAt: 1,
        ...overrides
    };
}
describe('asset cloud URL service', () => {
    it('returns null without storage config to preserve local-only mode', async () => {
        const service = createAssetCloudUrlService({
            assetRoot: '/unused',
            assets: {
                getById: () => asset(),
                updateUrl() {
                    throw new Error('should_not_update');
                }
            },
            getStorageConfig: () => null,
            createStorageProvider() {
                throw new Error('should_not_create_provider');
            }
        });
        await expect(service.ensureAssetCloudUrl('asset-image-1')).resolves.toBeNull();
    });
    it('queries existing cloud object keys without uploading', async () => {
        const service = createAssetCloudUrlService({
            assetRoot: '/unused',
            assets: {
                getById: () => asset({ s3Key: 'assets/existing.png' }),
                updateUrl() {
                    throw new Error('should_not_update_existing_key');
                }
            },
            getStorageConfig: () => ({
                provider: 'cos',
                endpoint: 'https://cos.ap-shanghai.myqcloud.com',
                bucket: 'comiccanvas',
                accessKeyId: 'ak-test',
                secretAccessKey: 'sk-test',
                publicUrlPrefix: 'https://cdn.example.test/media'
            }),
            createStorageProvider: () => ({
                id: 'cos',
                name: 'COS test provider',
                upload() {
                    throw new Error('should_not_upload_existing_key');
                },
                query: async (key) => `https://cdn.example.test/media/${key}?sig=fresh`,
                rename: async () => 'https://cdn.example.test/media/renamed.png',
                delete: async () => undefined,
                testConnection: async () => true
            })
        });
        await expect(service.ensureAssetCloudUrl('asset-image-1')).resolves.toMatchObject({
            url: 'https://cdn.example.test/media/assets/existing.png?sig=fresh',
            action: 'queried',
            s3Key: 'assets/existing.png'
        });
    });
    it('uploads local asset files and persists the returned cloud metadata', async () => {
        const tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-cloud-url-'));
        const assetRoot = join(tempDir, 'assets');
        const localAsset = asset();
        const localPath = join(assetRoot, localAsset.relativePath);
        mkdirSync(dirname(localPath), { recursive: true });
        writeFileSync(localPath, 'png-bytes');
        const uploadedPaths = [];
        const persisted = [];
        try {
            const service = createAssetCloudUrlService({
                assetRoot,
                assets: {
                    getById: (assetId) => {
                        const updated = persisted.find((entry) => entry.assetId === assetId);
                        return updated ? asset({ url: updated.url, s3Key: updated.s3Key }) : localAsset;
                    },
                    updateUrl(assetId, url, s3Key) {
                        persisted.push({ assetId, url, s3Key });
                    }
                },
                getStorageConfig: () => ({
                    provider: 'cos',
                    endpoint: 'https://cos.ap-shanghai.myqcloud.com',
                    bucket: 'comiccanvas',
                    accessKeyId: 'ak-test',
                    secretAccessKey: 'sk-test',
                    publicUrlPrefix: 'https://cdn.example.test/media'
                }),
                createStorageProvider: () => ({
                    id: 'cos',
                    name: 'COS test provider',
                    upload: async (filePath, key) => {
                        uploadedPaths.push(filePath);
                        return `https://cdn.example.test/media/${key}`;
                    },
                    query: async (key) => `https://cdn.example.test/media/${key}?sig=fresh`,
                    rename: async () => 'https://cdn.example.test/media/renamed.png',
                    delete: async () => undefined,
                    testConnection: async () => true
                })
            });
            const result = await service.ensureAssetCloudUrl(localAsset.id);
            expect(uploadedPaths).toEqual([localPath]);
            expect(result).toMatchObject({
                url: expect.stringContaining('https://cdn.example.test/media/assets/image/'),
                action: 'uploaded',
                source: 'cloud'
            });
            expect(persisted).toEqual([
                {
                    assetId: localAsset.id,
                    url: result?.url,
                    s3Key: result?.s3Key
                }
            ]);
        }
        finally {
            rmSync(tempDir, { recursive: true, force: true });
        }
    });
});
