import type { AssetRecord } from '../../../../../shared/assets'

/**
 * Returns the display URL that renderer surfaces must use for an asset.
 * Uploaded cloud assets are cloud-only: once an S3 key exists, local safe URLs
 * are not used as a display fallback.
 */
export function assetDisplayUrl(asset: AssetRecord): string {
  if (asset.s3Key) return asset.url ?? ''
  return asset.safeUrl
}
