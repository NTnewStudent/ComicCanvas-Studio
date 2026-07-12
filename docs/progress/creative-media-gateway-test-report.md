# Creative Media Gateway Test Report

Date: 2026-07-12

## Scope

Implemented the system-built-in `creative_media` gateway route contracts,
OpenAI-format text, Nano Banana and Seedream images, Seedance and Kling video
profiles, registry/reloader wiring, disabled built-in configuration, and
settings route fields.

## Passed Verification

```text
bun x vitest run tests/creative-media-provider.test.ts tests/creative-media-gateway-contract.test.ts tests/gateway-settings-ui.test.tsx tests/gateway-hot-reload.test.ts
4 test files passed, 15 tests passed

bun run typecheck
passed
```

The provider tests cover OpenAI-format text payloads, Nano Banana and Seedream
payload isolation, Seedance submit/poll/progress/result download, and result
normalization. Contract, settings, and hot-reload regressions pass alongside
the new multi-route catalog behavior.

## Full Suite Result

`bun test` was run and did not pass as a repository-wide command. Observed
unrelated environment/test-discovery failures include:

- browser tests without `window` or `document` (`canvas-chatbox`, style, and
  production component suites);
- Bun cannot load `better-sqlite3` for the Phase A smoke test;
- a test uses unavailable `vi.advanceTimersByTimeAsync`;
- discovery includes `hjwall/pc-client` and `cc-haha-main` test trees with
  unresolved aliases or missing dependencies.

These failures are outside the Creative Media Gateway files and were not
modified by this implementation.

## External Smoke Tests

No real remote provider was invoked because no endpoint and API key were
configured in this workspace. Before production use, configure the disabled
`Creative Media Gateway` and run one text, Nano Banana, Seedream, Seedance, and
Kling request against the intended endpoint.
