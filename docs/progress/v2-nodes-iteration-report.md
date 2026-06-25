# V2 节点复刻迭代报告 — 2026-06-26

## 迭代目标
复刻 hjwall v2 版本的生图/生视频节点，重置设计系统，优化画布性能。

## 完成项

### 1. 设计系统重置
- DESIGN.md → hjwall 炭黑+翠绿版本（10 章节，含亮色模式章节）
- styles.css CSS 变量对齐 hjwall tokens

### 2. CSS 动画系统
- 7 个 @keyframes 移植（呼吸光环、流光、连线流动、媒体溶解、错误抖动、Handle 脉冲）
- Handle 自定义样式（16px 品牌色圆形）
- 按钮系统（cc-btn-primary / cc-btn-secondary）

### 3. 共享组件库（5 个）
- RunStatusBadge（五态状态徽章）
- Chip（芯片按钮）
- PopoverMenu（弹出选择菜单）
- PromptFocusModal（专注模式弹窗）
- MentionTextarea（@提及文本框）

### 4. 共享类型扩展
- ImageNodeData +5 字段（prompt/modelId/stylePresetId/ratio/url）
- VideoNodeData +8 字段（prompt/duration/resolution/referenceAssets 等）
- 新增类型：ImageRatio(6种) / VideoRatio(6种) / VideoResolution(3档) / ReferenceAsset
- NodeType 新增 imageConfigV2 / videoConfigV2
- 连接矩阵扩展 V2 节点

### 5. ImageConfigV2Node（~525 行）
- 预览卡四态 + 20px 圆角 + 动画
- 选中 Toolbar 960px + MentionTextarea + 芯片行
- Handle 自定义 + 全屏预览 portal
- 接口桩（模拟状态切换）

### 6. VideoConfigV2Node（~774 行）
- 预览卡四态 + 比例驱动动态宽度
- 选中 Toolbar + 素材缩略图 + 时长滑条 + 分辨率选择
- hover 自动预览 + 全屏 portal
- 接口桩

### 7. 画布引擎性能优化
- 消除 store↔ReactFlow 双态同步循环
- ReactFlow 内置 useNodesState/useEdgesState 为实时状态源
- Store 仅做 debounced 持久化（300ms）
- 所有节点组件 React.memo
- nodeTypes 移到模块级
- 回调用 useCallback 稳定化
- onlyRenderVisibleElements 启用

### 8. 测试验证
- TypeScript 编译零错误
- 画布相关 43 个测试用例全部通过

## 未完成项
- 生图/生视频 API 集成（等网关对接）
- MentionTextarea 自动连线创建
- 画风/风格预设真实数据源
- 资产上传集成
- V2 节点专属测试编写
