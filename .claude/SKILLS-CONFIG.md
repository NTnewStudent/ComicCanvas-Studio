# ComicCanvas Studio - Claude Skills 配置清单

## 项目内置 Skills（3个）

### 1. **canvas-node-designer**
- **用途**：设计/新增画布节点类型
- **触发**：需要新增节点时
- **产出**：节点数据模型 + 连接矩阵更新 + UI 约定 + 测试点
- **文件范围**：`desktop/src/renderer/canvas/` + `shared/nodes.ts`

### 2. **pm-req-planner**
- **用途**：粗略需求 → 标准化需求文档（EARS 风格）
- **触发**：新功能需求
- **产出**：`Acceptance Criteria` + `Correctness Properties` → `.claude/specs/<feature>/`
- **文件范围**：`docs/` + `.claude/specs/`

### 3. **skill-creator**
- **用途**：创建新 skill 脚手架
- **触发**：需要添加项目特定 skill
- **产出**：符合项目规范的 `SKILL.md` + 可选 assets
- **文件范围**：`.claude/skills/`

---

## 推荐的 Claude 内置 Skills（常用集）

### 代码质量类

| Skill | 用途 | 触发词 |
|-------|------|--------|
| **code-review** | 代码审查（低/中/高努力度） | "审查 PR"、"代码检查" |
| **security-review** | 安全性审查 | "安全检查"、"权限审查" |
| **simplify** | 代码简化优化 | "简化代码"、"重构" |
| **verify** | 功能验证 | "验证修改"、"测试功能" |

### 配置与优化类

| Skill | 用途 | 触发词 |
|-------|------|--------|
| **update-config** | 项目配置管理（settings.json 钩子等） | "配置权限"、"添加钩子" |
| **fewer-permission-prompts** | 自动减少权限提示 | 工作中可自动调用 |
| **keybindings-help** | 自定义快捷键 | "快捷键"、"按键绑定" |

### 文档与报告类

| Skill | 用途 | 触发词 |
|-------|------|--------|
| **anthropic-skills:docx** | Word 文档生成（规范/报告） | "生成 Word"、"文档" |
| **anthropic-skills:pdf** | PDF 处理（合并/分割/创建） | "PDF 处理" |
| **anthropic-skills:pdf-reading** | 读取 PDF 内容 | "读取 PDF" |

### 开发工作流类

| Skill | 用途 | 触发词 |
|-------|------|--------|
| **run** | 运行项目应用 | "运行应用"、"启动服务" |
| **loop** | 循环任务（轮询/定时） | "每 5 分钟检查"、"定时运行" |
| **claude-api** | Claude API 参考 | "API 使用"、"模型选择" |

---

## 项目特定场景推荐

### 功能开发流程
```
1. 需求输入 → @pm-agent + /pm-req-planner
   ↓
2. 节点设计 → @canvas-agent + canvas-node-designer
   ↓
3. 代码实现 → /code-review → /simplify
   ↓
4. 安全检查 → /security-review
   ↓
5. 功能验证 → /verify
```

### Bug 修复流程
```
1. 定位问题 → Explore agent（搜索相关代码）
2. 实现修复 → 代码编写
3. 审查与测试 → /code-review → /verify
```

### 配置优化
```
1. 配置更新 → /update-config
2. 权限优化 → /fewer-permission-prompts
3. 快捷键配置 → /keybindings-help
```

---

## 使用方式

### 方式一：直接调用 Skill 命令
```bash
/code-review          # 审查当前变更
/verify               # 验证功能
/pm-req-planner       # 需求规格化
/canvas-node-designer # 设计新节点
```

### 方式二：通过 Agent 触发
```
@pm-agent /pm-req-planner
@canvas-agent /canvas-node-designer
@tooling-agent /code-review
```

### 方式三：在消息中提及
```
"审查一下这个 PR"        → 自动触发 /code-review
"检查安全性"             → 自动触发 /security-review
"生成需求文档"           → 自动触发 /pm-req-planner
```

---

## 当前项目配置状态

✅ **已配置**：
- 基础权限白名单（npm/git/node）
- 4 个项目 agents（orchestrator/canvas/tooling/pm）
- 3 个项目 skills（canvas-node-designer/pm-req-planner/skill-creator）

⚠️ **建议补充**：
- 添加 `code-review` 自动触发规则（PR 提交时）
- 添加 `fewer-permission-prompts` 权限优化
- 配置项目 git hooks（pre-commit lint、commit message 检查）

---

## 下一步

### 快速启用推荐配置
```bash
# 优化权限提示
/fewer-permission-prompts

# 查看 API 参考
/claude-api

# 配置项目钩子
/update-config
```

### 创建项目特定 Skill（如需）
```bash
# 使用脚手架创建新 skill
/skill-creator

# 示例：为 Electron 打包创建 skill
# → .claude/skills/electron-builder/SKILL.md
```

---

**更新时间**：2026-07-05  
**项目版本**：ComicCanvas Studio v1.0
