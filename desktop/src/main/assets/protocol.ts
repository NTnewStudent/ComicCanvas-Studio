/**
 * Safe asset protocol path resolution.
 * @see docs/api-contracts/assets-files.md
 */

import { isAbsolute, normalize, resolve, sep } from 'node:path'

import type { AssetRecord } from '../../../../shared/assets'

function containsTraversal(relativePath: string): boolean {
  return normalize(relativePath).split(/[\\/]+/u).includes('..')
}

/**
 * Resolves a renderer-safe asset record to a filesystem path under the asset root.
 * @param assetRoot - App-controlled asset storage root.
 * @param asset - Asset record containing a relative path.
 * @returns Absolute filesystem path inside the asset root.
 * @throws Error when the asset path is absolute, traverses upward, or escapes the asset root.
 * @see docs/api-contracts/assets-files.md
 */
export function resolveAssetProtocolPath(assetRoot: string, asset: AssetRecord): string {
  if (isAbsolute(asset.relativePath) || containsTraversal(asset.relativePath)) {
    throw new Error('asset_path_traversal')
  }

  const root = resolve(assetRoot)
  const target = resolve(root, asset.relativePath)

  if (target !== root && !target.startsWith(`${root}${sep}`)) {
    throw new Error('asset_path_traversal')
  }

  return target
}
