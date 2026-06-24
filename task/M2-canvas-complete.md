# PRD M2 — 画布完整

> **里程碑目标**：三节点完整交互、连接校验、确定性 prompt 预览、资产展示、inline 改名、保存/加载。
> **前置条件**：M1 全部 ✅
> **状态**：⬜ 未开始

---

## 需求列表

### REQ-020 React Flow 画布 Store ⬜

**User Story**：作为用户，我需要一个状态管理层，统一管理画布的节点/边/视口/undo，前端 UI 订阅其变化。

**Acceptance Criteria**：
1. SHALL 使用 Zustand v4 管理 `nodes / edges / viewport`。
2. THE store SHALL 提供 `applyChange / addNode / addEdge / deleteNode / deleteEdge / saveSnapshot / undo` 操作。
3. undo 支持至少 20 步，整个 Plan 应用折叠为**一条** undo 快照。
4. THE store SHALL NOT 调用任何 IPC——副作用由调用方触发。
5. 无 `any`，nodes/edges 类型为 `shared/nodes.ts` 导出类型。

**任务**：
- [ ] `desktop/src/renderer/canvas/store/canvas.store.ts`
- [ ] undo/redo 快照逻辑（zustand-immer 或 custom middleware）
- [ ] 单元测试：addNode → deleteNode → undo 恢复

---

### REQ-021 Text 节点 ⬜

**User Story**：作为用户，我需要一个文本节点，默认显示 label，点击展开显示文本输入区。

**Acceptance Criteria**：
1. 默认（collapsed）状态：只显示 label 文字 + 节点边框。
2. WHEN 用户单击节点，THE 节点 SHALL 展开，显示 `<textarea>` 用于编辑 `content` 字段。
3. WHEN 用户点击节点外部，THE 节点 SHALL 折叠。
4. 字数超过展开区高度时内部滚动，不撑大节点尺寸。
5. 双击 label 进入 inline 改名模式（REQ-027 共用逻辑）。

**任务**：
- [ ] `desktop/src/renderer/canvas/nodes/TextNode.tsx`
- [ ] 折叠/展开动画（CSS transition，respect prefers-reduced-motion）
- [ ] 组件测试：click → expand → 输入 → blur → collapse

---

### REQ-022 Image 节点 ⬜

**User Story**：作为用户，我需要一个图片节点，集成「配置 + 生成 + 结果」，按节点状态展示不同内容。

**Acceptance Criteria**：
1. 四态 UI：
   - `idle`：只显示 label + 占位符（虚线框）
   - `expanded`（点击后）：显示 prompt 输入、模型选择、orientation 选择、**生成**按钮
   - `pending/running`：显示骨架屏或 spinner（不阻塞画布交互）
   - `done`：展示生成图片（`cc-asset://` 协议，object-fit contain），图片下方显示 orientation 标签
2. WHEN 用户点击**生成**，THE renderer SHALL 调 `canvas.runNode` IPC，不同步等待结果。
3. 节点宽高随 orientation 自适应（landscape/portrait/square 三种比例）。
4. 双击 label inline 改名（REQ-027）。

**任务**：
- [ ] `desktop/src/renderer/canvas/nodes/ImageNode.tsx`
- [ ] 状态驱动 UI（idle/expanded/running/done 四态）
- [ ] cc-asset:// 图片展示 + 骨架占位
- [ ] orientation 自适应尺寸
- [ ] 组件测试：四态渲染快照

---

### REQ-023 Video 节点 ⬜

**User Story**：作为用户，我需要一个视频节点，配置首/尾帧图片参考和时长，生成后可在节点内预览视频。

**Acceptance Criteria**：
1. 展开后显示：prompt 输入、模型选择、orientation 选择、时长（秒）输入、首帧/尾帧图片（可选，拖入或选择 asset）。
2. `done` 态：展示视频预览（`<video>` + `cc-asset://`，静音自动循环）。
3. 上游 image 节点连接后，可在首帧/尾帧选择器中选用上游 asset。
4. 双击 label inline 改名（REQ-027）。

**任务**：
- [ ] `desktop/src/renderer/canvas/nodes/VideoNode.tsx`
- [ ] 首/尾帧选择器组件
- [ ] 视频预览（静音 + loop + cc-asset://）
- [ ] 组件测试：四态渲染快照

---

### REQ-024 连接校验 ⬜

**User Story**：作为用户，当我连了两个节点，如果连接不合法，我希望立即看到提示而不是静默接受。

**Acceptance Criteria**：
1. WHEN `onConnect` 触发，THE Canvas SHALL 调 `canConnect(source.type, target.type)`（import from `shared/connection-matrix.ts`）。
2. IF 不合法，THE Canvas SHALL 拒绝连线并显示 toast（"xx → xx 不允许连接"）。
3. 同一对节点已有连线时，禁止重复连线。
4. 后端保存图时二次校验，前后端均使用 `shared/connection-matrix.ts` 同一函数。

**任务**：
- [ ] `onConnect` handler 调 `canConnect`
- [ ] toast 通知（Radix UI Toast 或 sonner）
- [ ] 重复连线校验
- [ ] 单元测试：前后端 `canConnect` 调用同一函数，PBT 3×3

---

### REQ-025 Connected Inputs Panel + Prompt 预览 ⬜

**User Story**：作为用户，在展开图片/视频节点时，我希望看到上游文本节点的内容列表，以及最终会传给模型的 prompt 预览。

**Acceptance Criteria**：
1. 展开节点时，面板上方显示所有上游 text 节点内容（按 edge.createdAt 升序），每条带节点 label。
2. 面板下方显示「最终 Prompt 预览」，调用 `composeFinalPrompt`（`shared/composed-prompt.ts`）。
3. 预览结果与主进程下发模型的内容字节等价（前后端同函数）。
4. 上游节点内容实时更新时，预览自动刷新。

**任务**：
- [ ] `ConnectedInputsPanel` 组件
- [ ] 接入 `composeFinalPrompt` 函数（import from `shared/`）
- [ ] 实时刷新（Zustand selector 监听上游 nodes）
- [ ] 组件测试：2 个上游 text → 预览显示正确拼接

---

### REQ-026 节点画幅自适应 ⬜

**User Story**：作为用户，生成完成后节点应按图片/视频的实际宽高比显示，不拉伸。

**Acceptance Criteria**：
1. 节点根据 `orientation(landscape/portrait/square)` 切换预设尺寸（如 280×180 / 180×280 / 220×220）。
2. 图片/视频以 `object-fit: contain` 填充，不裁切。
3. `done` 态前以骨架屏占位，尺寸与最终一致（避免布局跳动）。
4. 用户可手动拖拽调整节点大小（React Flow NodeResizer）。

**任务**：
- [ ] orientation → 节点尺寸映射常量
- [ ] NodeResizer 集成
- [ ] 骨架屏占位（Tailwind animate-pulse）

---

### REQ-027 节点 Inline 改名 ⬜

**User Story**：作为用户，我希望双击节点 label 就能直接重命名，不需要弹窗。

**Acceptance Criteria**：
1. WHEN 用户双击节点 label，THE label SHALL 变为 `<input>`，自动聚焦，全选内容。
2. WHEN 用户按 Enter 或 blur，THE label SHALL 保存新名称并退出编辑模式。
3. WHEN 用户按 Escape，THE label SHALL 恢复原名称并退出编辑模式。
4. 空字符串不允许保存（恢复原名称）。
5. 三种节点共用同一 `useInlineRename` hook。

**任务**：
- [ ] `useInlineRename(initialLabel, onSave)` hook
- [ ] 集成到 TextNode / ImageNode / VideoNode
- [ ] 单元测试：Enter 保存、Escape 取消、空值拒绝

---

### REQ-028 画布保存 / 加载 ⬜

**User Story**：作为用户，我希望画布状态在关闭/重开应用后能恢复。

**Acceptance Criteria**：
1. WHEN 用户触发保存（Ctrl+S 或自动保存），THE Canvas SHALL 调 `canvas.saveGraph` IPC，传入完整 graph JSON。
2. THE 主进程 SHALL 把 graph JSON 存入 `workflow_version` 表（单事务）。
3. WHEN 应用启动，THE Canvas SHALL 调 `canvas.loadGraph`，恢复最新版本节点/边/视口。
4. 加载时按 Connection_Matrix 二次校验边，非法边忽略并 console.warn。

**任务**：
- [ ] `canvas.saveGraph` IPC handler（WorkflowRepo）
- [ ] `canvas.loadGraph` IPC handler
- [ ] renderer 侧 load 逻辑（启动时 TanStack Query 拉取）
- [ ] 集成测试：保存 → 重启 → 加载 → 节点一致

---

### REQ-029 零轮询验证 ⬜

**Acceptance Criteria**：
1. renderer 中 grep 无 `setInterval` 轮询资产状态。
2. 节点状态更新仅由 `job.completed / job.failed` IPC 事件驱动，或 TanStack Query `invalidateQueries`。
3. e2e 测试：生成期间抓取 renderer 定时器列表，确认无资产轮询计时器。

**任务**：
- [ ] grep 检查（`grep -r "setInterval" desktop/src/renderer`）
- [ ] IPC 事件驱动刷新实现
- [ ] e2e 计时器验证

---

## 完成标准

- [ ] 三节点（Text/Image/Video）UI 渲染测试全通过
- [ ] 连接校验 PBT 3×3 通过
- [ ] Prompt 预览前后端字节等价测试通过
- [ ] 画布保存/加载集成测试通过
- [ ] grep setInterval 在 renderer 无命中
- [ ] `tsc --noEmit` 无报错
