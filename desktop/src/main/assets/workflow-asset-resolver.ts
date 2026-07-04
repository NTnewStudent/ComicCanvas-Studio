/**
 * Runtime asset URL resolution for workflow execution payloads.
 * @see docs/api-contracts/assets-files.md
 */

import type { AssetRecord } from '../../../../shared/assets'
import type { StorageConfig } from '../storage/storage-config'
import type { StorageProvider } from '../storage/storage-provider'
import type { AssetCloudUrlService } from './asset-cloud-url'

export interface WorkflowResolvedAssetUrl {
  url: string
  source: 'local' | 'cloud'
}

export interface WorkflowAssetResolver {
  /** Resolves the URL that runtime providers may use for an asset reference. */
  resolveAssetUrl(asset: AssetRecord): Promise<WorkflowResolvedAssetUrl>
}

export interface WorkflowAssetResolverOptions {
  getStorageConfig?: () => StorageConfig | null
  createStorageProvider?: (config: StorageConfig) => StorageProvider
  cloudUrlService?: Pick<AssetCloudUrlService, 'ensureAssetRecordCloudUrl'>
}

function localSafeUrl(asset: AssetRecord): string {
  return asset.safeUrl.startsWith('cc-asset://asset/')
    ? asset.safeUrl
    : `cc-asset://asset/${asset.id}`
}

function hostnameOf(value: string | undefined): string | null {
  if (!value) return null
  try {
    return new URL(value).hostname
  } catch {
    return null
  }
}

function allowedCloudHosts(config: StorageConfig): Set<string> {
  const hosts = new Set<string>()
  const endpointHost = hostnameOf(config.endpoint)
  const publicHost = hostnameOf(config.publicUrlPrefix)
  if (endpointHost) hosts.add(endpointHost)
  if (publicHost) hosts.add(publicHost)
  return hosts
}

function isAllowedCloudUrl(url: string, config: StorageConfig): boolean {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }

  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return false
  }

  return allowedCloudHosts(config).has(parsed.hostname)
}

/**
 * Creates the workflow asset resolver used by canvas run dispatch.
 * @param options - Optional storage configuration/provider hooks.
 * @returns Resolver that prefers local safe URLs unless cloud refresh is configured and host-guarded.
 * @see docs/api-contracts/assets-files.md
 */
export function createWorkflowAssetResolver(options: WorkflowAssetResolverOptions = {}): WorkflowAssetResolver {
  return {
    async resolveAssetUrl(asset) {
      const fallback = { url: localSafeUrl(asset), source: 'local' as const }
      const config = options.getStorageConfig?.() ?? null
      if (!config) {
        return fallback
      }

      try {
        const refreshed = asset.s3Key && options.createStorageProvider
          ? await options.createStorageProvider(config).query(asset.s3Key)
          : (await options.cloudUrlService?.ensureAssetRecordCloudUrl(asset))?.url

        if (!refreshed) {
          return fallback
        }

        if (!isAllowedCloudUrl(refreshed, config)) {
          return fallback
        }

        return { url: refreshed, source: 'cloud' }
      } catch {
        return fallback
      }
    },
  }
}
