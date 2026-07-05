# Storage Config Contract

## Owner

tooling-agent 拥有主进程存储配置 handler 和仓储层。canvas-agent 通过现有资产流程消费生成的资产 URL。

## Scope

本契约覆盖本地 S3 兼容媒体存储设置，适用于 Cloudflare R2、Tencent COS、OSS、S3、MinIO 等服务商。配置持久化在 SQLite 表 `storage_configs` 中；密钥值在写入 SQLite 前用 Electron `safeStorage` 加密。

## Request/Response Contracts

- `storage.getConfig`：返回给渲染层的已保存存储配置，`secretAccessKey` 被红化为空字符串。
- `storage.saveConfig`：接受 `StorageConfigInput`，加密非空的 `secretAccessKey`，并以 `id = cloud-media` 存入 `storage_configs`。
- `storage.testConnection`：接受 `StorageConfigInput` 并向服务商校验目标 bucket。若渲染层为同一存储目标提交了被红化的空密钥，主进程复用内存中已解密的密钥。

SQLite 列：

- `id`, `provider`, `endpoint`, `region`, `bucket`, `access_key_id`
- `key_ref`, `ciphertext`
- `public_url_prefix`, `updated_at`

## Errors

- `storage_secret_unavailable`：需要加密持久化时 Electron `safeStorage` 不可用。
- `storage_secret_required`：保存时既没有提供新密钥，也没有此前持久化的加密密钥。
- 服务商连接失败返回 `{ ok: false, error }`，且不得包含凭证。

## Permissions

渲染层代码只能调用 preload 白名单内的存储 IPC 方法。渲染层读取永远不会收到明文密钥。主进程代码仅可在内存中为服务商调用临时持有已解密的密钥。

## Tests

- `tests/storage-handler.test.ts` 验证 SQLite 持久化、渲染层红化、加密密钥复用，以及连接测试的密钥复用。
- `tests/key-vault.test.ts` 验证与 safeStorage 兼容的加密行为及红化失败场景。
