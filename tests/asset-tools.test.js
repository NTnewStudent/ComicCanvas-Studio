import { describe, expect, it } from 'vitest';
import { createAssetTools } from '../desktop/src/main/tools/asset';
import { createToolRuntime } from '../desktop/src/main/tools/runtime';
const actor = { type: 'agent', id: 'asset-tool-test' };
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
describe('asset tools', () => {
    it('declares cloud URL permissions for Agent discovery', () => {
        const tools = createAssetTools({
            assets: { getById: () => asset() },
            cloudUrls: { ensureAssetCloudUrl: async () => null }
        });
        expect(tools.find((tool) => tool.descriptor.id === 'asset.ensureCloudUrl')?.descriptor.permissions.map((permission) => permission.kind).sort()).toEqual([
            'file.read',
            'network'
        ]);
    });
    it('returns a local fallback when cloud storage is not configured', async () => {
        const runtime = createToolRuntime({
            idFactory: () => 'invoke-local-fallback',
            clock: () => 1,
            tools: createAssetTools({
                assets: { getById: () => asset() },
                cloudUrls: { ensureAssetCloudUrl: async () => null }
            })
        });
        const result = await runtime.invoke({
            toolId: 'asset.ensureCloudUrl',
            input: { assetId: 'asset-image-1' },
            actor,
            traceId: 'trace-local-fallback'
        });
        expect(result.record.status).toBe('completed');
        expect(result.output).toEqual({
            assetId: 'asset-image-1',
            url: 'cc-asset://asset/asset-image-1',
            source: 'local',
            action: 'local_fallback'
        });
    });
    it('returns uploaded cloud URL metadata from the shared cloud URL service', async () => {
        const runtime = createToolRuntime({
            idFactory: () => 'invoke-cloud-url',
            clock: () => 1,
            tools: createAssetTools({
                assets: { getById: () => asset() },
                cloudUrls: {
                    async ensureAssetCloudUrl(assetId) {
                        return {
                            asset: asset({ url: 'https://cdn.example.test/media/asset-image-1.png', s3Key: 'assets/asset-image-1.png' }),
                            url: 'https://cdn.example.test/media/asset-image-1.png',
                            source: 'cloud',
                            action: 'uploaded',
                            s3Key: 'assets/asset-image-1.png'
                        };
                    }
                }
            })
        });
        const result = await runtime.invoke({
            toolId: 'asset.ensureCloudUrl',
            input: { assetId: 'asset-image-1' },
            actor,
            traceId: 'trace-cloud-url'
        });
        expect(result.record.status).toBe('completed');
        expect(result.output).toEqual({
            assetId: 'asset-image-1',
            url: 'https://cdn.example.test/media/asset-image-1.png',
            source: 'cloud',
            action: 'uploaded',
            s3Key: 'assets/asset-image-1.png'
        });
    });
    it('returns a stable error when the asset is missing', async () => {
        const runtime = createToolRuntime({
            idFactory: () => 'invoke-missing-asset',
            clock: () => 1,
            tools: createAssetTools({
                assets: { getById: () => null },
                cloudUrls: { ensureAssetCloudUrl: async () => null }
            })
        });
        const result = await runtime.invoke({
            toolId: 'asset.ensureCloudUrl',
            input: { assetId: 'missing-asset' },
            actor,
            traceId: 'trace-missing-asset'
        });
        expect(result.record.status).toBe('failed');
        expect(result.error).toEqual({
            errorClass: 'tool_runtime_failed',
            code: 'asset_not_found',
            message: 'Asset was not found.',
            retryable: false,
            details: { assetId: 'missing-asset' }
        });
    });
});
