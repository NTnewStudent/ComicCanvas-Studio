# PRD M5 — Agent 进阶

> **里程碑目标**：spawnSubAgent、自定义 Agent、@mention 选择器、工具管理 UI、资产文件夹。
> **前置条件**：M4 全部 ✅
> **状态**：⬜ 未开始

---

## 需求列表

### REQ-050 spawnSubAgent 实现 ⬜

**User Story**：作为 orchestrator，我需要在编排过程中动态生成子 Agent 处理特定子任务，子 Agent 工具集不超出父级。

**Acceptance Criteria**：
1. `spawnSubAgent(spec: SubAgentSpec)` SHALL 在主进程运行，创建独立 AsyncGenerator 实例处理子任务。
2. THE 子 agent SHALL 的 `allowedTools` ⊆ 父 agent 的 `allowedTools`（运行时校验，超集则拒绝并 throw）。
3. 递归深度 SHALL ≤ `MAX_SPAWN_DEPTH = 2`；超过时 throw `max_spawn_depth_exceeded`。
4. 子 agent 结果以 `SpawnSubAgentResult` 返回给父 agent，父 agent 可继续编排。
5. 子 agent 的 IPC 事件独立于父 agent（不污染父 agent 的 job 状态）。

**任务**：
- [ ] `desktop/src/main/agent/spawn-sub-agent.ts`
- [ ] 工具集 ⊆ 校验逻辑
- [ ] 深度计数器（通过 `AgentContext.depth` 传递）
- [ ] 单元测试：超集工具 → 拒绝；depth>2 → 拒绝；正常执行 → 结果返回

---

### REQ-051 子 Agent 隔离 ⬜

**User Story**：作为系统，子 Agent 运行不应影响父 Agent 的画布状态或 job 队列，除非父 Agent 显式合并结果。

**Acceptance Criteria**：
1. 子 agent 的写入工具（addNode/addEdge 等）操作**草稿 graph**，不直接修改持久化 `workflow_version`。
2. WHEN 父 agent 调 `applySubAgentResult(result)`，THE 父 agent SHALL 将草稿 graph 合并（经 sanitize + 矩阵校验）后应用。
3. 子 agent 失败不影响父 agent 继续执行（异常被捕获，记入 `dropped`）。

**任务**：
- [ ] 草稿 graph 隔离机制（内存 graph 副本，不写 DB）
- [ ] `applySubAgentResult` 合并逻辑
- [ ] 单元测试：子 agent 写入 → 父 agent 合并前 DB 不变

---

### REQ-052 自定义 Agent 配置 ⬜

**User Story**：作为高级用户，我需要在 Settings 页面定义自定义 Agent，指定 system prompt、允许工具集、关联 gateway。

**Acceptance Criteria**：
1. Settings 页面 SHALL 展示 `agents` 表中所有 Agent 定义（name / role / gatewayId / allowedTools）。
2. WHEN 用户添加/编辑 Agent，THE 表单 SHALL 包含：name、role（文本）、systemPrompt（textarea）、gatewayId（下拉，从 gateways 表）、allowedTools（多选，从工具注册表读取）。
3. THE `agents` 表行 SHALL 符合 `AgentDefinition` 接口，保存后立即可用于编排。
4. 内置 4 个 Agent（orchestrator/canvas/tooling/pm）只读展示，不可删除。

**任务**：
- [ ] `desktop/src/renderer/settings/AgentList.tsx`
- [ ] `desktop/src/renderer/settings/AgentForm.tsx`
- [ ] `settings.saveAgent / settings.deleteAgent` IPC handler
- [ ] 内置 Agent 保护逻辑
- [ ] 组件测试：新建 Agent → 表单校验 → IPC 调用

---

### REQ-053 @mention Agent 选择器 ⬜

**User Story**：作为用户，在 Chat 输入框输入 `@` 时，我希望看到可用 Agent 列表，选择后指定由该 Agent 处理此消息。

**Acceptance Criteria**：
1. WHEN 用户在 Chat 输入框键入 `@`，THE 输入框 SHALL 弹出 popover，列出所有可用 Agent（name + role 简介）。
2. 用户选择后，`@agent-name` 插入输入框，消息发送时 `agentId` 附在 `canvas.chatSend` payload。
3. WHEN `agentId` 指定，orchestrator SHALL 将该消息路由到对应 Agent 实例。
4. popover 支持键盘导航（↑↓选择，Enter 确认，Esc 关闭）。

**任务**：
- [ ] `desktop/src/renderer/chat/AgentMentionPopover.tsx`
- [ ] `@` 触发检测 hook（`useMentionTrigger`）
- [ ] `canvas.chatSend` payload 增加 `agentId?: string`
- [ ] 路由逻辑在 orchestrator handler
- [ ] 组件测试：键入 `@` → popover 显示；选择 → @mention 插入

---

### REQ-054 工具管理 UI ⬜

**User Story**：作为高级用户，我需要在 Settings 页面查看所有已注册工具，并能启用/禁用特定工具。

**Acceptance Criteria**：
1. Settings 页面 SHALL 展示工具注册表中所有工具（name / description / isReadOnly / isConcurrencySafe / enabled）。
2. WHEN 用户切换 enabled 开关，THE 主进程 SHALL 更新 `tools` 表 `enabled` 字段，后续 `checkPermissions` 校验时禁用的工具视为不在 allowedTools 中。
3. 内置工具（7 个 Canvas 工具）不可永久删除，只可禁用。
4. 工具卡片显示 isReadOnly / isConcurrencySafe 标签（info badge）。

**任务**：
- [ ] `desktop/src/renderer/settings/ToolList.tsx`
- [ ] `settings.setToolEnabled` IPC handler + DB 更新
- [ ] `checkPermissions` 集成 enabled 字段
- [ ] 组件测试：禁用工具 → checkPermissions 拒绝

---

### REQ-055 资产文件夹 ⬜

**User Story**：作为用户，我需要对生成的资产进行分类管理，创建嵌套文件夹并将资产移入。

**Acceptance Criteria**：
1. 资产面板 SHALL 展示 `asset_folder` 树（支持最多 3 级嵌套）。
2. WHEN 用户创建文件夹，THE renderer SHALL 调 `asset.createFolder(name, parentId?)`，写 `asset_folder` 表。
3. WHEN 用户将资产拖入文件夹，THE renderer SHALL 调 `asset.moveAsset(assetId, folderId)`，更新 `asset.folder_id`。
4. 文件夹删除时，子资产移到上级文件夹（不递归删除资产）。
5. `asset_folder.rel_path` 随层级自动拼接（`parent_rel/folder_name`）。

**任务**：
- [ ] `desktop/src/renderer/assets/AssetPanel.tsx`（文件夹树 + 资产格）
- [ ] `asset.createFolder / asset.deleteFolder / asset.moveAsset` IPC handler
- [ ] `AssetRepo.createFolder / moveAsset` 仓储方法
- [ ] 集成测试：创建 → 移入 → 删除父文件夹 → 资产上移

---

### REQ-056 端到端 Agent 进阶验证 ⬜

**Acceptance Criteria**：
1. orchestrator 调用 `spawnSubAgent` 生成 2 个子 Agent 处理并行子任务（mock），父 Agent 合并结果后 applyPlan 成功。
2. 深度超限（depth=3）→ 拒绝 + 错误信息展示在 Chat 面板。
3. 自定义 Agent 在 Chat 中通过 @mention 正确路由并产出 Plan。

**任务**：
- [ ] 集成测试：spawnSubAgent 并行 + 合并
- [ ] 深度超限 e2e 测试
- [ ] @mention 路由集成测试

---

## 完成标准

- [ ] spawnSubAgent 工具超集拒绝 + 深度超限单元测试通过
- [ ] 子 Agent 隔离：草稿写入 DB 不变集成测试通过
- [ ] @mention 路由 e2e 测试通过
- [ ] 资产文件夹 CRUD 集成测试通过
- [ ] `tsc --noEmit` 无报错
