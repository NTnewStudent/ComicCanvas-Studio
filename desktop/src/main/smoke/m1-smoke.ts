/**
 * M1 smoke-path glue for image-node generation through local services.
 * @see docs/api-contracts/jobs.md
 * @see docs/api-contracts/gateway-providers.md
 * @see docs/api-contracts/assets-files.md
 */

import type { GatewayReference, GatewayRequest } from '../../../../shared/gateway'
import type { JobResult } from '../../../../shared/jobs'
import type { PersistedJobRecord } from '../db/repositories/job.repo'
import type { AssetPipeline } from '../assets/pipeline'
import type { GatewayRegistry } from '../providers/registry'
import { uploadGeneratedAssetToCloud } from '../jobs/upload-result'
import type { AssetRepository } from '../db/repositories/asset.repo'

export interface ImageNodeSmokePathInput {
  job: PersistedJobRecord
  gateways: GatewayRegistry
  assets: AssetPipeline
  gatewayId: string
  /** Asset repository for S3 upload URL updates. */
  assetRepo?: AssetRepository
  /** Asset root directory for resolving local file paths. */
  assetRoot?: string
}

function readStringPayload(job: PersistedJobRecord, key: string, fallback: string): string {
  const value = job.payload[key]
  return typeof value === 'string' ? value : fallback
}

function readParameters(job: PersistedJobRecord): Record<string, unknown> {
  const value = job.payload.parameters
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {}
}

/**
 * Reconstructs GatewayReference[] from the serialized job payload.
 * The canvas handler serializes references as plain objects in the payload;
 * this function restores them to the GatewayReference shape for the provider.
 */
function readReferences(job: PersistedJobRecord): GatewayReference[] {
  const raw = job.payload.references
  if (!Array.isArray(raw)) {
    return []
  }

  const result: GatewayReference[] = []
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue
    const ref = item as Record<string, unknown>
    const assetId = typeof ref.assetId === 'string' ? ref.assetId : ''
    const url = typeof ref.url === 'string' ? ref.url : ''
    const mediaType = typeof ref.mediaType === 'string' ? ref.mediaType : 'image'
    const role = typeof ref.role === 'string' ? ref.role : undefined

    if (!assetId) continue

    const gatewayRef: GatewayReference = {
      assetId,
      mediaType: mediaType as GatewayReference['mediaType'],
      url
    }
    if (role === 'first_frame' || role === 'last_frame' || role === 'reference' || role === 'style') {
      gatewayRef.role = role
    }
    result.push(gatewayRef)
  }

  return result
}

/**
 * Runs the M1 image generation smoke path against injected local services.
 * @param input - Job, gateway, asset pipeline, and selected gateway ID.
 * @returns Job result referencing the persisted generated asset.
 * @throws Error when the provider does not return image bytes or asset persistence fails.
 * @see docs/api-contracts/jobs.md
 */
export async function runImageNodeSmokePath(input: ImageNodeSmokePathInput): Promise<JobResult> {
  const references = readReferences(input.job)

  const request: GatewayRequest = {
    channel: 'image',
    modelKey: readStringPayload(input.job, 'modelKey', 'stub-image'),
    prompt: readStringPayload(input.job, 'prompt', ''),
    references,
    parameters: readParameters(input.job),
    idempotencyKey: input.job.id
  }
  const gatewayResult = await input.gateways.invoke(input.gatewayId, request)

  if (gatewayResult.kind !== 'assetBytes' || gatewayResult.mediaType !== 'image') {
    throw new Error('provider_payload_invalid')
  }

  const asset = input.assets.saveGeneratedBytes({
    mediaType: 'image',
    bytes: gatewayResult.bytes,
    metadata: gatewayResult.metadata
  })

  // Upload generated asset to S3 if storage is configured (backward-compatible: no-op if not)
  let cloudUrl: string | undefined
  if (input.assetRepo && input.assetRoot) {
    cloudUrl = await uploadGeneratedAssetToCloud(asset, input.assetRoot, input.assetRepo)
  }

  return {
    kind: 'asset',
    assetId: asset.id,
    metadata: {
      safeUrl: asset.safeUrl,
      orientation: asset.metadata.orientation,
      ...(cloudUrl ? { cloudUrl } : {})
    }
  }
}
