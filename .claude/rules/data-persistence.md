---
globs: desktop/src/main/db/**
---

# 数据持久化规则

## 选型
- **SQLite**（better-sqlite3）+ **Drizzle ORM**，严格模式
- DB 抽象层：dialect 通过配置切换（sqlite 默认 / mysql 可选）

## 访问规约
- 所有读写走**仓储层**（`db/repositories/*.ts`），业务/IPC 层不直接拼查询
- 迁移用 Drizzle migrations，禁止运行时自动改表（无 `synchronize`）
- 事务边界明确：一次画布保存 / 一次 Plan 应用在单事务内

## 核心表
| 表 | 用途 |
|-----|------|
| workflow_project | 画布项目 |
| workflow / workflow_version | 画布图 + 版本 |
| jobs | 持久化任务队列（pending/processing/completed/failed）|
| chat_message | 编排对话（含 planJson、applyStatus）|
| asset / upload_file | 本地资产（相对路径 + orientation）|
| asset_folder | 资产文件夹（用户自定义嵌套）|
| agents / gateways / tools | 自定义 agent / 网关配置 / 插件工具 |

## 资产字段
- DB 只存**相对路径**（相对 `appData/assets/`），不存绝对路径
- `orientation ∈ {landscape, portrait, square}`，终态记录必填

## 红线
- ❌ 业务层散落 SQL / Drizzle 查询
- ❌ 存模型网关临时 URL 或绝对路径作为唯一数据源
- ❌ 运行时自动迁移表结构
