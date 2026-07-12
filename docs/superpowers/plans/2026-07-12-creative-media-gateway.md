# Creative Media Gateway Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the system-built-in `creative_media` gateway with OpenAI chat, Nano Banana/Seedream images, and Seedance/Kling video profiles.

**Architecture:** Gateway configuration gains model routes that map a channel and model key to one built-in protocol profile. Main-process adapters translate only normalized requests and the existing local jobs own remote video polling and asset storage.

**Tech Stack:** Electron, TypeScript strict, React, Vitest, Bun, fetch.

---

## File Structure

- `shared/gateway.ts`: gateway type, profile, and route contracts.
- `desktop/src/main/providers/creative-media.provider.ts`: provider and profile adapters.
- `desktop/src/main/providers/gateway-reloader.ts`: built-in provider construction.
- `desktop/src/main/ipc/gateway.handler.ts`: disabled built-in config and validation.
- `shared/workflow-node-definitions.ts`: multi-route model catalog.
- `desktop/src/renderer/src/settings/GatewayForm.tsx`: route/profile editor.
- `desktop/src/renderer/src/settings/GatewayList.tsx`: preserve and display routes.
- `tests/creative-media-provider.test.ts`: provider behavior.
- `tests/creative-media-gateway-contract.test.ts`: contracts, seed, reload, catalog.

### Task 1: Shared Route Contracts

**Files:**
- Modify: `shared/gateway.ts`
- Modify: `shared/workflow-node-definitions.ts`
- Modify: `docs/api-contracts/gateway-providers.md`
- Test: `tests/creative-media-gateway-contract.test.ts`

- [ ] Write failing tests for valid video route, invalid image/Kling route, and two video routes in one catalog.
- [ ] Run `bunx vitest run tests/creative-media-gateway-contract.test.ts` and verify the missing route API fails.
- [ ] Add the minimal types:

```ts
export type CreativeMediaProfile = 'openai_chat' | 'nano_banana' | 'seedream' | 'seedance' | 'kling'
export interface GatewayModelRoute { channel: GatewayChannel; modelKey: string; profile: CreativeMediaProfile }
```

- [ ] Add an exhaustive profile/channel validator, optional `modelRoutes` config fields, and catalog entries for every enabled route. Retain `modelMap` for non-creative gateway compatibility.
- [ ] Run `bunx vitest run tests/creative-media-gateway-contract.test.ts && bun run typecheck`; expected PASS.
- [ ] Commit only the contract, catalog, documentation, and test files with message `feat(gateway): add creative media model routes`.

### Task 2: Text And Image Profiles

**Files:**
- Create: `desktop/src/main/providers/creative-media.provider.ts`
- Test: `tests/creative-media-provider.test.ts`

- [ ] Write failing fetch-mock tests for OpenAI chat messages, Nano Banana references via `images`, and Seedream URL response format.
- [ ] Run `bunx vitest run tests/creative-media-provider.test.ts`; expected FAIL because the provider factory is absent.
- [ ] Create the provider entry point:

```ts
export function createCreativeMediaProvider(options: CreativeMediaProviderOptions): GatewayProvider {
  return { id: options.id, capabilities, modelKeys, invoke: (request, context) => invokeRoute(options, request, context) }
}
```

- [ ] Implement a closed route dispatch map. Implement `openai_chat` using existing chat/SSE semantics. Implement Nano Banana and Seedream with separate allowlisted bodies, valid image references, safe size defaults, URL/base64 parsing, and secret redaction.
- [ ] Run `bunx vitest run tests/creative-media-provider.test.ts`; expected PASS for text, both image payloads, unknown key dropping, result parsing, and key redaction.
- [ ] Commit provider and test files with message `feat(gateway): add creative media text and image profiles`.

### Task 3: Seedance And Kling Video Profiles

**Files:**
- Modify: `desktop/src/main/providers/creative-media.provider.ts`
- Modify: `tests/creative-media-provider.test.ts`

- [ ] Write failing tests that assert Seedance metadata content and Kling image/duration/aspect payloads, then test progress, success, failure, timeout, and cancellation.
- [ ] Run `bunx vitest run tests/creative-media-provider.test.ts`; expected FAIL because both video profiles are unsupported.
- [ ] Use the shared poller through this shape:

```ts
async function invokeAsyncVideo(profile: VideoProfile, request: GatewayRequest, context?: GatewayProviderContext): Promise<GatewayResult> {
  const task = await profile.submit(request)
  const completed = await pollWithBackoff((attempt) => profile.status(task.id, attempt), options, context)
  return downloadNormalizedVideo(completed.url, request, context)
}
```

- [ ] Map Seedance references to metadata content. Map Kling requests to text-to-video or image-to-video and allow only image, optional tail image, duration, and aspect ratio. Normalize returned media to `assetBytes`.
- [ ] Run `bunx vitest run tests/creative-media-provider.test.ts tests/async-media-provider.test.ts`; expected PASS.
- [ ] Commit provider and test files with message `feat(gateway): add seedance and kling video profiles`.

### Task 4: Reloader, Built-in Config, And Settings

**Files:**
- Modify: `desktop/src/main/providers/gateway-reloader.ts`
- Modify: `desktop/src/main/ipc/gateway.handler.ts`
- Modify: `desktop/src/renderer/src/settings/GatewayForm.tsx`
- Modify: `desktop/src/renderer/src/settings/GatewayList.tsx`
- Modify: `tests/gateway-hot-reload.test.ts`
- Modify: `tests/gateway-settings-ui.test.tsx`

- [ ] Write failing tests for disabled `creative-media` seed config, reloader construction, and a route-form submit with `{ channel: 'video', modelKey: 'kling-v2', profile: 'kling' }`.
- [ ] Run `bunx vitest run tests/gateway-hot-reload.test.ts tests/gateway-settings-ui.test.tsx tests/creative-media-gateway-contract.test.ts`; expected FAIL.
- [ ] Seed the disabled built-in config, validate/save routes, and instantiate the provider only for `creative_media`. Add route rows with channel-valid profile choices; preserve routes in edit/toggle calls and display route model badges. Do not add raw path or JSON-body controls.
- [ ] Run the same three test files; expected PASS.
- [ ] Commit wiring and test files with message `feat(gateway): wire creative media settings and reload`.

### Task 5: Verification And Report

**Files:**
- Create: `docs/progress/creative-media-gateway-test-report.md`

- [ ] Run `bunx vitest run tests/creative-media-provider.test.ts tests/creative-media-gateway-contract.test.ts tests/openai-compatible-provider.test.ts tests/async-media-provider.test.ts tests/gateway-hot-reload.test.ts tests/gateway-settings-ui.test.tsx`; expected PASS.
- [ ] Run `bun run typecheck && bun test`; record any pre-existing failure separately.
- [ ] Write the report with commands, actual pass/fail output, and the fact that external smoke tests require configured user credentials.
- [ ] Commit the report with message `docs: record creative media gateway verification`.

## Plan Self-Review

- Tasks 1 and 4 cover built-in identity, route validation, safe catalog, reload, and settings.
- Task 2 covers OpenAI text and the two distinct image payload families.
- Task 3 covers the two video dialects and worker-side asynchronous lifecycle.
- Tasks 1 through 5 enforce redaction, no raw request UI, and no NewAPI type.
