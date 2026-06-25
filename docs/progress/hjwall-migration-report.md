# hjwall 核心功能迁移迭代报告（REQ-077 ~ REQ-084）

> 日期：2026-06-26
> 范围：将 hjwall pc-client 8 项核心功能迁移至 ComicCanvas Studio

---

## 1. REQ-077 画布项目管理（多工作流创建/切换/重命名/删除）✅

**实现摘要**：在画布页面新增 `ProjectManager` 组件，支持多工作流的 CRUD 操作（创建、切换、重命名、删除），通过 IPC 调用后端 `canvas.handler` 管理持久化数据。

**文件变更**（2 files, +122 / -4）：
- `desktop/src/main/ipc/canvas.handler.ts` — 新增工作流 CRUD IPC handler
- `desktop/src/renderer/src/canvas/components/ProjectManager.tsx` — 项目管理器 UI 组件

---

## 2. REQ-078 工作流保存/加载（Ctrl+S + 自动保存 + 加载恢复）✅

**实现摘要**：实现 Ctrl+S 手动保存 + 定时自动保存策略，画布加载时从 DB 恢复节点/连线/视口状态。通过 `workflow.repo` 持久化 graph JSON。

**文件变更**（3 files, +242 / -2）：
- `desktop/src/main/db/repositories/workflow.repo.ts` — 新增 save/load workflow 方法
- `desktop/src/preload/index.ts` — 暴露保存/加载 IPC bridge
- `desktop/src/renderer/src/canvas/CanvasPage.tsx` — Ctrl+S 绑定 + 自动保存 + 加载恢复逻辑

---

## 3. REQ-079 画布内资产库面板（浮动面板+搜索+分类+时间排序）✅

**实现摘要**：新增 `CanvasAssetPanel` 浮动面板，支持资产搜索、分类筛选（image/video/text）、按创建时间倒序排列。扩展 `shared/ipc.ts` 通道定义，后端 `asset.handler` 提供查询接口。

**文件变更**（10 files, +927 / -8）：
- `desktop/src/main/db/repositories/asset.repo.ts` — 资产查询扩展
- `desktop/src/main/db/repositories/workflow.repo.ts` — 工作流辅助查询
- `desktop/src/main/ipc/asset.handler.ts` — 资产列表 IPC handler
- `desktop/src/main/ipc/canvas.handler.ts` — 画布资产查询
- `desktop/src/preload/index.ts` — 资产 IPC bridge
- `desktop/src/renderer/src/assets/AssetPanel.tsx` — 资产面板基础组件
- `desktop/src/renderer/src/canvas/CanvasPage.tsx` — 集成浮动资产面板
- `desktop/src/renderer/src/canvas/components/CanvasAssetPanel.tsx` — 画布内资产面板（新建）
- `desktop/src/renderer/src/canvas/components/ProjectManager.tsx` — 项目选择器集成
- `shared/ipc.ts` — 新增 IPC 通道定义

---

## 4. REQ-080 画布左侧操作栏增强（数据驱动+展开菜单+功能按钮）✅

**实现摘要**：重构画布左侧操作栏为数据驱动架构，支持展开/折叠菜单、节点类型快捷添加按钮，通过配置数组渲染功能按钮列表。

**文件变更**（1 file, +117 / -27）：
- `desktop/src/renderer/src/canvas/CanvasPage.tsx` — 左侧操作栏数据驱动重构

---

## 5. REQ-081 画布内 AI 对话（浮动 FAB + 展开面板 + Plan 应用）✅

**实现摘要**：新增 `CanvasChatBox` 组件，通过右下角 FAB 按钮唤出浮动对话面板，支持发送消息、接收 AI 回复（当前为 stub 响应），以及将 Plan 应用到画布。

**文件变更**（2 files, +355 / -0）：
- `desktop/src/renderer/src/canvas/CanvasPage.tsx` — 集成 ChatBox FAB
- `desktop/src/renderer/src/canvas/components/CanvasChatBox.tsx` — 画布内 AI 对话面板（新建）

---

## 6. REQ-082 画布右键菜单（空白区添加节点+节点操作）✅

**实现摘要**：实现画布右键上下文菜单，空白区域右键可添加 Text/Image/Video 节点，节点上右键提供复制、删除、锁定等操作。

**文件变更**：包含在 REQ-082 commit 中（与 V2 节点迭代合并提交），主要修改：
- `desktop/src/renderer/src/canvas/CanvasPage.tsx` — 右键菜单逻辑 + ContextMenu 组件

---

## 7. REQ-083 节点引用创建（@mention 自动创建/清理连线）✅

**实现摘要**：在 `MentionTextarea` 中扩展 @mention 功能，引用其他节点时自动创建连线（edge），当引用文本被删除时清理对应连线。扩展 `shared/nodes.ts` 添加引用元数据字段。

**文件变更**（4 files, +112 / -7）：
- `desktop/src/renderer/src/canvas/components/MentionTextarea.tsx` — @mention 连线创建/清理逻辑
- `desktop/src/renderer/src/canvas/nodes/ImageConfigV2Node.tsx` — 引用输入支持
- `desktop/src/renderer/src/canvas/nodes/VideoConfigV2Node.tsx` — 引用输入支持
- `shared/nodes.ts` — 新增 `references` 元数据字段

---

## 8. REQ-084 后端接口本地化验证（IPC 映射完整性确认）✅

**实现摘要**：审查并补充后端 IPC handler，确保所有前端调用的 IPC 通道都有对应的后端实现，修复 asset/job handler 中缺失的接口。

**文件变更**（4 files, +83 / -8）：
- `desktop/src/main/ipc/asset.handler.ts` — 补充资产查询/分类接口
- `desktop/src/main/ipc/canvas.handler.ts` — 修复接口签名
- `desktop/src/main/ipc/job.handler.ts` — 补充任务状态接口
- `desktop/src/main/runtime.ts` — 注册缺失的 handler

---

## 验证结果

### TypeScript 编译
```
bunx tsc --noEmit → 0 errors ✅
```

### 测试结果
```
Test Files: 38 passed | 17 failed (55 total)
Tests:      133 passed | 28 failed (161 total)
```

**失败原因分析**：全部 17 个失败文件均为 `better-sqlite3` 原生模块 ABI 版本不匹配（NODE_MODULE_VERSION 130 vs 137），属于 **预存环境问题**，与本次 REQ-077~084 变更无关。需要在 Electron 环境中使用 `@electron/rebuild` 重建原生模块。

### 通过的关键测试
- 所有 UI 组件测试通过（chat-ui, gateway-settings, text-node, image-node, video-node 等）
- 所有契约测试通过（connection-matrix, composed-prompt, shared-contracts）
- 所有安全测试通过（electron-security, key-vault, sanitize-plan）

---

## 已知限制

| 限制 | 说明 |
| :--- | :--- |
| ChatBox stub 响应 | `CanvasChatBox` 当前使用模拟回复，需接入真实 AI Provider |
| 资产面板依赖已有 IPC | `CanvasAssetPanel` 复用现有 asset IPC，未新增后端资产上传 |
| 自动保存间隔固定 | 当前 30 秒自动保存，后续可配置化 |
| 右键菜单未覆盖所有节点类型 | 自定义节点类型的右键菜单待扩展 |
| @mention 连线无校验 | 引用创建的连线未经过 `canConnect` 矩阵校验 |
| 原生模块 ABI 不匹配 | `better-sqlite3` 需要 `@electron/rebuild` 重建 |

---

## 文件变更汇总

| 指标 | 数量 |
| :--- | :--- |
| 涉及 commit | 8 |
| 新建文件 | 6 |
| 修改文件 | 18+ |
| 总新增行数 | ~1,960+ |
| 总删除行数 | ~56+ |
