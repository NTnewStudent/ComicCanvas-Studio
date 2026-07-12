/**
 * Gateway config hot-reload adapter.
 * @see docs/api-contracts/gateway-providers.md
 */

import type { GatewayConfigView } from '../../../../shared/gateway'
import { createAsyncMediaProvider } from './async-media.provider'
import { createCreativeMediaProvider } from './creative-media.provider'
import { createOpenAICompatibleProvider } from './openai-compatible.provider'
import type { GatewayRegistry } from './registry'
import { createStubProvider, type GatewayProvider } from './stub.provider'

export interface GatewayConfigReloaderOptions {
  /** Registry updated with rebuilt providers. */
  registry: GatewayRegistry
  /** Secret resolver used for provider configs that reference encrypted API keys. */
  resolveSecret?: (keyRef: string) => string
  /** Optional fetch implementation for tests and custom runtimes. */
  fetchImpl?: typeof fetch
}

export interface GatewayConfigReloader {
  reload(configs: GatewayConfigView[]): { reloadedGatewayIds: string[] }
}

function providerFromConfig(config: GatewayConfigView, options: GatewayConfigReloaderOptions): GatewayProvider {
  if (config.type === 'stub') {
    return createStubProvider({ id: config.id, modelKeys: config.modelMap })
  }

  const apiKey = options.resolveSecret?.(config.keyRef) ?? ''

  if (config.type === 'async_media_task') {
    return createAsyncMediaProvider({
      id: config.id,
      baseUrl: config.baseUrl,
      apiKey,
      modelKeys: config.modelMap,
      ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {})
    })
  }

  if (config.type === 'creative_media') {
    return createCreativeMediaProvider({
      id: config.id,
      baseUrl: config.baseUrl,
      apiKey,
      routes: config.modelRoutes ?? [],
      ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {})
    })
  }

  return createOpenAICompatibleProvider({
    id: config.id,
    baseUrl: config.baseUrl,
    apiKey,
    modelKeys: config.modelMap,
    ...(options.fetchImpl ? { fetchImpl: options.fetchImpl } : {})
  })
}

/**
 * Creates a hot-reloader that rebuilds provider handles from gateway config views.
 * @param options - Registry plus optional secret and fetch dependencies.
 * @returns Gateway config reloader.
 * @throws GatewayProviderError when provider construction dependencies are unavailable during later invocation.
 * @see docs/api-contracts/gateway-providers.md
 */
export function createGatewayConfigReloader(options: GatewayConfigReloaderOptions): GatewayConfigReloader {
  return {
    reload(configs) {
      const providers = configs.filter((config) => config.enabled).map((config) => providerFromConfig(config, options))
      return options.registry.reload(providers)
    }
  }
}
