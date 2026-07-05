# 测试报告

## 2026-07-05 - hjwall-canvas-full-migration 任务 20–33（RUEPE 批次）

范围：

- RUEPE 顺序审计/收尾 `specs/hjwall-canvas-full-migration/tasks.md`
  任务 20–33（工程检查项；REQ-098 人工验收行仍为 Pending）。
- 新增 Phase 7 场景文档 + `tests/hjwall-canvas-phase7-scenarios.test.ts`。

验证（环境：仓库根目录 `npm install`；`better-sqlite3` 原生绑定未构建；
`desktop/node_modules` 未安装）：

```bash
npx vitest run tests/style-contracts.test.ts tests/style-runtime-payload.test.ts tests/workflow-graph-compiler.test.ts
npx vitest run tests/style-library-panel.test.tsx tests/project-style-selector.test.tsx tests/style-settings-ui.test.tsx
npx vitest run tests/asset-service.test.ts -t "extracts"
npx vitest run tests/asset-audio-support.test.ts tests/canvas-asset-panel.test.tsx
npx vitest run tests/migrated-run-dispatch.test.ts tests/canvas-job-reconciliation.test.ts tests/sanitize-plan.test.ts tests/apply-plan-runner.test.ts
npx vitest run tests/hjwall-canvas-phase7-scenarios.test.ts tests/progress-backlog.test.ts
```

结果：

- 风格合成（任务 20）：11/11 通过。
- 风格 UI（任务 21）：7/7 通过（3 个文件）；`style-renderer-ui` 被阻塞（`desktop/node_modules` 中没有 `@xyflow/react`）。
- 资产元数据（任务 22）：2/2 纯提取测试通过；DB 流水线测试被阻塞。
- 资产面板（任务 23）：1/1 通过。
- 运行调度/协调/校验/plan-runner（任务 25–27、29）：29/29 通过。
- Agent 冒烟测试（任务 28）：2/3 通过；1 个 DB 集成用例被阻塞。
- Phase 7 静态冒烟测试（任务 30–32）：1/1 通过。
- RUEPE backlog 指针测试：4/4 通过。

残留环境缺口：

- `style-renderer-ui` 需要在 monorepo 根目录执行 `bun install`（workspaces 会把
  `@xyflow/react` 提升到 `desktop/node_modules`）；仅执行 `npm install` 在本次检出中
  无法满足 vitest 的别名解析。

**2026-07-05 后续跟进：** `npm rebuild better-sqlite3` 解除了对 SQLite 相关套件的阻塞 —
`asset-reference-sync`（1）、`asset-service`（11）、`agent-orchestration-smoke`
（3）= 15/15 通过。

## 2026-06-25 - M0 基础门禁

### M0-2 API 契约文档

范围：

- 新增了画布计划、任务、资产/文件、网关提供方、工具/插件、agents、skills、知识/上下文以及审计/可观测性所需的 `docs/api-contracts/` 模块契约文档。
- 新增 `tests/api-contract-docs.test.ts`，用于防止契约文档缺失或缺少必需章节。

验证：

```bash
bun run test
```

结果：

- RED（实现前）：失败，因为 `docs/api-contracts/canvas-plan.md` 及其余必需的拆分文档都缺失。

```bash
bunx vitest run tests/api-contract-docs.test.ts
```

结果：

- PASS：`tests/api-contract-docs.test.ts` 通过，1 个测试。

### M0-3 共享平台契约

范围：

- 将旧版合并的 tool/agent 契约拆分为聚焦的共享契约：
  `shared/jobs.ts`、`shared/assets.ts`、`shared/gateway.ts`、`shared/tools.ts`、
  `shared/agents.ts`、`shared/skills.ts` 和 `shared/knowledge.ts`。
- 围绕 domain/action 通道分组、请求映射、
  响应映射以及链接到新契约文档的事件映射重构了 `shared/ipc.ts`。
- 将 `shared/tools-agents.ts` 转换为已弃用的兼容性 barrel 文件。
- 扩展了 `scripts/verify-repo.mjs`，使 CI 能拒绝缺失 M0 契约文件的情况。

验证：

```bash
bunx vitest run tests/shared-contracts.test.ts
```

结果：

- RED（实现前）：失败，因为 `shared/jobs.ts` 及其他聚焦契约文件缺失，且 `shared/tools-agents.ts` 仍是权威来源。
- 实现后 PASS：`tests/shared-contracts.test.ts` 通过，2 个测试。

```bash
bun run typecheck
```

结果：

- PASS：TypeScript 严格编译以退出码 0 完成。

### M0-4 待办事项对齐

范围：

- 新增 `tests/progress-backlog.test.ts`，确保有证据支撑的 M0 进度不会与 `docs/progress/backlog.md` 出现偏差。
- 依据已有的 `shared/composed-prompt.ts` 及 `tests/composed-prompt.test.ts` 对齐 `REQ-008`。
- 依据 `ltm/bin/ltm.py selftest` 对齐 `REQ-009`。
- 依据新拆分的 `docs/api-contracts/*.md` 文档集与 `tests/api-contract-docs.test.ts` 对齐 `REQ-019`。
- 保持 `REQ-018` 为进行中状态，因为 `specs/core-platform-foundation/tasks.md` 中的任务 18-34 仍处于打开状态。

验证：

```bash
bunx vitest run tests/progress-backlog.test.ts
```

结果：

- RED（更新前）：失败，因为 `REQ-008`、`REQ-009`、`REQ-019` 以及里程碑 M0 任务 4 的状态已过期。
- 待下一验证区块更新 backlog 后重新运行。

```bash
bunx vitest run tests/progress-backlog.test.ts
```

结果：

- 更新后 PASS：`tests/progress-backlog.test.ts` 通过，2 个测试。

### M0-5 基础就绪与禁止 Demo 门禁

范围：

- 新增 `docs/architecture/core-platform-implementation-readiness.md`。
- 新增了数据库表结构草案、仓储层职责边界、迁移策略、
  运行时骨架方案、设置/管理界面、初始内置工具、
  初始内置 skills，以及默认 agent 交接规则。
- 新增 `docs/progress/no-demo-acceptance-review.md`。
- 修复了 `docs/architecture/01-system-architecture.md` 中一个过期的 `.claude/specs/...` 权威链接。

验证：

```bash
bunx vitest run tests/foundation-readiness.test.ts
```

结果：

- RED（实现前）：失败，因为就绪性文档和禁止 Demo 审查文档缺失。
- 实现后 PASS：`tests/foundation-readiness.test.ts` 通过，2 个测试。

```bash
rg -n "TBD|TODO|FIXME|\\.claude/specs|\\.codex/specs" specs docs/api-contracts docs/architecture .codex .agents AGENTS.md
```

结果：

- 修复后 PASS：在已检查的基础来源中未发现过期的权威 spec 链接或未解决的占位符标记。

### M0 最终验证

验证：

```bash
bun run test
```

结果：

- PASS：6 个测试文件通过，10 个测试通过。

```bash
bun run ci
```

结果：

- PASS：lint、typecheck、test、build 和仓库健全性检查以退出码 0 完成。

```bash
python ltm/bin/ltm.py selftest
```

结果：

- PASS：LTM 结构完整。

决策：

- M0 基础门禁已通过验收。
- 下一个实现事项是 M1 任务 5：Electron/Vite/React 骨架。

## 2026-06-25 - M1 可运行骨架

### M1-5 Electron/Vite/React 骨架

范围：

- 新增 `desktop` 作为 Bun workspace。
- 新增 Electron 主进程、沙盒化的 preload bridge、React 渲染层、Electron Vite 配置，以及 desktop 包脚本。
- 更新根目录 `dev` 和 `build` 脚本以使用 Bun workspace 过滤。
- 扩展了 ESLint 忽略配置，以排除诸如 `desktop/out/**` 之类的嵌套构建产物。

验证：

```bash
bunx vitest run tests/electron-skeleton.test.ts
```

结果：

- RED（实现前）：失败，因为 `desktop` workspace 和 Electron 入口文件缺失。
- 实现后 PASS：`tests/electron-skeleton.test.ts` 通过，3 个测试。

```bash
bun run --filter @comic-canvas/desktop build
```

结果：

- PASS：Electron Vite 构建了主进程、preload 和渲染层构建产物。

```bash
bun run ci
```

结果：

- PASS：lint、typecheck、7 个测试文件 / 13 个测试、desktop 构建、shared 构建以及仓库健全性检查以退出码 0 完成。

### M1-6 Electron 渲染层安全

范围：

- 新增针对 BrowserWindow 隔离默认设置的静态安全测试。
- 通过 `invokeMain` 强制使用带类型的 preload 封装。
- 新增渲染层导入扫描，防止直接导入 Electron/Node 或使用原始 `ipcRenderer`。

验证：

```bash
bunx vitest run tests/electron-security.test.ts
```

结果：

- RED（实现前）：失败，因为 preload 未使用带类型的 `invokeMain` 封装。
- 实现后 PASS：`tests/electron-security.test.ts` 通过，3 个测试。

```bash
bun run ci
```

结果：

- PASS：lint、typecheck、8 个测试文件 / 16 个测试、desktop 构建、shared 构建以及仓库健全性检查以退出码 0 完成。

### M1-7 数据库表结构与迁移基线

范围：

- 新增了 jobs、assets、asset folders、
  asset references、workflows、workflow versions、chat messages、gateways、
  tools、tool audit、agents、agent runs、skills、skill invocations、knowledge
  documents、knowledge chunks 以及 context packs 的 Drizzle SQLite 表结构声明。
- 新增 `0001_initial_core_platform.sql`。
- 新增了一个应用层受控的迁移执行器，用于将已应用的迁移记录在
  `__comiccanvas_migrations` 中。
- 为 `desktop` workspace 新增了 `better-sqlite3`、`drizzle-orm`、`drizzle-kit` 及类型依赖。

验证：

```bash
bunx vitest run tests/db-schema.test.ts
```

结果：

- RED（实现前）：失败，因为 `better-sqlite3` 和数据库模块缺失。
- 实现后 PASS：`tests/db-schema.test.ts` 通过，2 个测试。

```bash
bun run ci
```

结果：

- PASS：lint、typecheck、9 个测试文件 / 18 个测试、desktop 构建、shared 构建以及仓库健全性检查以退出码 0 完成。

### M1-8 仓储层边界

范围：

- 在 `desktop/src/main/db/repositories/` 下为 jobs、assets、workflows、chat messages、gateways、
  tools、agents、skills 以及 knowledge records 新增了仓储模块。
- 新增 JSON 序列化辅助函数，用于仓储层持有的持久化 JSON 字段。
- 新增一个静态边界测试，确保原始 Drizzle 与 SQL 访问都保留在数据库模块内。
- 新增了通过仓储层 API 进行的迁移驱动写/读测试。

验证：

```bash
bunx vitest run tests/repository-boundaries.test.ts
```

结果：

- RED（实现前）：失败，因为仓储层文件和仓储层 API 缺失。
- 实现后 PASS：`tests/repository-boundaries.test.ts` 通过，3 个测试。

```bash
bun run ci
```

结果：

- PASS：lint、typecheck、10 个测试文件 / 21 个测试、desktop 构建、shared 构建以及仓库健全性检查以退出码 0 完成。

### M1-9 JobRuntime 骨架

范围：

- 新增 `JobQueue`，用于在返回仅票据式响应前持久化待处理任务。
- 新增仓储层持有的任务状态转换：claim、complete、fail 以及启动时重新排队。
- 新增 `JobWorker`，用于取用一个待处理任务、运行已注册的处理器、持久化终态，并恰好发出一次终态事件。
- 新增 `JobEventBus` 及对被遗弃中处理任务的启动恢复机制。

验证：

```bash
bunx vitest run tests/job-runtime.test.ts
```

结果：

- RED（实现前）：失败，因为 `desktop/src/main/jobs/events` 及其余 JobRuntime 模块缺失。
- 实现后 PASS：`tests/job-runtime.test.ts` 通过，4 个测试。

### M1-10 Stub 网关提供方

范围：

- 新增用于 text、image 和 video 通道的确定性 `stub` provider。
- 新增带网关查找及通道/模型预检的 provider 注册中心。
- 确保 provider 调用返回不含 provider 特定响应字段的规范化 `GatewayResult` 结构体。

验证：

```bash
bunx vitest run tests/stub-provider.test.ts
```

结果：

- RED（实现前）：失败，因为 `desktop/src/main/providers/registry` 和 `stub.provider` 缺失。
- 实现后 PASS：`tests/stub-provider.test.ts` 通过，3 个测试。

### M1-11 AssetService 基线

范围：

- 新增基于内容哈希的相对存储路径的生成资产字节流水线。
- 新增朝向分类以及非法元数据拒绝逻辑。
- 新增 `cc-asset://asset/<assetId>` 安全 URL 记录及安全协议路径解析。
- 通过 SQLite 基线持久化资产 `sizeBytes` 元数据。

验证：

```bash
bunx vitest run tests/asset-service.test.ts
```

结果：

- RED（实现前）：失败，因为 `desktop/src/main/assets/pipeline` 和 `protocol` 缺失。
- 实现后 PASS：`tests/asset-service.test.ts` 通过，9 个测试。

### M1-12 IPC 骨架

范围：

- 新增了 canvas、job、asset 和 gateway 的 IPC 处理器骨架模块。
- 新增了会对内部错误进行红化处理的安全 IPC 错误包装辅助函数。
- 新增了处理器注册测试及针对生成字节流、data URL、绝对路径以及 provider 特定字段的响应深度扫描。

验证：

```bash
bunx vitest run tests/ipc-skeleton.test.ts
```

结果：

- RED（实现前）：失败，因为 `desktop/src/main/ipc/*` 处理器模块缺失。
- 实现后 PASS：`tests/ipc-skeleton.test.ts` 通过，4 个测试。

### M1-13 冒烟路径

范围：

- 新增了 M1 冒烟测试胶水代码，通过 JobQueue、JobWorker、
  stub 网关 provider、AssetPipeline 以及终态任务事件来完成图片节点的生成。
- 验证了仅票据式的入队响应、已完成的任务状态、持久化的资产
  元数据、安全资产 URL、相对资产路径，以及恰好一次的终态事件。

验证：

```bash
bunx vitest run tests/m1-smoke-path.test.ts
```

结果：

- RED（实现前）：失败，因为 `desktop/src/main/smoke/m1-smoke` 缺失。
- 实现后 PASS：`tests/m1-smoke-path.test.ts` 通过，1 个测试。

## 2026-06-25 - M2 完整画布

### M2-14 画布 Store

范围：

- 在实现前阅读了 `hjwall/pc-client/src/modules/workflow-canvas/store.ts` 及相关 store 测试。
- 新增了一个原生 Zustand 画布 store，用于管理 nodes、edges、viewport、undo/redo、`applyChange`、
  添加/删除 node/edge、重复拒绝以及共享连接矩阵校验。
- 使用当前 `shared/nodes.ts` 契约为 text、image 和 video 节点数据新增了确定性默认值。

验证：

```bash
bunx vitest run tests/canvas-store.test.ts
```

结果：

- RED（实现前）：失败，因为 `desktop/src/renderer/src/canvas/store/canvas.store` 缺失。
- 实现后 PASS：`tests/canvas-store.test.ts` 通过，5 个测试。

### M2-15 文本节点

范围：

- 在实现前阅读了 `hjwall/pc-client/src/modules/workflow-canvas/nodes/TextNode.tsx` 及相关测试。
- 新增了渲染层 `TextNode`，具备折叠状态标签/预览、展开状态 textarea 编辑、点击外部折叠、
  可滚动的预览/编辑区域，以及内联重命名功能。
- 通过 Testing Library、jsdom、React DOM 编译器设置以及根目录 React 类型依赖新增了 TSX 组件测试支持。
- 针对 ComicCanvas `--cc-*` 设计系统变量，为文本节点样式的卡片、选中态、输入框以及聚焦态做了 token 化处理。

验证：

```bash
bunx vitest run tests/text-node.test.tsx
```

结果：

- RED（修复前）：失败，因为之前的 jsdom 渲染在测试之间未被清理，导致出现重复的 `Text 1` 按钮。
- 新增验收测试的 RED：点击外部折叠失败，因为在对 `document.body` 执行 `mousedown` 后，展开的 textarea 仍保持挂载。
- 实现后 PASS：`tests/text-node.test.tsx` 通过，4 个测试。

```bash
bun run typecheck
```

结果：

- RED（依赖修复前）：失败，因为根目录 TSX 测试缺少 React 类型声明。
- 添加根目录 `@types/react` 和 `@types/react-dom` 后 PASS。

### M2 Tailwind 渲染层基础修正

范围：

- 在用户反馈画布 UI 应复用现有实现模式后，重新检查了 `hjwall/pc-client` 渲染层样式架构。
- 为 desktop workspace 新增了 Tailwind v3、PostCSS、Autoprefixer、`clsx` 和 `tailwind-merge`。
- 新增了 `desktop/tailwind.config.ts`、`desktop/postcss.config.js` 以及匹配 `pc-client` 复用模式的渲染层 `cn` 辅助函数。
- 将渲染层样式表转换为 Tailwind layer 加当前 ComicCanvas `global/design/DESIGN.md` token 值。
- 将 M2 文本节点及 desktop shell 从手写组件 CSS 迁移到 Tailwind 工具类。

验证：

```bash
bunx vitest run tests/tailwind-renderer.test.ts
```

结果：

- RED（实现前）：失败，因为 desktop Tailwind/PostCSS 配置、Tailwind 样式表 layer 以及渲染层 `cn` 辅助函数缺失。
- 实现后 PASS：`tests/tailwind-renderer.test.ts` 通过，2 个测试。

```bash
bun run --filter @comic-canvas/desktop build
```

结果：

- PASS：Electron Vite 在渲染层构建中处理了 Tailwind CSS。

```bash
bun run lint
bun run typecheck
```

结果：

- RED（`tsconfig.json` 更新前）：lint 失败，因为 `desktop/tailwind.config.ts` 未包含在 TypeScript 项目服务中。
- 将 Tailwind 配置加入根 TypeScript include 后 PASS。

### M2-16 图片节点

范围：

- 使用 `hjwall/pc-client` 画布节点模式作为渲染层参考，同时保持 ComicCanvas 契约与 `global/design/DESIGN.md` token 为权威来源。
- 新增了具备 idle、expanded、pending、running、done 和 error 状态的渲染层 `ImageNode`。
- 新增了 prompt 覆盖、模型选择、朝向选择、异步 generate 回调以及安全的 `cc-asset://` 预览渲染。
- 保持该节点仅为渲染层：无主进程导入、无直接文件访问、无同步生成字节流，也无轮询。

验证：

```bash
bunx vitest run tests/image-node.test.tsx
```

结果：

- RED（实现前）：失败，因为 `desktop/src/renderer/src/canvas/nodes/ImageNode` 不存在。
- 实现后 PASS：`tests/image-node.test.tsx` 通过，4 个测试。

```bash
bunx vitest run tests/image-node.test.tsx tests/text-node.test.tsx tests/tailwind-renderer.test.ts
```

结果：

- PASS：3 个测试文件通过，10 个测试通过。

```bash
bun run lint
bun run typecheck
bun run --filter @comic-canvas/desktop build
bun run ci
```

结果：

- PASS：lint 以退出码 0 完成。
- RED（测试辅助函数修复前）：typecheck 失败，因为 `Partial<ImageNodeProps>` 不允许对 `data` 进行部分覆盖。
- 在为部分 `ImageNodeData` 覆盖收窄测试辅助函数类型后 PASS。
- PASS：Electron Vite desktop 构建以退出码 0 完成。
- PASS：完整 CI 以 19 个测试文件、57 个测试通过完成，随后 lint、typecheck、desktop/shared 构建以及仓库验证均以退出码 0 完成。

### M2-17 视频节点

范围：

- 在实现前阅读了 `hjwall/pc-client/src/modules/workflow-canvas/nodes/VideoNode.tsx`、`VideoGenerationNode.tsx`、`VideoConfigNode.tsx` 和 `RunStatusBadge.tsx`。
- 新增了具备 idle、expanded、pending、running、done 和 error 状态的渲染层 `VideoNode`。
- 新增了 prompt 覆盖、模型选择、朝向选择、时长选择、首/尾帧图片选择、异步 generate 回调以及安全的 `cc-asset://` 视频预览渲染。
- 保持该节点仅为渲染层：无主进程导入、无直接文件访问、无同步生成字节流，也无轮询。

验证：

```bash
bunx vitest run tests/video-node.test.tsx
```

结果：

- RED（实现前）：失败，因为 `desktop/src/renderer/src/canvas/nodes/VideoNode` 不存在。
- 实现后 PASS：`tests/video-node.test.tsx` 通过，4 个测试。

```bash
bunx vitest run tests/video-node.test.tsx tests/image-node.test.tsx tests/text-node.test.tsx tests/tailwind-renderer.test.ts
```

结果：

- PASS：4 个测试文件通过，14 个测试通过。

```bash
bun run lint
bun run typecheck
bun run --filter @comic-canvas/desktop build
bun run ci
```

结果：

- PASS：lint 以退出码 0 完成。
- PASS：TypeScript 严格编译以退出码 0 完成。
- PASS：Electron Vite desktop 构建以退出码 0 完成。
- PASS：完整 CI 以 20 个测试文件、61 个测试通过完成，随后 lint、typecheck、desktop/shared 构建以及仓库验证均以退出码 0 完成。

### M2-18 连接校验 UX

范围：

- 在实现前阅读了 `hjwall/pc-client/src/modules/workflow-canvas/lib/connection-toast.ts`、`store.ts` 以及连接规则相关测试。
- 新增了渲染层 `createCanvasConnectHandler`，使未来的 React Flow `onConnect` 调用走统一的画布 store，而不是重复实现矩阵规则。
- 新增了 `ConnectionFeedback`，用于为非法及重复连接渲染无障碍访问的中文连接失败反馈。
- 保留共享矩阵作为规则来源：处理器委托给 `CanvasStoreState.addEdge`，其消费的是 `shared/connection-matrix.ts`。

验证：

```bash
bunx vitest run tests/connection-validation-ux.test.tsx
```

结果：

- RED（实现前）：失败，因为 `desktop/src/renderer/src/canvas/components/ConnectionFeedback` 和 `canvas/lib/connection-validation` 不存在。
- 实现后 PASS：`tests/connection-validation-ux.test.tsx` 通过，3 个测试。

```bash
bunx vitest run tests/connection-validation-ux.test.tsx tests/connection-matrix.test.ts tests/canvas-store.test.ts tests/video-node.test.tsx tests/image-node.test.tsx tests/text-node.test.tsx tests/tailwind-renderer.test.ts
```

结果：

- PASS：7 个测试文件通过，24 个测试通过。

```bash
bun run lint
bun run typecheck
bun run --filter @comic-canvas/desktop build
bun run ci
```

结果：

- PASS：lint 以退出码 0 完成。
- PASS：TypeScript 严格编译以退出码 0 完成。
- PASS：Electron Vite desktop 构建以退出码 0 完成。
- PASS：完整 CI 以 21 个测试文件、64 个测试通过完成，随后 lint、typecheck、desktop/shared 构建以及仓库验证均以退出码 0 完成。

### M2-19 已连接输入面板

范围：

- 在实现前阅读了 `hjwall/pc-client/src/modules/workflow-canvas/components/ConnectedInputsPanel.tsx` 和 `lib/composed-prompt.ts`。
- 新增了一个纯渲染层 `buildConnectedInputsView` 适配器，将画布 store 图投影到共享的 `composeFinalPrompt` 契约，而非重复实现 prompt 拼接。
- 新增了 `ConnectedInputsPanel`，使用 Tailwind + `cn`、有序的上游文本条目、参考图数量，以及一个与 `shared/composed-prompt.ts` 字节等价的最终 prompt 预览。
- 将该面板挂载在图片和视频节点的展开配置区域，位于 `Prompt override` 上方；当零个上游文本节点时仍不渲染面板。
- 通过 Zustand selector 添加了 store 订阅行为，同时为测试及备用画布实例保留受控的图属性传参。

验证：

```bash
bunx vitest run tests/connected-inputs-panel.test.tsx
```

结果：

- RED（实现前）：失败，因为 `desktop/src/renderer/src/canvas/components/ConnectedInputsPanel` 和 `canvas/lib/connected-inputs` 不存在。
- RED（实时更新）：当省略图属性时失败，因为该组件未订阅画布 store。
- 实现后 PASS：`tests/connected-inputs-panel.test.tsx` 通过，4 个测试。

```bash
bunx vitest run tests/connected-inputs-panel.test.tsx tests/composed-prompt.test.ts tests/canvas-store.test.ts tests/text-node.test.tsx tests/image-node.test.tsx tests/video-node.test.tsx tests/tailwind-renderer.test.ts
```

结果：

- PASS：7 个测试文件通过，24 个测试通过。

```bash
bunx vitest run tests/connected-inputs-panel.test.tsx tests/image-node.test.tsx tests/video-node.test.tsx tests/composed-prompt.test.ts tests/canvas-store.test.ts tests/tailwind-renderer.test.ts
bun run lint
bun run typecheck
bun run ci
```

结果：

- PASS：集成的图片/视频节点回归测试以 6 个测试文件、20 个测试通过完成。
- PASS：lint 以退出码 0 完成。
- PASS：TypeScript 严格编译以退出码 0 完成。
- PASS：完整 CI 以 22 个测试文件、68 个测试通过完成，随后 lint、typecheck、desktop/shared 构建以及仓库验证均以退出码 0 完成。

### M2-20 节点尺寸与内联重命名基础组件

范围：

- 在实现前阅读了 `hjwall/pc-client/src/modules/workflow-canvas/nodes/TextNode.tsx`、`ImageGenerationNode.tsx` 以及朝向相关组件测试。
- 使用 Bun 安装了 `@xyflow/react`，并将真实的 `NodeResizer` 集成到 Text、Image 和 Video 节点中。
- 新增了共享的 `node-sizing` 基础组件，用于朝向宽高比、预览宽度、节点最小尺寸以及 NodeResizer Tailwind 类。
- 新增了可复用的 `useInlineRename` hook，并将 `TextNode` 的内联重命名行为迁移到该共享 hook。
- 保持图片和视频预览帧在宽度稳定的情况下使用朝向驱动的 `aspect-ratio`，并保持媒体元素为 `object-fit: contain`。

验证：

```bash
bunx vitest run tests/node-sizing.test.ts tests/inline-rename-hook.test.tsx tests/node-resizer-integration.test.ts
```

结果：

- RED（实现前）：失败，因为 `canvas/lib/node-sizing`、`canvas/hooks/use-inline-rename` 以及 NodeResizer 集成尚不存在。
- 实现后 PASS：3 个测试文件通过，5 个测试通过。

```bash
bunx vitest run tests/text-node.test.tsx tests/image-node.test.tsx tests/video-node.test.tsx tests/tailwind-renderer.test.ts
bun run lint
bun run typecheck
bun run ci
```

结果：

- PASS：节点回归测试以 4 个测试文件、14 个测试通过完成。
- PASS：lint 以退出码 0 完成。
- PASS：TypeScript 严格编译以退出码 0 完成。
- PASS：完整 CI 以 25 个测试文件、73 个测试通过完成，随后 lint、typecheck、desktop/shared 构建以及仓库验证均以退出码 0 完成。

### M2-21 图的保存与加载

范围：

- 新增了 `shared/graph.ts`，作为持久化画布图的契约，包含节点、位置、边和视口。
- 新增了由 `WorkflowRepository` 支撑的 `canvas.saveGraph` 与 `canvas.loadGraph` IPC handler。
- 持久化的图保存现在通过一个仓储事务运行，该事务会插入一个图版本并同时刷新工作流时间戳。
- 通过 `shared/connection-matrix.ts` 重新校验已保存的边，在持久化前丢弃缺失节点或非法的边。
- 在 `docs/api-contracts/canvas-plan.md` 中记录了保存/加载的请求、响应、错误、权限及测试规则。

验证：

```bash
bun run typecheck
```

结果：

- RED（图位置支持前）：TypeScript 失败，因为 `CanvasGraphNode` 不接受 `position`，且一个旧的仓储测试仍在使用没有 `viewport` 的图。
- 实现后 PASS：TypeScript 严格编译以退出码 0 完成。

```bash
bunx vitest run tests/canvas-graph-persistence.test.ts
```

结果：

- PASS：图的保存/加载集成测试通过，覆盖了 handler 重建后的最新版本加载、节点位置、视口、合法边的保留、非法边的丢弃，以及工作流时间戳的刷新。

```bash
bunx vitest run tests/ipc-skeleton.test.ts tests/repository-boundaries.test.ts
```

结果：

- PASS：IPC 注册与仓储边界回归测试通过，2 个测试文件、7 个测试。

```bash
bun run lint
bun run typecheck
bun run test
bun run build
bun run ci
```

结果：

- PASS：lint 以退出码 0 完成。
- PASS：TypeScript 严格编译以退出码 0 完成。
- PASS：完整测试套件以 26 个测试文件、74 个测试通过完成。
- PASS：desktop/shared 构建以退出码 0 完成。
- PASS：完整 CI 中 lint、typecheck、测试、构建以及仓库验证均通过。

### M2-22 渲染层零轮询

范围：

- 在实现前阅读了 `hjwall/pc-client/src/modules/workflow-canvas/__tests__/no-polling.static.spec.ts` 和 `hooks/useWorkflowTaskRealtime.ts`。
- 使用 Bun 安装了 `@tanstack/react-query`，并将渲染层根节点包裹在 `QueryClientProvider` 中。
- 新增了一个针对 `job.completed`、`job.failed` 和 `asset.changed` 的类型化 preload 事件桥，返回取消订阅回调而不暴露原始 `ipcRenderer`。
- 新增了 `createIpcJobEventBus`，使 worker 的终态事件能够通过 Electron IPC 分发给存活的渲染层窗口，同时保留对重复终态事件的拒绝逻辑。
- 新增了 `useCanvasRealtime` 和 `registerCanvasRealtimeInvalidation`，使任务和资产的终态事件能够使 job/asset 查询失效，而不依赖渲染层轮询。
- 新增了一个渲染层静态守卫，在生产渲染层源码中出现 `setInterval`、`refetchInterval` 或资产/任务轮询循环字面量时会失败。

验证：

```bash
bunx vitest run tests/renderer-zero-polling.test.ts
bunx vitest run tests/canvas-realtime-invalidation.test.ts
bunx vitest run tests/job-ipc-fanout.test.ts
```

结果：

- RED（实现前）：零轮询测试失败，因为 preload 缺少 `subscribeMain`/类型化事件辅助函数。
- RED（实现前）：实时失效测试失败，因为 `canvas/hooks/use-canvas-realtime` 不存在。
- RED（实现前）：任务 IPC 分发测试失败，因为 `desktop/src/main/jobs/ipc-fanout.ts` 不存在。
- 实现后 PASS：3 个测试文件通过，4 个测试通过。

```bash
bun run lint
bun run typecheck
bun run test
bun run build
bun run ci
```

结果：

- PASS：lint 以退出码 0 完成。
- PASS：TypeScript 严格编译以退出码 0 完成。
- PASS：完整测试套件以 29 个测试文件、78 个测试通过完成。
- PASS：desktop/shared 构建以退出码 0 完成。
- PASS：完整 CI 中 lint、typecheck、测试、构建以及仓库验证均通过。

### M3-23 OpenAI 兼容 Provider

范围：

- 新增了实现现有 `GatewayProvider` 接口的 `createOpenAICompatibleProvider`。
- 通过标准化的 `GatewayRequest` 支持 OpenAI 兼容的 `/images/generations` 和 `/chat/completions` 请求。
- 将图片的 `b64_json` 和临时图片 URL 响应标准化为与 provider 无关的 `assetBytes` 结果。
- 将 chat completion 内容和 token 用量标准化为与 provider 无关的 `text` 结果。
- 在远程提交前拒绝不支持的视频请求，并对 provider 错误中的 API key 进行红化。

验证：

```bash
bunx vitest run tests/openai-compatible-provider.test.ts
```

结果：

- RED（实现前）：失败，因为 `desktop/src/main/providers/openai-compatible.provider.ts` 不存在。
- 实现后 PASS：OpenAI 兼容 provider 测试通过，1 个测试文件、4 个测试。

```bash
bun run lint
bun run typecheck
bun run test
bun run build
bun run ci
```

结果：

- PASS：lint 以退出码 0 完成。
- PASS：TypeScript 严格编译以退出码 0 完成。
- PASS：完整测试套件以 30 个测试文件、82 个测试通过完成。
- PASS：desktop/shared 构建以退出码 0 完成。
- PASS：完整 CI 中 lint、typecheck、测试、构建以及仓库验证均通过。

### 前端 UI 基线对齐

范围：

- 将渲染层 UI 路线从仅限 M2 的画布说明提升为全局 M2-M5 基线。
- 要求所有渲染层 UI 任务在引入新的局部 UI 模式之前，先使用 Tailwind CSS、共享的 `cn` 辅助函数、`global/design/DESIGN.md` 中的 token，以及最接近的 `hjwall/pc-client` 模块。
- 为网关设置、Chat/Plan UI、agent 设置、工具管理、资产库、skill 管理和插件管理任务新增了明确的 `pc-client` 参考路径。
- 更新了 backlog 当前前端路线，使其与规范里程碑规格保持一致。

验证：

```bash
bunx vitest run tests/tailwind-renderer.test.ts
git diff --check
```

结果：

- PASS：Tailwind 渲染层基线测试通过，1 个测试文件、3 个测试。
- PASS：`git diff --check` 以退出码 0 完成。

### M3-24 异步媒体任务适配器

范围：

- 新增了 `pollWithBackoff`，用于 provider 侧的异步任务轮询，支持指数回退、超时处理、进度回调和 worker 侧取消检查。
- 新增了 `createAsyncMediaProvider`，用于常见的提交/轮询/获取媒体任务协议。
- 将已完成的异步图片/视频输出（来自 base64 或临时媒体 URL）标准化为 `assetBytes` 结果。
- 在共享网关错误契约中新增了 `provider_canceled`，使 worker 取消与远程 provider 失败区分开。
- 为 `GatewayProvider.invoke` 扩展了一个携带 `isCanceled` 和 `onProgress` 的可选上下文。
- 扩展了任务事件总线和 IPC 分发适配器，使其可以广播 `job.progress` 事件而不将其视为终态事件。

验证：

```bash
bunx vitest run tests/polling-strategy.test.ts tests/async-media-provider.test.ts
bunx vitest run tests/job-ipc-fanout.test.ts
```

结果：

- RED（实现前）：异步媒体测试失败，因为 `desktop/src/main/providers/async-media.provider.ts` 不存在。
- RED（实现前）：轮询策略测试失败，因为 `desktop/src/main/providers/polling-strategy.ts` 不存在。
- RED（实现前）：进度分发测试失败，因为 `events.emitProgress` 不存在。
- 实现后 PASS：轮询、异步媒体 provider 以及任务 IPC 分发测试通过，3 个测试文件、10 个测试。

```bash
bun run lint
bun run typecheck
bun run test
bun run build
bun run ci
```

结果：

- PASS：lint 以退出码 0 完成。
- PASS：TypeScript 严格编译以退出码 0 完成。
- PASS：完整测试套件以 32 个测试文件、92 个测试通过完成。
- PASS：desktop/shared 构建以退出码 0 完成。
- PASS：完整 CI 中 lint、typecheck、测试、构建以及仓库验证均通过。

### M3-25 网关设置 UI

范围：

- 在 UI 工作前阅读了 `global/design/DESIGN.md`，并使用了现有的 Tailwind + `cn` 渲染管线。
- 在实现 ComicCanvas 专属组件前，参考了 `hjwall/pc-client/src/modules/project/components/` 和 `hjwall/pc-client/src/components/common/` 的表单/对话框模式。
- 新增了 `GatewayList` 和 `GatewayForm` 渲染层组件，支持新增/编辑/删除/测试、启用开关、掩码 key 显示、能力选择以及文本/图片/视频模型映射。
- 为 `gateway.list`、`gateway.save`、`gateway.delete` 和 `gateway.test` 新增了类型化 preload 方法。
- 扩展了网关 IPC 骨架以注册 list/save/delete/test handler，同时将真实的加密保险箱行为留给 M3-26、热重载留给 M3-27。
- 将网关设置面板挂载到当前渲染层外壳中，使该 UI 在应用内可访问。

验证：

```bash
bunx vitest run tests/gateway-settings-ui.test.tsx tests/gateway-preload.test.ts
bunx vitest run tests/ipc-skeleton.test.ts tests/electron-security.test.ts
bun run typecheck
bun run lint
```

结果：

- RED（实现前）：网关设置 UI 测试失败，因为 `GatewayForm` 和 `GatewayList` 不存在。
- RED（实现前）：网关 preload 测试失败，因为类型化网关方法未被暴露。
- 实现后 PASS：网关设置/preload/安全/IPC 测试通过，4 个测试文件、13 个测试。
- PASS：TypeScript 严格编译以退出码 0 完成。
- PASS：lint 以退出码 0 完成。

```bash
bun run lint
bun run typecheck
bun run test
bun run build
bun run ci
```

结果：

- PASS：lint 以退出码 0 完成。
- PASS：TypeScript 严格编译以退出码 0 完成。
- PASS：完整测试套件以 34 个测试文件、98 个测试通过完成。
- PASS：desktop/shared 构建以退出码 0 完成。
- PASS：完整 CI 中 lint、typecheck、测试、构建以及仓库验证均通过。

### M3-26 加密密钥保险箱

范围：

- 在 `desktop/src/main/security/key-vault.ts` 下新增了 `createKeyVault`。
- 实现了一个兼容 safeStorage 的适配器边界，提供 `isEncryptionAvailable`、`encryptString` 和 `decryptString`。
- 将加密后的 provider 密钥以 base64 密文形式存储，并使用稳定的 `gateway:<providerId>` key 引用。
- 为加密不可用以及解密/加密失败的情况新增了拒绝路径，使用 `gateway_secret_unavailable`。
- 确保原生存储失败不会在抛出的消息中回显明文密钥。

验证：

```bash
bunx vitest run tests/key-vault.test.ts
bun run typecheck
bun run lint
```

结果：

- RED（实现前）：密钥保险箱测试失败，因为 `desktop/src/main/security/key-vault.ts` 不存在。
- 实现后 PASS：密钥保险箱测试通过，1 个测试文件、4 个测试。
- PASS：TypeScript 严格编译以退出码 0 完成。
- PASS：lint 以退出码 0 完成。

```bash
bun run lint
bun run typecheck
bun run test
bun run build
bun run ci
```

结果：

- PASS：lint 以退出码 0 完成。
- PASS：TypeScript 严格编译以退出码 0 完成。
- PASS：完整测试套件以 35 个测试文件、102 个测试通过完成。
- PASS：desktop/shared 构建以退出码 0 完成。
- PASS：完整 CI 中 lint、typecheck、测试、构建以及仓库验证均通过。

### 前端治理后续工作

范围：

- 确认了 desktop 渲染层已经在使用 Tailwind CSS v3、PostCSS、共享的 `cn` 辅助函数以及 `global/design/DESIGN.md` 中的 token。
- 将 Tailwind + `cn` + `global/design/DESIGN.md` + 最接近的 `hjwall/pc-client` 参考要求新增到 PM agent 治理规则中，使未来的渲染层 UI 任务在规划阶段就带有相同的基线。
- 扩展了渲染层 Tailwind 基础测试，使其同时保护 PM agent 治理文本与里程碑规格。

验证：

```bash
bunx vitest run tests/tailwind-renderer.test.ts
```

结果：

- PASS：Tailwind renderer foundation 测试通过，1 个测试文件、3 个测试。

### M3-27 Provider 热重载与模型映射

范围：

- 新增了 `GatewayRegistry.reload` 以及模型 key 的回退逻辑，使省略 `modelKey` 的请求能够从当前 provider 的每通道模型映射中解析。
- 通过在调用时捕获 provider handle 来保留正在进行的调用行为；reload 只会替换未来的 registry handle，不会修改已经在运行的 provider 调用。
- 新增了 `createGatewayConfigReloader`，用于从已启用的网关配置视图重建 stub、OpenAI 兼容以及异步媒体 provider。
- 扩展了 stub provider 的构建逻辑，使其在 reload 期间保留已配置的网关 ID 和模型映射。
- 在网关 IPC handler 中注册了 `gateway.reload`，并通过 preload 暴露了类型化的 `reloadGateways`。
- 在 `docs/api-contracts/gateway-providers.md` 中记录了 `gateway.reload` 的请求/响应以及重载不变量。

验证：

```bash
bunx vitest run tests/gateway-hot-reload.test.ts tests/gateway-preload.test.ts
bunx vitest run tests/gateway-hot-reload.test.ts tests/gateway-preload.test.ts tests/ipc-skeleton.test.ts tests/stub-provider.test.ts
bunx vitest run tests/openai-compatible-provider.test.ts tests/async-media-provider.test.ts tests/gateway-settings-ui.test.tsx tests/gateway-preload.test.ts tests/gateway-hot-reload.test.ts
bun run typecheck
bun run lint
```

结果：

- RED（实现前）：热重载测试失败，因为 `GatewayRegistry.reload` 不存在。
- RED（实现前）：网关 handler 在保存时未触发 reload，也未注册 `gateway.reload`。
- RED（实现前）：preload 未暴露 `reloadGateways`。
- RED（stub reload 修复前）：配置重载返回的 provider ID 是 `stub`，而不是配置的网关 ID `stub-main`。
- 实现后 PASS：热重载、preload、IPC 骨架以及 stub provider 测试通过，4 个测试文件、10 个测试。
- PASS：网关 provider/设置回归测试通过，5 个测试文件、16 个测试。
- PASS：TypeScript 严格编译以退出码 0 完成。
- PASS：lint 以退出码 0 完成。

```bash
bun run test
bun run build
bun run ci
```

结果：

- PASS：完整测试套件以 36 个测试文件、106 个测试通过完成。
- PASS：desktop/shared 构建以退出码 0 完成。
- PASS：完整 CI 中 lint、typecheck、测试、构建以及仓库验证均通过。

## 2026-06-25 - M4 Agent 编排

### M4-28 编排器 AsyncGenerator 运行

范围：

- 阅读了 `cc-haha-main/src/query.ts`、`QueryEngine.ts` 和 `query/deps.ts`，作为 AsyncGenerator 驱动循环和依赖注入的概念性参考，未复制源码。
- 新增了 `desktop/src/main/agent/orchestrator.ts`，其中 `runOrchestrator` 是一个 `while (true)` 的 AsyncGenerator 状态机，用于流式产出进度并返回声明式的 `CanvasPlan`。
- 新增了 `createOrchestratorRuntime`，使 `canvas.chatSend` 在规划器/模型工作开始前先入队一个 `agent.run` 任务并返回一个待处理票据。
- 新增了 `canvas.chatSend` 和 `canvas.chatGetPlan` 的主进程 IPC handler，以及类型化的 preload API `sendCanvasChat` 和 `getCanvasPlan`。
- 在 `docs/api-contracts/canvas-plan.md` 中记录了 chat-to-plan 的 IPC 契约。

验证：

```bash
bun x vitest run tests/gateway-preload.test.ts
```

结果：

- RED（preload 实现前）：失败，因为 `desktop/src/preload/index.ts` 未暴露 `sendCanvasChat`。

```bash
bun x vitest run tests/gateway-preload.test.ts tests/ipc-skeleton.test.ts tests/orchestrator-runtime.test.ts
bun run typecheck
bun run lint
```

结果：

- 实现后 PASS：preload、IPC 骨架以及编排器运行时测试通过，3 个测试文件、8 个测试。
- PASS：TypeScript 严格编译以退出码 0 完成。
- PASS：lint 以退出码 0 完成。

```bash
bun run test
bun run build
bun run ci
```

结果：

- PASS：完整测试套件以 37 个测试文件、109 个测试通过完成。
- PASS：desktop/shared 构建以退出码 0 完成。
- PASS：完整 CI 中 lint、typecheck、测试、构建以及仓库验证均通过。

### M4-29 ToolRuntime 与 Canvas 工具集

范围：

- 阅读了 `cc-haha-main/src/Tool.ts` 以及代表性的读/写工具，以了解可复用的形态：基于 schema 的工具定义、权限检查、读/写并发控制，以及可选的进度流式产出。
- 新增了 `desktop/src/main/tools/runtime.ts`，包含 `defineTool`、`createToolRuntime`、schema 校验、安全的调用记录、权限策略钩子、只读工具的并行执行以及写入工具的串行执行。
- 新增了 `desktop/src/main/tools/canvas/index.ts`，包含内置的画布工具：`queryGraph`、`proposePlan`、`createNode`、`connectNodes`、`updateNodeData`、`deleteNode` 和 `runNode`。
- 确保 `connectNodes` 使用 `shared/connection-matrix.ts`，且 `runNode` 只入队一个本地任务票据而不等待生成的资产。
- 新增了 `zod` 作为 ToolRuntime 以及未来插件/自定义工具契约的 schema 校验依赖。

验证：

```bash
bun x vitest run tests/tool-runtime.test.ts tests/canvas-tools.test.ts
```

结果：

- RED（实现前）：失败，因为 `desktop/src/main/tools/canvas` 不存在，且 `zod` 在测试/运行时边界中不可用。
- 实现后 PASS：ToolRuntime 与 canvas 工具集测试通过，2 个测试文件、6 个测试。

```bash
bun run typecheck
bun run lint
```

结果：

- PASS：TypeScript 严格编译以退出码 0 完成。
- PASS：lint 以退出码 0 完成。

```bash
bun run ci
```

结果：

- PASS：完整 CI 以 lint、typecheck、39 个测试文件 / 115 个测试、构建以及仓库验证全部通过完成。

### M4-30 sanitizePlan

范围：

- 新增了 `desktop/src/main/agent/sanitize-plan.ts`，作为主进程针对不受信任的 CanvasPlan 输出的安全门。
- Sanitizer 强制执行共享节点白名单、边类型白名单、`shared/connection-matrix.ts`、运行动作白名单，以及嵌套可执行字符串的剥离。
- 被丢弃的记录会被保留并合并进 `plan.dropped` 以供审计。
- 将 `runOrchestrator` 与该 sanitizer 连接，在产出/存储最终 Plan 之前先对规划器输出进行清洗。

验证：

```bash
bun x vitest run tests/sanitize-plan.test.ts
```

结果：

- RED（实现前）：失败，因为 `desktop/src/main/agent/sanitize-plan.ts` 不存在。
- 实现后 PASS：sanitizePlan 测试通过，1 个测试文件、5 个测试。
- PASS：属性/注入覆盖测试生成了 120 个用例，并验证清洗后的输出中没有可执行字符串残留。

```bash
bun x vitest run tests/orchestrator-runtime.test.ts tests/sanitize-plan.test.ts
bun x tsc --noEmit --pretty false
bun x eslint . --max-warnings=0
```

结果：

- PASS：编排器运行时与 sanitizePlan 回归测试通过，2 个测试文件、7 个测试。
- PASS：TypeScript 严格编译以退出码 0 完成。
- PASS：lint 以退出码 0 完成。

```bash
bun run ci
```

结果：

- PASS：完整 CI 以 lint、typecheck、40 个测试文件 / 120 个测试、构建以及仓库验证全部通过完成。

### M4-31 Chat Plan IPC

范围：

- 扩展了 `chat-message.repo.ts`，新增消息查找以及 plan/apply-status 更新 API，使 chat 持久化保持在仓储边界之后。
- 新增了 `CanvasPlanEventBus`，以及用于异步 Plan 完成通知的 Electron `canvas.planReady` 分发。
- 更新了 `createOrchestratorRuntime`，使其在 `chatSend` 时持久化用户 chat 消息，保持同步响应不携带 plan，在 agent 任务完成后存储已清洗的 Plan JSON，并发出 `canvas.planReady`。
- 通过沙箱化的 preload 桥暴露了 `onCanvasPlanReady`。

验证：

```bash
bun x vitest run tests/chat-plan-ipc.test.ts
```

结果：

- RED（实现前）：失败，因为 `desktop/src/main/agent/plan-events.ts` 不存在。
- 实现后 PASS：chat plan IPC 测试通过，1 个测试文件、3 个测试。

```bash
bun x vitest run tests/chat-plan-ipc.test.ts tests/orchestrator-runtime.test.ts tests/repository-boundaries.test.ts tests/gateway-preload.test.ts
bun x eslint . --max-warnings=0
bun x tsc --noEmit --pretty false
```

结果：

- PASS：chat plan IPC、编排器运行时、仓储边界以及 preload 回归测试通过，4 个测试文件、9 个测试。
- PASS：lint 以退出码 0 完成。
- PASS：TypeScript 严格编译以退出码 0 完成。

```bash
bun run ci
```

结果：

- PASS：完整 CI 以 lint、typecheck、41 个测试文件 / 123 个测试、构建以及仓库验证全部通过完成。

### M4-32 applyPlan 与 PlanRunner

范围：

- 在渲染层工作前阅读了 `global/design/DESIGN.md`，并将 `hjwall/pc-client/src/modules/workflow-canvas/lib/plan-applier.ts` 和 `plan-runner.ts` 作为概念性参考。
- 新增了 `desktop/src/renderer/src/canvas/lib/apply-plan.ts`，用于通过渲染层 store 将 CanvasPlan 的节点/边应用为单个可撤销快照。
- applyPlan 在将 ref 映射到画布节点 ID 之前，会在本地重新校验节点类型、边类型、共享连接矩阵规则、图片角色以及运行动作白名单。
- 新增了 `desktop/src/renderer/src/canvas/lib/plan-runner.ts`，作为一个带失败短路的纯串行 runSteps 状态机。

验证：

```bash
bun x vitest run tests/apply-plan-runner.test.ts
```

结果：

- RED（实现前）：失败，因为 `desktop/src/renderer/src/canvas/lib/apply-plan.ts` 不存在。
- 实现后 PASS：applyPlan 与 PlanRunner 测试通过，1 个测试文件、4 个测试。

```bash
bun x vitest run tests/apply-plan-runner.test.ts tests/canvas-store.test.ts tests/connection-matrix.test.ts tests/sanitize-plan.test.ts
bun x eslint . --max-warnings=0
bun x tsc --noEmit --pretty false
```

结果：

- PASS：渲染层 applyPlan/PlanRunner 与画布契约回归测试通过，4 个测试文件、16 个测试。
- PASS：lint 以退出码 0 完成。
- PASS：TypeScript 严格编译以退出码 0 完成。

```bash
bun run ci
```

结果：

- PASS：完整 CI 以 lint、typecheck、42 个测试文件 / 127 个测试、构建以及仓库验证全部通过完成。

### M4-33 Chat UI

范围：

- 在渲染层 UI 工作前阅读了 `global/design/DESIGN.md`，并使用了现有的 Tailwind + `cn` 渲染管线。
- 参考了 `hjwall/pc-client/src/modules/workflow-canvas/components/CanvasChatBox.tsx`、`BottomInputPanel.tsx`、`MentionTextarea.tsx` 和 `CommandPalette.tsx`，了解 chat 输入框、自动执行、键盘操作以及命令入口的模式。
- 新增了 `desktop/src/renderer/src/chat/ChatPanel.tsx`，用于异步画布 chat 发送、`canvas.planReady` 订阅、plan 获取、消息历史、Enter/Shift+Enter 行为以及自动执行状态。
- 新增了 `desktop/src/renderer/src/chat/PlanCard.tsx`，用于展示已清洗的 Plan 摘要、节点/边/运行步骤计数、丢弃警告、澄清展示以及应用控件。
- 将 `ChatPanel` 挂载到 `App.tsx` 中，并将 Apply Plan 接到 `applyCanvasPlan(plan, canvasStore)`。

验证：

```bash
bun x vitest run tests/chat-ui.test.tsx
```

结果：

- RED（实现前）：失败，因为 `desktop/src/renderer/src/chat/ChatPanel.tsx` 不存在。
- 实现后 PASS：ChatPanel 与 PlanCard 组件测试通过，1 个测试文件、5 个测试。

```bash
bun x vitest run tests/chat-ui.test.tsx tests/apply-plan-runner.test.ts tests/tailwind-renderer.test.ts
bun x tsc --noEmit --pretty false
bun x eslint . --max-warnings=0
```

结果：

- PASS：Chat UI、applyPlan/PlanRunner 以及 Tailwind renderer 基线测试通过，3 个测试文件、12 个测试。
- PASS：TypeScript 严格编译以退出码 0 完成。
- PASS：lint 以退出码 0 完成。

```bash
bun run ci
```

结果：

- PASS：完整 CI 以 lint、typecheck、43 个测试文件 / 132 个测试、构建以及仓库验证全部通过完成。

### M4-34 Agent 编排冒烟路径

范围：

- 新增了渲染层的 `createCanvasPlanExecutionController`，用于桥接 `applyPlan`、`PlanRunner`、`canvas.runNode` 以及任务终态事件。
- 接通了 `App.tsx`，使 Chat 的 `autoExecute` 能够启动 runSteps，并使任务的 completed/failed 事件将已规划的节点更新为 done/error。
- 通过沙箱化的 preload 桥暴露了 `runCanvasNode`。
- 更新了 `canvas.runNode` IPC，使其在可用时通过注入的持久化队列入队，而不是只返回一个占位票据。
- 新增了 `createMainProcessRuntime`，并从 Electron 主入口安装它，使真实的应用启动能够注册 canvas/job/asset/gateway/chat handler、仓储层、队列、worker、stub 网关、资产管线以及 plan/job IPC 分发。
- 新增了持久化队列入队后的运行时自动排空机制，使真实的 Electron IPC 调用能够处理 agent/runNode 任务而无需手动的仅测试用 worker 调用。
- 强化了 `sanitizePlan`，使其能丢弃诸如 `onRun` 这类事件处理器风格的键，以及诸如 `window.*` 这类全局对象可执行字符串。

验证：

```bash
bun x vitest run tests/agent-orchestration-smoke.test.ts
```

结果：

- RED（实现前）：失败，因为 `desktop/src/renderer/src/canvas/lib/canvas-plan-execution.ts` 不存在。
- RED（sanitizer 强化前）：失败，因为注入的 `onRun: "window.evil()"` 没有产生被丢弃的记录。
- RED（App/preload 接线前）：失败，因为渲染层 App 未使用 Plan 执行控制器，且 preload 未暴露 `canvas.runNode`。
- 实现后 PASS：agent 编排冒烟测试通过，1 个测试文件、2 个测试。

```bash
bun x vitest run tests/main-runtime-wiring.test.ts
```

结果：

- RED（实现前）：失败，因为 `desktop/src/main/runtime.ts` 不存在。
- RED（入口安装前）：失败，因为 `desktop/src/main/index.ts` 未调用 `createMainProcessRuntime`。
- 实现后 PASS：主运行时接线测试通过，1 个测试文件、2 个测试。

```bash
bun x vitest run tests/main-runtime-wiring.test.ts tests/agent-orchestration-smoke.test.ts tests/ipc-skeleton.test.ts tests/job-ipc-fanout.test.ts tests/chat-plan-ipc.test.ts
bun x tsc --noEmit --pretty false
```

结果：

- PASS：运行时接线、M4 冒烟、IPC 骨架、任务分发以及 chat plan IPC 测试通过，5 个测试文件、15 个测试。
- PASS：TypeScript 严格编译以退出码 0 完成。

```bash
bun run ci
```

结果：

- PASS：完整 CI 以 lint、typecheck、45 个测试文件 / 137 个测试、构建以及仓库验证全部通过完成。

## 2026-06-25 - M5 高级平台

### M5-35 spawnSubAgent

范围：

- 在实现前阅读了 `docs/api-contracts/agents.md`、`shared/agents.ts` 以及当前的 M4 agent/工具运行时。
- 概念性地参考了 `cc-haha-main` 中关于隔离子运行、每子级工具池、最大轮次边界以及可追踪任务执行的说明，未复制源码。
- 新增了 `desktop/src/main/agent/spawn-sub-agent.ts`，包含父子权限交集、通过 `MAX_SPAWN_DEPTH` 实现的深度限制、子运行依赖注入、安全错误类，以及独立的子级追踪元数据。
- 扩展了 `shared/agents.ts`、兼容层 `shared/tools-agents.ts` barrel、`docs/api-contracts/agents.md` 以及遗留的 `docs/api-contracts/tools-agents.md`，使 `SpawnSubAgentResult` 携带 `droppedSkills` 和可审计的 `trace`。

验证：

```bash
bun x vitest run tests/spawn-sub-agent.test.ts
```

结果：

- RED（实现前）：失败，因为 `desktop/src/main/agent/spawn-sub-agent.ts` 不存在。
- 实现后 PASS：spawnSubAgent 测试通过，1 个测试文件、3 个测试。

```bash
bun x tsc --noEmit --pretty false
```

结果：

- RED（精确可选属性修复前）：失败，因为可选的 `modelId` 被显式传入了 `undefined`。
- 收窄可选子运行字段后 PASS：TypeScript 严格编译以退出码 0 完成。

```bash
bun run ci
```

结果：

- PASS：完整 CI 以 lint、typecheck、46 个测试文件 / 140 个测试、构建以及仓库验证全部通过完成。

### M5-36 子 Agent 隔离与合并

范围：

- 在实现前阅读了 `desktop/src/main/tools/canvas/index.ts`、`desktop/src/main/db/repositories/workflow.repo.ts`、`shared/graph.ts`、`shared/plan.ts` 以及当前的画布图持久化测试。
- 新增了 `desktop/src/main/agent/sub-agent-isolation.ts`，包含 `createIsolatedSubAgentDraft` 和 `applySubAgentResult`。
- 复用了现有的 `CanvasGraphStore` 契约，使子级画布工具只写入一个克隆的草稿图，直到父级显式合并。
- 新增了 `desktop/src/main/agent/sanitize-graph.ts`，用于在持久化前剥离子级草稿图节点数据中的可执行字符串并丢弃不支持的值。
- 更新了 agents 和 canvas-plan 契约，说明子 agent 的草稿写入在父级合并前不会持久化，且合并会通过共享连接矩阵重新校验边。

验证：

```bash
bun x vitest run tests/sub-agent-isolation.test.ts
```

结果：

- RED（实现前）：失败，因为 `desktop/src/main/agent/sub-agent-isolation.ts` 不存在。
- 实现后 PASS：子 agent 隔离与合并测试通过，1 个测试文件、2 个测试。

```bash
bun x tsc --noEmit --pretty false
bun x eslint . --max-warnings=0
```

结果：

- PASS：TypeScript 严格编译以退出码 0 完成。
- PASS：lint 以退出码 0 完成。

```bash
bun run ci
```

结果：

- PASS：完整 CI 以 lint、typecheck、47 个测试文件 / 142 个测试、构建以及仓库验证全部通过完成。


### M5-37 自定义 Agent 设置

范围：

- 新增了 `desktop/src/main/agent/registry.ts` 和 `desktop/src/main/ipc/agent.handler.ts`，使内置 agent 与持久化的自定义 agent 共用同一个 registry 边界。
- 完成了 `desktop/src/main/db/repositories/agent.repo.ts` 中通过 `agents.policy_json` 对用户 agent 的 CRUD 持久化。
- 暴露了类型化的 preload API：`listAgents`、`saveAgent` 和 `deleteAgent`，并在真实主进程运行时中注册了 AgentRegistry。
- 在 `AgentList.tsx` 和 `AgentForm.tsx` 中新增了 Tailwind + `cn` 渲染层设置 UI，遵循现有的网关设置样式以及 `hjwall/pc-client` 密集设置/确认对话框交互模式，未复制参考源码。
- 将 Agent 设置挂载到 `App.tsx` 中，保持内置 agent 只读，同时允许创建、编辑和删除用户 agent。
- 更新了 `docs/api-contracts/agents.md`、规范里程碑任务，以及 REQ-053 的 backlog 状态。

验证：

```bash
bun x vitest run tests/agent-settings-ipc.test.ts tests/agent-settings-ui.test.tsx
```

结果：

- RED（实现前）：后端失败，因为 `desktop/src/main/agent/registry.ts` 缺失；UI 失败，因为 `AgentForm` 和 `AgentList` 缺失。
- 实现后 PASS：自定义 Agent 设置 IPC 与 UI 测试通过，2 个测试文件、8 个测试。

```bash
bun x vitest run tests/agent-settings-ipc.test.ts tests/agent-settings-ui.test.tsx tests/gateway-preload.test.ts tests/ipc-skeleton.test.ts tests/main-runtime-wiring.test.ts
bun x tsc --noEmit --pretty false
bun x eslint . --max-warnings=0
```

结果：

- PASS：目标 M5-37、preload、IPC 骨架以及主运行时接线测试通过，5 个测试文件、17 个测试。
- PASS：TypeScript 严格编译以退出码 0 完成。
- PASS：lint 以退出码 0 完成。

```bash
bun run ci
```

结果：

- PASS：完整 CI 以 lint、typecheck、49 个测试文件 / 150 个测试、desktop/shared 构建以及仓库验证全部通过完成。

### M5-38 @mention Agent 选择器

范围：

- 阅读了渲染层工作已强制执行的 `global/design/DESIGN.md` 基线，并参考了 `hjwall/pc-client/src/modules/workflow-canvas/components/MentionTextarea.tsx`、`CommandPalette.tsx`、`CanvasChatBox.tsx` 和 `BottomInputPanel.tsx` 的 mention、键盘操作以及密集输入框模式。
- 新增了 `desktop/src/renderer/src/chat/useMentionTrigger.ts`，用于检测文本域光标周围末尾的 `@query`。
- 新增了 `desktop/src/renderer/src/chat/AgentMentionPopover.tsx`，包含 Tailwind + `cn` 列表框渲染、活动项状态、鼠标悬停、点击选择以及可访问的选项标签。
- 更新了 `ChatPanel.tsx`，使其加载 `agent.list`、默认使用内置编排器、在输入 `@` 时打开 popover、支持 ArrowUp/ArrowDown/Enter/Escape、显示已选 agent 的 chip、剥离可见的 mention 前缀，并将 `canvas.chatSend.agentId` 路由到所选 agent。

验证：

```bash
bun x vitest run tests/chat-ui.test.tsx --reporter=dot
```

结果：

- RED（实现前）：新的路由测试失败，因为不存在 `Agent mention selector` 列表框。
- 实现后 PASS：Chat UI 测试通过，1 个测试文件、6 个测试。

```bash
bun run typecheck
bun run lint
```

结果：

- PASS：TypeScript 严格编译以退出码 0 完成。
- PASS：lint 以退出码 0 完成。

```bash
bun run ci
```

结果：

- PASS：完整 CI 以 lint、typecheck、49 个测试文件 / 151 个测试、desktop/shared 构建以及仓库验证全部通过完成。

### M5-39 工具管理 UI

范围：

- 扩展了 `desktop/src/main/tools/runtime.ts`，新增 `enable` 和 `disable`、描述符克隆、禁用工具列表，以及通过现有 `tool_not_found` 安全错误路径实现的禁用调用拒绝。
- 新增了 `desktop/src/main/ipc/tool.handler.ts`，支持 `tool.list`、`tool.invoke`、`tool.enable` 和 `tool.disable`。
- 将真实主进程运行时接到 `createToolRuntime`、内置画布工具以及 `registerToolHandlers`。
- 暴露了类型化的 preload 方法：`listTools`、`enableTool`、`disableTool` 和 `invokeTool`。
- 在 `desktop/src/renderer/src/settings/ToolList.tsx` 中新增了 Tailwind + `cn` 渲染层设置 UI，遵循现有的网关/Agent 设置卡片模式以及 `hjwall/pc-client` 密集设置参考，未复制源码。
- 将工具设置挂载到 `App.tsx` 中，并更新了 M5 进度/backlog 状态。

验证：

```bash
bun x vitest run tests/tool-runtime.test.ts tests/tool-management-ipc.test.ts tests/tool-settings-ui.test.tsx tests/gateway-preload.test.ts tests/ipc-skeleton.test.ts --reporter=dot
```

结果：

- RED（实现前）：失败，因为 `runtime.disable` 缺失、`desktop/src/main/ipc/tool.handler.ts` 缺失、preload 未暴露工具操作，且 `ToolList` 不存在。
- 实现后 PASS：工具运行时、工具 IPC、preload、IPC 骨架以及工具设置 UI 测试通过，5 个测试文件、15 个测试。

```bash
bun x vitest run tests/tool-runtime.test.ts tests/tool-management-ipc.test.ts tests/tool-settings-ui.test.tsx tests/gateway-preload.test.ts tests/ipc-skeleton.test.ts tests/main-runtime-wiring.test.ts --reporter=dot
bun run typecheck
bun run lint
```

结果：

- PASS：目标 M5-39 加上主运行时接线测试通过，6 个测试文件、17 个测试。
- PASS：TypeScript 严格编译以退出码 0 完成。
- PASS：lint 以退出码 0 完成。

```bash
bun run ci
```

结果：

- PASS：完整 CI 以 lint、typecheck、51 个测试文件 / 156 个测试、desktop/shared 构建以及仓库验证全部通过完成。

### M5-40 资产库文件夹

范围：

- 在 `shared/assets.ts`、`shared/ipc.ts` 和 `docs/api-contracts/assets-files.md` 中为 `asset.getFolders`、`asset.createFolder` 和 `asset.deleteFolder` 新增了嵌套资产文件夹契约。
- 扩展了 `AssetRepository`，新增文件夹 CRUD、按文件夹/媒体类型的资产列表、资产移动、引用记录、安全的回收站拒绝，以及强制墓碑化的文件夹删除。
- 为 list/move/trash/文件夹创建/文件夹删除接通了资产 IPC handler 和 preload 方法，并注入了运行时仓储层。
- 在 `desktop/src/renderer/src/assets/AssetPanel.tsx` 中新增了 Tailwind + `cn` 渲染层 UI，挂载在 `App.tsx` 中，改编自 `hjwall/pc-client` 的资产库模式，未复制源码。
- 更新了 IPC 骨架测试覆盖，以适配扩展后的资产通道集合。

验证：

```bash
bun x vitest run tests/asset-folders-repo.test.ts tests/asset-folders-ipc.test.ts tests/asset-preload.test.ts tests/asset-panel-ui.test.tsx --reporter=dot
```

结果：

- RED（实现前）：失败，因为 `createFolder`、扩展的资产 IPC handler、preload 资产方法以及 `AssetPanel` 均缺失。
- 实现后 PASS：资产文件夹仓储、IPC、preload 以及渲染层 UI 测试通过，4 个测试文件、5 个测试。

```bash
bun run typecheck
bun run lint
bun run test -- --reporter=dot
```

结果：

- PASS：TypeScript 严格编译以退出码 0 完成。
- PASS：lint 以退出码 0 完成。
- PASS：完整测试套件通过，55 个测试文件、161 个测试。

```bash
bun run ci
```

结果：

- PASS：完整 CI 以 lint、typecheck、55 个测试文件 / 161 个测试、desktop/shared 构建以及仓库验证全部通过完成。

## 2026-06-26 - CI/CD Bun 强化

范围：

- 保持 Bun 作为包管理器与任务运行器，同时将脆弱的 Windows `.bin` shim 调用替换为 ESLint、TypeScript、Vitest 和原生重建的显式 Bun 脚本入口。
- 新增了 `@electron/rebuild` 和 `rebuild:native`，使 `better-sqlite3` 在生产 desktop 构建前针对 Electron 的 ABI 重建。
- 新增了 `eslint-plugin-react-hooks`，以匹配现有的渲染层 lint 指令并防止规则缺失导致的失败。
- 更新了 GitHub Actions CI/release 任务，为需要现代 Node 兼容性的工具在 Bun 旁安装 Node 24。
- 修复了渲染层和 IPC 代码中当前的 lint 阻塞项：显式的 fire-and-forget Promise 处理、安全的 Zustand 方法选择器、未使用的导入/类型，以及导航 Promise 处理。

验证：

```bash
bun run lint
bun run typecheck
bun run test -- --reporter=dot
bun run build
bun run verify:repo
bun run ci
```

结果：

- PASS：lint 以退出码 0 完成。
- PASS：TypeScript 严格编译以退出码 0 完成。
- PASS：Vitest 入口通过 Bun 成功运行。
- PASS：Electron 原生重建完成，且 desktop 构建以退出码 0 完成。
- PASS：仓库验证通过。
- PASS：完整 CI 门禁以 lint、typecheck、测试、构建以及仓库验证全部通过完成。

操作说明：

- 在 Windows 上，`rebuild:native` 必须在 Electron 关闭的情况下运行；活动的 Electron 进程可能会锁定 `better_sqlite3.node`，导致重建期间出现 `EPERM`。

## 2026-06-26 - REQ-092 本地媒体拖放切片

范围：

- 新增了 `desktop/src/renderer/src/canvas/lib/local-media-drop.ts`，用于在修改画布之前对本地拖放文件进行分类。
- 图片和视频拖放现在会规划 `asset.import` 请求，并在主进程返回安全的资产记录后，在拖放位置创建图片/视频画布节点。
- 沙箱化的 preload 桥现在暴露了类型化的 `importAsset`，仅映射到现有的 `asset.import` IPC 契约。
- 画布资产插入与本地文件拖放现在共用同一个节点创建路径，包括 `assetId`、`url` 和 `status: done`，使导入的媒体能够通过安全 URL 渲染。
- 音频拖放会被明确拒绝，并显示中文的用户提示消息，直到共享的音频节点契约落地。

验证：

```bash
bun node_modules/typescript/bin/tsc --noEmit --pretty false
bun node_modules/eslint/bin/eslint.js desktop/src/renderer/src/canvas/lib/local-media-drop.ts desktop/src/renderer/src/canvas/CanvasPage.tsx desktop/src/preload/index.ts tests/local-media-drop.test.ts --max-warnings=0
& 'C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' node_modules\vitest\vitest.mjs run tests/local-media-drop.test.ts --reporter=verbose
```

结果：

- PASS：TypeScript 严格编译以退出码 0 完成。
- PASS：目标 ESLint 以退出码 0 完成。
- PASS：本地媒体拖放测试通过，1 个测试文件、3 个测试。

当前阻塞项：

- `bun node_modules/vitest/vitest.mjs run tests/local-media-drop.test.ts` 在 Windows 上于测试收集前失败，报 `TypeError: File URL path must be an absolute path`。
- `bun x vitest ...` 目前因 Bun bin 重映射错误失败：`could not create process`。
- 通过 Codex 内置 Node 运行的完整测试套件能够到达测试阶段，但许多仓储层/运行时测试失败，因为 `better-sqlite3` 是为 NODE_MODULE_VERSION 130 编译的，而内置 Node 需要 137。这是环境/ABI 不匹配问题，并非 REQ-092 已完成的证据。
- 完整的 desktop 拖放用户流程证据仍待补充，因此 REQ-092 仍为部分完成状态。

## 2026-06-26 - Windows Bun/Node/Electron ABI 后续处理

范围：

- 将黑屏/应用关闭症状的根因定位到 `better-sqlite3` 在测试设置后被编译为 Node ABI 137，而 Electron 33 需要 ABI 130。
- 更改了根目录的 `dev`，使 desktop 启动时先运行 `rebuild:native`，防止之前的 Node/Vitest 运行使 Electron 残留错误的原生模块 ABI。
- 新增了 `scripts/run-vitest.mjs`，使 `bun run test` 仍作为任务入口，同时 Vitest 在真实的 Node 进程中执行。这避免了 Windows 上 Bun 运行时启动 Vitest 失败的问题（`File URL path must be an absolute path`）。
- 更新了过时的契约测试，使其匹配当前的路由/画布架构、扩展后的 IPC 通道、中文本地化的 AssetPanel UI，以及当前的 `canvas.runNode` 参考负载。
- 将 `CanvasPage` 重新接线到 `createCanvasPlanExecutionController`，保留了从 `applyPlan` 到 `runCanvasNode` 以及任务终态事件更新的真实 Plan 自动执行路径。

验证：

```bash
& 'C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' node_modules\vitest\vitest.mjs run tests\electron-skeleton.test.ts tests\ipc-skeleton.test.ts tests\asset-panel-ui.test.tsx tests\agent-orchestration-smoke.test.ts --reporter=dot
bun run typecheck
bun run lint
& 'C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' node_modules\vitest\vitest.mjs run tests\local-media-drop.test.ts tests\db-schema.test.ts --reporter=verbose
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun run test -- tests\electron-skeleton.test.ts tests\ipc-skeleton.test.ts tests\asset-panel-ui.test.tsx tests\agent-orchestration-smoke.test.ts tests\local-media-drop.test.ts tests\db-schema.test.ts --reporter=dot
bun run rebuild:native
Start-Process -FilePath bun -ArgumentList @('run','dev') -WorkingDirectory 'D:\draw\hjw' -WindowStyle Hidden -PassThru
Invoke-WebRequest -UseBasicParsing http://localhost:5173/
```

结果：

- PASS：更新后的 IPC/electron/asset/orchestration 目标测试通过，4 个文件、12 个测试。
- PASS：TypeScript 严格编译以退出码 0 完成。
- PASS：ESLint 以退出码 0 完成。
- PASS：本地媒体拖放加 DB schema 测试通过，2 个文件、5 个测试。
- PASS：`bun run test` 包装器通过带 `NODE_BINARY` 的 Node 执行了 Vitest，6 个文件、17 个测试。
- PASS：Electron 原生重建完成，且 desktop dev 进程已启动；Vite 渲染层从 `http://localhost:5173/` 返回了 HTTP 200。

操作说明：

- CI 已经安装了 Node 24，因此 `bun run test` 在那里可以解析到 `node`。在本地 Codex shell 中若 `node` 不在 PATH 上，需要在运行测试前将 `NODE_BINARY` 设置为 Node 20+ 可执行文件。
- 在同一工作区中运行 Node/Vitest 和 Electron dev 需要 ABI 切换：测试需要 Node ABI；desktop dev/构建需要 `bun run rebuild:native` 来获得 Electron ABI。

## 2026-06-26 - REQ-094 风格契约与 Prompt 拼接切片

范围：

- 阅读了 hjwall 风格参考：`backend/src/modules/style/style-prompt.util.ts`、其单元测试、`style-preset.entity.ts` 和 `StyleLibraryPanel.tsx`。
- 新增了 `shared/styles.ts`，作为 ComicCanvas 关于风格预设视图、保存输入、项目默认请求、有效风格解析以及确定性 prompt 拼接的共享真源。
- 新增了 `docs/api-contracts/styles.md`，记录风格 list/save/delete/project-default 通道以及 prompt 拼接不变量。
- 为 `style.list`、`style.save`、`style.delete`、`style.setProjectDefault` 和 `style.changed` 新增了类型化的共享 IPC 条目。
- 保留了与 hjwall 兼容的 prompt 规则：`promptBefore + content + promptAfter`，空部分会被跳过，仅当 before/after 均为空时才回退到旧版 `legacyPromptPreset`。

验证：

```bash
& 'C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' node_modules\vitest\vitest.mjs run tests\style-contracts.test.ts --reporter=verbose
bun run typecheck
bun run lint
```

结果：

- RED（首次）：`tests/style-contracts.test.ts` 失败，因为 `../shared/styles` 不存在。
- RED（新增类型级 IPC 断言后）：`bun run typecheck` 失败，因为 `StyleIpcChannel` 以及风格请求/响应映射条目缺失。
- 实现后 PASS：风格契约测试通过，1 个文件、6 个测试。
- PASS：TypeScript 严格编译以退出码 0 完成。
- PASS：ESLint 以退出码 0 完成。

REQ-094 剩余缺口：

- 尚无风格仓储层/schema 迁移。
- 尚未注册主进程风格 IPC handler。
- 尚未接通渲染层风格库或项目/节点选择器 UI。
- 尚无生成任务负载测试证明风格注入被运行时图片/视频任务使用。

## 2026-06-26 - REQ-094 风格仓储层与 IPC 切片

范围：

- 新增了 SQLite 迁移 `0003_style_presets`，包含 `style_presets` 和 `workflows.default_style_preset_id`。
- 为 `style_presets` 和工作流默认风格新增了 Drizzle schema 声明。
- 新增了 `StyleRepository`，用于风格的保存/列表/软删除以及工作流项目默认风格持久化。
- 新增了 `registerStyleHandlers`，支持 `style.list`、`style.save`、`style.delete` 和 `style.setProjectDefault`。
- 在主进程运行时和 IPC 骨架测试覆盖中注册了风格 IPC。

验证：

```bash
& 'C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' node_modules\vitest\vitest.mjs run tests\style-repository-ipc.test.ts --reporter=verbose
& 'C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' node_modules\vitest\vitest.mjs run tests\style-repository-ipc.test.ts tests\style-contracts.test.ts tests\ipc-skeleton.test.ts tests\db-schema.test.ts --reporter=dot
bun run typecheck
bun run lint
```

结果：

- RED（首次）：测试失败，因为 `desktop/src/main/db/repositories/style.repo` 不存在。
- RED（初次实现后）：Node/Vitest 被 `better-sqlite3` 的 Electron ABI 阻塞；通过 `bun install --force` 恢复了 Node ABI。
- RED（到达断言后）：项目默认风格未持久化，因为测试尚未创建工作流行；修复了测试以践行真实的同数据库工作流前置条件。
- PASS：风格仓储层/IPC 测试通过，1 个文件、3 个测试。
- PASS：风格契约、风格仓储层/IPC、IPC 骨架以及 DB schema 测试通过，4 个文件、17 个测试。
- PASS：TypeScript 严格编译以退出码 0 完成。
- PASS：ESLint 以退出码 0 完成。

REQ-094 剩余缺口：

- 尚无渲染层风格库 UI。
- 尚未接通项目级或节点级风格选择器。
- 尚无生成任务负载测试证明运行时图片/视频任务会调用 `composeStyledPrompt`。
- 尚无 desktop 用户流程证据表明可以选择一个风格并用该风格运行 stub 生成。

## 2026-06-26 - REQ-094 运行时风格负载切片

范围：

- 在 `canvas.runNode` 和 `canvas.runPlan` 中新增了基于已持久化图快照的运行时任务负载拼接。
- 运行时负载现在在选中已启用风格时包含拼接后的 prompt、模型 key、生成参数、引用以及风格负向 prompt。
- 节点级 `stylePresetId` 会在任务入队时覆盖工作流项目默认风格。
- 将主进程运行时接线，使其把真实的 `StyleRepository` 传入画布 IPC handler。

验证：

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/style-runtime-payload.test.ts
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/main-runtime-wiring.test.ts
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/style-runtime-payload.test.ts tests/style-contracts.test.ts tests/style-repository-ipc.test.ts tests/ipc-skeleton.test.ts tests/main-runtime-wiring.test.ts tests/m1-smoke-path.test.ts
bun run typecheck
bun run lint
```

结果：

- RED（首次）：`tests/style-runtime-payload.test.ts` 失败，因为 `canvas.runNode` 只入队了 `{ nodeId, references }`，遗漏了 `prompt`、`modelKey` 和 `parameters`。
- RED（新增运行时级哈希断言后）：`tests/main-runtime-wiring.test.ts` 失败，因为已持久化的项目风格未被传入 `registerCanvasHandlers`。
- PASS：风格运行时负载测试通过，1 个文件、1 个测试。
- PASS：主运行时接线测试通过，1 个文件、3 个测试。
- PASS：目标风格/运行时/冒烟测试组通过，6 个文件、20 个测试。
- PASS：TypeScript 严格编译以退出码 0 完成。
- PASS：ESLint 以退出码 0 完成。

REQ-094 剩余缺口：

- 尚无渲染层风格库 UI。
- 尚未接通项目级或节点级风格选择器。
- 尚无 desktop 用户流程证据表明可以选择一个风格并用该风格运行 stub 生成。

## 2026-06-26 - 画布空白屏幕 / Maximum Update Depth 修复

范围：

- 通过在 Electron 中打开默认项目画布，重现了 desktop“黑屏”报告。
- 实际可见的失败是 React 的路由错误浮层：`Maximum update depth exceeded`。
- 根因定位在画布渲染层的 Zustand selector，它们从 `useStore(canvasStore, selector)` 返回了新创建的函数，导致外部 store 快照不稳定。
- 将这些 selector 替换为稳定的 store action selector，并为 `CanvasStoreState` 的 action 标注了 `this: void`，使 lint 允许安全的方法提取。
- 新增了一个回归测试，用于拒绝画布渲染层文件中新创建的函数式 selector。

验证：

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/canvas-store-selector-stability.test.ts
bun run lint
bun run typecheck
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/canvas-store-selector-stability.test.ts tests/agent-orchestration-smoke.test.ts tests/style-runtime-payload.test.ts tests/main-runtime-wiring.test.ts
```

结果：

- RED（首次）：`tests/canvas-store-selector-stability.test.ts` 在 `CanvasPage.tsx` 和 `ImageConfigV2Node.tsx` 上失败。
- PASS：selector 稳定性回归测试通过，1 个文件、1 个测试。
- PASS：目标画布/agent/风格/运行时测试组通过，4 个文件、7 个测试。
- PASS：TypeScript 严格编译以退出码 0 完成。
- PASS：ESLint 以退出码 0 完成。

Desktop 观察：

- 修复前：Electron 项目列表正常渲染，但打开 `Default workspace` 时会显示 React 的 `Maximum update depth exceeded` 路由错误浮层。
- 修复后的 desktop 验证仍需要为 Electron ABI 重建原生模块并重启应用。

## 2026-06-26 - REQ-094 渲染层风格选择器切片

范围：

- 暴露了类型化的 preload 风格 API：`listStyles`、`saveStyle`、`deleteStyle` 和 `setProjectDefaultStyle`。
- 移除了 `ImageConfigV2Node` 中硬编码的仅前端图片风格预设列表。
- 将图片和视频 V2 节点的风格 chip 接线，使其通过 `window.comicCanvas.listStyles({ includeDisabled: false })` 加载已启用的风格预设。
- 新增了加载中/不可用标签，并在选择时保留节点级 `stylePresetId` 更新。

验证：

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/style-renderer-ui.test.tsx
bun run typecheck
bun run lint
bun install --force
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/style-renderer-ui.test.tsx tests/style-contracts.test.ts tests/ipc-skeleton.test.ts tests/canvas-store-selector-stability.test.ts tests/style-runtime-payload.test.ts tests/main-runtime-wiring.test.ts tests/style-repository-ipc.test.ts
```

结果：

- RED（首次）：`tests/style-renderer-ui.test.tsx` 失败，因为图片节点风格选择器从未调用 `listStyles`。
- RED（第二次）：新增的视频节点风格选择器测试失败，因为视频工具栏仍带有一个不起作用的风格 chip，且没有发起任何 `listStyles` 调用。
- PASS：风格渲染层 UI 测试通过，1 个文件、2 个测试。
- PASS：目标风格/运行时/仓储层/IPC/画布回归测试组通过，7 个文件、22 个测试。
- PASS：TypeScript 严格编译以退出码 0 完成。
- PASS：ESLint 以退出码 0 完成。

操作说明：

- 第一个目标运行时测试组遇到了 `better-sqlite3` ABI 不匹配问题，因为 Electron ABI 130 仍已安装，而 Node/Vitest 需要 ABI 137。停止残留的 Electron/electron-vite/esbuild 进程并运行 `bun install --force` 恢复了 Node 测试 ABI。

REQ-094 剩余缺口：

- 尚无渲染层风格库 CRUD UI。
- 尚无项目级默认风格选择器 UI。
- 尚无 desktop 风格选择和 stub 生成流程证据。

## 2026-06-26 - REQ-094 风格库、本地化与项目负载切片

范围：

- 在共享 IPC 契约、主进程风格 handler、preload 桥以及风格 API 契约文档中新增了 `style.getProjectDefault`。
- 在设置 > 风格中新增了 `StyleLibrary`，支持风格预设的列表/创建/编辑/删除/切换工作流。
- 在画布工具栏新增了 `ProjectStyleSelector`，使工作流可以加载、展示、清除并持久化其默认风格。
- 保持图片/视频节点风格选择器由 `style.list` 支撑，而不是硬编码的仅前端风格选项。

验证：

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/style-contracts.test.ts tests/style-repository-ipc.test.ts tests/style-settings-ui.test.tsx tests/project-style-selector.test.tsx tests/ipc-skeleton.test.ts tests/style-renderer-ui.test.tsx
bun run typecheck
bun run lint
bun run dev
Invoke-WebRequest -UseBasicParsing http://localhost:5173/
```

结果：

- RED（首次）：`tests/style-contracts.test.ts` 和 `tests/style-repository-ipc.test.ts` 失败，因为 IPC 契约和 handler 中缺少 `style.getProjectDefault`。
- RED（首次）：`tests/style-settings-ui.test.tsx` 失败，因为 `StyleLibrary` 不存在。
- RED（首次）：`tests/project-style-selector.test.tsx` 失败，因为 `ProjectStyleSelector` 不存在。
- PASS：目标风格 UI/IPC/渲染层测试通过，6 个文件、21 个测试。
- PASS：TypeScript 严格编译以退出码 0 完成。
- PASS：ESLint 以退出码 0 完成。
- PASS：Electron 原生重建通过 `bun run dev` 完成；Vite 渲染层从 `http://localhost:5173/` 返回了 HTTP 200。

Desktop 观察：

- Electron 窗口 `ComicCanvas Studio` 渲染出了带有 `Default workspace` 的项目列表；打开它渲染出了画布，而不是之前的 `Maximum update depth exceeded` 路由错误。
- 画布工具栏渲染出了 `Project style: None`，选择器打开后显示 `No project style`。
- 设置 > 风格渲染出了风格库面板。创建带有 prompt-before、prompt-after、描述和标签的 `Industrial Ink` 保存成功，并立即出现在列表中。
- 返回画布后，在项目风格菜单中显示出了 `Industrial Ink`。选择它后持久化成功，并将工具栏更新为 `Project style: Industrial Ink`。

REQ-094 剩余缺口：

- 风格预设封面缩略图渲染尚未实现。
- 风格库和 ProjectStyleSelector 的 UI 文案仍部分为英文，需要产品本地化处理。
- 在 REQ-094 标记完成前，仍需捕获使用已选项目风格和节点覆盖的完整 desktop stub 生成证据。

## 2026-06-26 - REQ-094 风格封面、本地化与项目负载切片

范围：

- 新增了从 `StylePresetView.coverUrl` 渲染的风格库封面缩略图。
- 在风格库表单中新增了 `coverAssetId` 编辑功能，使已保存的预设可以引用现有的安全资产 URL。
- 将风格库、设置风格标签页、ProjectStyleSelector 以及图片/视频 V2 节点风格选择器的状态本地化为中文。
- 更新了运行时生成负载拼接逻辑，使 `canvas.runNode` 和 `canvas.runPlan` 在解析工作流项目默认风格时使用请求中的工作流 ID。
- 新增了一个项目默认运行时测试，证明没有节点级风格覆盖的图片节点会从工作流默认风格获得 `promptBefore`、`promptAfter` 和 `negativePrompt`。

验证：

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/style-settings-ui.test.tsx tests/style-runtime-payload.test.ts --reporter=verbose
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/style-contracts.test.ts tests/style-repository-ipc.test.ts tests/style-runtime-payload.test.ts tests/style-renderer-ui.test.tsx tests/style-settings-ui.test.tsx tests/project-style-selector.test.tsx tests/ipc-skeleton.test.ts tests/main-runtime-wiring.test.ts --reporter=dot
bun run typecheck
bun run lint
bun run dev
Invoke-WebRequest -UseBasicParsing http://localhost:5173/
```

结果：

- RED（首次）：`tests/style-settings-ui.test.tsx` 失败，因为风格库仍使用英文文案、没有封面缩略图，且未保存 `coverAssetId`。
- RED（首次）：`tests/style-runtime-payload.test.ts` 失败，因为 `canvas.runNode` 在解析工作流默认值时用的是 `default` 而不是请求中的 `workflowId`。
- 实现后 PASS：目标风格库与运行时负载测试通过，2 个文件、5 个测试。
- 实现后 PASS：风格/IPC/运行时/渲染层回归测试组通过，8 个文件、27 个测试。
- PASS：TypeScript 严格编译以退出码 0 完成。
- PASS：ESLint 以退出码 0 完成。
- PASS：Electron 原生重建通过 `bun run dev` 完成；Vite 渲染层从 `http://localhost:5173/` 返回了 HTTP 200。

操作说明：

- 运行完整的风格仓储层/运行时测试组最初失败，因为 `better-sqlite3` 仍是为 Electron ABI 130 编译的，而 Node/Vitest 需要 ABI 137。停止 Electron dev 进程并运行 `bun install --force` 恢复了 Node 测试 ABI。
- 最后一次尝试通过 Windows 自动化捕获 Electron 窗口时因应用批准超时而失败，因此本地化后的风格 UI 的最新 desktop 截图证据仍待补充。

REQ-094 剩余缺口：

- 本地化后的风格封面展示以及使用项目默认风格运行 stub 生成的最新 desktop 用户流程证据仍待补充。
- 运行时现在已有针对项目默认与节点覆盖优先级的自动化负载证据，但在 REQ-094 标记完成前，仍需从 desktop 流程中观察到相同的行为。

## 2026-06-26 - REQ-094 渲染层工作流 ID 运行接线

范围：

- 为共享的 `canvas.runNode` 请求契约扩展了可选的 `workflowId`。
- 通过在 run-plan 请求上允许可选的 `workflowId`，使 `canvas.runPlan` 与工作流范围的风格解析保持兼容。
- 更新了 `CanvasPage` 中渲染层的 Plan 自动执行路径，使 `window.comicCanvas.runCanvasNode` 除节点 ID 外还能接收到当前工作流 ID。
- 新增了接线覆盖测试，防止未来的渲染层改动悄悄丢弃生成请求中的 `currentWorkflowId`。

验证：

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/agent-orchestration-smoke.test.ts tests/style-runtime-payload.test.ts tests/style-contracts.test.ts --reporter=dot
bun run typecheck
bun run lint
```

结果：

- PASS：渲染层编排冒烟、风格运行时负载以及风格契约测试通过，3 个文件、10 个测试。
- PASS：TypeScript 严格编译以退出码 0 完成。
- PASS：ESLint 以退出码 0 完成。

REQ-094 剩余缺口：

- desktop 验收仍需要一段从画布 UI 捕获的运行记录，展示已选的项目默认风格到达排队生成任务并产生对应的 stub 资产。

## 2026-06-26 - REQ-094 工作流范围运行时风格运行

范围：

- 为真实的 `createMainProcessRuntime` 路径新增了运行时覆盖测试，覆盖 `canvas.runNode` 接收非默认 `workflowId` 的情况。
- 更新了主进程 `CanvasGraphStore` 契约，使图的读写能够按工作流 ID 分区，同时保留默认工作流调用方的行为。
- 更新了 `canvas.runNode` 和 `canvas.runPlan` 的负载构建逻辑，使引用解析以及 prompt/风格拼接读取的是请求的工作流图，而不总是 `default` 图。
- 验证了非默认工作流的项目默认风格会通过与 desktop IPC 相同的运行时路径，改变排队的 stub 生成输出哈希。

验证：

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/main-runtime-wiring.test.ts --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/main-runtime-wiring.test.ts tests/style-runtime-payload.test.ts tests/style-contracts.test.ts tests/canvas-tools.test.ts tests/agent-orchestration-smoke.test.ts --reporter=dot
bun run typecheck
```

结果：

- RED（首次）：新增的非默认工作流测试失败，因为排队的 stub 输出哈希是从错误的图 prompt 生成的，证明 `workflowId` 没有被应用到图查找中。
- 实现后 PASS：`tests/main-runtime-wiring.test.ts` 通过，1 个文件、4 个测试。
- 实现后 PASS：目标风格/运行时/工具/agent 回归测试组通过，5 个文件、17 个测试。
- PASS：TypeScript 严格编译以退出码 0 完成。

REQ-094 剩余缺口：

- desktop 验收仍需要一段捕获的 UI 运行记录，展示已选的项目默认风格到达排队生成任务并产生对应的 stub 资产。

## 2026-06-26 - REQ-096 真实任务状态 IPC 切片

范围：

- 当运行时注入了持久化任务依赖时，将主运行时的 `job.get`、`job.list` 和 `job.recover` 骨架路径替换为真实的 `JobRepository` 读取。
- 新增了带状态/类型/目标过滤以及有上限的 `JobRepository.list`，使渲染层任务面板能够观察持久化的队列状态而不使用假数据行。
- 将 `createMainProcessRuntime` 接线，使其把真实的持久化队列、任务仓储层和时钟传入 `registerJobHandlers`。
- 为早期注册测试保留了骨架回退逻辑，这些测试有意在未提供完整运行时依赖的情况下实例化 handler。
- 新增了一个运行时测试，证明一个 `canvas.runNode` 票据在终态完成前可以通过 `job.get` 查询到已持久化的目标 ID、prompt 负载和参数，在完成后也能查询到资产结果。

验证：

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/main-runtime-wiring.test.ts --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/main-runtime-wiring.test.ts tests/job-runtime.test.ts tests/ipc-skeleton.test.ts tests/repository-boundaries.test.ts --reporter=dot
bun run typecheck
```

结果：

- RED（恢复 Node/Vitest ABI 后首次）：新增的任务可观测性测试失败，因为 `job.get` 返回的是骨架行，未包含已持久化的 `targetId` 或负载。
- 实现后 PASS：`tests/main-runtime-wiring.test.ts` 通过，1 个文件、5 个测试。
- PASS：运行时/任务/IPC/仓储层回归测试组通过，4 个文件、18 个测试。
- PASS：TypeScript 严格编译以退出码 0 完成。

REQ-096 剩余缺口：

- 已迁移的视频/音频/合成节点任务分发与终态回写仍不完整。
- desktop 验收仍需要一段从真实 Electron 画布捕获的运行记录，展示排队任务详情、终态事件更新以及产生的资产。

## 2026-06-26 - REQ-096 画布重新打开时的任务对账切片

范围：

- 新增了一个纯渲染层对账辅助函数，用于处理画布页面关闭期间已完成的持久化画布任务。
- 仅对已加载图上具有当前 `targetId` 的任务，以及仅画布图片/视频类型的任务进行对账。
- 根据每个目标最新的任务恢复节点状态：已完成的资产任务设置 `status: done` 和 `assetId`，失败的任务设置 `status: error`，待处理/处理中的任务设置 `status: pending` 并清除结果资产。
- 将 `CanvasPage` 的图加载与工作流切换接线到单一的恢复路径，该路径在加载后调用一次 `job.list`，并在任务对账不可用时回退到已保存的图。
- 新增了一个静态守卫，证明画布页面使用的是一次性对账辅助函数，且没有新增渲染层轮询。

验证：

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/canvas-job-reconciliation.test.ts --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/canvas-job-reconciliation.test.ts tests/job-preload.test.ts tests/canvas-job-panel.test.tsx --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/canvas-job-reconciliation.test.ts tests/job-preload.test.ts tests/canvas-job-panel.test.tsx tests/job-runtime.test.ts tests/main-runtime-wiring.test.ts tests/job-ipc-fanout.test.ts tests/renderer-zero-polling.test.ts tests/electron-security.test.ts --reporter=dot
bun run typecheck
```

结果：

- RED（首次）：`tests/canvas-job-reconciliation.test.ts` 失败，因为
  `desktop/src/renderer/src/canvas/lib/job-reconciliation.ts` 不存在。
- 实现后 PASS：对账、preload 接线以及任务面板
  测试通过，3 个文件、8 个测试。
- 首次大范围回归在运行 Electron 后暴露出已知的原生 ABI 不匹配问题
  （`better-sqlite3` 编译为 Electron ABI 130，而 Node/Vitest
  需要 ABI 137）。停止 Electron/Bun dev 进程并运行
  `bun install --force` 恢复了 Node 测试 ABI。
- ABI 恢复后 PASS：REQ-096 任务/运行时/preload/UI/安全
  回归测试组通过，8 个文件、26 个测试。
- PASS：TypeScript 严格编译以退出码 0 完成。

REQ-096 剩余缺口：

- 已迁移的视频/音频/合成节点任务分发与终态回写仍不完整。
- desktop 验收仍需要一段捕获的重新打开流程记录，证明一个错过的
  终态任务能够根据持久化的任务状态更新已加载的画布节点。

## 2026-06-26 - REQ-096 画布任务面板切片

范围：

- 通过沙箱化的 preload 桥暴露了 `listJobs`，作为对 `job.list` 的类型化封装。
- 新增了 `CanvasJobPanel`，作为最近本地任务的紧凑画布浮层，展示任务 ID、本地化状态、类型、目标节点、进度、失败消息以及手动刷新。
- 将该面板通过顶部工具栏和左侧工具栏“运行任务”控件接入 `CanvasPage`，使任务状态对用户可见，而不仅是测试或开发者工具可见。
- 将该面板订阅到 `job.completed` 和 `job.failed` 终态事件以刷新列表，而不使用渲染层轮询循环。

验证：

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/job-preload.test.ts tests/canvas-job-panel.test.tsx --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/job-preload.test.ts tests/canvas-job-panel.test.tsx tests/job-runtime.test.ts tests/main-runtime-wiring.test.ts tests/job-ipc-fanout.test.ts tests/renderer-zero-polling.test.ts tests/electron-security.test.ts --reporter=dot
bun run typecheck
```

结果：

- RED（首次）：preload 测试失败，因为 `listJobs` 和 `job.list` 封装缺失。
- RED（首次）：组件测试失败，因为 `CanvasJobPanel` 不存在。
- 实现后 PASS：任务 preload 与面板测试通过，2 个文件、4 个测试。
- PASS：REQ-096 UI/任务/preload/安全回归测试组通过，7 个文件、21 个测试。
- PASS：TypeScript 严格编译以退出码 0 完成。

REQ-096 剩余缺口：

- 一次性任务对账由后续的“画布重新打开时的任务对账切片”覆盖；desktop 重新打开的证据仍待在那里补充。
- 已迁移的视频/音频/合成节点任务分发与终态回写仍不完整。
- desktop 验收仍需要一段从真实 Electron 画布捕获的运行记录，展示排队任务详情、终态事件更新以及产生的资产。

## 2026-06-26 - REQ-096 任务列表过滤契约切片

范围：

- 新增了针对 `JobRepository.list` 状态、类型、目标 ID 以及最新优先限制行为的目标仓储层覆盖测试。
- 将 `limit <= 0` 定义为空结果，使渲染层任务面板可以禁用一个查询或请求空页，而不会意外收到一条持久化的任务。
- 新增了主运行时 IPC 覆盖测试，证明 `job.list` 能够通过类型、目标和限制过滤返回已持久化的 `canvas.runNode` 任务。
- 调整了该 IPC 测试，去除了待处理状态的假设，因为真实的主运行时会自动排空任务，可能在渲染层读取列表前就将排队的任务移动到 `processing` 或 `completed`。

验证：

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/job-runtime.test.ts tests/main-runtime-wiring.test.ts --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/job-runtime.test.ts tests/main-runtime-wiring.test.ts tests/ipc-skeleton.test.ts tests/repository-boundaries.test.ts tests/job-ipc-fanout.test.ts --reporter=dot
bun run typecheck
```

结果：

- RED（首次）：新增的仓储层测试失败，因为 `limit: 0` 被夹取为一行，而不是返回空列表。
- RED（首次）：最初的 IPC 测试也暴露了一个无效假设，即两个任务在自动排空后仍会保持 `pending`。
- 实现/测试修正后 PASS：`tests/job-runtime.test.ts` 和 `tests/main-runtime-wiring.test.ts` 通过，2 个文件、11 个测试。
- PASS：REQ-096 任务/运行时/IPC 回归测试组通过，5 个文件、22 个测试。
- PASS：TypeScript 严格编译以退出码 0 完成。

REQ-096 剩余缺口：

- `job.list` 的渲染层 UI 消费已由前面的画布任务面板切片覆盖。
- 一次性任务对账由后续的“画布重新打开时的任务对账切片”覆盖；desktop 重新打开的证据仍待在那里补充。
- 已迁移的视频/音频/合成节点任务分发与终态回写仍不完整。
- desktop 验收仍需要一段从真实 Electron 画布捕获的运行记录，展示排队任务详情、终态事件更新以及产生的资产。

## 2026-06-26 - REQ-093 共享节点契约与矩阵切片

范围：

- 将共享画布节点词汇扩展为已接受的迁移集合：text、image、video、character、scene、audio、imageConfigV2、videoConfigV2、videoCompose、superResolution、muxAudioVideo 和 mjImage。
- 扩展了共享连接矩阵，支持语义、媒体、配置、合成、放大、混流和 mjImage 流程，同时保留现有的 image-to-video 和 imageConfigV2-to-video 兼容性。
- 更新了 CanvasPlan 清洗逻辑、apply-plan 节点过滤/默认数据、画布工具 schema，以及针对迁移词汇的连接校验标签。
- 将此切片仅作为共享契约切片。渲染层节点组件、图序列化证据、迁移后的运行分发、终态回写以及 desktop 验收仍是任务 13 到 17 以及 25 中的后续工作。

验证：

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/node-contracts.test.ts --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/node-contracts.test.ts tests/connection-matrix.test.ts tests/sanitize-plan.test.ts tests/apply-plan-runner.test.ts tests/agent-orchestration-smoke.test.ts --reporter=dot
bun run typecheck
```

结果：

- RED（首次）：`tests/node-contracts.test.ts` 失败，因为矩阵仍只暴露旧的节点词汇，并拒绝了诸如 text-to-character 之类的迁移语义流程。
- 实现后 PASS：REQ-093 契约/矩阵/sanitizer/apply-plan 回归测试组通过，5 个文件、18 个测试。
- PASS：通过 `bun run typecheck`，TypeScript 严格编译以退出码 0 完成。

REQ-093 剩余缺口：

- 扩展后节点联合类型的图序列化覆盖仍需要显式测试和 desktop 保存/加载证据。
- Character、scene、audio、videoCompose、superResolution、muxAudioVideo 和 mjImage 仍需要生产渲染层组件和面向用户的垂直切片。
- 迁移节点的运行分发、任务终态回写以及真实 desktop 验收证据仍不完整。

## 2026-06-26 - REQ-093 图持久化序列化切片

范围：

- 新增了图持久化覆盖测试，证明所有已接受的迁移 hjwall 画布节点类型都可以通过 `canvas.saveGraph` 和 `canvas.loadGraph` 往返。
- 为未知的 `legacyNode` 新增了一个负向持久化用例，要求图 sanitizer 移除不受支持的节点以及与它们相连的所有边。
- 将图持久化清洗逻辑移入共享图契约，通过 `sanitizeCanvasGraphSnapshot` 和 `isCanvasNodeType` 实现，使 IPC 和未来的图交接路径能够复用同一套节点白名单与边校验逻辑。

验证：

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/canvas-graph-persistence.test.ts --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/node-contracts.test.ts tests/connection-matrix.test.ts tests/canvas-graph-persistence.test.ts tests/sanitize-plan.test.ts tests/apply-plan-runner.test.ts tests/agent-orchestration-smoke.test.ts --reporter=dot
bun run typecheck
```

结果：

- RED（首次）：迁移后的图持久化测试失败，因为 `canvas.saveGraph` 持久化了不受支持的 `legacyNode`。
- 实现后 PASS：`tests/canvas-graph-persistence.test.ts` 通过，1 个文件、2 个测试。
- PASS：REQ-093 图/契约/编排回归测试组通过，6 个文件、20 个测试。
- PASS：通过 `bun run typecheck`，TypeScript 严格编译以退出码 0 完成。

REQ-093 剩余缺口：

- 扩展后迁移图的 desktop 保存/加载证据仍需要从真实 Electron 画布中捕获。
- 新迁移节点的 UI 组件、面向用户的创建流程、运行分发以及终态回写仍不完整。

## 2026-06-26 - REQ-093 渲染层默认数据就绪切片

范围：

- 新增了渲染层 store 覆盖测试，证明新接受的迁移节点类型在从画布 store 创建时不会退化为视频节点的默认数据。
- 为 character、scene、audio、videoCompose、superResolution、muxAudioVideo 和 mjImage 在画布 store 中新增了显式默认数据。
- 将 `CanvasPage` 直接节点创建的默认数据与 store 同步，使未来可见的创建菜单条目产生与 store 级创建相同的持久化负载。

验证：

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/canvas-store.test.ts --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/canvas-store.test.ts tests/apply-plan-runner.test.ts tests/canvas-graph-persistence.test.ts tests/node-contracts.test.ts tests/connection-matrix.test.ts tests/agent-orchestration-smoke.test.ts --reporter=dot
bun run typecheck
```

结果：

- RED（首次）：新增的 canvas-store 测试失败，因为创建 `character` 产生了带有视频字段的 `Video 1` 数据。
- 实现后 PASS：`tests/canvas-store.test.ts` 通过，1 个文件、6 个测试。
- PASS：REQ-093 store/plan/图/契约回归测试组通过，6 个文件、20 个测试。
- PASS：通过 `bun run typecheck`，TypeScript 严格编译以退出码 0 完成。

REQ-093 剩余缺口：

- 迁移的节点类型尚未在画布创建菜单中暴露为生产 UI 组件。
- Character、scene、audio、videoCompose、superResolution、muxAudioVideo 和 mjImage 仍需要专门的渲染层节点或有意为之的通用节点策略，以及 desktop 创建/保存/加载证据。
- 迁移节点类型的运行分发与终态回写仍待完成。

## 2026-06-26 - REQ-093 通用迁移节点 UI 切片

范围：

- 新增了一个通用的 `MigratedNode` 渲染层组件，用于尚无专门生产组件的已接受 hjwall 语义/工具节点类型：character、scene、audio、videoCompose、superResolution、muxAudioVideo 和 mjImage。
- 通用节点渲染稳定的类型标签、节点标签、状态（若存在），以及根据节点类型不同的基础可编辑字段，如 description、prompt、model、category 和 asset ID。
- 在 React Flow 的 `nodeTypes` 中注册了这些迁移节点类型，并将它们暴露在画布右键菜单/展开的新增菜单中，使用户可以创建并持久化它们。
- 有意将其保持为一个通用的 UI 桥接层。它使这些节点可见且可编辑，但并不宣称对每个节点都实现了完整的专门化 hjwall 对等能力。

验证：

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/migrated-node.test.tsx tests/migrated-node-menu.test.ts --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/migrated-node.test.tsx tests/migrated-node-menu.test.ts tests/canvas-store.test.ts tests/apply-plan-runner.test.ts tests/canvas-graph-persistence.test.ts tests/node-contracts.test.ts tests/connection-matrix.test.ts --reporter=dot
bun run typecheck
bun run dev
```

结果：

- RED（首次）：`tests/migrated-node.test.tsx` 最初失败，因为 `MigratedNode` 不存在。
- RED（首次）：`tests/migrated-node-menu.test.ts` 失败，因为迁移节点类型未通过画布新增菜单暴露出来。
- 实现后 PASS：迁移节点组件/菜单测试通过，2 个文件、4 个测试。
- PASS：REQ-093 UI/store/plan/图/契约回归测试组通过，7 个文件、22 个测试。
- PASS：通过 `bun run typecheck`，TypeScript 严格编译以退出码 0 完成。
- DESKTOP 部分通过：`bun run dev` 重建了 Electron 原生模块并启动了 desktop 应用；真实的 Electron 项目页面渲染出来且没有黑屏。后续的画布新增菜单截图被用户窗口输入打断，因此不计为完成证据。

REQ-093 剩余缺口：

- 需要从新增菜单捕获真实 Electron desktop 上创建、编辑、保存和重新加载迁移通用节点的证据。
- 在 hjwall 对等能力要求更丰富的控件、预览、排序或结果处理的地方，用专门的生产组件替换通用 UI。
- 迁移节点类型的运行分发与终态回写仍待完成。

## 2026-06-26 - REQ-093/REQ-096 语义上下文 Prompt 拼接切片

范围：

- 扩展了共享的 `composeFinalPrompt`，使迁移的语义/上下文节点不再仅仅是装饰性的图节点。
- Character 和 scene 节点现在在连接于生成节点上游时，会使用它们的 label 和 description 贡献确定性的 prompt 行。
- 带有 `assetId` 的 character、scene 和 mjImage 节点现在会向同一个共享结果贡献图片引用，供渲染层预览和主运行时生成负载拼接消费。
- mjImage 节点现在会将其 prompt 文本贡献给下游生成 prompt，同时保留现有的 text/image/video 行为。

验证：

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/composed-prompt.test.ts --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/composed-prompt.test.ts tests/connected-inputs-panel.test.tsx tests/style-runtime-payload.test.ts tests/main-runtime-wiring.test.ts tests/canvas-store.test.ts tests/canvas-graph-persistence.test.ts --reporter=dot
bun run typecheck
```

结果：

- RED（首次）：新增的拼接测试失败，因为 character、scene 和 mjImage 上游节点被忽略，只出现了文本加目标 prompt 覆盖内容。
- 实现后 PASS：`tests/composed-prompt.test.ts` 通过，1 个文件、2 个测试。
- PASS：prompt 预览/运行时负载/图回归测试组通过，6 个文件、22 个测试。
- PASS：通过 `bun run typecheck`，TypeScript 严格编译以退出码 0 完成。

剩余缺口：

- Audio、videoCompose、superResolution 和 muxAudioVideo 仍需要适合其任务类型的运行时快照语义。
- Desktop 证据仍需要证明真实的画布图中带有 character、scene 和 mjImage 节点会影响可见的最终 prompt 预览和排队的任务负载。

## 2026-06-26 - REQ-096 迁移运行分发切片

范围：

- 为迁移的运行时节点新增了类型化任务队列分发，而不是把每个 `canvas.runNode` 调用都作为 `canvas.generateImage` 发送。
- `mjImage` 现在作为带有 `nodeType: "mjImage"` 的图片任务入队，包含多结果参数、语义 character/scene 上下文、自身 prompt，以及来自上游语义节点的图片引用。
- `videoCompose`、`superResolution` 和 `muxAudioVideo` 现在分别作为 `canvas.composeVideo`、`canvas.upscaleVideo` 和 `canvas.muxAudioVideo` 入队，带有结构化的输入引用和参数。
- 主运行时为视频生成、合成、放大和混流任务注册了本地 stub 上报处理器，使持久化 worker 不会仅因为真实网关执行有意排除在范围之外，而对类型化的迁移任务判定失败。

验证：

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/migrated-run-dispatch.test.ts --reporter=dot
bun run typecheck
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/migrated-run-dispatch.test.ts tests/style-runtime-payload.test.ts tests/ipc-skeleton.test.ts tests/main-runtime-wiring.test.ts tests/job-runtime.test.ts tests/composed-prompt.test.ts --reporter=dot
```

结果：

- RED（首次）：`tests/migrated-run-dispatch.test.ts` 最初失败，因为 `mjImage` 缺少运行时 prompt/引用负载，且视频合成节点仍作为 `canvas.generateImage` 入队。
- 实现后 PASS：迁移运行分发的专项测试通过，1 个文件、2 个测试。
- PASS：通过 `bun run typecheck`，TypeScript 严格编译以退出码 0 完成。
- PASS：运行时/IPC/样式/prompt/任务回归测试组通过，6 个文件、23 个测试。

剩余缺口：

- Audio 节点的入队语义仍需要一个专门的垂直切片。
- 新类型化迁移任务结果的终态回写目前仍只是 stub，需要画布节点状态/结果对账证据。
- Desktop 证据仍需要证明用户可以从画布运行这些迁移节点，并从真实应用窗口观察到任务票据/结果。

## 2026-06-26 - REQ-096 类型化迁移重新打开对账切片

范围：

- 扩展了渲染层一次性任务对账逻辑，使已完成的类型化迁移任务在工作流重新打开时不会被忽略。
- `canvas.composeVideo`、`canvas.upscaleVideo` 和 `canvas.muxAudioVideo` 现在被视为可运行的画布任务，用于持久化任务的恢复。
- 已完成的 `report` 结果现在可以将 `status: "done"` 以及可选的 `assetId`、`url`、`urls` 和 `selectedIndex` 写回迁移节点数据。
- 现有的已完成资产任务、失败任务以及 pending/processing 任务行为保持不变。

验证：

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/canvas-job-reconciliation.test.ts --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/canvas-job-reconciliation.test.ts tests/migrated-run-dispatch.test.ts tests/job-preload.test.ts tests/canvas-job-panel.test.tsx tests/job-runtime.test.ts tests/main-runtime-wiring.test.ts tests/apply-plan-runner.test.ts --reporter=dot
bun run typecheck
```

结果：

- RED（首次）：新增的对账测试失败，因为类型化迁移任务被过滤掉，且已完成的上报元数据使节点保持 pending 状态。
- 实现后 PASS：`tests/canvas-job-reconciliation.test.ts` 通过，1 个文件、4 个测试。
- PASS：任务/对账/分发/PlanRunner 回归测试组通过，7 个文件、26 个测试。
- PASS：通过 `bun run typecheck`，TypeScript 严格编译以退出码 0 完成。

剩余缺口：

- 实时终态事件在画布保持打开时仍需要相同的类型化迁移结果映射。
- Audio 节点的入队语义仍需要一个专门的垂直切片。
- Desktop 重新打开的证据仍需要证明真实的 Electron 画布能将类型化迁移任务状态重新加载到可见的节点状态/结果字段中。

## 2026-06-26 - REQ-096 类型化迁移实时回写切片

范围：

- 为一次性重新打开对账和实时 PlanRunner 终态事件复用了同一套终态结果到节点数据的映射。
- 已完成的 `report` 事件现在可以在画布保持打开时，更新一个正在运行的迁移节点为 `status: "done"`，并附带可选的 `assetId`、`url`、`urls` 和 `selectedIndex`。
- 修复了一个实时竞态：同步的 `runNode` 票据只在微任务中被注册，导致一个快速到达的终态事件可能在 `jobId -> runStep` 存储之前就已到达。
- 现有针对图片/视频节点的资产结果回写仍由编排 smoke 路径覆盖。

验证：

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/agent-orchestration-smoke.test.ts --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/agent-orchestration-smoke.test.ts tests/apply-plan-runner.test.ts tests/canvas-job-reconciliation.test.ts tests/migrated-run-dispatch.test.ts tests/job-runtime.test.ts tests/main-runtime-wiring.test.ts --reporter=dot
bun run typecheck
```

结果：

- RED（首次）：新增的 smoke 测试失败，因为已完成的迁移 `report` 结果使一个正在运行的 videoCompose 节点停留在 `pending` 状态。
- RED（后续）：接入结果映射后，同一测试暴露出一个同步票据注册竞态；终态事件可能在 job-to-step 映射填充之前到达。
- 实现后 PASS：`tests/agent-orchestration-smoke.test.ts` 通过，1 个文件、3 个测试。
- PASS：PlanRunner/对账/分发/运行时回归测试组通过，6 个文件、24 个测试。
- PASS：通过 `bun run typecheck`，TypeScript 严格编译以退出码 0 完成。

剩余缺口：

- Audio 节点的入队语义仍需要一个专门的垂直切片。
- PlanRunner 仍需要覆盖超出 videoCompose 上报回写场景之外更广泛的迁移运行步骤。
- Desktop 证据仍需要证明真实的 Electron 画布能在不要求重新加载的情况下显示实时的迁移任务结果。

## 2026-06-26 - REQ-096 Audio 运行分发切片

范围：

- 新增了 `canvas.generateAudio` 作为一等的持久化任务类型。
- `canvas.runNode` 现在将 audio 节点作为类型化 audio 任务入队，而不是退化为 `canvas.generateImage`。
- Audio 运行负载包含 audio 节点输入引用和时长元数据，使导入/生成的音频能够参与与图片/视频/合成节点相同的异步运行时模型。
- 主运行时为 audio 任务注册了一个本地 stub 上报处理器，因为真实网关请求执行有意排除在此次迁移范围之外。
- 重新打开对账现在将 `canvas.generateAudio` 视为可运行的画布任务，并将已完成的 audio 上报元数据恢复到 audio 节点数据中。

验证：

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/migrated-run-dispatch.test.ts --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/migrated-run-dispatch.test.ts tests/canvas-job-reconciliation.test.ts --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/migrated-run-dispatch.test.ts tests/canvas-job-reconciliation.test.ts tests/agent-orchestration-smoke.test.ts tests/apply-plan-runner.test.ts tests/job-runtime.test.ts tests/main-runtime-wiring.test.ts tests/ipc-skeleton.test.ts --reporter=dot
bun run typecheck
```

结果：

- RED（首次）：audio 分发测试失败，因为 audio 节点仍以仅带空引用的 `canvas.generateImage` 入队。
- 实现后 PASS：`tests/migrated-run-dispatch.test.ts` 通过，1 个文件、3 个测试。
- PASS：audio 分发加对账的专项测试通过，2 个文件、8 个测试。
- PASS：REQ-096 运行时/IPC/PlanRunner 回归测试组通过，7 个文件、32 个测试。
- PASS：通过 `bun run typecheck`，TypeScript 严格编译以退出码 0 完成。

剩余缺口：

- PlanRunner 仍需要覆盖超出 audio 和 videoCompose 上报结果场景之外更广泛的迁移运行步骤。
- Desktop 证据仍需要证明用户可以从真实的 Electron 画布运行 audio 以及下游的 mux/合成流程。

## 2026-06-26 - REQ-097 迁移 Plan 运行动作切片

范围：

- 将共享 CanvasPlan 运行动作词汇扩展为包含迁移运行时动作：`audioRun`、`mjImageRun`、`videoComposeRun`、`superResolutionRun` 和 `muxAudioVideoRun`。
- 更新了主进程的 `sanitizePlan`，使这些动作得以保留，而不是被当作 `unsupported_action` 丢弃。
- 更新了渲染层的 `applyCanvasPlan`，使迁移运行动作能映射为带有已解析节点 ID 的 PlanRunner 运行步骤。
- 将该切片保持专注于 plan 校验和运行步骤映射。自然语言编排器 prompt 生成、PlanCard 摘要文案以及真实 desktop 的 autoExecute 证据仍是后续工作。

验证：

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/sanitize-plan.test.ts tests/apply-plan-runner.test.ts --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/sanitize-plan.test.ts tests/apply-plan-runner.test.ts tests/agent-orchestration-smoke.test.ts tests/migrated-run-dispatch.test.ts tests/canvas-job-reconciliation.test.ts tests/main-runtime-wiring.test.ts --reporter=dot
bun run typecheck
```

结果：

- RED（首次）：新增的 sanitizer/applyPlan 测试失败，因为迁移运行动作被当作 `unsupported_action` 丢弃。
- 实现后 PASS：专项 Plan 动作测试通过，2 个文件、11 个测试。
- PASS：REQ-096/REQ-097 plan/运行时回归测试组通过，6 个文件、28 个测试。
- PASS：通过 `bun run typecheck`，TypeScript 严格编译以退出码 0 完成。

REQ-097 剩余缺口：

- 编排器 prompt/工具仍需要有意地使用 character、scene、style、asset 以及迁移运行词汇来生成 comic-drama 工作流。
- Desktop PlanCard 证据仍需要证明真实用户 prompt 能够按串行顺序应用并 autoExecute 迁移运行步骤。

## 2026-06-26 - REQ-097 内置 Comic-Drama Planner 切片

范围：

- 将主运行时默认 planner 提升为
  `createDefaultOrchestratorPlanner`，使内置编排器行为可以在
  Electron 启动之外被测试。
- 用一个确定性的迁移工作流替换了 comic-drama 请求原来的单图回退方案：
  story 文本、character、scene、mjImage、audio、videoCompose 和
  muxAudioVideo 节点。
- 内置 planner 现在会为生成的链条产出迁移运行动作：
  `mjImageRun`、`audioRun`、`videoComposeRun` 和 `muxAudioVideoRun`。
- 新增了主运行时 IPC 覆盖测试，证明当未注入外部模型驱动的 planner 时，
  `canvas.chatSend` 和 `canvas.chatGetPlan` 会使用这个内置的
  comic-drama planner。

验证：

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/orchestrator-runtime.test.ts --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/orchestrator-runtime.test.ts tests/main-runtime-wiring.test.ts --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/orchestrator-runtime.test.ts tests/main-runtime-wiring.test.ts tests/sanitize-plan.test.ts tests/apply-plan-runner.test.ts tests/agent-orchestration-smoke.test.ts tests/migrated-run-dispatch.test.ts tests/canvas-job-reconciliation.test.ts --reporter=dot
bun run typecheck
```

结果：

- RED（首次）：新增的默认 planner 测试失败，因为
  `createDefaultOrchestratorPlanner` 不存在，旧的默认 planner
  私有地存在于 `runtime.ts` 中。
- 实现后 PASS：编排器运行时专项测试通过，1 个文件、3 个测试。
- PASS：直接 planner 加主运行时 chat IPC 测试通过，2 个文件、10 个测试。
- PASS：REQ-096/REQ-097 plan/运行时回归测试组通过，7 个文件、32 个测试。
- PASS：通过 `bun run typecheck`，TypeScript 严格编译以退出码 0 完成。

REQ-097 剩余缺口：

- 澄清行为与风格相关的特定意图仍需要更丰富的测试和实现。
- Desktop PlanCard 证据仍需要证明真实用户 prompt 能够按串行顺序应用并
  autoExecute 迁移链条。

## 2026-06-26 - REQ-097 PlanCard 已迁移摘要切片

范围：

- 新增了针对迁移 comic-drama plan 的 PlanCard 覆盖，使用户在应用 plan 之前
  能够看到实际的节点/动作词汇。
- PlanCard 现在会为迁移节点和运行动作渲染去重后的摘要标签，包括
  character、scene、MJ 出图、audio 生成、视频合成以及音视频混流。
- 该摘要保持现有的 plan 数量、丢弃警告、autoExecute 开关以及应用操作行为不变。

验证：

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/chat-ui.test.tsx --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/chat-ui.test.tsx tests/orchestrator-runtime.test.ts tests/main-runtime-wiring.test.ts tests/sanitize-plan.test.ts tests/apply-plan-runner.test.ts tests/agent-orchestration-smoke.test.ts --reporter=dot
bun run typecheck
```

结果：

- RED（首次）：新增的 Chat UI 测试失败，因为 PlanCard 只展示了 plan
  数量，没有显示迁移节点/动作的语义。
- RED（后续）：最初的标签渲染重复了如 `MJ 出图` 这样的标签，并触发了 React key 警告。
- 实现后 PASS：Chat UI 专项测试通过，1 个文件、7 个测试。
- PASS：REQ-097 UI/planner/运行时回归测试组通过，6 个文件、31 个测试。
- PASS：通过 `bun run typecheck`，TypeScript 严格编译以退出码 0 完成。

REQ-097 剩余缺口：

- Desktop PlanCard 证据仍需要证明可见的迁移摘要出现在真实的 Electron 聊天面板中，并自动执行迁移运行步骤。
- Clarify 行为以及针对样式的 plan 意图仍是部分实现。

## 2026-06-26 - REQ-097 真实 Electron PlanCard 证据切片

范围：

- 通过 `bun run dev` 启动了 desktop 应用。
- 验证了真实的 Electron 窗口（不仅是浏览器预览）能够无黑屏地渲染项目页面和默认工作流画布。
- 从真实的 Electron 画布聊天面板提交了一个漫剧请求：
  `做一个雨夜侦探漫画短剧，包含角色、场景、图片、配音、视频合成和音视频合成`.
- 在 Electron 窗口中观察到了带有迁移标签的 PlanCard 摘要：text、character、scene、MJ image、audio、video composition、audio/video mux 和 audio generation。
- 切换了 autoExecute 并从真实的 PlanCard 应用了该 plan。应用后画布仍保持渲染状态，且小地图显示在当前视口之外还有额外的已应用节点。

证据文件：

- `C:\Users\ZYCD\AppData\Local\Temp\comiccanvas-electron-window.png`：
  在 Electron 中渲染的项目页面。
- `C:\Users\ZYCD\AppData\Local\Temp\comiccanvas-electron-after-click.png`：
  在 Electron 中渲染的工作流画布。
- `C:\Users\ZYCD\AppData\Local\Temp\comiccanvas-electron-plancard.png`：
  带有迁移摘要标签的真实 PlanCard。
- `C:\Users\ZYCD\AppData\Local\Temp\comiccanvas-electron-after-apply-plan.png`：
  应用 plan 后画布仍保持可用。

验证：

```bash
bun run dev
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/chat-ui.test.tsx tests/orchestrator-runtime.test.ts tests/main-runtime-wiring.test.ts tests/sanitize-plan.test.ts tests/apply-plan-runner.test.ts tests/agent-orchestration-smoke.test.ts tests/migrated-run-dispatch.test.ts tests/canvas-job-reconciliation.test.ts --reporter=dot
```

结果：

- DESKTOP PASS：Electron 项目页面和工作流画布均未黑屏。
- DESKTOP PASS：真实 PlanCard 显示了迁移节点/动作标签以及 sanitizer 丢弃警告 UI。
- DESKTOP 部分通过：从真实 PlanCard 应用该 plan 使画布保持可用并似乎添加了节点，但对每个迁移运行步骤的可见终态证明仍需要一个更受控的 desktop 验收流程。
- Desktop 启动后自动化检查被阻塞：desktop 启动之后的 Vitest 命令对依赖 DB 的测试失败，因为 `better-sqlite3` 是为 Electron ABI 130 编译的，而内置的 Node 运行器需要 ABI 137。该命令中的非 DB 测试仍然通过。在下一次 Node/Vitest 回归测试前，请关闭 Electron 并运行 `bun install --force`。

REQ-097 剩余缺口：

- 捕获一个受控的 desktop autoExecute 流程，其中每个迁移运行步骤都依次可见地到达终态节点/任务状态。
- Clarify 行为以及针对样式的 plan 意图仍是部分实现。

## 2026-06-26 - REQ-091 工作流 JSON 导入/导出 IPC 切片

范围：

- 新增了 `canvas.exportWorkflow` 和 `canvas.importWorkflow` 的共享 IPC 契约。
- 新增了工作流仓储层的 `getSummary` 支持，使导出能够保留工作流显示名称。
- `canvas.exportWorkflow` 返回 schema 版本 1、工作流名称，以及经共享图契约清洗后的最新图。
- `canvas.importWorkflow` 接受工作流 JSON，拒绝无效 JSON，拒绝绝对本地路径和 `file://` URL，清洗不受支持的节点/无效边，上报被丢弃的记录，创建新工作流，并持久化第一个图版本。

验证：

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/canvas-graph-persistence.test.ts --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/canvas-graph-persistence.test.ts tests/ipc-skeleton.test.ts --reporter=dot
bun run typecheck
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/canvas-graph-persistence.test.ts tests/ipc-skeleton.test.ts tests/main-runtime-wiring.test.ts tests/orchestrator-runtime.test.ts tests/agent-orchestration-smoke.test.ts --reporter=dot
```

结果：

- RED（首次）：工作流导出返回了 `undefined`，因为 IPC handler 尚不存在。
- 实现后 PASS：图持久化/导入/导出专项测试通过，1 个文件、3 个测试。
- PASS：IPC 注册加图导入/导出测试通过，2 个文件、9 个测试。
- PASS：通过 `bun run typecheck`，TypeScript 严格编译以退出码 0 完成。
- PASS：工作流/运行时/编排器回归测试组通过，5 个文件、22 个测试。

REQ-091 剩余缺口：

- 渲染层导入/导出控件与 desktop 用户流程证据仍待完成。
- 脏保存切换与离开守卫仍是独立的 REQ-091 工作。

## 2026-06-26 - REQ-091 工作流 JSON 导入/导出渲染层 UI 切片

范围：

- 通过沙箱化的 preload 桥暴露了 `exportWorkflow` 和 `importWorkflow`，映射到 `canvas.exportWorkflow` 和 `canvas.importWorkflow`。
- 新增了 `/projects` 工作流 JSON 控件：
  - 顶层导入面板，
  - 卡片级工作流导出操作，
  - 格式化的导出 JSON 预览，
  - 可选的导入名称，
  - 丢弃记录的成功反馈，
  - 针对不安全或无效导入的中文错误反馈。
- 新增了从 desktop workspace 依赖路径解析 `react-router-dom` 的根级 TypeScript 和 Vitest 配置，与现有的 Bun workspace 布局保持一致。

验证：

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/workflow-import-export-ui.test.tsx --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/workflow-import-export-ui.test.tsx tests/canvas-graph-persistence.test.ts tests/ipc-skeleton.test.ts --reporter=dot
bun run typecheck
```

结果：

- RED（首次）：preload 未暴露工作流导入/导出，且 `/projects` 缺少导入/导出控件。
- 实现后 PASS：渲染层导入/导出专项测试通过，1 个文件、4 个测试。
- PASS：渲染层加 IPC/图持久化回归测试通过，3 个文件、13 个测试。
- PASS：通过 `bun run typecheck`，TypeScript 严格编译以退出码 0 完成。

REQ-091 剩余缺口：

- 导入/导出的 desktop 用户流程证据仍待完成。
- 脏保存切换与离开守卫仍是独立的 REQ-091 工作。

## 2026-06-26 - REQ-091 脏保存工作流切换守卫切片

范围：

- 新增了一个专门的工作流切换守卫模块，用于处理脏画布的切换。
- 脏工作流切换现在会先尝试保存当前图。
- 如果保存失败，工作流切换会被阻止，画布会保持在当前工作流上，而不是静默继续。
- 手动保存和自动保存现在仍会暴露保存错误状态，而不产生未处理的 promise 拒绝。
- CanvasPage 在处于脏状态时注册了一个 `beforeunload` 守卫，使窗口关闭或浏览器刷新可以对未保存的图更改发出警告。

验证：

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/workflow-switch-guard.test.ts --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/workflow-switch-guard.test.ts tests/workflow-import-export-ui.test.tsx tests/job-preload.test.ts tests/canvas-graph-persistence.test.ts tests/ipc-skeleton.test.ts --reporter=dot
bun run typecheck
```

结果：

- RED（首次）：守卫模块不存在，且脏保存切换行为没有独立的覆盖测试。
- 实现后 PASS：脏保存守卫专项测试通过，1 个文件、4 个测试。
- PASS：REQ-091/CanvasPage 相邻回归测试通过，5 个文件、20 个测试。
- PASS：通过 `bun run typecheck`，TypeScript 严格编译以退出码 0 完成。

REQ-091 剩余缺口：

- 导入/导出、脏工作流切换、窗口关闭以及后退导航的 desktop 用户流程证据仍待完成。

## 2026-06-26 - REQ-092 画布片段核心切片

范围：

- 新增了用于画布片段的渲染层图辅助函数。
- `extractCanvasSnippet`：
  - 要求至少选中两个节点，
  - 只保留被选中的节点，
  - 只保留选中节点之间的内部边，
  - 将片段节点坐标归一化到所选子图的原点。
- `insertCanvasSnippet`：
  - 重新映射节点 ID，
  - 重新映射边 ID 和边端点，
  - 将片段插入到调用方提供的原点，
  - 通过一次画布 store 的 `applyChange` 快照应用插入，使一次撤销就能移除插入的片段。
- 新增了最小化的 CanvasPage 操作：
  - `保存片段` 在选中两个或更多节点时启用，
  - `插入片段` 插入最新的内存中片段，
  - 状态反馈上报保存/插入结果。

验证：

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/canvas-snippet.test.ts --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/canvas-snippet.test.ts tests/canvas-store.test.ts --reporter=dot
bun run typecheck
```

结果：

- RED（首次）：片段模块不存在。
- RED（后续）：CanvasPage 未暴露片段保存/插入操作。
- 实现后 PASS：画布片段专项测试通过，1 个文件、4
  个测试。
REQ-092 片段剩余缺口：

- 更丰富的片段管理 UI 仍待完成。
- Desktop 端选中-保存-插入以及跨项目保存/重新打开的证据仍待完成。

## 2026-06-27 - Phase A 人工评审运行手册闸门

范围：

- 新增了 `docs/progress/phase-a-human-review-runbook.md`，作为人工 desktop 验收的执行指南。
- 新增了 `docs/progress/phase-a-human-review-session-template.md`，使评审人员可以记录所需的行结果、失败情况和产品延期决定，而不泄露密钥或将 Agent/MJ 行用作 Phase A 证据。
- 从 `docs/progress/human-desktop-review-checklist.md` 链接到了该运行手册。
- 重新确认了 `HDR-PHASEA-001` 是 Phase A 验收闸门，在人工评审通过或明确的产品延期决定之前保持 Pending。
- 重新确认了在 `HDR-PHASEA-001` 处于 Pending 状态期间，Task 60 保持阻塞，Agent plan 应用/运行自动化保持禁用。
- 新增了 `docs/progress/task-60-agent-plan-apply-readiness.md`，记录了 Task 60 在人工闸门开放时的预检项、可复用点、禁止的捷径以及最小未来验证要求。
- 重新确认了 MJ 节点/组件实现不在 Phase A 范围内；旧版 MJ 图支持仅限于可读的不可用行为。

验证：

```bash
bun scripts/run-vitest.mjs run tests/phase-a-human-review-runbook.test.ts tests/agent-plan-apply-gate.test.ts tests/phase-a-acceptance-gate.test.ts tests/human-desktop-review-checklist.test.ts --reporter=dot
bun run typecheck
git diff --check
```

结果：

- RED（首次）：新增的运行手册测试最初依赖 Markdown 的自动换行来处理较长的 MJ/R2 规则语句。
- 收紧断言并新增会话模板后 PASS：Phase A 运行手册/模板、Task 60 闸门、验收闸门和人工检查清单测试通过，4 个文件、4 个测试。

## 2026-06-27 - Phase A 资产 UI 任务 7-9

范围：

- 将 Task 7（`/assets` 外壳对等）标记为工程完成，包含与 URL 同步的媒体/搜索/排序/日期过滤器、带计数的类型标签、上传入口、响应式网格/列表外壳、文件夹/分类侧边栏，以及加载、空状态和错误状态。
- 将 Task 8（上传卡片对等）标记为工程完成，包含文件索引/计数、当前文件名、忙碌时禁用的上传入口、百分比进度、成功导入后的列表刷新，以及混合批次失败反馈。
- 将 Task 9（资产卡片/预览/批量操作对等）标记为工程完成，包含图片缩略图、非图片回退方案、预览元数据、显示重命名、单个安全删除反馈，以及批量安全删除选择重置。
- 更新了 `hjwall-assets-workflows-gap-analysis.md` 和 `human-desktop-review-checklist.md`，使 HDR-ASSET-001 到 HDR-ASSET-003 保持人工评审待定状态，但已具备工程证据。

验证：

```bash
bun scripts/run-vitest.mjs run tests/asset-panel-ui.test.tsx tests/asset-folders-ipc.test.ts tests/asset-rename-repo.test.ts tests/hjwall-assets-workflows-inventory.test.ts tests/human-desktop-review-checklist.test.ts --reporter=dot
bun run typecheck
git diff --check
bun scripts/run-vitest.mjs run tests/phase-a-acceptance-gate.test.ts tests/agent-orchestration-requirements-refresh.test.ts --reporter=dot
```

结果：

- PASS：资产 UI、文件夹 IPC、重命名仓储层、清单和检查清单回归测试通过，5 个文件、24 个测试。
- PASS：通过 `bun run typecheck`，TypeScript 严格编译以退出码 0 完成。
- PASS：`git diff --check` 以退出码 0 完成。
- PASS：Phase A 验收闸门与 Agent 需求闸门通过，2 个文件、2 个测试。

剩余闸门：

- 在人工评审通过或明确的产品延期决定之前，Task 60 仍被 `HDR-PHASEA-001` 阻塞；Agent plan 应用/运行自动化未启用。
- 在 HDR-050 和 HDR-051 保持人工评审待定期间，Task 60 保持阻塞，Agent plan 应用/运行自动化保持禁用。

## 2026-06-27 - Phase A Assets/Workflows 评审闸门

范围：

- 扩展了 `docs/progress/human-desktop-review-checklist.md`，新增了 Human Phase A Acceptance Matrix。
- 新增了 `HDR-ASSET-009`，用于验证 R2/SQLite 存储评审，并保留 `HDR-PHASEA-001` 作为最终的人工验收行。
- 新增了 `desktop/src/main/smoke/phase-a-assets-workflows-smoke.ts` 和 `tests/phase-a-assets-workflows-smoke.test.ts`。
- 该 smoke 流程创建一个工作流项目、添加画布节点、保存并重新打开图、导入/分类一个图片资产、将其插入画布节点数据、同步资产引用以阻止安全删除、保存/插入一个带有重新映射 ID 的片段，并通过队列、worker、资产管线和终态事件完成一个 stub 图片生成任务。
- 更新了 backlog 和差距分析，使 Task 58 记录验收决定，而不绕过人工评审。

验证：

```bash
bun scripts/run-vitest.mjs run tests/phase-a-assets-workflows-smoke.test.ts tests/m1-smoke-path.test.ts tests/hjwall-assets-workflows-inventory.test.ts tests/human-desktop-review-checklist.test.ts --reporter=dot
bun scripts/run-vitest.mjs run tests/phase-a-acceptance-gate.test.ts --reporter=verbose
bun run typecheck
git diff --check
```

结果：

- RED（首次）：`tests/phase-a-assets-workflows-smoke.test.ts` 失败，因为 Phase A smoke 辅助函数不存在。
- 实现后 PASS：Phase A smoke、M1 smoke、清单和检查清单专项测试组通过，4 个文件、5 个测试。
- RED（首次）：`tests/phase-a-acceptance-gate.test.ts` 失败，因为 backlog、差距分析和本报告尚未记录最终验收闸门。
- 报告更新后 PASS：`tests/phase-a-acceptance-gate.test.ts` 通过，1 个文件、1 个测试。
- Task 58 决定：Phase A 未被验收。`HDR-PHASEA-001` 仍是最终闸门，需要人工评审通过或明确的产品延期决定。

## 2026-06-27 - REQ-092 Audio 资产导入 IPC 持久化切片

范围：

- 新增了通过 `asset.import` 使用真实 SQLite 资产仓储层导入本地音频文件的 IPC 层覆盖测试。
- 验证了音频导入以 `mediaType: audio` 持久化，使用 `metadata.mimeType: audio/mpeg`，记录文件大小，返回一个渲染层安全的 `cc-asset://` URL，并可以通过 `mediaType: audio` 列出。
- 修复了导入资产的 `relativePath` 生成逻辑，使其使用 POSIX 分隔符（`imported/audio/...`）而不是 Windows 反斜杠，从而在跨操作系统时保留可移植的工作流/导出记录，同时仍通过原生文件系统路径复制文件。
- 在此前的 Electron dev 运行为 Electron 重新编译了 `better-sqlite3` 之后，通过 `bun install --force` 恢复了 Node/Vitest 原生 ABI。

验证：

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/asset-folders-ipc.test.ts --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/asset-folders-ipc.test.ts tests/local-media-drop.test.ts tests/asset-audio-support.test.ts --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/asset-folders-ipc.test.ts tests/local-media-drop.test.ts tests/asset-audio-support.test.ts tests/canvas-visible-copy.test.ts tests/canvas-connect-to-create.test.ts tests/canvas-command-palette.test.tsx tests/canvas-selection-actions.test.ts tests/mention-edge-validation.test.tsx tests/canvas-edge-creation.test.ts tests/connection-validation-ux.test.tsx tests/canvas-snippet.test.ts tests/canvas-store.test.ts --reporter=dot
bun run typecheck
```

结果：

- RED（首次）：依赖 DB 的资产 IPC 测试最初因 Electron 重建导致的原生 ABI 不匹配而失败；执行 `bun install --force` 后，新增的音频导入断言因 `relativePath` 使用了 Windows 反斜杠而失败。
- 实现后 PASS：资产文件夹/音频 IPC 测试通过，1 个文件、3 个测试。
- PASS：本地媒体/音频支持回归测试通过，3 个文件、8 个测试。
- PASS：REQ-092 交互回归测试组通过，12 个文件、36 个测试。
- PASS：通过 `bun run typecheck`，TypeScript 严格编译以退出码 0 完成。

REQ-092 本地媒体剩余缺口：

- 在 task 9 可以被标记为完成之前，真实的 desktop 拖放证据仍待完成。
- 由于 `bun install --force` 恢复了 Node/Vitest ABI，Electron dev 应用目前已停止，需要在下一次 desktop 验证前重新执行 `bun run dev`。

## 2026-06-27 - REQ-092 本地 Audio 媒体拖放切片

范围：

- 将本地媒体拖放规划从仅支持图片/视频扩展到图片、视频和音频文件。
- `planLocalMediaDrop` 现在接受音频 MIME 类型和常见的音频扩展名（`.mp3`、`.wav`、`.m4a`、`.aac`、`.flac`、`.ogg`），并返回一个 `audio` 节点创建方案。
- 保留了不支持文件和缺失本地路径反馈的中文可读性。
- 在共享资产媒体契约和主进程资产导入解析中新增了 `audio`，包括扩展名和 MIME 推断。
- 扩展了 CanvasPage 资产插入逻辑，使拖放/导入的音频资产能够创建带有导入资产 ID 和安全 URL 的 `audio` 画布节点。
- 新增了资产面板音频显示钩子，使更广泛的资产 UI 能识别音频资产，而不是落入一个不完整的媒体类型映射。

验证：

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/local-media-drop.test.ts --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/local-media-drop.test.ts tests/asset-audio-support.test.ts --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/local-media-drop.test.ts tests/asset-audio-support.test.ts tests/canvas-visible-copy.test.ts tests/canvas-connect-to-create.test.ts tests/canvas-command-palette.test.tsx tests/canvas-selection-actions.test.ts tests/mention-edge-validation.test.tsx tests/canvas-edge-creation.test.ts tests/connection-validation-ux.test.tsx tests/canvas-snippet.test.ts tests/canvas-store.test.ts --reporter=dot
bun run typecheck
```

结果：

- RED（首次）：`tests/local-media-drop.test.ts` 失败，因为拖放的音频文件被以“当前画布不支持 audio 节点”拒绝。
- 实现后 PASS：本地媒体拖放专项测试通过，1 个文件、3 个测试。
- PASS：音频资产支持专项测试通过，2 个文件、5 个测试。
- PASS：REQ-092 交互回归测试组通过，11 个文件、33 个测试。
- PASS：通过 `bun run typecheck`，TypeScript 严格编译以退出码 0 完成。

REQ-092 本地媒体剩余缺口：

- IPC 导入测试应显式覆盖音频文件导入持久化。
- 在 task 9 可以被标记为完成之前，desktop 拖放证据仍待完成。

## 2026-06-27 - REQ-092 画布可见文案质量切片

范围：

- 新增了针对画布面向用户标签的可见文案质量闸门。
- 将 V2 生成节点的乱码默认标签替换为可读的 `Image Generation` 和 `Video Generation` 标签。
- 将迁移后处理节点的乱码右键菜单标签替换为 `Video Compose`、`Super Resolution` 和 `Mux Audio Video`。
- 将乱码的片段错误反馈以及右键菜单分区/操作标签替换为可读文案。
- 将命令面板搜索占位符、aria 标签和空状态替换为可读的英文文案。
- 更新了命令面板组件测试，以断言新的可读无障碍搜索名称和命令标签。

验证：

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/canvas-visible-copy.test.ts --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/canvas-visible-copy.test.ts tests/canvas-connect-to-create.test.ts tests/canvas-command-palette.test.tsx tests/canvas-selection-actions.test.ts tests/mention-edge-validation.test.tsx tests/canvas-edge-creation.test.ts tests/connection-validation-ux.test.tsx tests/canvas-snippet.test.ts tests/local-media-drop.test.ts tests/canvas-store.test.ts --reporter=dot
bun run typecheck
```

结果：

- RED（首次）：`tests/canvas-visible-copy.test.ts` 失败，因为可见画布文案仍缺少 `Image Generation`、`Video Generation`、可读的命令面板文案，且仍暴露乱码字符串。
- 实现后 PASS：可见文案专项测试通过，1 个文件、3 个测试。
- PASS：REQ-092 交互回归测试组通过，10 个文件、31 个测试。
- PASS：通过 `bun run typecheck`，TypeScript 严格编译以退出码 0 完成。

REQ-092 质量剩余缺口：

- 历史遗留的乱码仍存在于不可见的注释和较旧的进度文档中；本切片仅对可见画布文案设置了闸门。
- Desktop 键盘/鼠标以及无效连接反馈的证据在 REQ-092 被标记为完成之前仍待补充。

## 2026-06-27 - REQ-092 命令面板 / Fit View / 框选切片

范围：

- 新增了 `CanvasCommandPalette` 作为可搜索的画布命令入口。
- 为以下操作接线了 CanvasPage 命令：
  - 通过 React Flow 的 `fitView({ padding: 0.18, duration: 240 })` 实现适配视图，
  - 选择模式，
  - 平移模式，
  - 复制已选节点，
  - 删除已选节点。
- 新增了带可编辑目标保护的 Ctrl/Cmd+K 唤起方式。
- 新增了用于选择模式、平移模式和命令面板的左侧工具栏按钮。
- 将 React Flow 的 `selectionOnDrag` 和 `panOnDrag` 接线到当前的交互模式。
- 修复了若干已存在的 `CanvasPage.tsx` 乱码语法破坏问题，这些问题此前阻止了
  TypeScript 编译，包括损坏的 JSX 属性、损坏的片段反馈字符串，以及一个
  被破坏的直接连接成功分支。

验证：

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/canvas-command-palette.test.tsx --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/canvas-command-palette.test.tsx tests/canvas-selection-actions.test.ts tests/mention-edge-validation.test.tsx tests/canvas-edge-creation.test.ts tests/connection-validation-ux.test.tsx tests/canvas-snippet.test.ts tests/local-media-drop.test.ts tests/canvas-store.test.ts --reporter=dot
bun run typecheck
```

结果：

- RED（首次）：`tests/canvas-command-palette.test.tsx` 失败，因为
  `CanvasCommandPalette` 不存在。
- 实现后 PASS：命令面板专项测试通过，1 个文件、2 个测试。
- PASS：REQ-092 交互回归测试组通过，8 个文件、25 个测试。
- PASS：通过 `bun run typecheck`，TypeScript 严格编译以退出码 0 完成。

REQ-092 工具栏/快捷键剩余缺口：

- Desktop 键盘/鼠标检查清单证据仍待完成。
- 右键菜单和 connect-to-create 边路径仍需要显式的共享校验覆盖测试。

## 2026-06-27 - REQ-092 Connect-To-Create 边校验切片

范围：

- 新增了 `connectCreatedCanvasNode` 作为 connect-to-create 手势的共享渲染层辅助函数。
- 该辅助函数委托给带有 `connect-to-create` 原因标记的 `createCanvasEdge`，
  因此重复拒绝、连接矩阵拒绝以及反馈消息都与直接连接和 @mention 边
  保持在同一条权威路径上。
- 将 CanvasPage 节点右键菜单操作接线为先创建一个新节点，然后通过
  `connectCreatedCanvasNode` 尝试建立源节点 -> 新建节点的边。

验证：

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/canvas-connect-to-create.test.ts --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/canvas-connect-to-create.test.ts tests/canvas-command-palette.test.tsx tests/canvas-selection-actions.test.ts tests/mention-edge-validation.test.tsx tests/canvas-edge-creation.test.ts tests/connection-validation-ux.test.tsx tests/canvas-snippet.test.ts tests/local-media-drop.test.ts tests/canvas-store.test.ts --reporter=dot
bun run typecheck
```

结果：

- RED（首次）：专项测试失败，因为 `canvas-connect-to-create` 不存在。
- RED（后续）：CanvasPage 接线测试失败，因为该辅助函数未被节点右键菜单
  导入或使用。
- 实现后 PASS：connect-to-create 专项测试通过，1 个文件、3 个测试。
- PASS：REQ-092 交互回归测试组通过，9 个文件、28 个测试。
- PASS：通过 `bun run typecheck`，TypeScript 严格编译以退出码 0 完成。

REQ-092 连接剩余缺口：

- 若后续新增了独立的非创建类边操作，仍需要覆盖剩余的显式右键菜单边路径。
- Desktop 无效连接反馈证据仍待完成。

## 2026-06-27 - REQ-092 V2 @mention 边校验切片

范围：

- 新增了针对 V2 节点 `@mention` 创建用户路径的覆盖测试，不仅限于更底层的边辅助函数。
- ImageConfigV2 和 VideoConfigV2 现在从当前画布 store 节点中派生 mention 候选项，排除当前节点本身。
- 选择一个 mention 会通过 `createCanvasEdge` 创建边，因此使用了与之相同的重复拒绝与连接矩阵校验路径。
- Mention 创建的边现在使用正确的图方向：被提及/上游节点 -> 当前 V2 节点。
- 移除一个 mention token 会清理对应的从上游到当前节点的 `createdByMention` 边。
- ImageConfigV2 的样式加载现在统一调用 `listStyles({ includeDisabled: false })`，与 VideoConfigV2 和样式选择器契约保持一致。

验证：

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/mention-edge-validation.test.tsx --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/mention-edge-validation.test.tsx tests/canvas-edge-creation.test.ts tests/connection-validation-ux.test.tsx tests/style-renderer-ui.test.tsx tests/migrated-node.test.tsx tests/node-contracts.test.ts --reporter=dot
bun run typecheck
```

结果：

- RED（首次）：V2 `@mention` 测试无法找到现有的画布节点 `Story Beat`，证明 UI 尚未在用户路径中暴露 mention 候选项。
- 实现后 PASS：V2 `@mention` 专项测试通过，1 个文件、1 个测试。
- PASS：mention、边辅助函数、连接反馈、样式选择器、迁移节点和节点契约回归测试通过，6 个文件、14 个测试。
- PASS：通过 `bun run typecheck`，TypeScript 严格编译以退出码 0 完成。

REQ-092 连接剩余缺口：

- 当右键菜单和 connect-to-create 边创建路径被实现后，仍需要显式的共享校验覆盖测试。
- Desktop 无效连接反馈证据仍待完成。

## 2026-06-27 - REQ-092 已选节点复制/删除快捷键切片

范围：

- 新增了共享的渲染层选中操作，用于复制和删除操作。
- 复制已选节点现在：
  - 支持多个已选节点，
  - 只保留完全位于所选子图内部的边，
  - 将复制的节点偏移 40px，
  - 将复制操作写入一条 `applyChange` 历史记录，使一次撤销即可移除复制出的子图。
- 删除已选节点现在会在一次可撤销的 `applyChange` 中移除所有相连的边。
- CanvasPage 现在从以下入口复用这些相同的选中操作：
  - 单个节点的右键菜单复制/删除，
  - Ctrl/Cmd+D 用于已选节点复制，
  - Delete/Backspace 用于已选节点删除。
- 键盘操作会跳过可编辑目标，如 input、textarea、select 和 contenteditable 元素，使 prompt 编辑不会被打断。

验证：

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/canvas-selection-actions.test.ts --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/canvas-selection-actions.test.ts tests/canvas-store.test.ts tests/canvas-store-selector-stability.test.ts tests/canvas-snippet.test.ts --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/canvas-selection-actions.test.ts tests/mention-edge-validation.test.tsx tests/canvas-edge-creation.test.ts tests/connection-validation-ux.test.tsx tests/canvas-snippet.test.ts tests/local-media-drop.test.ts tests/canvas-store.test.ts --reporter=dot
bun run typecheck
```

结果：

- RED（首次）：`canvas-selection-actions` 不存在，导致专项测试在收集阶段就失败。
- 实现后 PASS：已选节点复制/删除专项测试通过，1 个文件、3 个测试。
- PASS：store、selector 稳定性以及片段相邻回归测试通过，4 个文件、14 个测试。
- PASS：REQ-092 交互回归测试组通过，7 个文件、23 个测试。
- PASS：通过 `bun run typecheck`，TypeScript 严格编译以退出码 0 完成。

REQ-092 工具栏/快捷键剩余缺口：

- 命令面板操作、缩放/适配视图以及平移/框选模式仍需要显式实现和证据。
- Desktop 键盘/鼠标检查清单证据仍待完成。

## 2026-06-27 - REQ-092 直接连接反馈切片

范围：

- 将损坏的连接 UX 字符串替换为稳定的中文反馈消息。
- `createCanvasConnectHandler` 仍是唯一的渲染层适配器，基于权威的画布 store 校验与连接矩阵。
- CanvasPage 中直接的 ReactFlow `onConnect` 现在使用 `createCanvasConnectHandler`，而不是直接调用 `canvasStore.addEdge`。
- 在画布内新增了 `ConnectionFeedback` 渲染，使用户能对重复和无效连接获得即时的、无障碍的反馈。

验证：

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/connection-validation-ux.test.tsx --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/connection-validation-ux.test.tsx tests/connection-matrix.test.ts tests/canvas-store.test.ts tests/apply-plan-runner.test.ts tests/canvas-snippet.test.ts --reporter=dot
bun run typecheck
```

结果：

- RED（首次）：CanvasPage 未导入或使用共享的连接 handler 或反馈横幅。
- 实现后 PASS：连接 UX 专项测试通过，1 个文件、4 个测试。
- PASS：连接矩阵、store、apply-plan、片段以及 CanvasPage 相邻回归测试通过，5 个文件、22 个测试。
- PASS：通过 `bun run typecheck`，TypeScript 严格编译以退出码 0 完成。

REQ-092 连接剩余缺口：

- 右键菜单、connect-to-create 以及 @mention 创建的边路径仍需要显式的共享校验覆盖测试。
- Desktop 无效连接反馈证据仍待完成。

## 2026-06-27 - REQ-092 持久化画布片段库切片

范围：

- 在 `shared/snippets.ts` 中新增了共享的片段契约与校验逻辑。
- 新增了可复用画布片段的 SQLite 持久化：
  - `canvas_snippets` 表与迁移 `0004_canvas_snippets`，
  - 带软删除的仓储层 list/save/delete，
  - 会丢弃无效外部边的经清洗的节点/边存储，
  - 按更新时间倒序的列表。
- 新增了 `canvasSnippet.list`、`canvasSnippet.save` 和 `canvasSnippet.delete` 的 IPC handler。
- 在主运行时中注册了片段 handler，并暴露了类型化的 preload API：`listCanvasSnippets`、`saveCanvasSnippet` 和 `deleteCanvasSnippet`。
- 将 CanvasPage 的片段操作从仅使用内存中最新片段升级为一个紧凑的持久化片段库选择器。

验证：

```bash
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/canvas-snippet-repository-ipc.test.ts tests/db-schema.test.ts tests/ipc-skeleton.test.ts --reporter=dot
$env:NODE_BINARY='C:\Users\ZYCD\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'; bun scripts/run-vitest.mjs run tests/canvas-snippet.test.ts tests/canvas-snippet-repository-ipc.test.ts tests/db-schema.test.ts tests/ipc-skeleton.test.ts --reporter=dot
bun run typecheck
```

结果：

- RED（首次）：`canvas-snippet.repo` 不存在，导致仓储层/IPC 测试在收集阶段就失败。
- 实现后 PASS：片段仓储层/IPC、schema 和 IPC 骨架回归测试通过，3 个文件、11 个测试。
- PASS：片段核心加持久化库回归测试通过，4 个文件、15 个测试。
- PASS：通过 `bun run typecheck`，TypeScript 严格编译以退出码 0 完成。

REQ-092 片段剩余缺口：

- 更丰富的片段管理 UI 仍待完成。
- Desktop 端选中-保存-插入以及跨项目保存/重新打开的证据仍待完成。

## 2026-07-04 - hjwall-canvas-full-migration Phase 0/2 审计与加固

范围：

- Task 1-3（Phase 0）针对现有产出物重新审计。尽管所需产出物已经存在且仍然准确，但检查框仍处于陈旧的 (`[ ]`) 状态；已翻转为 `[x]`，并直接在 `specs/hjwall-canvas-full-migration/tasks.md` 中补充了证据引用。
- Task 2 的审计产出要求（“在不删除历史记录的情况下，在新的带日期的验证报告中将各项标记为已验证、部分验证或存在矛盾”）在本次会话中确实被执行了：新增了 `docs/progress/backlog-claims-audit-2026-07-04.md`，针对当前代码逐一分类核对了 REQ-077..085。发现两个与代码直接冲突的部分声明：REQ-078 文档记载的“30 秒自动保存”（实际情况：`CanvasPage.tsx` 中是 2 秒的防抖）以及 REQ-082 声称的节点“锁定”操作（在节点模型中并不存在）。`verification-report-2026-06-26.md` 保持原样（属于不同的产出物：CI/lint/构建健康状况，而不是逐条 REQ 声明审计）。
- Task 4（Phase 1）：在核实证据声明时发现并修复了一个真实的功能性缺陷。`desktop/src/main/ipc/canvas.handler.ts` 中的 `canvas.createWorkflow` 调用了 `workflows.create(...)`，但从未调用 `workflows.addVersion(...)`，导致每个新创建的工作流的图版本数都为零。由于 `getSummary`/`getLatestVersion` 在不存在版本行时都会回退到 `emptyGraph()`，这个缺陷被掩盖了，没有产生任何可见症状，只是初始版本行悄无声息地缺失了。修复方式是在创建时插入一个初始的空图版本，复用 handler 现有的 `clock`/`idFactory` 依赖。
- Task 7（Phase 2）：编写了 `docs/architecture/canvas-graph-state-ownership.md`，记录了 Zustand 的 `canvasStore`（权威数据源）与 React Flow 本地状态（渲染缓存）之间实际存在（而非理想化）的双状态模型：`CanvasPage.tsx` 中防抖 300ms 的 RF 到 store 同步（`persistToStore`）、即时的 store 到 RF 同步（`syncReactFlowFromStore`）、两处直接绕过的调用点（手动 `setState()` 调用、实时任务回写），以及未来的绑定归属模型。这满足了 task 7 验证标准中“设计说明”这一半的要求；“针对撤销/自动保存/实时竞态的回归测试”这一半仍需要新增测试代码（见下文）。

验证：

```bash
bun install
bun scripts/run-vitest.mjs run tests/workflow-project-repo.test.ts tests/workflow-template-repo.test.ts tests/ipc-skeleton.test.ts tests/canvas-graph-persistence.test.ts tests/main-runtime-wiring.test.ts tests/migrated-run-dispatch.test.ts tests/style-runtime-payload.test.ts tests/model-feature-ipc.test.ts --reporter=dot
bun scripts/run-vitest.mjs run tests/canvas-graph-state-races.test.ts --reporter=dot
bun scripts/run-vitest.mjs run --reporter=dot
```

结果：

- RED（首次，task 4 测试）：最初的测试草稿断言在裸仓储层 `create()` 调用之后，`workflows.getLatestVersion(...)` 会立即返回一个版本。这个断言失败了（`expected null to match object {...}`），因为仓储层的 `create()` 按设计有意与版本无关；创建版本是调用方的职责。修正方式是拆分为两个测试：一个记录了单独调用 `create()` 不会留下任何版本行，另一个通过一个本地的假 `ipcMain` 执行 `registerCanvasHandlers` 的 `canvas.createWorkflow`（实际的修复位置），确认它会插入初始版本。还新增了一个此前没有覆盖的重命名/软删除回归测试。
- 修复后 PASS：工作流仓储层/IPC 专项测试组通过，8 个文件、39 个测试。
- PASS：新增的 `tests/canvas-graph-state-races.test.ts`（4 个测试）确认了 `updateNodeData` 以及 RF 同步的 `setNodes`/`setEdges` 被正确地排除在撤销历史之外；描绘了一个此前未记录的数据丢失缺口——`undo()`/`redo()` 会重放一个冻结的快照，并静默丢弃在该快照被捕获之后（无论方向）应用的实时 `updateNodeData` 补丁（在设计说明中作为已知缺口进行跟踪，此任务并未修复它，因为 task 7 的范围是决策与记录）；并断言自动保存延迟（2000ms）始终保持在 RF 到 store 持久化防抖（300ms）的至少 2 倍以上，该值是直接从 `CanvasPage.tsx` 中解析出来的，因此未来对该常量的更改会使测试失败，而不是悄无声息地产生偏差。
- PASS：`bun install` 后（该 worktree 没有 `node_modules`）运行完整测试套件，显示 402 个通过 / 7 个跨 3 个文件的预先存在的失败（`tests/agent-settings-ui.test.tsx`、`tests/job-preload.test.ts`、`tests/migrated-node-menu.test.ts`）。通过对照未经修改的 `ce30e59` 基线执行 `git stash` 确认了这 7 个失败是预先存在的，与本次会话的更改无关；没有引入回归。

延续到后续的剩余缺口：

- Task 4 仍保持 `[-]`（进行中）：JSDoc `@see docs/api-contracts/canvas-plan.md` 只存在于 `workflow.repo.ts` 中的一个导出函数上，而不是每一个导出的仓储层方法上；针对项目列表流程的人工评审检查清单覆盖（REQ-098）仍待完成。
- Task 7 的已知缺口（撤销/重做会静默丢弃实时补丁）已被跟踪，但本次会话有意不修复它——task 7 的范围是决策与记录，加上对*当前*行为的回归覆盖，而不是重新设计撤销/重做语义。一个后续任务应决定撤销/重做是否应该将实时补丁合并到重放的快照中，而不是覆盖它们。
- 3 个预先存在的失败测试文件（`tests/agent-settings-ui.test.tsx`、`tests/job-preload.test.ts`、`tests/migrated-node-menu.test.ts`）在本次会话中未被调查或修复，因为它们超出了 task 1、2、4 和 7 的范围，且早于本次会话的更改就已存在。

## 2026-07-04 - Task 4 收尾（JSDoc 契约锚点）

关闭了 task 4 的剩余缺口：JSDoc `@see docs/api-contracts/canvas-plan.md` 此前只存在于 `desktop/src/main/db/repositories/workflow.repo.ts` 中的一个导出符号上。为每一个导出的类型/接口，以及全部 11 个 `WorkflowRepository` 接口方法（`create`、`addVersion`、`getLatestVersion`、`getSummary`、`listTemplates`、`publishTemplate`、`copyTemplateToDraft`、`list`、`listVersions`、`restoreVersion`、`rename`、`delete`）都新增了 JSDoc 块（意图、适用时的 `@param`/`@returns`/`@throws`、契约锚点）。

编辑过程中，发现并修复了本次会话早前增量编辑过程中自行引入的一个缺陷：三个导出类型（`WorkflowCreateRecord`、`WorkflowVersionCreateRecord`、`WorkflowVersionRecord`）各自都累积了两个叠加的 JSDoc 块。已对每个符号去重为一个准确的块。

验证：

```bash
bun node_modules/typescript/bin/tsc --noEmit
bun scripts/run-vitest.mjs run tests/workflow-project-repo.test.ts tests/workflow-template-repo.test.ts tests/ipc-skeleton.test.ts tests/canvas-graph-persistence.test.ts tests/main-runtime-wiring.test.ts tests/migrated-run-dispatch.test.ts tests/style-runtime-payload.test.ts tests/model-feature-ipc.test.ts --reporter=dot
```

结果：类型检查通过；同一个 8 文件/39 测试的专项测试组重新运行后仍然是 39/39 全绿（仅 JSDoc 改动，未触及任何运行时行为）。

Task 4 检查框在 `specs/hjwall-canvas-full-migration/tasks.md` 中已从 `[-]` 翻转为 `[x]`。项目列表流程的人工评审检查清单覆盖仍按此 spec 的状态图例，单独在 REQ-098 下跟踪。

## 2026-07-04 - Task 8 收尾（工具栏/右键菜单/命令面板对等能力）

针对当前代码重新核实了 task 8 现有的证据，而不是直接采信 `[-]` 状态。确认 `desktop/src/renderer/src/canvas/CanvasPage.tsx` 中存在：通过 `ADDABLE_NODE_OPTIONS` 实现的快速新增，在右键菜单新增/连接并创建处理器中通过 `screenToFlowPosition` 实现的光标位置新增，命令面板操作（`CanvasCommandPalette`、`Ctrl/Cmd+K`）、`fitView`/放大/缩小控件、接入 React Flow 的 `panOnDrag`/`selectionOnDrag` 的选择/平移 `interactionMode`，以及由 `isEditableKeyboardTarget` 守卫的复制/删除快捷键（`Ctrl/Cmd+D`、`Delete`/Mac 上的 `Backspace`）。

验证：

```bash
bun scripts/run-vitest.mjs run tests/canvas-add-node-paths.test.ts tests/canvas-command-palette.test.tsx tests/canvas-shell-parity.test.ts tests/canvas-shortcuts-parity.test.ts tests/canvas-visible-copy.test.ts tests/canvas-selection-actions.test.ts --reporter=dot
```

结果：6 个文件，19 个测试，全部通过。无需任何代码更改；这是一次仅用于核实的通过，确认证据文本与实际实现相符后再翻转检查框。

Task 8 检查框在 `specs/hjwall-canvas-full-migration/tasks.md` 中已从 `[-]` 翻转为 `[x]`。desktop 键盘/鼠标流程的人工批准（HDR-020/HDR-021）仍按此 spec 的状态图例，单独在 REQ-098 下跟踪。

## 2026-07-04 - Task 9 收尾（拖拽本地媒体到画布）

委派了一次针对当前代码的独立审计，核实 task 9 的证据。确认了图片/视频/音频分类（`desktop/src/renderer/src/canvas/lib/local-media-drop.ts` 中的 `planLocalMediaDrop`/`planLocalMediaDrops`，基于先 MIME 后扩展名的判定方式，缺失路径/不支持类型时给出中文拒绝原因）、放置位置的节点创建（`CanvasPage.tsx` 中的 `handleCanvasDrop`，使用 `screenToFlowPosition`，对每个被接受的文件按批次偏移）以及资产导入 IPC（`desktop/src/main/ipc/asset.handler.ts` 中的 `asset.import`，媒体类型从扩展名/MIME 推断，以 POSIX 相对路径持久化）都是真实实现的，而不仅仅是计划——audio 的处理方式与 image/video 完全一致，不是单独附加上去的。

验证：

```bash
bun scripts/run-vitest.mjs run tests/local-media-drop.test.ts tests/canvas-local-media-drop-parity.test.ts tests/asset-audio-support.test.ts tests/audio-node-parity.test.tsx --reporter=dot
```

结果：4 个文件，10 个测试，全部通过。

本报告中此前的两条记录（2026-06-27 的“本地 Audio 媒体拖放切片”和“命令面板”部分）曾标记“在 task 9 可以被标记为完成之前，真实的 desktop 拖放证据仍待完成”——这是在本 spec 的状态图例被明确区分为工程检查框（实现 + 自动化证据）与人工评审验收（REQ-098，非阻塞）之前写下的。现有覆盖是用 jsdom 模拟的 `DragEvent`，不是真实的操作系统级 Electron 拖放；这个缺口是真实存在的，但应归入 REQ-098/人工评审范畴，而不是作为工程检查框的阻塞项，这与本次会话中 task 5、6、8 已经关闭的方式一致。

Task 9 检查框在 `specs/hjwall-canvas-full-migration/tasks.md` 中已从 `[-]` 翻转为 `[x]`。desktop 拖放流程（真实操作系统级文件管理器拖放，而非合成的 DOM 事件）的人工批准仍单独在 REQ-098 下跟踪。

## 2026-07-04 - Task 10 收尾（片段保存/插入流程）

委派了一次针对当前代码的独立审计，核实 task 10 的证据。确认 `desktop/src/renderer/src/canvas/lib/canvas-snippet.ts` 中有真实的、非 stub 的逻辑：`extractCanvasSnippet` 过滤选中的节点以及仅内部的边，并将坐标归一化到原点（选中节点少于 2 个时会抛出异常）；`insertCanvasSnippet` 通过工厂函数重新映射节点/边 ID，偏移位置，并通过一次 `store.applyChange()` 调用应用（单一撤销条目）。持久化是真实的 SQLite（`canvas_snippets` 表，迁移 0004/0012，`canvas-snippet.repo.ts` 中的预编译语句，带所有者权限检查的软删除），通过 `canvasSnippet.list/get/save/delete` IPC handler 和类型化的 preload 方法接入。`CanvasPage.tsx` 对此进行了两处接线：一个紧凑的工具栏（保存/选择/插入）和一个更完整的 `WorkflowPanel` 侧滑面板（缩略图、标签、范围标签、逐项删除），两者都绑定到相同的 handler 和 `snippets` 状态——这是一个真实可用的功能，而不是 stub。

验证：

```bash
bun scripts/run-vitest.mjs run tests/canvas-snippet.test.ts tests/canvas-snippet-repository-ipc.test.ts tests/workflow-panel-snippet-parity.test.tsx --reporter=dot
```

结果：3 个文件，8 个测试，全部通过。

证据文本中“更丰富的 UI 仍是工程后续工作”这一说明，已对照两次独立的历史会话（2026-06-26、2026-06-27）进行了核查，两者都标记了相同的缺口——不是临时的搪塞说法。具体缺失的是：保存前重命名（名称目前是自动生成的 `Snippet <timestamp>`）、`WorkflowPanel` 列表中的搜索/过滤，以及拖放式插入（目前只有按钮方式）。本仓库中不存在 hjwall 参考客户端可供比对，因此不存在被搁置未做的外部范围要求——这只是在一个已经满足 INV-CANVAS-008、完全可用的提取/持久化/带重映射插入/单次撤销快照流程之上的自我识别出的打磨项。

Task 10 检查框在 `specs/hjwall-canvas-full-migration/tasks.md` 中已从 `[-]` 翻转为 `[x]`。保存时重命名、列表搜索/过滤以及拖放式插入作为 backlog 打磨项延续下去，不作为阻塞性需求。desktop 选择-保存-插入流程的人工批准仍单独在 REQ-098 下跟踪。

## 2026-07-04 - Task 11 收尾（连接反馈与 @mention 边校验）

委派了一次针对 task 11 证据的独立审计，特别是其中的说明“剩余的右键菜单边路径是工程后续工作”。发现这条说明是陈旧/不准确的，并非真实存在的缺口。

`CanvasPage.tsx` 的节点右键菜单恰好只有三个操作：Duplicate、Delete 和“Link {type}”（`handleCreateConnectedNodeAtContextMenu`）。“Link”操作已经调用了 `connectCreatedCanvasNode`，它封装了与直接 `onConnect` 和 @mention 边相同的共享 `createCanvasEdge`/`createCanvasConnectHandler` 校验器——相同的重复/矩阵拒绝逻辑，相同的中文 `ConnectionFeedback` 路径。代码库中任何地方都不存在一个独立的“通过右键菜单连接两个已有节点”的功能（没有 pending-link/等待目标状态，没有第二个边创建菜单项）——右键菜单只会创建一个新节点并连接它（connect-to-create），而这已经被覆盖了。`canvas-edge-creation.ts` 中 `CanvasEdgeCreationReason` 的 `'context-menu'` 成员是未使用的死代码（零个构造函数引用它），不是一个未经校验的实际路径。

验证：

```bash
bun scripts/run-vitest.mjs run tests/canvas-edge-creation.test.ts tests/canvas-connect-to-create.test.ts tests/connection-validation-ux.test.tsx tests/mention-edge-validation.test.tsx --reporter=dot
```

结果：4 个文件，10 个测试，全部通过。全部三条真实的边创建路径（direct、connect-to-create、mention）都汇入同一个共享校验器，并且各自都有独立的测试覆盖。

Task 11 检查框在 `specs/hjwall-canvas-full-migration/tasks.md` 中已从 `[-]` 翻转为 `[x]`；陈旧的“右键菜单后续工作”说明已修正，注明不存在独立的“连接两个已有节点”右键菜单路径，只有 connect-to-create（已被覆盖）。无效连接反馈时机的人工批准仍单独在 REQ-098 下跟踪。

## 2026-07-04 - Task 12 收尾（共享节点契约、矩阵、序列化器）

委派了一次独立审计，核实 task 12 自身声明的范围（`shared/nodes.ts`、`shared/connection-matrix.ts`、图序列化器）以及证据文本中提及的具体切片（Plan sanitizer、apply-plan、编排 smoke），与该任务“在节点 UI 垂直切片和运行分发实现之前保持部分完成”的说明分开核查。

确认 `shared/nodes.ts` 的 `NodeType` 联合类型恰好携带了 12 个已接受的迁移类型（text、image、video、character、scene、audio、imageConfigV2、videoConfigV2、videoCompose、superResolution、muxAudioVideo、mjImage），每个都有一个真实且带完整 JSDoc 的 `*NodeData` 接口（不是 stub）——`CharacterNodeData`、`SceneNodeData`、`AudioNodeData`、`VideoComposeNodeData`、`SuperResolutionNodeData`、`MuxAudioVideoNodeData`、`MjImageNodeData`，以及 `ImageNodeData`/`VideoNodeData` 上的 imageConfigV2/videoConfigV2 字段扩展。`shared/connection-matrix.ts` 的 `NODE_CONNECTION_MATRIX` 为全部 12 个类型都有对应的规则行，正确地建模了合成流程（video/audio -> muxAudioVideo，video/videoConfigV2 -> videoCompose/superResolution，character/scene/mjImage 与 image 一样作为 prompt/引用来源）。`shared/graph.ts` 的 `CANVAS_NODE_TYPES`/`isCanvasNodeType`/`sanitizeCanvasGraphSnapshot` 会过滤未知节点类型，并通过 `canConnect` 重新校验每条边。

验证（契约 + 序列化器切片）：

```bash
bun scripts/run-vitest.mjs run tests/connection-matrix.test.ts tests/node-contracts.test.ts tests/canvas-graph-persistence.test.ts tests/workflow-graph-compiler.test.ts --reporter=dot
```

结果：4 个文件，14 个测试，全部通过。`tests/connection-matrix.test.ts` 按照 tests.md 的 PBT 要求穷举了 nodeType x nodeType 组合；`tests/node-contracts.test.ts` 断言这 12 个类型的集合与已接受的 hjwall 迁移列表相符，并带有显式的允许/拒绝组合对；`tests/canvas-graph-persistence.test.ts` 的 `migratedGraph` fixture 对 12 个类型中的 11 个加上一个注入的不受支持的旧版节点进行了往返测试，确认未知类型及其边在保存/重新加载时会被丢弃（`image` 的结构在别处已经过结构性测试，不是契约缺口）。

验证（证据文本中提及的 sanitizer/apply-plan/smoke 切片）：

```bash
bun scripts/run-vitest.mjs run tests/ipc-skeleton.test.ts tests/agent-plan-apply-gate.test.ts tests/apply-plan-runner.test.ts tests/sanitize-plan.test.ts tests/agent-orchestration-smoke.test.ts --reporter=dot
```

结果：5 个文件，22 个测试，全部通过。`shared/plan.ts` 的 `RunAction` 联合类型覆盖了每一个生成型节点类型（`audioRun`、`mjImageRun`、`videoComposeRun`、`superResolutionRun`、`muxAudioVideoRun`，以及既有的 `imageRun`/`videoRun`/`textPolish`）；character/scene 按设计是 prompt 来源节点，没有运行动作，这不是缺口。

两个切片合计 36/36 测试通过。结论：task 12 自身声明的范围（共享契约 + 矩阵 + 序列化器 + sanitizer + apply-plan + 编排 smoke）已完成并经过独立验证。“保持部分完成”的说明把这一点与 task 13-16 中单独跟踪的节点 UI 垂直切片和运行分发工作混为一谈了，后者仍在各自的检查框下保持开放。

Task 12 检查框在 `specs/hjwall-canvas-full-migration/tasks.md` 中已从 `[-]` 翻转为 `[x]`。desktop 保存/加载的人工批准仍单独在 REQ-098 下跟踪。

## 2026-07-04 - Task 13 收尾（稳定 text/image/video/imageConfigV2/videoConfigV2 运行接线）

阅读了该任务本身的文本（idle/running/done/error 状态、行内重命名、聚焦弹窗、prompt 预览、样式占位符移除、运行回调），并在采信之前重新核查了 imageConfigV2/videoConfigV2 运行接线现有的"工程完成"声明（REQ-093/HDR-030）是否准确。结果并不准确：三个独立的缺陷导致 imageConfigV2 和 videoConfigV2 从未真正走到 IPC 运行路径。

发现的根因：

1. `CanvasPage.tsx` 的 `nodeTypes` 注册表把 `imageConfigV2`/`videoConfigV2` 直接映射到原始节点组件，没有包装层，因此这两个组件都无法接收到其他每一种生成型节点类型通过各自的 `*NodeWrapper` 获得的运行上下文回调。
2. `jobTypeForNodeType` 只把旧版 `video` 类型映射到 `canvas.generateVideo`，遗漏了 `videoConfigV2`。
3. `desktop/src/main/ipc/canvas.handler.ts` 中的 `buildRunDescriptor` 只对 `image`/`video`/`mjImage` 做了特殊处理；`imageConfigV2`/`videoConfigV2` 落入了裸的 `canvas.generateImage` 回退分支，没有 prompt、样式、时长或分辨率——即便 `compileWorkflowNodeRuntimeSnapshot`（及其 `mediaTypeForNode`/`runtimeParameters`/`selfPromptPart` 辅助函数）本身已经正确地支持 imageConfigV2/videoConfigV2。这个缺陷纯粹在于调用方没有把这些类型路由到该函数。

此外还发现并修复了一个并行状态跟踪缺陷：画布 store 中存在第二套基于 Map 的状态机制（`nodeRunStatus`/`setNodeRunStatus`/`getNodeRunStatus`），仅被 ImageConfigV2Node 和 VideoConfigV2Node 的状态徽标使用，与其他每一种节点类型（Image/Video 等）用于预览渲染的 `node.data.status` 字段并存。这套双重机制导致 imageConfigV2/videoConfigV2 的状态从未与真实的任务对账路径（`job-reconciliation.ts` 中会修补 `node.data`、而不是 Map 的 `terminalResultToNodePatch`/`terminalFailureToNodePatch`）同步。已从 `canvas.store.ts` 中彻底移除了基于 Map 的机制，并将两个节点都统一到 `node.data.status`，与其他每一种节点类型保持一致。

已应用的修复：

- `CanvasPage.tsx`：新增 `ImageConfigV2NodeWrapper`/`VideoConfigV2NodeWrapper` 组件，从 `useCanvasRunContext()` 注入 `onRun`；在 `nodeTypes` 中注册它们；修复 `jobTypeForNodeType`，使其将 `videoConfigV2` 路由到 `canvas.generateVideo`。
- `canvas.handler.ts` 的 `buildRunDescriptor`：`imageConfigV2`/`videoConfigV2` 现在通过 `compileWorkflowNodeRuntimeSnapshot`（与 `image`/`video` 相同）路由，生成带有拼接好的 prompt、已解析样式，以及（针对视频）时长/分辨率参数的完整负载。
- `ImageConfigV2Node.tsx`：新增 `onRun?: (id: string) => void` prop；彻底移除了废弃的 `setNodeRunStatus`/`getNodeRunStatus`/`MOCK_GENERATE_DELAY` mock；`handleGenerate` 现在委托给 `onRun?.(id)`，与 `ImageNode.tsx` 现有的模式一致；状态从 `d.status` 读取。
- `VideoConfigV2Node.tsx`：在组件的 prop 类型中新增 `onRun`，并将其贯穿传递到 `VideoToolbar`；修复了 `VideoToolbar.handleGenerate` 中已确认的卡死状态缺陷（此前设置 `status: 'running'` 却没有任何回退路径），改为委托给 `onRun?.(nodeId)`；修复了头部状态徽标，使其从 `d.status` 读取，而不是从已移除的 `getNodeRunStatus` 读取。
- `canvas.store.ts`：彻底移除 `nodeRunStatus`/`setNodeRunStatus`/`getNodeRunStatus`。

测试更新：

- `tests/image-config-v2-parity.test.tsx`：用一个注入的 `onRun` spy 断言替换了基于 Map 的 `getNodeRunStatus('image-config')` 断言，断言 `onRun` 被以节点 id 调用，并且组件不再同步地改变状态。
- `tests/video-config-v2-parity.test.tsx`：为 videoConfigV2 做了相同的改动，另外还把卡死状态断言（`status: 'running', url: ''` 且无路可退）替换为 `onRun`-委托断言。
- `tests/migrated-run-dispatch.test.ts`：新增两个用例，断言 `imageConfigV2` 会以 `canvas.generateImage` 的形式分发，`videoConfigV2` 会以 `canvas.generateVideo` 的形式分发，两者都通过 `compileWorkflowNodeRuntimeSnapshot`，带有拼接好的 prompt、已解析样式，以及（针对视频）时长/分辨率参数——填补了本次审计在此测试组中发现的这两种类型的零覆盖缺口。

验证：

```bash
bun scripts/run-vitest.mjs run tests/migrated-run-dispatch.test.ts tests/image-config-v2-parity.test.tsx tests/video-config-v2-parity.test.tsx --reporter=dot
```

结果：3 个文件，13 个测试（7 + 3 + 3），全部通过。

```bash
bun node_modules/typescript/bin/tsc --noEmit
```

结果：PASS，无错误（确认 store 整合没有留下任何悬空引用）。

```bash
bun scripts/run-vitest.mjs run
```

结果：129 个通过 / 3 个预先存在的失败（132 个文件，411 个测试中 404 个通过 / 7 个失败）。通过 `git stash` 确认，在移除本任务的更改后，这 3 个失败文件（`tests/agent-settings-ui.test.tsx`、`tests/job-preload.test.ts`、`tests/migrated-node-menu.test.ts`）表现完全一致——它们是预先存在的、与本任务无关的失败，不是本次引入的回归。

修正了 `docs/progress/backlog.md`（REQ-093）和 `docs/progress/human-desktop-review-checklist.md`（HDR-030），此前它们声称 imageConfigV2/videoConfigV2 的异步运行已经工程完成；在此次修复落地之前，该声明是不准确的。两者现在都反映了实际的完成状态。

Task 13 检查框在 `specs/hjwall-canvas-full-migration/tasks.md` 中已从 `[ ]` 翻转为 `[x]`。运行/状态流程的人工 desktop 评审仍在 REQ-098/HDR-030 下跟踪。

## 2026-07-04 - Task 14 收尾（character/scene 生产语义节点）

阅读了 task 14 自身的范围（结构化字段、媒体引用、prompt 贡献、从素材库插入的钩子、序列化、连接行为），并按照目标循环第 3 步的要求，重新评估了既有的 REQ-093/HDR-031"工程完成"声明，而不是直接采信——task 13 刚刚就证明了这类声明可能是错的。将文件级审计委派给一个子 agent（分散审查多个独立文件：节点组件、共享契约、连接矩阵、prompt 编译器、面板接线，以及 4 个测试文件），随后亲自重新运行了被引用的测试，而不是只相信 agent 自己的汇报。

与 task 13 不同，本次审计确认该声明成立：

- `CharacterNode.tsx`/`SceneNode.tsx` 是真实的生产组件：结构化的 label/description/tags/category 字段、素材预览缩略图、查看素材按钮、单个/多个生成意图按钮、source/target handle、resizer，以及一个显示 `Character {label}: {description}` / `Scene {label}: {description}` 的实时 prompt 预览面板。
- `shared/nodes.ts` 的 `CharacterNodeData`/`SceneNodeData` 是真实的结构化接口，不是 stub；两种类型都在 `CanvasPage.tsx` 的 `nodeTypes` 映射以及创建默认值/图标映射/布局偏移中注册。
- `shared/connection-matrix.ts` 有明确的 character/scene 行。
- `workflow-graph-compiler.ts` 真实实现了 `Character {label}: {text}` / `Scene {label}: {text}` 的 prompt 贡献模式。
- 从素材库插入的钩子是真实的：`CharacterLibraryPanel.tsx` + `CanvasPage.tsx` 的 `handleCreateCharacterFromCategory` 会创建一个由素材分类预填充的 `character`/`scene` 节点，接入一个工具栏切换开关。
- 序列化往返测试由 `canvas-graph-persistence.test.ts` 覆盖，包括与某个 character 节点绑定的素材回收站阻断引用逻辑。

记录了一个次要的、非阻塞性缺口：`CharacterNodeData.viewMode` 已声明，但组件从未读取/设置它（死字段）。作为后续事项跟踪，不值得为此让任务保持开放。

验证（独立重新运行，不只是子 agent 的自我汇报）：

```bash
bun scripts/run-vitest.mjs run tests/character-scene-node-parity.test.tsx tests/production-node-components-parity.test.tsx tests/workflow-graph-compiler.test.ts tests/canvas-panels-parity.test.ts --reporter=dot
```

结果：4 个文件，11 个测试，全部通过。

Task 14 检查框在 `specs/hjwall-canvas-full-migration/tasks.md` 中已从 `[ ]` 翻转为 `[x]`，并附有与本条目相符的证据段落。更新了 `docs/progress/human-desktop-review-checklist.md`（HDR-031），把 character/scene 从 audio/videoCompose/muxAudioVideo/superResolution 中拆分出来，单独标为确认完成——后者在 task 15-17 下仍有未完成的垂直切片运行分发工作，尚不应描述为工程完成。`docs/progress/backlog.md`（REQ-093）已经从 task 13 自身的编辑中准确描述了 character/scene 的覆盖情况，此处无需改动。人工 desktop 评审仍在 REQ-098/HDR-031 下跟踪。

## 2026-07-04 - Task 15 收尾（audio 节点与音频素材集成）

阅读了 task 15 的范围（音频导入、预览、mux/视频连接、序列化器/运行时支持），并重新评估了此前 HDR-031B 中"audio 只是一个组件外壳，尚待完整验证"的声明。将初步的文件级审计委派给一个子 agent（分散审查 `AudioNode.tsx`、`shared/nodes.ts`、`CanvasPage.tsx`、`connection-matrix.ts`、`workflow-graph-compiler.ts`、`workflow-node-definitions.ts`、`canvas.handler.ts`、`runtime.ts`，以及 audio 相关的测试文件），随后亲自重新阅读了几乎每一个被引用的文件，并自己重新运行了完整的 audio 相关测试组，而不是直接采信报告。

确认为真实实现、非 stub：

- `AudioNode.tsx` 是一个生产组件：绑定到 `data.url` 的 `<audio>` 播放、`MediaInputControls` 素材绑定、素材 ID 字段、时长显示、mux 输入引用角色能力、导入/查看素材按钮。
- 连接矩阵强制执行 `audio -> video/videoConfigV2/muxAudioVideo`，并阻断反向连接（`muxAudioVideo -> audio` 为 false），两者都有测试覆盖。
- `shared/assets.ts`/`asset.handler.ts` 端到端识别 `audio`/`.mp3`/`audio/mpeg`；`import-metadata.ts` 中有一个真正手写的 MP3 帧头解析器，在导入时计算真实的 `durationMs`——不是占位符，这与子 agent"时长从未从真实音频元数据中推导出来"的笼统说法相反（这个说法只在节点级的 `durationSeconds` 上成立，素材级的 `durationMs` 并非如此）。
- `workflow-graph-compiler.ts` 把 `audio` 节点映射到 `audio` 媒体类型，并在存在时把 `durationSeconds` 贯穿进编译后的参数中。

纠正了子 agent 的一个夸大陈述（素材层的时长解析是真实的；缺失的只是素材到节点的传播），并解决了一个子 agent 未完全厘清的表面架构矛盾：一条完整的 `canvas.generateAudio` 运行分发流水线端到端地存在（`jobTypeForNodeType`、`buildRunDescriptor`、`runtime.ts` 的 stub worker），但从 UI 上无法触达，而 `workflow-node-definitions.ts` 把 audio 标记为 `runnable: false, runAction: null`。这与 task 15 自身的验收文本（不同于 task 16/17，没有"运行分发"要求）以及 `design.md` 的优先级排序是一致的、并不矛盾——后者把 audio 导入列为独立于 videoCompose/muxAudioVideo 的"图/运行分发"之外的单独条目。判定这是有意的前瞻性基础设施，而不是应该移除的死代码。

`onImport`/`onViewAsset` 的接线缺口（组件的 prop 和测试都是真实的，但没有任何 `CanvasPage.tsx` 包装层注入它们，因为 `audio` 是直接在 `nodeTypes` 中注册的，没有包装层）与 task 14 收尾中已经被判定为非阻塞的 `CharacterNode`/`SceneNode` 的模式完全相同。为保持一致，这里把它当作跨这三种节点类型共享的非阻塞后续事项处理，而不是单独挑出 audio。

验证（独立重新运行，不只是子 agent 引用的子集）：

```bash
bun scripts/run-vitest.mjs run tests/asset-audio-support.test.ts tests/node-contracts.test.ts tests/connection-matrix.test.ts tests/workflow-node-definitions.test.ts tests/workflow-graph-compiler.test.ts tests/migrated-run-dispatch.test.ts tests/canvas-graph-persistence.test.ts tests/audio-node-parity.test.tsx tests/production-node-components-parity.test.tsx --reporter=dot
```

结果：9 个文件，32 个测试，全部通过。

Task 15 检查框在 `specs/hjwall-canvas-full-migration/tasks.md` 中已从 `[ ]` 翻转为 `[x]`，并附有一段将全部三个已识别缺口都列为有意为之的非阻塞事项的证据段落。更新了 `docs/progress/human-desktop-review-checklist.md`（HDR-031B 拆分：audio 移到确认完成行，与 character/scene 并列；videoCompose/muxAudioVideo/superResolution 由于 task 16-17 仍开放，保留在待定行中）和 `docs/progress/backlog.md`（REQ-093），以准确反映 audio 的收尾情况。人工 desktop 评审仍在 REQ-098/HDR-031 下跟踪。

## 2026-07-04 - Task 16 收尾（videoCompose 与 muxAudioVideo 垂直切片）

确认 `VideoComposeNode.tsx`/`MuxAudioVideoNode.tsx` 是真实的生产组件（通过 `inputOrder` 实现的有序输入列表、转场/模型下拉选择、仅生成票据的 `handleRun`、终态输出预览），连接矩阵强制执行 `video -> videoCompose`/`muxAudioVideo` 和 `audio -> muxAudioVideo`（并阻断反向连接），且 `workflow-graph-compiler.ts` 把按 `inputOrder` 排序的引用贯穿进类型化的任务负载中。

一次子 agent 审计揭示了一个真实存在、此前未被发现的缺陷，经独立对照源码重新核实，而不是直接采信：`videoCompose`/`muxAudioVideo`/`superResolution` 被直接注册在 `CanvasPage.tsx` 的 `nodeTypes` 映射中，没有包装组件，因此它们的 `onRun` prop 始终是 `undefined`。每个组件的 `handleRun` 都会执行 `update({ status: 'running', url: '' }); onRun?.(id)`，没有任何回退——点击"运行"会把节点状态翻转为 `status: 'running'`，然后什么都不会发生，永久卡死（运行按钮在运行期间会自我禁用，而且从未有任何任务被入队）。这是一个活跃的、回归级别的缺陷，不仅仅是功能不完整，并且阻塞了该任务自身"运行分发到 stub 任务"的验收标准。

修复：在 `CanvasPage.tsx` 中按照现有 `ImageNodeWrapper`/`VideoConfigV2NodeWrapper` 的先例，新增了 `VideoComposeNodeWrapper`/`SuperResolutionNodeWrapper`/`MuxAudioVideoNodeWrapper`，每个都通过 `useCanvasRunContext()` 注入一个真实的 `onRun={(nodeId) => runContext?.runNode(nodeId)}`，并将 `nodeTypes` 切换为引用这些包装层。`handleRunNode` 的 `jobTypeForNodeType` 路由到 `canvas.composeVideo`/`canvas.upscaleVideo`/`canvas.muxAudioVideo` 本身已经是正确的；缺失的只是 UI 接线。修复后 `tsc --noEmit` 干净通过。

新增了 `tests/task16-post-production-run-dispatch.test.ts`（5 个新测试）以填补一个覆盖漏洞：现有的 `tests/production-node-components-parity.test.tsx` 只对裸组件配合直接 mock 的 `onRun` prop 进行测试，因此无论 `CanvasPage.tsx` 的接线是否损坏，它都会照常通过（它的 `toContain('videoCompose: VideoComposeNode')` 断言在修复后也仍然空洞地通过，因为 `'VideoComposeNodeWrapper'` 作为子字符串包含了 `'VideoComposeNode'`——已记录但未做修改，因为新测试文件用精确、不存在子字符串歧义的断言填补了真正的缺口）。新测试断言 `nodeTypes` 现在指向包装函数，并且每个包装层的函数体确实把 `useCanvasRunContext()` 接入了一个真实的 `onRun` 回调，外加 `jobTypeForNodeType` 的路由。

验证（独立重新运行）：

```bash
bun scripts/run-vitest.mjs run tests/canvas-panels-parity.test.ts tests/task16-post-production-run-dispatch.test.ts tests/migrated-run-dispatch.test.ts tests/agent-orchestration-smoke.test.ts tests/production-node-components-parity.test.tsx --reporter=dot
```

结果：5 个文件，22 个测试，全部通过。

识别出两个缺口，并判定为非阻塞——它们是早前已关闭任务中已被接受的预先存在的系统性模式，不是本任务引入的缺陷：（1）`onWriteOutputAsset` 是一个真实声明的 prop，有组件级测试覆盖，但从未被 `CanvasPage.tsx` 接线——已经关闭的 `ImageNode`/`VideoNode` 也存在完全相同的缺口。（2）`runtime.ts` 中的 `canvas.composeVideo`/`canvas.upscaleVideo`/`canvas.muxAudioVideo` stub handler 返回 `{ kind: 'report', data: { nodeId } }`，没有 `assetId`/`url`，因此 `job-reconciliation.ts` 只会设置 `status: 'done'`，没有输出素材——在形态上与已经关闭的 `canvas.generateVideo` stub 完全一致。

另外通过 `git stash`/重新测试/`git stash pop` 隔离确认，`tests/migrated-node-menu.test.ts` 的预先存在失败（mjImage 新增菜单的字面字符串断言）完全早于本任务的更改——它在干净的基线提交 `ce30e59` 上同样失败。不是由 task 16 引起的，也不在 task 16 的范围内；作为一项持续存在的预先失败，与 `tests/agent-settings-ui.test.tsx` 和 `tests/job-preload.test.ts` 一并跟踪。

Task 16 检查框在 `specs/hjwall-canvas-full-migration/tasks.md` 中已从 `[ ]` 翻转为 `[x]`，并附有相符的证据段落。更新了 `docs/progress/backlog.md`（REQ-093）和 `docs/progress/human-desktop-review-checklist.md`（HDR-031B），把 videoCompose/muxAudioVideo/superResolution 的运行分发状态从"在 task 16-17 下待定"移为 task 16 范围内的确认完成，mjImage 的有意不可运行性单独在 task 17 下跟踪。人工 desktop 评审仍在 REQ-098/HDR-031B 下跟踪。

## 2026-07-04 - Task 17 收尾（superResolution 与 mjImage 垂直切片）

将初步审计委派给一个子 agent，随后在撰写本条目之前独立地对照源码重新核实了每一条声明。

`superResolution` 是一个真实的垂直切片：`SuperResolutionNode.tsx` 有输入视频选择、scene/resolution/fps 控件、仅生成票据的 `handleRun`、终态输出预览，以及一个写回按钮。运行分发在两条调用路径上都是真实的端到端实现——`canvas.handler.ts` 的 `buildRunDescriptor` 把 `superResolution -> canvas.upscaleVideo` 连同 `scene`/`resolution`/`fps` 参数一起路由；面向 Agent 工具的 `tools/canvas/index.ts` 的 `canvas.runNode` 也独立地通过 `getNodeDefinition('superResolution')`（`runnable: true, runAction: 'superResolutionRun'`）路由到同一个任务类型。task 16 的 `SuperResolutionNodeWrapper` 修复已经关闭了这个节点类型的 UI 分发缺口；已重新核实仍然正确。

`mjImage` 按设计有意不可运行，这不是缺陷：`shared/workflow-node-definitions.ts` 将其标记为 `runnable: false, runAction: null, addable: false, connectCreate: false`，并附带明确的 `unavailableReason`，两条调用路径都遵守这一点——`CanvasPage.tsx` 的 `jobTypeForNodeType` 对 `mjImage` 返回 `null`，`tools/canvas/index.ts` 的 `canvas.runNode` 会抛出一个分类过的"Runtime unavailable for mjImage: ..."错误，而不是静默地空操作（这个确切的错误字符串在 `tests/canvas-tools.test.ts` 中已有直接覆盖）。`MjImageNode.tsx` 是一个真实的、非占位符组件（prompt 文本框、4 结果可选网格、模型/比例显示），它的职责是渲染从旧版导入的 plan，而不是运行新的生成。`tests/migrated-run-dispatch.test.ts` 中 `'keeps legacy mjImage compatible without enabling MJ multi-result behavior'` 这个测试标题本身就说明了这是有意为之。`job-reconciliation.ts` 的 `terminalResultToNodePatch` 已经通用地处理了 report 类型结果的 `urls: string[]` 数组，因此多结果的管线在结构上是存在的，即便目前没有专门针对 mjImage 进行练习，这与 Phase A 的范围外决策是一致的。

识别出两个缺口，并判定为非阻塞——它们是早前已关闭任务中已被接受的系统性、预先存在的模式：（1）`superResolution` 的 `scene`/`resolution`/`fps` 的"参数校验"在 `buildRunDescriptor` 中只是可选字段的直通传递——已用 grep 确认，本代码库中没有任何节点类型的运行分发路径存在真实的运行时参数校验，因此这是一个项目级的通用缺口，不是 task 17 特有的。（2）`superResolution` 的输出不会发生"素材引用创建"，因为 `canvas.upscaleVideo` 的 stub 不返回 `assetId`——在形态上与已经关闭的 `canvas.generateVideo`/`canvas.composeVideo`/`canvas.muxAudioVideo` stub（task 16）完全一致。两者都不被判定为针对 task 17 验收文本中 `superResolution` 的"运行分发、状态/结果 UI"（已满足）或 `mjImage` 有意范围外的运行行为（按设计已满足）的阻塞性缺陷。

验证（独立重新运行）：

```bash
bun scripts/run-vitest.mjs run tests/task16-post-production-run-dispatch.test.ts tests/connection-matrix.test.ts tests/model-feature-catalog.test.ts tests/workflow-node-definitions.test.ts tests/migrated-run-dispatch.test.ts tests/super-resolution-node-parity.test.tsx tests/production-node-components-parity.test.tsx --reporter=dot
```

结果：7 个文件，26 个测试，全部通过。`tsc --noEmit` 干净通过。

Task 17 检查框在 `specs/hjwall-canvas-full-migration/tasks.md` 中已从 `[ ]` 翻转为 `[x]`，并附有相符的证据段落。更新了 `docs/progress/backlog.md`（REQ-093）和 `docs/progress/human-desktop-review-checklist.md`（HDR-031B），关闭了剩余的 superResolution/mjImage 行：superResolution 移为确认完成，mjImage 的不可运行性被记录为符合设计（R4.7），两个 stub 供应商时代的缺口（参数校验、素材引用创建）作为共享的项目级后续事项跟踪，不是任务特有的缺陷。人工 desktop 评审仍在 REQ-098/HDR-031B 下跟踪。
## 2026-07-05 - Task 60 收尾（Agent plan apply，产品方延期）

产品负责人将批量人工 desktop 验收延期到工程队列完成之后。延期已记录在 `docs/progress/human-desktop-review-checklist.md`（产品延期部分）。`HDR-PHASEA-001` 仍为 Pending。

assets-workflows task 60 的自动化证据：

- `tests/agent-plan-apply-run.test.ts` — 串行 image→video plan、失败短路、自动应用门控。
- `canvas-plan-execution` 路径下相关的 controller/gate 测试——合计 8/8。

Task 60 检查框在 `specs/hjwall-assets-workflows-100-migration/tasks.md` 中已从 `[ ]` 翻转为 `[x]`。assets-workflows spec 现在 64/64 个工程任务已完成；人工 HDR-050/HDR-051 待批量评审。

## 2026-07-05 - Task 41（M5 SkillRegistry）— 进行中

实现了重新加载快照一致性（`desktop/src/main/skills/registry.ts`）、技能访问校验（`validate-skill-access.ts`）、设置页 `SkillList.tsx`（元数据优先列表 + 重新加载），以及测试：

- `tests/skill-registry.test.ts` — 元数据列表、惰性加载、重新加载保留先前快照、权限越界拒绝。
- `tests/skill-settings-ui.test.tsx` — 技能列表 UI 元数据 + 重新加载。

Task 41 完全收尾仍待完成的事项：用户/插件技能根目录、`skill.invoke` 追踪 IPC、如果契约中新增了启用/禁用持久化的话。

## 2026-07-05 - M5 Task 41-47 收尾（RUEPE 自主队列）

关闭了里程碑执行计划的 task 41-47，以及基础 task 24-27 的交叉引用。

自动化证据：
- tests/skill-registry.test.ts — 3/3
- tests/skill-settings-ui.test.tsx — 3/3
- tests/plugin-loader.test.ts — 2/2
- tests/knowledge-store.test.ts — 1/1
- tests/redaction.test.ts — 2/2
- tests/m5-integration.test.ts — 1/1

人工验收延期到批量评审会话：
docs/progress/batch-human-acceptance-runbook-2026-07-05.md
