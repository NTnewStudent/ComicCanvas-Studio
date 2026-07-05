# 核心平台实现就绪度

本文档在 M1 实现启动前，收尾 M0 阶段遗留的基础规划任务。它将基础设计转化为持久化、仓储层、运行时骨架、产品面、内置项和交接规则的具体实现契约。

## DB Schema 草案

M1 阶段的 SQLite/Drizzle schema SHALL 从以下表开始。所有 ID 均为主进程生成的稳定字符串 ID。所有 JSON 列在仓储层边界处，写入前和读取后均需校验。

| 表 | 必需列 | 归属 | 契约 |
| :--- | :--- | :--- | :--- |
| `jobs` | `id`, `type`, `status`, `target_id`, `payload_json`, `result_json`, `error_class`, `error_message`, `retryable`, `lease_owner`, `attempts`, `progress`, `created_at`, `updated_at` | tooling-agent | `docs/api-contracts/jobs.md` |
| `assets` | `id`, `media_type`, `status`, `rel_path`, `safe_url`, `width`, `height`, `duration_ms`, `orientation`, `mime_type`, `hash`, `folder_id`, `created_at`, `updated_at`, `deleted_at` | tooling-agent | `docs/api-contracts/assets-files.md` |
| `asset_folders` | `id`, `parent_id`, `name`, `type`, `rel_path`, `sort_order`, `created_at`, `updated_at`, `deleted_at` | tooling-agent | `docs/api-contracts/assets-files.md` |
| `asset_references` | `id`, `asset_id`, `ref_type`, `ref_id`, `created_at` | tooling-agent | `docs/api-contracts/assets-files.md` |
| `workflows` | `id`, `name`, `created_at`, `updated_at`, `deleted_at` | canvas-agent | `docs/api-contracts/canvas-plan.md` |
| `workflow_versions` | `id`, `workflow_id`, `graph_json`, `created_at`, `created_by` | canvas-agent | `docs/api-contracts/canvas-plan.md` |
| `chat_messages` | `id`, `workflow_id`, `agent_run_id`, `role`, `content`, `plan_json`, `apply_status`, `created_at` | orchestrator-agent | `docs/api-contracts/agents.md` |
| `gateway_configs` | `id`, `name`, `type`, `base_url`, `key_ref`, `capabilities_json`, `model_map_json`, `enabled`, `created_at`, `updated_at` | tooling-agent | `docs/api-contracts/gateway-providers.md` |
| `tools` | `id`, `owner_kind`, `owner_id`, `name`, `schema_json`, `permission_json`, `concurrency`, `enabled`, `created_at`, `updated_at` | tooling-agent | `docs/api-contracts/tools-plugins.md` |
| `tool_audit` | `id`, `trace_id`, `tool_id`, `actor_type`, `actor_id`, `capability`, `target_json`, `decision`, `reason`, `created_at` | tooling-agent | `docs/api-contracts/audit-observability.md` |
| `agents` | `id`, `source`, `name`, `description`, `instructions`, `policy_json`, `enabled`, `created_at`, `updated_at` | orchestrator-agent | `docs/api-contracts/agents.md` |
| `agent_runs` | `id`, `agent_id`, `job_id`, `status`, `context_pack_id`, `trace_json`, `error_class`, `created_at`, `updated_at` | orchestrator-agent | `docs/api-contracts/agents.md` |
| `skills` | `id`, `source`, `version`, `name`, `entry`, `metadata_json`, `enabled`, `created_at`, `updated_at` | orchestrator-agent | `docs/api-contracts/skills.md` |
| `skill_invocations` | `id`, `skill_id`, `version`, `agent_run_id`, `loaded_refs_json`, `status`, `created_at` | orchestrator-agent | `docs/api-contracts/skills.md` |
| `knowledge_documents` | `id`, `source_type`, `source_ref`, `scope_json`, `status`, `metadata_json`, `created_at`, `updated_at`, `deleted_at` | tooling-agent | `docs/api-contracts/knowledge-context.md` |
| `knowledge_chunks` | `id`, `document_id`, `ordinal`, `text`, `metadata_json`, `embedding_ref`, `created_at` | tooling-agent | `docs/api-contracts/knowledge-context.md` |
| `context_packs` | `id`, `agent_run_id`, `summary_json`, `source_refs_json`, `redactions_json`, `created_at` | orchestrator-agent | `docs/api-contracts/knowledge-context.md` |

Schema 规则：

- 渲染层可见的查询 SHALL 绝不返回绝对路径形式的 `rel_path`。
- 密钥 SHALL 以 `key_ref` 值存储，经密钥库解析，而非 JSON 明文。
- 终态 job 状态 SHALL 为不可变，除了幂等修复元数据。
- 任何涉及用户可见删除的表 SHALL 使用 `deleted_at` 或墓碑状态，除非契约明确允许硬删除。

## 仓储层归属边界

所有原始 Drizzle/SQL 访问归属于 `desktop/src/main/db/repositories/` 之下。Service、IPC、worker 和 agent 模块 SHALL 调用仓储层，不得直接查询表。

| 仓储 | 表 | 公共职责 |
| :--- | :--- | :--- |
| `job.repo.ts` | `jobs` | 创建工单、领取任务、状态迁移、列表/查询、恢复更新 |
| `asset.repo.ts` | `assets`, `asset_references` | 创建资产、更新元数据、记录引用关系、墓碑检查 |
| `asset-folder.repo.ts` | `asset_folders` | 文件夹 CRUD、移动树结构、回收站文件夹元数据 |
| `workflow.repo.ts` | `workflows`, `workflow_versions` | 保存/加载图版本与图元数据 |
| `chat-message.repo.ts` | `chat_messages` | 持久化对话、Plan、应用状态 |
| `gateway.repo.ts` | `gateway_configs` | 网关配置 CRUD（不含明文密钥） |
| `tool.repo.ts` | `tools`, `tool_audit` | 注册表快照、启用/禁用、审计决策 |
| `agent.repo.ts` | `agents`, `agent_runs` | 内置镜像、用户 agent CRUD、运行轨迹 |
| `skill.repo.ts` | `skills`, `skill_invocations` | skill 元数据快照与调用轨迹 |
| `knowledge.repo.ts` | `knowledge_documents`, `knowledge_chunks`, `context_packs` | 摄入记录、分块、检索元数据、context pack 轨迹 |

边界检查：

- `desktop/src/main/ipc/**` SHALL 仅包含校验与 handler 编排逻辑。
- `desktop/src/main/jobs/**` SHALL 使用 `job.repo.ts` 管理持久化状态。
- `desktop/src/main/providers/**` SHALL 不导入 DB 表。
- `desktop/src/renderer/**` SHALL 不导入仓储层或主进程模块。

## 迁移策略

迁移由应用控制并版本化。

- M1 SHALL 为上述 schema 新增初始 Drizzle 迁移。
- 应用启动时 SHALL 在服务启动前检查 DB schema 版本。
- 生产环境用户 DB SHALL NOT 被临时运行时 SQL 自动改动。
- 迁移失败 SHALL 以安全错误停止服务启动，并给出恢复说明。
- 迁移测试 SHALL 针对临时 SQLite 数据库运行。
- 任何改变持久化 JSON 结构的迁移 SHALL 在相关契约文档中附兼容性说明。

## 运行时骨架规划

### JobRuntime

实现文件：

- `desktop/src/main/jobs/queue.ts`
- `desktop/src/main/jobs/worker.ts`
- `desktop/src/main/jobs/recovery.ts`
- `desktop/src/main/jobs/events.ts`

必需行为：

- `enqueue` 写入 `pending` 行并返回 `JobTicket`。
- Worker 在转为 `processing` 前通过 lease 认领任务。
- 终态结果/错误在事件发出前先持久化。
- 启动恢复时，将残留的 `processing` 行重新入队，或以 `job_worker_interrupted` 标记失败。
- 测试覆盖终态唯一性与无同步资产返回。

### AssetService 与本地文件库

实现文件：

- `desktop/src/main/assets/pipeline.ts`
- `desktop/src/main/assets/protocol.ts`
- `desktop/src/main/assets/library.ts`

必需行为：

- 生成的字节数据保存在应用受控存储中。
- 在标记为 `ready` 前完成元数据与朝向分类。
- 通过安全协议解析渲染层媒体资源。
- 拒绝路径越界，绝不暴露绝对路径。
- 对回收站/墓碑操作强制执行引用检查。

### GatewayRegistry

实现文件：

- `desktop/src/main/providers/registry.ts`
- `desktop/src/main/providers/stub.provider.ts`
- `desktop/src/main/providers/openai-compatible.provider.ts`
- `desktop/src/main/providers/async-media.provider.ts`
- `desktop/src/main/security/key-vault.ts`

必需行为：

- M1 提供确定性的 `stub`。
- M3 新增 OpenAI 兼容与异步媒体适配器。
- 网关配置热重载仅影响后续新任务。
- 不支持的能力在提交到远端之前即失败。
- 密钥经加密与红化处理。

### ToolRuntime 与 PluginLoader

实现文件：

- `desktop/src/main/tools/runtime.ts`
- `desktop/src/main/tools/registry.ts`
- `desktop/src/main/tools/plugin-loader.ts`
- `desktop/src/main/tools/canvas/*.ts`

必需行为：

- 注册前校验工具 schema 与权限。
- 内置工具与插件工具共用同一调用路径。
- 只读工具可并发运行；写入操作串行或独占执行。
- 无效插件被隔离并附带诊断信息。

### AgentRuntime 与 AgentRegistry

实现文件：

- `desktop/src/main/agent/runtime.ts`
- `desktop/src/main/agent/registry.ts`
- `desktop/src/main/agent/orchestrator.ts`
- `desktop/src/main/agent/spawn-sub-agent.ts`
- `desktop/src/main/agent/sanitize-plan.ts`

必需行为：

- 内置 agent 与用户 agent 加载进同一注册表。
- Agent 运行为持久化 job。
- Context Pack 在使用模型/工具之前构建完成。
- CanvasPlan 输出在应用前经过净化。
- 子 agent 权限为父级策略的交集子集。

### SkillRegistry

实现文件：

- `desktop/src/main/skills/registry.ts`
- `desktop/src/main/skills/loader.ts`

必需行为：

- 从文档规定的路径发现内置、用户与插件 skill。
- 优先暴露元数据，惰性加载引用内容。
- 当所需权限超出 agent 策略时，调用失败。
- 重新加载失败时保留上一个有效快照。

### KnowledgeStore 与 ContextBuilder

实现文件：

- `desktop/src/main/knowledge/store.ts`
- `desktop/src/main/knowledge/retriever.ts`
- `desktop/src/main/knowledge/context-builder.ts`

必需行为：

- 摄入本地文件、文档、笔记与资产元数据。
- 优先通过词法检索进行分块与索引，embedding 支持置于接口后。
- 检索遵循项目/工作区/用户批准的范围。
- 已删除或移除的来源在删除/重建后被排除。
- Context Pack 来源包含引用元数据。

## 设置与管理面

M3-M5 渲染层设置 SHALL 通过领域 API 暴露以下面板，而非通用的 `settings.*` IPC：

| 面板 | API 契约 | 必需控件 |
| :--- | :--- | :--- |
| 网关（Gateways） | `docs/api-contracts/gateway-providers.md` | 列表、新增、编辑、启用/禁用、测试、删除、模型映射、密钥掩码显示 |
| 工具（Tools） | `docs/api-contracts/tools-plugins.md` | 列表、归属标识、权限标识、启用/禁用、诊断信息 |
| 插件（Plugins） | `docs/api-contracts/tools-plugins.md` | 本地清单加载、禁用/卸载、隔离详情 |
| Agent | `docs/api-contracts/agents.md` | 内置只读列表、自定义创建/编辑/删除、工具/skill 策略 |
| Skill | `docs/api-contracts/skills.md` | 列表、元数据查看、重新加载、启用/禁用（若支持） |
| 知识库（Knowledge） | `docs/api-contracts/knowledge-context.md` | 摄入、检索预览、删除、重建、范围/引用检查 |
| 资产库（Asset Library） | `docs/api-contracts/assets-files.md` | 文件夹、移动、回收站/墓碑、引用警告 |
| 健康与审计 | `docs/api-contracts/audit-observability.md` | 健康检查、审计过滤、安全调试导出 |

## 初始内置工具

| Tool ID | 分类 | 权限 | 并发性 | 用途 |
| :--- | :--- | :--- | :--- | :--- |
| `canvas.queryGraph` | canvas | `canvas.read` | readonly | 返回图快照。 |
| `canvas.proposePlan` | canvas | `canvas.read` | readonly | 产出草稿 CanvasPlan，无变更。 |
| `canvas.createNode` | canvas | `canvas.write` | serial-write | 添加 text/image/video 节点。 |
| `canvas.connectNodes` | canvas | `canvas.write` | serial-write | 通过连接矩阵校验后添加边。 |
| `canvas.updateNodeData` | canvas | `canvas.write` | serial-write | 更新节点数据与标签。 |
| `canvas.deleteNode` | canvas | `destructive` | exclusive | 经确认策略后删除节点。 |
| `canvas.runNode` | canvas | `provider.spend` | serial-write | 将生成任务入队。 |
| `asset.import` | asset | `file.read` | serial-write | 导入用户批准的文件。 |
| `asset.move` | asset | `canvas.write` | serial-write | 在文件夹间移动资产。 |
| `asset.trash` | asset | `destructive` | exclusive | 经引用检查后放入回收站/墓碑。 |
| `gateway.test` | gateway | `network` | serial-write | 将网关测试任务入队。 |
| `knowledge.retrieve` | knowledge | `canvas.read` | readonly | 检索范围内的知识分块。 |
| `knowledge.ingest` | knowledge | `file.read` | serial-write | 摄入用户批准的来源。 |

## 初始内置 Skill

| Skill ID | 所需工具 | 输出 |
| :--- | :--- | :--- |
| `comic.script-breakdown` | `knowledge.retrieve`, `canvas.proposePlan` | 场景分拍与节点规划提示。 |
| `comic.storyboard-planning` | `canvas.queryGraph`, `canvas.proposePlan` | 分镜列表与图布局建议。 |
| `comic.character-consistency` | `knowledge.retrieve`, `asset.import` | 角色参考包与 prompt 约束。 |
| `comic.image-prompt-refinement` | `canvas.queryGraph`, `canvas.updateNodeData` | 带风格/角色一致性的精炼图像 prompt。 |
| `comic.video-shot-planning` | `canvas.queryGraph`, `canvas.proposePlan` | 视频运行步骤与帧参考策略。 |

每个 skill SHALL 在运行时实现前定义元数据、预期输入、输出、轨迹字段、所需工具与权限需求。

## 默认 Agent 阵容与交接规则

| Agent | 用途 | 默认工具 | 默认 Skill | 交接规则 |
| :--- | :--- | :--- | :--- | :--- |
| `orchestrator-agent` | 分析用户请求并产出经净化的 CanvasPlan 工作流。 | `canvas.queryGraph`, `canvas.proposePlan`, `knowledge.retrieve` | script breakdown, storyboard planning | 图变更细节交接给 canvas-agent；运行时/网关相关问题交接给 tooling-agent。 |
| `canvas-agent` | 负责画布图操作、节点配置、布局与 Plan 应用。 | 默认排除破坏性操作的 canvas 工具 | image prompt refinement, video shot planning | 任务/资产/网关故障交接给 tooling-agent。 |
| `tooling-agent` | 负责 DB、jobs、assets、gateways、tools、plugins 与 IPC 实现。 | asset、gateway、job、tool、knowledge 工具 | 默认无 | 契约缺失或含糊时交接给 pm-agent。 |
| `pm-agent` | 负责需求、API 契约、backlog、进度与验证报告。 | 只读诊断与契约工具 | 默认无 | 契约通过后将实现交接给 tooling/canvas/orchestrator。 |
| `super-agent` | M5 之后可选的强力入口，用于大范围多 agent 任务。 | 显式策略授权后可用 `*` | 所有允许的 skill | 可 spawn 子 agent；子级权限始终为父级子集。 |

规则：

- 内置 agent 在设置中为只读，除非迁移另有说明。
- 自定义 agent 仅可在显式指定工具、skill、网关、上下文与权限策略的情况下创建。
- 交接为可追踪的 agent 事件，且不绕过 ToolRuntime。
