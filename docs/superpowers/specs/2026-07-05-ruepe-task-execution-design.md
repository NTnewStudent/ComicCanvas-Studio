# RUEPE 任务执行规范 — 设计文档

Date: 2026-07-05

Canonical rule: `.cursor/rules/ruepe-task-execution.mdc`

## 目的

将 Cursor 开发 Agent 的默认工作流固化为五阶段 **RUEPE**（Read → Understand → Evaluate → Plan → Execute），以 `docs/progress/backlog.md` 的「当前执行项」为战术单线程指针，以 `specs/*/tasks.md` 为任务细节真源，双写进度到 spec 勾选与 `docs/progress/project-log.md`。

本规范约束 **仓库内开发 Agent**（Cursor），不修改产品运行时 `desktop/src/main/agent/` 的编排提示词。

## 决策记录

| 决策项 | 选择 |
| :--- | :--- |
| 落点 | Cursor 项目规则 `alwaysApply: true` |
| 任务调度真源 | `backlog.md`「当前执行项」指针 |
| 任务细节真源 | 指针所指的 `specs/.../tasks.md` 中对应编号任务块 |
| 进度落盘 | spec 勾选 + `project-log.md` + 更新 backlog 指针 |
| 适用范围 | 全部用户消息均走 RUEPE（含只读查询） |
| 并行 | 禁止并行推进多项 spec 任务；禁止子 Agent 并行拆多项任务 |

## 任务解析

### 指针表（backlog）

`docs/progress/backlog.md` 在「当前焦点」之下维护：

```markdown
## 当前执行项（RUEPE 真源，单项）

| 字段 | 值 |
| :--- | :--- |
| spec | specs/hjwall-canvas-full-migration/tasks.md |
| task | 20 |
| 状态 | 进行中 |
| 阻塞原因 | |
```

- **spec**：相对仓库根路径的 tasks 文件。
- **task**：该文件中 `- [ ]` / `[-]` / `[x]` 列表的编号（与任务标题前的数字一致）。
- **状态**：`待开始` / `进行中` / `已完成` / `阻塞`。
- **阻塞原因**：状态为阻塞时必填；否则留空。

### 解析算法

1. Read `backlog.md`，读取「当前执行项」表。
2. 若指针存在：打开 `spec` 文件，定位 `task` 编号对应条目全文（含 Verify / Evidence / Requirements）。
3. 若指针缺失：尝试从「当前焦点」「下一步」唯一推导一个 spec；若推导出不唯一项 → Evaluate 输出**阻塞**，不进入实现。
4. 用户当次消息显式指定其他 spec/任务编号时：以用户指令为准，并同步更新 backlog 指针。
5. 在同一 spec 内按文档顺序执行；不得跳过靠前的 `[ ]` / `[-]` 去做靠后任务（用户显式重排除外）。

「当前焦点」保留战略描述；「当前执行项」是战术单线程指针。

## RUEPE 五阶段

| 阶段 | 实现类消息 | 只读类消息（如查进度） |
| :--- | :--- | :--- |
| **Read** | backlog 指针 + spec 任务块 + design/api-contracts + 已有 evidence | progress、spec、test-report、project-log |
| **Understand** | 复述目标/边界/依赖；列出待澄清项 | 说明用户要什么信息 |
| **Evaluate** | 对照代码/测试复核勾选是否可信；轻微优化 vs 重大偏差 | 判断文档是否漂移 |
| **Plan** | 步骤、文件、风险、`bun scripts/run-vitest.mjs run ...`、`bun run typecheck` | 说明将引用哪些来源作答 |
| **Execute** | 实现/修复；测试通过前不得标 `[x]` | 输出报告，无产品代码变更 |

### 偏差处理

- **轻微优化**：Plan 中说明理由后采用（与 project-log 2026-07-04 task 13 模式一致）。
- **重大偏差**：暂停 Execute，用 AskQuestion 确认。包括：需求与实现矛盾、需新 IPC/契约、需跳过任务顺序、无法判断测试基线失败归属。

### 只读回合展示

五阶段不得跳过思考；用户可见回复可用 **RUEPE 简表** 压缩，但须覆盖五阶段要点。

## 进度双写

### A. Spec（`specs/*/tasks.md`）

- `[ ]` → `[-]`（开始）→ `[x]`（仅测试通过后）。
- 任务下追加 **Evidence**：变更摘要、验证命令、通过数/总数。

### B. Project log（`docs/progress/project-log.md`）

- 顶部插入 dated 条目，对齐 2026-07-04 风格：任务号、理解、方案、测试、非阻塞 follow-up。

### C. Backlog 指针

- 完成后：更新状态；`task` 指向 spec 内下一未完成项；必要时更新 REQ 行简述。

### D. 聊天输出（任务完成时）

```
【任务 N】<名称>
- 状态：已完成 / 阻塞
- 理解摘要：…
- 方案说明：…
- 测试结果：…
- 进度：<已完成>/<总数>（该 spec 内）
```

## 任务链自动下发

完成一项后**默认**检查 backlog 指针并自动下发下一项（同会话续跑 RUEPE），无需用户再次输入「继续任务」。

| 规则 | 说明 |
| :--- | :--- |
| 默认 | 执行类消息完成首项后自动续链 |
| 停用 | 用户消息含「仅此项」「不要自动继续」「单线程停止」「只做一个」 |
| 暂停 | 下一项 `状态` 为阻塞 → 输出暂停摘要并结束链 |
| 上限 | 单条用户消息最多连续 3 项；达上限提示「继续任务」续链 |
| QingTian | 链内不 `record_reply`；链末对合并回复同步一次 |

续链仍遵守：不得跳过靠前 `[ ]`/`[-]`、不得并行、测试未通过不得标 `[x]`、重大偏差 AskQuestion 并结束链。

## 禁止事项

- 禁止跳过 Read→Understand→Evaluate→Plan 直接写产品代码。
- 禁止未跑验证就标 `[x]` 或写「已完成」。
- 禁止并行第二项 spec 任务或并行子 Agent 执行多项任务。
- 禁止静默重大替代方案。
- 禁止擅自调整 spec 任务顺序（用户显式重排除外）。

## 规则冲突优先级

1. 安全/禁止类（`coding-standards`、`project-identity` 红线）最高。
2. Superpowers `brainstorming` HARD-GATE 或 Plan mode：Execute 不得写产品代码，直至设计获批。
3. RUEPE 串行与测试门禁优先于「可并行工具调用」习惯。
4. QingTian MCP：`record_reply` + `check_messages` 在用户可见回复**之后**执行。
5. 无用户明确要求不得 git commit。

## Superpowers 衔接

| RUEPE 阶段 | Skill |
| :--- | :--- |
| Evaluate（复杂） | 只读探索；禁止并行 Task |
| Plan（多文件） | `writing-plans` |
| Execute 前 | `test-driven-development` |
| 声称完成前 | `verification-before-completion` |
| 大步骤结束 | `requesting-code-review` / `code-reviewer`（串行，仍属当前单项） |

## 已知风险

| 风险 | 缓解 |
| :--- | :--- |
| alwaysApply token 成本 | 只读回合用 RUEPE 简表 |
| backlog 多焦点歧义 | 单指针表 |
| backlog 与 spec 漂移 | Evaluate 交叉核对；漂移写 project-log |
| 环境无 bun | 标阻塞，不标完成 |
| REQ-095 等与 assets-workflows spec 不一致 | Evaluate 时以 spec + 代码为准，修正 backlog 简述 |

## 验收标准

1. 新对话处理「查看进度」时引用 backlog 指针 + spec，可见 RUEPE（可简表）。
2. 「继续任务」仅针对指针单项；测试未通过不更新 `[x]`。
3. 本设计 doc 与 `.cursor/rules/ruepe-task-execution.mdc` 一致。
4. backlog 含可解析指针；初始 task 20（hjwall-canvas-full-migration）。

## 参考

- `docs/progress/project-log.md`（2026-07-04 `/goal` 与 goal loop step-3）
- `specs/hjwall-canvas-full-migration/tasks.md` status legend
- Superpowers `verification-before-completion`
