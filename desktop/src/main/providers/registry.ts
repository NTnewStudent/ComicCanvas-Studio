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
  set(id: string, provider: GatewayProvider): void
  invoke(id: string, request: GatewayRequest, context?: GatewayProviderContext): Promise<GatewayResult>
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
    async invoke(id, request, context) {
      const provider = providers.get(id)

      if (!provider) {
        throw new GatewayProviderError({ errorClass: 'gateway_not_found', message: `Gateway ${id} is not registered`, retryable: false })
      }

      if (!provider.capabilities.includes(request.channel) || provider.modelKeys[request.channel] !== request.modelKey) {
        throw new GatewayProviderError({
          errorClass: 'capability_unsupported',
          message: `Gateway ${id} does not support ${request.channel}:${request.modelKey}`,
          retryable: false
        })
      }

      return provider.invoke(request, context)
    }
  }
}
