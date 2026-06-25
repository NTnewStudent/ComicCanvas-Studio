---
inclusion: manual
---

# skill: pm-req-planner

把粗粒度的 ComicCanvas 功能需求转化为带 EARS 验收标准和正确性属性的 requirements、design、tasks 三件套。适用于涉及 IPC、共享契约、Agent 编排、画布行为、任务队列、Provider、DB 或生成资产的大型或跨模块需求，编码前使用。

## 输出位置

创建或更新以下路径（`specs/` 是全项目 spec 存档，Codex/Claude/Kiro 与人工贡献者共享）：

- `specs/<feature-slug>/requirements.md`
- `specs/<feature-slug>/design.md`
- `specs/<feature-slug>/tasks.md`

## requirements.md 格式（EARS 风格）

使用 EARS 验收标准：

```
WHEN <触发> THE <系统> SHALL <行为>.
IF <条件> THEN THE <系统> SHALL <行为>.
WHILE <状态> THE <系统> SHALL <行为>.
WHERE <场景> THE <系统> SHALL <行为>.
FOR ALL <集合> ... SHALL ... （不变量）
```

必须包含：
- 带明确非目标的引言（scope + non-goals）
- 领域术语词汇表
- 用户故事
- 映射到需求的验收标准
- 命名为 `INV-x` 的正确性属性

## design.md 格式

必须包含：
- 映射到需求和不变量的概述
- 架构图（有益时使用 mermaid）
- 组件与接口
- 数据模型
- API/IPC 契约及 `docs/api-contracts/` 链接
- 测试策略
- 行为或存储变更时的迁移/切换方案

## ComicCanvas 生成类需求（AC 必须覆盖）

- 通过本地 job 队列完全异步生成
- 完成/失败 IPC 终态事件
- 请求 handler 无同步资产返回
- 本地资产存储于 appData assets，DB 存相对路径

## 连接类需求（AC 必须引用）

- `shared/connection-matrix.ts` 作为唯一真源
- 穷举或属性测试覆盖允许与拒绝的节点对

## Agent 输出需求（AC 必须要求）

- 纯声明式 CanvasPlan JSON
- 白名单 sanitization
- 拒绝或丢弃可执行代码/脚本字符串

## 模板

参考 `.agents/skills/pm-req-planner/assets/requirements-template.md` 与 `.agents/skills/pm-req-planner/assets/design-template.md`。
