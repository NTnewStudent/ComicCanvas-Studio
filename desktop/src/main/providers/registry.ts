/**
 * Gateway provider registry with capability preflight.
 * @see docs/api-contracts/gateway-providers.md
 */

import type { GatewayError, GatewayRequest, GatewayResult } from '../../../../shared/gateway'
import type { GatewayProvider, GatewayProviderContext } from './stub.provider'

export class GatewayProviderError extends Error implements GatewayError {
  readonly errorClass: GatewayError['errorClass']
  readonly retryable: boolean

  /**
   * Creates a provider registry error that preserves the shared GatewayError envelope fields.
   * @param error - Shared gateway error payload.
   * @throws Error never intentionally; construction only stores payload fields.
   * @see docs/api-contracts/gateway-providers.md
   */
  constructor(error: GatewayError) {
    super(error.message)
    this.name = 'GatewayProviderError'
    this.errorClass = error.errorClass
    this.retryable = error.retryable
  }
}

export interface GatewayRegistry {
  /**
   * Registers or replaces one provider for future invocations.
   * @param id - Gateway ID used by jobs and gateway settings.
   * @param provider - Provider handle to use for future invocations.
   * @returns void.
   * @see docs/api-contracts/gateway-providers.md
   */
  set(id: string, provider: GatewayProvider): void
  /**
   * Hot-reloads provider handles for future invocations.
   * @param providers - Provider handles rebuilt from the latest gateway configuration.
   * @returns Gateway IDs replaced in the registry.
   * @see docs/api-contracts/gateway-providers.md
   */
  reload(providers: GatewayProvider[]): { reloadedGatewayIds: string[] }
  /**
   * Invokes the currently registered provider while retaining that provider for the call lifetime.
   * @param id - Gateway ID selected by the job or tool call.
   * @param request - Normalized gateway request.
   * @param context - Optional worker cancellation/progress context.
   * @returns Normalized provider result.
   * @throws GatewayProviderError when the provider is missing or cannot serve the requested channel/model.
   * @see docs/api-contracts/gateway-providers.md
   */
  invoke(id: string, request: GatewayRequest, context?: GatewayProviderContext): Promise<GatewayResult>
}

function resolveModelKey(provider: GatewayProvider, request: GatewayRequest): string {
  return request.modelKey.length > 0 ? request.modelKey : provider.modelKeys[request.channel]
}

/**
 * Creates an in-memory gateway registry for provider lookup and preflight checks.
 * @returns Gateway registry API.
 * @throws GatewayError when a provider is missing or cannot serve the requested channel/model.
 * @see docs/api-contracts/gateway-providers.md
 */
export function createGatewayRegistry(): GatewayRegistry {
  const providers = new Map<string, GatewayProvider>()

  return {
    set(id, provider) {
      providers.set(id, provider)
    },
    reload(nextProviders) {
      const reloadedGatewayIds = nextProviders.map((provider) => {
        providers.set(provider.id, provider)
        return provider.id
      })

      return { reloadedGatewayIds }
    },
    async invoke(id, request, context) {
      const provider = providers.get(id)

      if (!provider) {
        throw new GatewayProviderError({ errorClass: 'gateway_not_found', message: `Gateway ${id} is not registered`, retryable: false })
      }

      const modelKey = resolveModelKey(provider, request)

      if (!provider.capabilities.includes(request.channel) || modelKey.length === 0 || provider.modelKeys[request.channel] !== modelKey) {
        throw new GatewayProviderError({
          errorClass: 'capability_unsupported',
          message: `Gateway ${id} does not support ${request.channel}:${modelKey}`,
          retryable: false
        })
      }

      return provider.invoke({ ...request, modelKey }, context)
    }
  }
}
