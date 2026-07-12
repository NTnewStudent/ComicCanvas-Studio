# Tasks - Creative Media Gateway

> Source of truth: `requirements.md` and `design.md` in this directory.

## 1. Shared Contracts And API Documentation

- [ ] Add `creative_media`, profile types, and validated model routes to
  `shared/gateway.ts`.
- [ ] Define a compatibility strategy for the current `GatewayModelMap`.
- [ ] Update `shared/ipc.ts`, preload types, and
  `docs/api-contracts/gateway-providers.md` before handler edits.
- [ ] Add shared contract tests for route/profile compatibility and safe views.

## 2. Provider Core

- [ ] Implement `creative-media.provider.ts` with route dispatch, redaction,
  capability preflight, cancellation, and normalized errors.
- [ ] Wire it through `gateway-reloader.ts` without modifying current providers.
- [ ] Test reload behavior for new and in-flight calls.

## 3. Text And Image Profiles

- [ ] Implement `openai_chat` request/result and SSE normalization.
- [ ] Implement Nano Banana and Seedream translation, references, defaults, and
  result normalization.
- [ ] Test payload allowlists, URL/base64 result handling, and redaction.

## 4. Video Profiles

- [ ] Implement Seedance submit/status/result translation.
- [ ] Implement Kling text-to-video/image-to-video dispatch and result parsing.
- [ ] Test progress, success, failure, malformed response, timeout, and cancel.

## 5. Settings, Catalog, And Job Integration

- [ ] Seed and configure the disabled system built-in gateway.
- [ ] Add multi-route settings controls with channel-valid profile choices.
- [ ] Expand the model catalog to expose every enabled route.
- [ ] Verify image/video jobs remain asynchronous and store final local assets.

## 6. Verification And Cutover

- [ ] Run focused provider, IPC, settings, job, and catalog tests.
- [ ] Run `bun run typecheck` and the full Bun suite; record unrelated failures.
- [ ] Run configured smoke tests for text, Nano Banana, Seedream, Seedance, and
  Kling when endpoint credentials are available.
- [ ] Write the consolidated implementation test report in `docs/progress/`.
