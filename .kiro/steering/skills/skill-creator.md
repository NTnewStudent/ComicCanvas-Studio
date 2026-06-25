---
inclusion: manual
---

# skill: comiccanvas-skill-creator

为 ComicCanvas 创建新的仓库级 Kiro steering skill 时使用本 skill。

## 输出位置

在 `.kiro/steering/skill-<name>.md` 创建新的 skill steering 文件（`inclusion: manual`）。

同时在 `.agents/skills/<skill-name>/SKILL.md` 创建 Codex/Agents 兼容版本。

## Kiro Steering 文件结构

```yaml
---
inclusion: manual
---
```

正文结构：
1. 标题与一句话用途
2. 何时使用（触发条件）
3. 期望的用户/代码库输入
4. 执行步骤
5. 必须产出
6. ComicCanvas 特定约束

## ComicCanvas 特定约束（每个新 skill 必须涵盖）

- 通过 job 队列异步生成
- `shared/connection-matrix.ts` 作为连接唯一真源
- 纯声明式 CanvasPlan 输出
- 新 IPC/服务接口前先在 `docs/api-contracts/` 登记

## Codex SKILL.md frontmatter

```yaml
---
name: <kebab-case-name>
description: <清晰的触发范围；Codex 何时应/不应使用它>
---
```

## 维护规则

- 每个 skill 聚焦一项任务
- 优先用指令而非脚本（除非需要确定性工具）
- 若 skill 取代了 Claude skill，在两个发现文档中同步更新或明确说明 Kiro steering 是规范版本
