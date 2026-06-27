# Storage Config Contract

## Owner

tooling-agent owns the main-process storage configuration handler and repository. canvas-agent consumes the resulting asset URLs through existing asset flows.

## Scope

This contract covers local S3-compatible media storage settings for providers such as Cloudflare R2, Tencent COS, OSS, S3, and MinIO. Configuration is persisted in SQLite table `storage_configs`; secret values are encrypted with Electron `safeStorage` before they are written to SQLite.

## Request/Response Contracts

- `storage.getConfig`: returns the saved storage config for the renderer with `secretAccessKey` redacted to an empty string.
- `storage.saveConfig`: accepts `StorageConfigInput`, encrypts a non-empty `secretAccessKey`, and stores the config under `id = cloud-media` in `storage_configs`.
- `storage.testConnection`: accepts `StorageConfigInput` and validates the target bucket with the provider. If the renderer submits a redacted empty secret for the same storage target, the main process reuses the decrypted in-memory secret.

SQLite columns:

- `id`, `provider`, `endpoint`, `region`, `bucket`, `access_key_id`
- `key_ref`, `ciphertext`
- `public_url_prefix`, `updated_at`

## Errors

- `storage_secret_unavailable`: Electron `safeStorage` is unavailable when encrypted persistence is required.
- `storage_secret_required`: save was attempted without a new secret and without a previously persisted encrypted secret.
- Provider connection failures return `{ ok: false, error }` and must not include credentials.

## Permissions

Renderer code may call the preload allowlisted storage IPC methods only. Renderer reads never receive plaintext secrets. Main process code may hold a decrypted secret in memory only for provider calls.

## Tests

- `tests/storage-handler.test.ts` verifies SQLite persistence, renderer redaction, encrypted secret reuse, and connection-test secret reuse.
- `tests/key-vault.test.ts` verifies safeStorage-compatible encryption behavior and redacted failures.
