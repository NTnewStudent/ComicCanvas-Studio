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

/** Request used by settings UI to fetch OpenAI-compatible model IDs. */
export interface GatewayFetchModelsRequest {
  /** Existing gateway ID whose saved base URL should be used when `baseUrl` is omitted. */
  gatewayId?: string
  /** OpenAI-compatible base URL, usually ending in `/v1`. */
  baseUrl?: string
  /** Optional auth material supplied by the settings form. */
  auth?: GatewayAuthInput
}

/** Renderer-safe model list fetched from a gateway's OpenAI-compatible `/models` endpoint. */
export interface GatewayFetchedModel {
  /** Provider model identifier, for example `gpt-4.1-mini`. */
  id: string
  /** Optional provider owner metadata from OpenAI-compatible responses. */
  ownedBy?: string
  /** Optional provider creation timestamp from OpenAI-compatible responses. */
  created?: number
}

/** Response returned by `gateway.fetchModels`. */
export interface GatewayFetchModelsResponse {
  /** Existing gateway ID when the request targeted a saved gateway. */
  gatewayId?: string
  /** Sorted unique model records safe for renderer display. */
  models: GatewayFetchedModel[]
}

export interface GatewayReference extends AssetRef {
  role?: 'reference' | 'first_frame' | 'last_frame' | 'style'
  /** Cloud URL (set when asset was imported/uploaded to S3; fallback to local safeUrl when no cloud) */
  url: string
}

/** OpenAI-compatible tool call emitted by a chat completion. */
export interface GatewayToolCall {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

/** OpenAI-compatible tool definition for chat completions. */
export interface GatewayToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

/** Multi-turn chat message for native tool-calling gateways. */
export interface GatewayChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content?: string | null
  tool_calls?: GatewayToolCall[]
  tool_call_id?: string
  name?: string
}

export interface GatewayRequest {
  channel: GatewayChannel
  modelKey: string
  prompt: string
  references: GatewayReference[]
  parameters: Record<string, unknown>
  idempotencyKey: string
  /** When set for text channel, replaces the single-user `prompt` message. */
  messages?: GatewayChatMessage[]
  /** Native OpenAI-compatible tools for the completion request. */
  tools?: GatewayToolDefinition[]
  toolChoice?: 'auto' | 'none' | { type: 'function'; function: { name: string } }
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
  | { kind: 'text'; text: string; toolCalls?: GatewayToolCall[]; usage?: GatewayUsage }
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
