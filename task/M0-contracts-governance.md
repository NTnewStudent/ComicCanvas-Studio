# PRD M0 — 契约 & 治理

> **里程碑目标**：shared/ 类型契约、.claude/ 治理层、LTM 就绪，是所有后续里程碑的静态基础。
> **状态**：✅ 完成

---

## 需求列表

### REQ-001 `shared/nodes.ts` — 节点类型 & Data 模型 ✅

**User Story**：作为 tooling/canvas-agent，我需要一份前后端共享的节点类型定义，避免各自维护副本。

**Acceptance Criteria**：
- WHEN 引用节点类型，THE shared/nodes.ts SHALL 导出 `NodeType = 'text' | 'image' | 'video'`。
- THE 文件 SHALL 包含 `TextNodeData / ImageNodeData / VideoNodeData / CanvasEdgeData` 完整字段定义。
- THE 文件 SHALL 包含 `NodeStatus = 'idle'|'pending'|'running'|'done'|'error'`。
- 无 `any`，全 strict TypeScript。

**验证**：`tsc --noEmit` 通过；grep 无 `any`。

---

### REQ-002 `shared/connection-matrix.ts` — 连接矩阵 ✅

**User Story**：作为前后端，我需要一份唯一真源判断节点连线合法性。

**Acceptance Criteria**：
- THE `NODE_CONNECTION_MATRIX` SHALL 定义 `text→[image,video]`, `image→[image,video]`, `video→[video]`。
- THE `canConnect(u, d): boolean` 函数 SHALL 被 renderer `onConnect` 与 main 图校验器共同 import。
- PBT 穷举 3×3 所有组合，断言与矩阵定义等价。

**验证**：Vitest + fast-check 属性测试，9 组合全通过。

---

### REQ-003 `shared/plan.ts` — CanvasPlan 类型 ✅

**User Story**：作为 orchestrator-agent，我需要一个声明式 Plan 类型让主进程和渲染层能安全传递编排结果。

**Acceptance Criteria**：
- THE `CanvasPlan` SHALL 包含 `kind / summary / nodes / edges / runSteps / question / dropped`。
- THE `RunAction` SHALL = `'imageRun' | 'videoRun' | 'textPolish'`，无其它值。
- FOR ALL Plan 实例，SHALL 可 JSON.stringify/parse 无损往返（无 Function / undefined 字段）。

**验证**：类型编译通过；序列化往返单元测试。

---

### REQ-004 `shared/ipc.ts` — IPC 通道契约 ✅

**Acceptance Criteria**：
- SHALL 导出所有 IPC 通道名常量：`canvas.*` / `job.*` / `settings.*` / `asset.*`。
- 新增 IPC 通道前必须先在此文件 + `docs/api-contracts/` 登记。
- 无运行时 side-effect（纯类型/常量文件）。

---

### REQ-005 `shared/tools-agents.ts` — Tool/Agent/Gateway 类型 ✅

**Acceptance Criteria**：
- SHALL 导出 `ToolDefinition / AgentDefinition / GatewayConfig / AssetFolder`。
- SHALL 导出 `SubAgentSpec / SpawnSubAgentResult / MAX_SPAWN_DEPTH = 2`。
- `SubAgentSpec.allowedTools` 类型 `string[]`，运行时校验 child ⊆ parent。

---

### REQ-006 `.claude/` 治理层 ✅

**Acceptance Criteria**：
- SHALL 包含 `agents/` (4 文件) + `rules/` (9 文件) + `commands/` (6 文件) + `skills/` + `specs/`。
- `.claude/settings.json` SHALL 包含 permissions allow/deny + Stop hook for LTM。
- 无任何 `.kiro/` 残留引用。

---

### REQ-007 `docs/api-contracts/tools-agents.md` ✅

**Acceptance Criteria**：
- SHALL 包含完整 Tool 接口 TypeScript 签名 + canvas 工具集 7 条目表格。
- SHALL 包含 `agent.spawnSubAgent` 完整输入/输出/安全约束描述。

---

### REQ-008 `shared/composed-prompt.ts` — 确定性 Prompt 拼接 ✅

**User Story**：作为主进程和渲染层，我需要一个纯函数，对同一 graph 快照产出字节等价的最终 prompt。

**Acceptance Criteria**：
1. WHEN 节点有 ≥1 个上游 text，THE 函数 SHALL 按 `edge.createdAt` 升序排列，用 `\n`(U+000A) 拼接文本内容。
2. WHEN 节点自身有 promptOverride，THE 函数 SHALL 追加在拼接文本之后；自身为空不追加尾随换行。
3. WHEN 上游含 image/video 节点，THE 函数 SHALL 在文本前追加固定中文指令前缀，并返回 `referenceImages / referenceVideos`。
4. FOR ALL 相同 graph 快照，多次调用结果 SHALL 恒等（纯函数，无随机/时间依赖）。
5. 前端预览与后端下发调用同一函数，文本贡献部分字节等价。

**接口**：
```typescript
export function composeFinalPrompt(
  graph: GraphSnapshot,
  nodeId: string
): { composedPrompt: string; referenceImages: AssetRef[]; referenceVideos: AssetRef[] }
```

**任务**：
- [ ] 实现 `shared/composed-prompt.ts` 纯函数
- [ ] Vitest + fast-check PBT：随机 text + 顺序断言恒等 + 前后端字节等价
- [ ] 确认无 side-effect（不读 DB、不调网络）

**验证**：PBT ≥100 次随机用例全通过；前后端同函数引用确认。

---

### REQ-009 LTM 初始化 ✅

**User Story**：作为开发者，我需要 LTM 记录系统就绪，Stop hook 能自动捕获会话。

**Acceptance Criteria**：
1. `ltm/bin/ltm.py selftest` 退出码 0。
2. `ltm/events.jsonl` / `ltm/checkpoints.jsonl` / `ltm/sessions.jsonl` 文件存在（可为空）。
3. `.claude/settings.json` Stop hook 命令路径有效，dry-run 不报错。

**任务**：
- [ ] 检查 `ltm/bin/ltm.py` 是否存在，若无则创建最小实现（selftest + capture-turn）
- [ ] 验证 Stop hook 路径（Windows python 命令可用性）
- [ ] 写一条手动测试记录确认 append 逻辑正确

---

## 完成标准

- [x] REQ-008 通过 PBT
- [x] REQ-009 ltm selftest 通过
- [ ] `tsc --noEmit` 在 shared/ 无报错
- [ ] grep `any` 在 shared/ 无命中
