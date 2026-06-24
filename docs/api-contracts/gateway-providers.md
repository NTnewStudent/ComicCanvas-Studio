# Gateway Providers Contract

## Owner

- Primary: tooling-agent
- Supporting: orchestrator-agent, pm-agent
- Shared source: `shared/gateway.ts`, `shared/assets.ts`

## Scope

This contract covers provider configuration, capability validation, normalized text/image/video requests, OpenAI-compatible protocols, async media task protocols, hot reload, and secret handling.

Non-goals:

- No provider-specific payloads in CanvasPlan.
- No plaintext API keys in DB, logs, LTM, traces, or renderer responses.
- No provider temporary URLs as final asset references.

## Request/Response Contracts

### `gateway.save`

Request:

```ts
interface GatewayConfigInput {
  id?: string
  name: string
  type: GatewayType
  baseUrl: string
  auth: GatewayAuthInput
  capabilities: GatewayCapability[]
  modelMap: GatewayModelMap
  enabled: boolean
}
```

Response:

```ts
interface GatewayConfigView {
  id: string
  name: string
  type: GatewayType
  baseUrl: string
  capabilities: GatewayCapability[]
  modelMap: GatewayModelMap
  enabled: boolean
  keyRef: string
}
```

### `gateway.invoke`

Internal service request:

```ts
interface GatewayRequest {
  channel: 'text' | 'image' | 'video'
  modelKey: string
  prompt: string
  references: GatewayReference[]
  parameters: Record<string, unknown>
  idempotencyKey: string
}
```

Response:

```ts
type GatewayResult =
  | { kind: 'text'; text: string; usage?: GatewayUsage }
  | { kind: 'assetBytes'; mediaType: 'image' | 'video'; bytes: Uint8Array; metadata: GatewayMediaMetadata }
  | { kind: 'remoteTask'; remoteTaskId: string; pollAfterMs: number }
```

Rules:

- Initial adapters SHALL include OpenAI-compatible text/chat and image-style requests.
- Async media providers SHALL use submit, poll/get status, fetch bytes, normalize result.
- Async media polling SHALL accept a worker-side invocation context with cancellation checks and progress callbacks. Cancellation SHALL raise `provider_canceled` before additional remote work is submitted or polled.
- Gateway results SHALL be normalized before JobWorker or AssetService consumes them.

## Errors

| Error class | Meaning |
| :--- | :--- |
| `gateway_not_found` | Configured gateway ID does not exist or is disabled. |
| `gateway_secret_unavailable` | Secret reference cannot be decrypted. |
| `capability_unsupported` | Requested channel/model is not supported. |
| `provider_request_failed` | Remote provider rejected or failed the request. |
| `provider_timeout` | Timeout policy elapsed. |
| `provider_canceled` | Worker-side cancellation was requested before the provider reached a terminal result. |
| `provider_payload_invalid` | Provider response cannot be normalized. |

## Permissions

- Saving gateways requires settings write permission.
- Invoking paid or external-networked providers requires gateway/tool policy approval.
- API keys SHALL be stored through OS/Electron safe storage or equivalent encrypted local vault.

## Tests

- Unit: capability checks reject unsupported channel/model before remote submission.
- Unit: OpenAI-compatible payload normalization for text and image.
- Unit: async media polling handles completed, failed, timeout, and cancellation.
- Integration: saving gateway hot-reloads future jobs while in-flight jobs keep their original provider.
- Redaction: keys and auth headers never appear in logs, traces, or errors.
