---
name: skill-creator
description: 创建新 skill 的脚手架。生成符合本项目规范的 SKILL.md（YAML frontmatter + 内容结构）与可选 assets/。
---

# skill-creator

为本项目创建新的 Claude Code skill。

## frontmatter 规范

```yaml
---
name: <kebab-case 名称>
description: <一句话：做什么 + 何时使用，模型据此自动判断是否激活>
# 可选：
# when_to_use: <补充触发场景>
# allowed-tools: [Read, Grep, ...]   # 限制工具池
# context: inline | fork              # inline 展开当前对话 / fork 独立子代理
# agent: <关联 sub-agent 名>
# paths: ["glob/**"]                  # 条件激活：操作匹配文件时才出现
---
```

## 内容结构建议

1. 标题 + 一句话定位。
2. **何时使用**（触发条件，越具体越好）。
3. **产出 / 步骤**（可操作清单）。
4. **本项目口径**（与全局约束对齐：异步生成 / 连接矩阵唯一真源 / Plan 纯声明式 等）。
5. 可选 `assets/`（模板文件）。

## 放置位置

`.claude/skills/<name>/SKILL.md`。创建后在 `.claude/README.md` 的 Skills 表登记。
