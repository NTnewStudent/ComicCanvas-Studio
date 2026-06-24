/**
 * M1 smoke-path glue for image-node generation through local services.
 * @see docs/api-contracts/jobs.md
 * @see docs/api-contracts/gateway-providers.md
 * @see docs/api-contracts/assets-files.md
 */

import type { GatewayRequest } from '../../../../shared/gateway'
import type { JobResult } from '../../../../shared/jobs'
import type { PersistedJobRecord } from '../db/repositories/job.repo'
import type { AssetPipeline } from '../assets/pipeline'
import type { GatewayRegistry } from '../providers/registry'

export interface ImageNodeSmokePathInput {
  job: PersistedJobRecord
  gateways: GatewayRegistry
  assets: AssetPipeline
  gatewayId: string
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
 * Runs the M1 image generation smoke path against injected local services.
 * @param input - Job, gateway, asset pipeline, and selected gateway ID.
 * @returns Job result referencing the persisted generated asset.
 * @throws Error when the provider does not return image bytes or asset persistence fails.
 * @see docs/api-contracts/jobs.md
 */
export async function runImageNodeSmokePath(input: ImageNodeSmokePathInput): Promise<JobResult> {
  const request: GatewayRequest = {
    channel: 'image',
    modelKey: readStringPayload(input.job, 'modelKey', 'stub-image'),
    prompt: readStringPayload(input.job, 'prompt', ''),
    references: [],
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

  return {
    kind: 'asset',
    assetId: asset.id,
    metadata: {
      safeUrl: asset.safeUrl,
      orientation: asset.metadata.orientation
    }
  }
}
