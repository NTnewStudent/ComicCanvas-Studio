import { describe, expect, it } from 'vitest'

import type { AssetRecord } from '../shared/assets'
import { createWorkflowAssetResolver } from '../desktop/src/main/assets/workflow-asset-resolver'

function asset(overrides: Partial<AssetRecord>): AssetRecord {
  return {
    id: 'asset-1',
    mediaType: 'image',
    status: 'ready',
    relativePath: 'imported/image/asset-1.png',
    safeUrl: 'cc-asset://asset/asset-1',
    metadata: {},
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  }
}

describe('REQ-106 workflow asset URL resolver', () => {
  it('prefers local cc-asset URLs when cloud storage is not configured', async () => {
    const resolver = createWorkflowAssetResolver()

    await expect(resolver.resolveAssetUrl(asset({ url: 'https://r2.example.test/assets/asset-1.png', s3Key: 'assets/asset-1.png' }))).resolves.toEqual({
      url: 'cc-asset://asset/asset-1',
      source: 'local',
    })
  })

  it('refreshes cloud URLs through configured storage and rejects stale foreign hosts', async () => {
    const queries: string[] = []
    const resolver = createWorkflowAssetResolver({
      getStorageConfig: () => ({
        provider: 'r2',
        endpoint: 'https://account.r2.cloudflarestorage.com',
        bucket: 'wenyi',
        accessKeyId: 'ak-test',
        secretAccessKey: 'sk-test',
        publicUrlPrefix: 'https://cdn.example.test/media',
      }),
      createStorageProvider: () => ({
        id: 'r2',
        name: 'R2 test provider',
        upload: async () => 'https://cdn.example.test/media/uploaded.png',
        query: async (key) => {
          queries.push(key)
          return `https://cdn.example.test/media/${key}?sig=fresh`
        },
        rename: async () => 'https://cdn.example.test/media/renamed.png',
        delete: async () => undefined,
        testConnection: async () => true,
      }),
    })

    await expect(
      resolver.resolveAssetUrl(asset({
        url: 'https://evil.example.test/assets/asset-1.png?sig=old',
        s3Key: 'assets/asset-1.png',
      })),
    ).resolves.toEqual({
      url: 'https://cdn.example.test/media/assets/asset-1.png?sig=fresh',
      source: 'cloud',
    })
    expect(queries).toEqual(['assets/asset-1.png'])
  })

  it('falls back to local safeUrl when refreshed cloud URL is outside the allowed storage hosts', async () => {
    const resolver = createWorkflowAssetResolver({
      getStorageConfig: () => ({
        provider: 'r2',
        endpoint: 'https://account.r2.cloudflarestorage.com',
        bucket: 'wenyi',
        accessKeyId: 'ak-test',
        secretAccessKey: 'sk-test',
      }),
      createStorageProvider: () => ({
        id: 'r2',
        name: 'R2 test provider',
        upload: async () => 'https://account.r2.cloudflarestorage.com/wenyi/uploaded.png',
        query: async () => 'https://evil.example.test/assets/asset-1.png?sig=fresh',
        rename: async () => 'https://account.r2.cloudflarestorage.com/wenyi/renamed.png',
        delete: async () => undefined,
        testConnection: async () => true,
      }),
    })

    await expect(resolver.resolveAssetUrl(asset({ url: 'https://account.r2.cloudflarestorage.com/wenyi/assets/asset-1.png', s3Key: 'assets/asset-1.png' }))).resolves.toEqual({
      url: 'cc-asset://asset/asset-1',
      source: 'local',
    })
  })

  it('uploads local assets without s3Key when cloud URL assurance is available', async () => {
    const uploads: string[] = []
    const resolver = createWorkflowAssetResolver({
      getStorageConfig: () => ({
        provider: 'cos',
        endpoint: 'https://cos.ap-shanghai.myqcloud.com',
        bucket: 'comiccanvas',
        accessKeyId: 'ak-test',
        secretAccessKey: 'sk-test',
        publicUrlPrefix: 'https://cdn.example.test/media',
      }),
      createStorageProvider: () => ({
        id: 'cos',
        name: 'COS test provider',
        upload: async () => 'https://cdn.example.test/media/unused.png',
        query: async () => 'https://cdn.example.test/media/unused-query.png',
        rename: async () => 'https://cdn.example.test/media/renamed.png',
        delete: async () => undefined,
        testConnection: async () => true,
      }),
      cloudUrlService: {
        async ensureAssetRecordCloudUrl(input) {
          uploads.push(input.id)
          return {
            asset: { ...input, url: 'https://cdn.example.test/media/assets/asset-1.png', s3Key: 'assets/asset-1.png' },
            url: 'https://cdn.example.test/media/assets/asset-1.png',
            source: 'cloud',
            action: 'uploaded',
            s3Key: 'assets/asset-1.png',
          }
        },
      },
    })

    await expect(resolver.resolveAssetUrl(asset({}))).resolves.toEqual({
      url: 'https://cdn.example.test/media/assets/asset-1.png',
      source: 'cloud',
    })
    expect(uploads).toEqual(['asset-1'])
  })
})
