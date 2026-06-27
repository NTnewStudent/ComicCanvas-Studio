/**
 * Built-in asset tools for cloud URL preparation and runtime asset access.
 * @see docs/api-contracts/assets-files.md
 * @see docs/api-contracts/tools-plugins.md
 */

import { z } from 'zod'

import type { AssetRepository } from '../../db/repositories/asset.repo'
import type { AssetCloudUrlService } from '../../assets/asset-cloud-url'
import { defineTool, ToolExecutionError, type ToolDefinition } from '../runtime'
import type { ToolDescriptor, ToolPermission } from '../../../../../shared/tools'

export interface AssetToolsOptions {
  assets: Pick<AssetRepository, 'getById'>
  cloudUrls: Pick<AssetCloudUrlService, 'ensureAssetCloudUrl'>
}

const fileReadPermission: ToolPermission = { kind: 'file.read', reason: 'Reads the local asset file before cloud upload.' }
const networkPermission: ToolPermission = { kind: 'network', reason: 'Uploads or refreshes access through configured cloud storage.' }

function descriptor(input: Omit<ToolDescriptor, 'category' | 'owner' | 'enabled'>): ToolDescriptor {
  return {
    ...input,
    category: 'asset',
    owner: { kind: 'builtin', id: 'core' },
    enabled: true
  }
}

const ensureCloudUrlOutputSchema = z.object({
  assetId: z.string(),
  url: z.string(),
  source: z.enum(['cloud', 'local']),
  action: z.enum(['uploaded', 'queried', 'local_fallback']),
  s3Key: z.string().optional()
})

/**
 * Creates asset tools used by Agents and plugins.
 * @param options - Asset repository and cloud URL assurance service.
 * @returns Tool definitions for asset/cloud preparation.
 * @throws Error never intentionally during construction; invocation returns safe tool errors.
 * @see docs/api-contracts/assets-files.md
 */
export function createAssetTools(options: AssetToolsOptions): ToolDefinition<unknown, unknown>[] {
  return [
    defineTool({
      descriptor: descriptor({
        id: 'asset.ensureCloudUrl',
        name: 'Ensure Asset Cloud URL',
        description: 'Uploads a local asset to configured COS/S3-compatible storage when needed, or refreshes its signed cloud URL.',
        inputSchemaRef: 'asset.ensureCloudUrl.input',
        outputSchemaRef: 'asset.ensureCloudUrl.output',
        permissions: [fileReadPermission, networkPermission],
        concurrency: 'serial-write'
      }),
      inputSchema: z.object({ assetId: z.string().min(1) }),
      outputSchema: ensureCloudUrlOutputSchema,
      renderToolUseMessage: (input) => `Ensure cloud URL for ${input.assetId}`,
      async call(input) {
        const asset = options.assets.getById(input.assetId)
        if (!asset) {
          throw new ToolExecutionError({
            code: 'asset_not_found',
            message: 'Asset was not found.',
            details: { assetId: input.assetId }
          })
        }

        const ensured = await options.cloudUrls.ensureAssetCloudUrl(input.assetId)
        if (!ensured) {
          return {
            assetId: asset.id,
            url: asset.safeUrl,
            source: 'local' as const,
            action: 'local_fallback' as const
          }
        }

        return {
          assetId: asset.id,
          url: ensured.url,
          source: ensured.source,
          action: ensured.action,
          s3Key: ensured.s3Key
        }
      }
    })
  ]
}
