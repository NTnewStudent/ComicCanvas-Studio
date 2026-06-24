/**
 * Provider gateway contracts for normalized text, image, and video generation.
 * @see docs/api-contracts/gateway-providers.md
 */

import type { AssetRef, AssetMediaType, AssetMetadata } from './assets'

export type GatewayType = 'openai_compat' | 'async_media_task' | 'stub'

export type GatewayChannel = 'text' | 'image' | 'video'

export type GatewayCapability = GatewayChannel | 'image.edit' | 'video.firstFrame' | 'video.lastFrame'

export interface GatewayModelMap {
  text?: string
  image?: string
  video?: string
}

export interface GatewayConfigView {
  id: string
  name: string
  type: GatewayType
  baseUrl: string
  capabilities: GatewayCapability[]
  modelMap: GatewayModelMap
  enabled: boolean
  keyRef: string
}

export type GatewayAuthInput =
  | { mode: 'none' }
  | { mode: 'apiKey'; secret: string }
  | { mode: 'existingRef'; keyRef: string }

export interface GatewayConfigInput {
  id?: string
  name: string
  type: GatewayType
  baseUrl: string
  auth: GatewayAuthInput
  capabilities: GatewayCapability[]
  modelMap: GatewayModelMap
  enabled: boolean
}

export interface GatewayReference extends AssetRef {
  role?: 'reference' | 'first_frame' | 'last_frame'
}

export interface GatewayRequest {
  channel: GatewayChannel
  modelKey: string
  prompt: string
  references: GatewayReference[]
  parameters: Record<string, unknown>
  idempotencyKey: string
}

export interface GatewayUsage {
  inputTokens?: number
  outputTokens?: number
  providerCostUnits?: number
}

export interface GatewayMediaMetadata extends AssetMetadata {
  mediaType: Extract<AssetMediaType, 'image' | 'video'>
}

export type GatewayResult =
  | { kind: 'text'; text: string; usage?: GatewayUsage }
  | { kind: 'assetBytes'; mediaType: 'image' | 'video'; bytes: Uint8Array; metadata: GatewayMediaMetadata }
  | { kind: 'remoteTask'; remoteTaskId: string; pollAfterMs: number }

export interface GatewayError {
  errorClass:
    | 'gateway_not_found'
    | 'gateway_secret_unavailable'
    | 'capability_unsupported'
    | 'provider_request_failed'
    | 'provider_timeout'
    | 'provider_canceled'
    | 'provider_payload_invalid'
  message: string
  retryable: boolean
}
