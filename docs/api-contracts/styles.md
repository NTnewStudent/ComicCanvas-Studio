# Style Presets API Contract

## Purpose

风格预设为 prompt 预览与生成任务提供项目级与节点级的画风控制。共享的 prompt 函数是渲染层预览与主进程运行时负载构造共用的唯一规则。

## Shared Contracts

- `StylePresetView`：渲染层安全的风格预设，字段包括 `id`、`code`、`name`、
  `description`、`promptBefore`、`promptAfter`、`legacyPromptPreset`、
  `negativePrompt`、`coverAssetId`、`coverUrl`、`tags`、`enabled`、
  `sortOrder`、`createdAt`、`updatedAt`。
- `StylePresetSaveInput`：创建/更新输入。密钥值与本地绝对路径不是合法字段。
- `StyleProjectDefaultRequest`：`{ workflowId, stylePresetId }`，其中
  `stylePresetId: null` 表示清除项目默认值。

## Prompt Composition

`composeStyledPrompt(content, style)` 是纯函数且具备确定性：

- 对 `content`、`promptBefore`、`promptAfter` 进行 trim。
- 若 `promptBefore` 或 `promptAfter` 存在，则按顺序 `promptBefore`、content、
  `promptAfter`，用 `\n` 拼接非空部分。
- 若 before/after 均为空，则使用 `legacyPromptPreset`，拼接为
  `content + "\n\n画面风格：" + legacyPromptPreset`。
- 若不存在任何风格部分，则原样返回 trim 后的 content。

运行时路径与预览路径 SHALL 使用同一个共享函数，或字节等价的派生实现。

## Effective Style Resolution

节点级 `stylePresetId` 会覆盖工作流项目的默认值。生效风格缺失或已禁用属于
可恢复的运行校验错误：

- `style_not_found`：所选风格不可用。
- `style_disabled`：所选风格存在但已禁用。

当被引用的风格缺失或已禁用时，保存/加载 MUST 保持非破坏性。

删除一个风格预设 SHALL 对该预设做软删除/禁用，并清除指向该预设的工作流
项目默认值，同时保留现有节点级 `stylePresetId` 的图数据，以便过期节点
校验能够报告该问题。

## IPC Channels

- `style.list`：列出对 settings 或画布界面可见的已启用与已禁用风格预设。
- `style.save`：创建或更新一个风格预设。
- `style.delete`：软删除或禁用一个预设，且不修改现有图节点数据；指向该被
  删除预设的工作流项目默认引用 SHALL 被清除。
- `style.setProjectDefault`：设置或清除某个工作流的默认风格预设。
- `style.getProjectDefault`：读取某个工作流当前的默认风格预设，以便渲染层
  的项目选择器能够从持久化状态初始化。

面向渲染层的响应 SHALL 只包含安全的资产 URL。SHALL NOT 包含本地绝对路径、
API 密钥、生成的字节数据，或特定 provider 的临时 URL。

## Evidence

在 REQ-094 被标记为完成之前需要具备以下验证证据：

- 共享契约与 prompt 组合的单元测试。
- 风格持久化与项目默认值更新的仓储层与 IPC 测试。
- 渲染层风格库、画布风格面板，以及节点/项目选择器的测试。
- 桌面端流程：选择项目风格、覆盖节点风格、运行一个 stub 任务，并验证任务
  负载使用了预期的带风格 prompt。
