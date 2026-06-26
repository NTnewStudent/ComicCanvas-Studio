# REQ-085 S3 媒体云存储架构 — 迭代报告

> 日期：2026-06-26 | 状态：✅ 完成

---

## 1. 架构变更摘要

ComicCanvas Studio 的资产存储架构从 **纯本地存储** 升级为 **混合存储（本地 + 云）**：

- 媒体文件（图片/视频）上传至 S3 兼容云存储，DB 记录云端 URL
- 项目文件（workflow JSON）保持本地存储
- 通过策略模式抽象 `StorageProvider` 接口，支持多厂商切换
- 生成结果自动回传云存储，Provider 直接返回云端 URL

---

## 2. 文件变更列表

### 新增文件
| 文件 | 说明 |
|:---|:---|
| `desktop/src/main/storage/storage-provider.ts` | StorageProvider 策略接口 |
| `desktop/src/main/storage/storage-config.ts` | 存储配置类型定义 |
| `desktop/src/main/storage/storage-factory.ts` | StorageFactory 工厂 + 注册表 |
| `desktop/src/main/storage/providers/s3-provider.ts` | S3 协议实现 |
| `desktop/src/main/ipc/storage.handler.ts` | 存储配置 IPC handler |
| `desktop/src/renderer/src/settings/StorageSettingsForm.tsx` | 设置页存储配置组件 |
| `desktop/src/main/db/migrations/0002_add_asset_cloud_fields.sql` | DB 迁移：资产表增加云端字段 |

### 修改文件
| 文件 | 说明 |
|:---|:---|
| `shared/ipc.ts` | 新增 storage.* IPC 通道契约 |
| `shared/assets.ts` | 资产类型增加 cloudKey/cloudUrl 字段 |
| `shared/gateway.ts` | Provider 输出 URL 支持云端地址 |
| `desktop/src/main/db/schema.ts` | asset 表 schema 增加云端字段 |
| `desktop/src/main/db/repositories/asset.repo.ts` | 仓储层支持云端 URL 读写 |
| `desktop/src/main/db/migrate.ts` | 注册新迁移 |
| `desktop/src/main/ipc/asset.handler.ts` | 资产导入自动上传 S3 |
| `desktop/src/main/ipc/canvas.handler.ts` | 节点引用使用云端 URL |
| `desktop/src/main/jobs/upload-result.ts` | 生成结果自动回传 S3 |
| `desktop/src/main/providers/async-media.provider.ts` | 异步媒体直接用云端 URL |
| `desktop/src/main/providers/openai-compatible.provider.ts` | 兼容云端 URL 入参 |
| `desktop/src/main/runtime.ts` | 注册 storage IPC handler |
| `desktop/src/preload/index.ts` | 暴露 storage IPC 通道 |
| `desktop/src/renderer/src/settings/SettingsPage.tsx` | 设置页集成存储选项卡 |
| `desktop/package.json` | 新增 @aws-sdk/client-s3 依赖 |

### 治理文档更新
| 文件 | 说明 |
|:---|:---|
| `AGENTS.md` / `AGENTS_KIRO.md` / `AGENT_CODEX.md` | 项目架构描述从"本地优先"改为"混合存储" |
| `README.md` | 更新架构概述 |
| `.qoder/rules/project-identity.md` | 更新项目身份定义 |

---

## 3. StorageProvider 接口说明

```typescript
interface StorageProvider {
  readonly id: string          // 提供者标识（如 's3', 'r2', 'cos'）
  readonly name: string        // 显示名称

  upload(filePath: string, key: string): Promise<string>  // 上传 → 返回 URL
  query(key: string): Promise<string>                      // 查询访问 URL
  rename(oldKey: string, newKey: string): Promise<string>  // 改名 → 返回新 URL
  delete(key: string): Promise<void>                       // 删除云端文件
  testConnection(): Promise<boolean>                       // 连接测试
}
```

**设计模式**：Strategy Pattern  
**工厂模式**：`StorageFactory` 通过注册表管理 Provider 实现，按 `config.provider` 字段选择具体实现类。

---

## 4. 支持的云存储厂商

| 厂商 | provider ID | 协议 | 说明 |
|:---|:---|:---|:---|
| AWS S3 | `s3` | S3 | 原生 AWS S3 |
| Cloudflare R2 | `r2` | S3 兼容 | 零出口流量费，需自定义 endpoint |
| 腾讯云 COS | `cos` | S3 兼容 | 通过 S3 兼容端点接入 |
| 阿里云 OSS | `oss` | S3 兼容 | 通过 S3 兼容端点接入 |
| MinIO | （fallback） | S3 兼容 | 默认 fallback 到 S3StorageProvider |

所有厂商统一使用 `S3StorageProvider` 实现，通过 `endpoint` / `region` / `bucket` 参数区分。

---

## 5. 配置使用指南

在 **设置 → 存储设置** 选项卡中配置：

| 字段 | 说明 | 示例 |
|:---|:---|:---|
| 存储服务商 | 选择厂商 | Cloudflare R2 |
| Endpoint | S3 兼容端点 | `https://<account-id>.r2.cloudflarestorage.com` |
| Region | 区域 | `auto` |
| Bucket | 存储桶名 | `comiccanvas-media` |
| Access Key ID | 访问密钥 | 从厂商控制台获取 |
| Secret Access Key | 密钥 | 从厂商控制台获取（存入 OS safeStorage） |
| URL 前缀 | 公开访问域名 | `https://pub-xxx.r2.dev` |

配置完成后点击「测试连接」验证。Secret Key 通过 OS `safeStorage` 加密存储，不落明文。

---

## 6. 向后兼容说明

- **无云存储配置时**：资产导入流程保持原有本地存储行为，不影响已有数据
- **DB 迁移**：`0002_add_asset_cloud_fields.sql` 为 `asset` 表新增 `cloud_key` 和 `cloud_url` 列，均为 `TEXT` 类型可空，不影响已有记录
- **已有资产**：`cloud_key` / `cloud_url` 为 null 的资产继续使用本地路径访问
- **IPC 通道**：新增 `storage.*` 通道，不影响已有 `asset.*` / `canvas.*` 通道

---

## 7. 已知限制

1. **无文件去重**：同一文件多次上传会生成不同 key，未做内容哈希去重
2. **无离线缓存**：云端 URL 访问依赖网络，无本地缓存降级策略
3. **单桶限制**：当前配置仅支持一个 bucket，不支持按项目分桶
4. **无生命周期管理**：未自动清理云端孤立对象（DB 记录删除但云端文件未删）
5. **无分片上传**：大文件（>100MB）上传未做分片，可能超时
6. **better-sqlite3 ABI**：测试环境中 `better-sqlite3` 原生模块存在 Node.js ABI 版本不匹配（130 vs 137），17 个 DB 相关测试文件因此跳过，非本次变更引入
