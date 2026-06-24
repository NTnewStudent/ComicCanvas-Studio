# PRD M1 — 骨架可跑

> **里程碑目标**：Electron 应用跑起来，DB + 队列 + stub provider 端到端跑通手动生图流程。
> **前置条件**：M0 全部 ✅
> **状态**：⬜ 未开始

---

## 需求列表

### REQ-010 Electron 脚手架 ⬜

**User Story**：作为开发者，我需要一个能打包的 Electron + Vite + TypeScript 骨架，main/preload/renderer 分层明确。

**Acceptance Criteria**：
1. `npm run dev` 启动后出现 BrowserWindow，renderer 加载正常。
2. `npm run build` 生成可执行文件，无编译报错。
3. THE main 进程 SHALL 开启 `contextIsolation: true`，`nodeIntegration: false`，`sandbox: true`。
4. THE preload SHALL 仅通过 `contextBridge.exposeInMainWorld` 暴露白名单 API，不暴露 Node API。
5. Vite dev-server 热更新在 renderer 正常工作。

**技术选型**：electron-vite + TypeScript strict + React 18。

**任务**：
- [ ] `npm create electron-vite` 或手工搭建 monorepo 结构
- [ ] 配置 `electron.vite.config.ts`（main / preload / renderer 三入口）
- [ ] `tsconfig.json` strict 模式，paths alias `@shared → shared/`
- [ ] 验证 contextIsolation/sandbox 配置
- [ ] `npm run dev` smoke test

---

### REQ-011 Drizzle Schema + DB 抽象层 ⬜

**User Story**：作为 tooling-agent，我需要一套 SQLite schema，可通过配置切换到 MySQL，业务层不写裸 SQL。

**Acceptance Criteria**：
1. SHALL 定义核心表：`workflow_project / workflow / workflow_version / jobs / chat_message / asset / asset_folder / agents / gateways / tools`。
2. THE DB 抽象层 SHALL 导出 `getDb()` 工厂，dialect 由配置决定（默认 sqlite）。
3. Drizzle migrations 管理表结构变更，禁止 `synchronize: true`。
4. `getDb()` 在 main 进程单例初始化，preload/renderer 不直接访问。

**关键字段**（jobs 表）：`id, type, status(pending/processing/completed/failed), payload(json), result(json|null), error_class, created_at, updated_at`。

**任务**：
- [ ] `desktop/src/main/db/schema.ts` — Drizzle 表定义
- [ ] `desktop/src/main/db/index.ts` — `getDb()` 工厂（better-sqlite3 + drizzle-orm/sqlite-core）
- [ ] 初始 migration 文件
- [ ] 单元测试：建表 + 简单 CRUD 验证
- [ ] `npm run db:migrate` 脚本

---

### REQ-012 仓储层 ⬜

**User Story**：作为业务/IPC 层，我需要通过仓储函数读写数据，不直接拼 Drizzle 查询。

**Acceptance Criteria**：
1. SHALL 实现仓储模块：`WorkflowRepo / JobRepo / AssetRepo / ChatMessageRepo`。
2. FOR ALL 仓储函数，SHALL 接受 db 实例注入（便于测试 mock）。
3. 事务边界：画布保存（saveGraph）与 Plan 应用在单事务内。
4. 无散落 Drizzle 查询在业务/IPC 层。

**任务**：
- [ ] `desktop/src/main/db/repositories/job.repo.ts`
- [ ] `desktop/src/main/db/repositories/asset.repo.ts`
- [ ] `desktop/src/main/db/repositories/workflow.repo.ts`
- [ ] `desktop/src/main/db/repositories/chat-message.repo.ts`
- [ ] 单元测试（in-memory sqlite）

---

### REQ-013 JobQueue + JobWorker 骨架 ⬜

**User Story**：作为主进程，我需要一个持久化任务队列，入队即返票据，Worker 异步消费，支持进程重启恢复。

**Acceptance Criteria**：
1. WHEN 调用 `enqueue(payload)`，THE queue SHALL 写 `jobs` 行（status=pending）+ 触发内存调度，**绝不在此调模型**，≤50ms 返回 `{ jobId }`。
2. THE worker SHALL 取 pending → processing → 调 provider stub → 写 completed/failed → emit IPC 事件。
3. 终态唯一：每 jobId `completed + failed` 事件计数 = 1（幂等写）。
4. 进程重启时，status=processing 的行复位为 pending 重排（或标 failed，由配置决定）。
5. 并发上限配置（默认 3 个 worker slot）。

**任务**：
- [ ] `desktop/src/main/jobs/queue.ts` — enqueue / consume 逻辑
- [ ] `desktop/src/main/jobs/worker.ts` — worker 主循环
- [ ] 重启恢复逻辑（启动时扫描 processing 行）
- [ ] IPC emit `job.progress / job.completed / job.failed`
- [ ] 单元测试：入队→消费→终态唯一性

---

### REQ-014 Provider 接口 + Stub Provider ⬜

**User Story**：作为 JobWorker，我需要一个标准 Provider 接口调用模型，stub 版本让 M1 端到端可跑通。

**Acceptance Criteria**：
1. THE `IProvider` SHALL 定义 `generateImage(params) / generateVideo(params) / chat(params)` 方法，返回 `AsyncGenerator` 或 `Promise<ProviderResult>`。
2. THE stub provider SHALL 在 200ms 内返回固定测试图片 bytes（1×1 PNG）和假尺寸 `{w:512, h:512}`。
3. THE Provider 注册表 SHALL 支持按 `GatewayConfig.id` 查找 Provider 实例。

**任务**：
- [ ] `desktop/src/main/providers/interface.ts` — IProvider + ProviderResult 类型
- [ ] `desktop/src/main/providers/stub.provider.ts`
- [ ] `desktop/src/main/providers/registry.ts`
- [ ] 单元测试：stub 返回值校验

---

### REQ-015 资产管线 ⬜

**User Story**：作为 JobWorker，我需要把模型返回的字节安全落盘，分类 orientation，渲染层通过自定义协议访问。

**Acceptance Criteria**：
1. `saveBytes(buf, ext) → relPath`：文件名用内容 hash（sha256 前16位），落盘到 `appData/assets/`。
2. `classifyOrientation(w, h)`: `w>h→landscape / w<h→portrait / w===h→square`；非正整数抛 `metadata_missing`。
3. `cc-asset://<relPath>` 协议通过 `protocol.handle` 注册，读取前做 `appData/assets/` 越界校验，拒绝 `..` 路径穿越。
4. 渲染层 img src 只接受 `cc-asset://` 协议，不接受 `file://` 或绝对路径。

**任务**：
- [ ] `desktop/src/main/assets/pipeline.ts` — saveBytes + classifyOrientation
- [ ] `desktop/src/main/assets/protocol.ts` — cc-asset:// 注册 + 越界校验
- [ ] PBT `classifyOrientation`：fast-check 随机 (w,h) 验证三段定义
- [ ] 越界路径穿越测试（`../../../etc/passwd`）

---

### REQ-016 IPC Handler 骨架 ⬜

**User Story**：作为 preload/renderer，我需要能通过 IPC 触发主进程操作并收到响应。

**Acceptance Criteria**：
1. SHALL 注册 `shared/ipc.ts` 中定义的所有 handle/on 通道。
2. canvas.runNode handler SHALL 调 `enqueue()` 返回 `{ jobId }`，不同步等待 provider。
3. job.subscribe handler SHALL 让 renderer 接收 `job.progress / job.completed / job.failed` 事件。
4. 所有 handler 有 try/catch，错误走 `{ error: string }` 结构返回，不 crash 主进程。

**任务**：
- [ ] `desktop/src/main/ipc/canvas.handler.ts`
- [ ] `desktop/src/main/ipc/job.handler.ts`
- [ ] `desktop/src/main/ipc/settings.handler.ts`（stub）
- [ ] `desktop/src/main/ipc/asset.handler.ts`（stub）
- [ ] 确认每个通道已在 `docs/api-contracts/` 登记

---

### REQ-017 端到端 Smoke Test ⬜

**User Story**：作为开发者，我需要一条 happy-path 验证 M1 全链路通畅。

**Acceptance Criteria**：
1. 手动触发 `canvas.runNode({ nodeId, action: 'imageRun' })`。
2. 主进程 enqueue → JobWorker 消费 → stub provider 返回 → 资产落盘 → `job.completed` IPC 发出。
3. renderer 收到 `job.completed` 事件，节点状态更新为 `done`，显示 `cc-asset://` 图片。
4. DB `jobs` 行 status = `completed`，result 含 `relPath + orientation`。
5. 全程无 `setInterval` 轮询资产。

**任务**：
- [ ] 集成测试脚本（Node + stub provider）
- [ ] Electron e2e：Playwright 或手动 smoke check
- [ ] 确认渲染层无 setInterval 轮询

---

## 完成标准

- [ ] `npm run dev` 出现 BrowserWindow，无控制台报错
- [ ] 端到端 Smoke Test（REQ-017）通过
- [ ] `tsc --noEmit` 无报错
- [ ] 终态唯一性单元测试通过
- [ ] 无 `any`，无裸 SQL 在业务层
