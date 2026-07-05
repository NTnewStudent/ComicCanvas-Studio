# Assets And Files Contract

## Owner

- Primary: tooling-agent
- Supporting: canvas-agent, pm-agent
- Shared source: `shared/assets.ts`, `shared/nodes.ts`

## Scope

本契约涵盖生成资产、导入的本地文件、资产文件夹、图片分类/标签、引用完整性、
安全的渲染层 URL、云端 URL 元数据，以及本地文件库行为。资产存放于应用受控
的存储中；DB 记录只存储相对路径与可选的归一化云端 URL 元数据。

Non-goals：

- 渲染层响应中不出现绝对文件系统路径。
- 不将 provider 临时 URL 作为持久资产引用。
- 本地版本中不存在 Seedance、真人或活体鉴权类资产系统。
- 不存在独立的角色/场景/道具/生物实体表；这些概念属于图片资产分类。

## Request/Response Contracts

### `asset.pickImportFiles`

Request:

```ts
type AssetPickImportFilesRequest = Record<string, never>
```

Response:

```ts
interface AssetPickImportFilesResponse {
  paths: string[]
}
```

`asset.pickImportFiles` 打开主进程的系统文件选择器，返回用户所选文件的
本地绝对路径。它 SHALL NOT 上传文件、持久化记录、暴露存储凭证或返回文件
字节数据。渲染层 MAY 对每个所选路径依次调用 `asset.import`，以复用同一套
本地/R2 导入流水线与进度模型。

### `asset.import`

Request:

```ts
interface AssetImportRequest {
  sourcePath: string
  folderId?: string
  mediaType: AssetMediaType
  categoryIds?: string[]
  tags?: string[]
}
```

Response:

```ts
interface AssetRecord {
  id: string
  displayName?: string
  mediaType: AssetMediaType
  status: AssetStatus
  relativePath: string
  safeUrl: string
  metadata: AssetMetadata
  folderId?: string
  createdAt: number
  updatedAt: number
}
```

### `asset.move`

Request:

```ts
interface AssetMoveRequest {
  assetId: string
  folderId: string | null
}
```

Response:

```ts
type AssetMoveResponse = AssetRecord
```

### `asset.rename`

Request:

```ts
interface AssetRenameRequest {
  assetId: string
  displayName: string
}
```

Response:

```ts
type AssetRenameResponse = AssetRecord
```

`asset.rename` 仅更新逻辑显示标签。它 SHALL NOT 重命名本地文件、云端对象、
`relativePath`、`safeUrl` 或 `s3Key`；这能保证用户可见的重命名操作后，
画布/节点引用保持稳定。

### `asset.getCategories`

Request:

```ts
interface AssetCategoryListRequest {
  includeDisabled?: boolean
}
```

Response:

```ts
type AssetCategoryListResponse = AssetCategory[]
```

### `asset.createCategory` / `asset.updateCategory`

Requests:

```ts
interface AssetCategoryCreateRequest {
  name: string
  description?: string
  color?: string
  icon?: string
  sortOrder?: number
}

interface AssetCategoryUpdateRequest {
  categoryId: string
  name?: string
  description?: string | null
  color?: string
  icon?: string
  sortOrder?: number
  enabled?: boolean
}
```

Response:

```ts
type AssetCategoryMutationResponse = AssetCategory
```

### `asset.assignCategory` / `asset.removeCategory`

Request:

```ts
interface AssetCategoryAssignRequest {
  assetId: string
  categoryId: string
}
```

### `asset.trash`

Request:

```ts
interface AssetTrashRequest {
  assetId: string
  mode: 'safe' | 'force-tombstone'
}
```

### `asset.getFolders`

Request:

```ts
type AssetGetFoldersRequest = Record<string, never>
```

Response:

```ts
type AssetGetFoldersResponse = AssetFolder[]
```

### `asset.createFolder`

Request:

```ts
interface AssetFolderCreateRequest {
  name: string
  parentId: string | null
  type: AssetFolderType
}
```

Response:

```ts
type AssetFolderCreateResponse = AssetFolder
```

### `asset.deleteFolder`

Request:

```ts
interface AssetFolderDeleteRequest {
  folderId: string
  mode: 'safe' | 'force-tombstone'
}
```

Response:

```ts
interface AssetFolderDeleteResponse {
  folderId: string
  status: 'deleted' | 'rejected'
  affectedAssetIds: string[]
  tombstonedAssetIds: string[]
  blockingReferences: AssetReference[]
}
```

Response:

```ts
interface AssetTrashResponse {
  assetId: string
  status: 'trashed' | 'tombstoned' | 'rejected'
  blockingReferences: AssetReference[]
}
```

Rules:

- 生成的字节数据 SHALL 在任务终态结果被归一化后，通过 AssetService 保存。
- `cc-asset://asset/<assetId>` 或文档记载的等效形式，是渲染层使用的 URL。
- 文件夹整理 SHALL 更新文件夹关系，且不泄漏绝对路径。
- 资产重命名 SHALL 仅更新 `displayName` 与 `updatedAt`；存储路径与安全 URL
  保持不变。
- 删除一个文件夹树 SHALL 对文件夹做软删除，并在请求 `force-tombstone` 时
  将被引用的资产保留为可恢复的墓碑记录。
- 资产的创建/更新/回收/墓碑化变更 SHALL 通过 `asset.changed` IPC 事件发出。
- 内置的起始图片分类 SHALL 为角色、场景、道具与生物。
- 自定义分类 SHALL 在 SQLite 中持久化 name、slug、color、icon、排序、内置
  标志、启用状态与删除状态。
- 资产分类的指定 SHALL 保留底层资产记录，并 SHALL 在渲染层安全的
  `AssetRecord` 值上暴露分类 ID。
- 渲染层的上传进度 SHALL 建模为本地多文件导入状态，包含文件索引/数量、
  当前文件名、完成百分比与最近一次失败的文件名。
- 不引入 `asset.uploadProgress` IPC 通道；渲染层的上传卡片从连续的
  `asset.import` 调用与 `asset.changed` 失效通知中推导进度。
- 已保存的画布图 SHALL 将节点资产选择与视频引用输入同步进
  `asset_references`。
- 已完成的媒体任务 SHALL 将其终态资产结果以 `refType = job` 同步进
  `asset_references`。
- preload 桥接层 SHALL 暴露一个类型化的 `asset.changed` 订阅辅助函数，
  返回取消订阅回调。
- 渲染层资产刷新 SHALL 使用 IPC 事件加查询失效，不使用 `setInterval`、
  资产轮询循环，或 TanStack Query 的 `refetchInterval`。
- 渲染层预览 SHALL 继续使用本地的 `cc-asset://asset/<assetId>` 安全 URL。
- 运行时执行负载 MAY 仅通过 workflow asset resolver 使用云端 URL。该
  resolver SHALL 在配置了存储时调用所配置存储 provider 的 `query(s3Key)`
  来刷新或重新签发云端访问权限。
- 刷新后的云端 URL SHALL 通过针对所配置存储端点或 `publicUrlPrefix` 的
  host 校验；刷新失败、存储配置缺失、`s3Key` 缺失，以及外部 host，
  SHALL 回退到本地 `cc-asset://` URL。
- MJ 的 URL 刷新/重新签发行为不在本地 Phase A 迁移范围内。

## Errors

| Error class | Meaning |
| :--- | :--- |
| `asset_not_found` | 资产 ID 不存在。 |
| `asset_path_traversal` | 安全协议或导入路径尝试了路径穿越。 |
| `asset_metadata_invalid` | 尺寸、时长或媒体元数据未通过校验。 |
| `asset_unsupported_extension` | 导入文件扩展名不在本地资产库允许列表中。 |
| `asset_reference_blocked` | 破坏性操作被现有引用阻止。 |
| `asset_display_name_required` | 重命名请求未包含可用的显示名称。 |
| `asset_category_not_found` | 分类 ID 不存在或已被删除。 |
| `asset_category_name_required` | 分类创建请求未包含可用的名称。 |
| `asset_storage_unavailable` | 应用受控的资产根目录无法读取或写入。 |

## Permissions

- 导入文件需要用户批准的文件访问权限。
- 移动/重命名文件夹以及重命名资产显示标签属于本地库的写操作。
- 回收/删除需要引用完整性检查，若存在引用可能需要 `ask`。
- 渲染层只接收逻辑资产 ID 与安全 URL。

## Tests

- Unit：横屏、竖屏与正方形的方向分类。
- Unit：导入的图片/音频元数据能提取尺寸、方向、MIME、大小、哈希，并在可行
  时尽力提取时长。
- Integration：生成的字节数据以相对路径存储。
- Integration：不支持的导入扩展名在本地拷贝或云端上传之前被拒绝。
- Integration：安全协议拒绝路径穿越。
- Integration：被引用资产的回收操作会依据请求模式阻止或创建可恢复的墓碑
  记录。
- Integration：删除嵌套文件夹时，被引用资产会被墓碑化、未被引用资产会被
  回收，从而保留引用关系。
- Repository/IPC/Preload/UI：资产显示名重命名保持存储路径与安全 URL不变。
- Renderer：侧边栏分类设置通过类型化的更新 API 编辑自定义分类的颜色/图标
  并禁用自定义分类。
- Renderer：上传卡片从本地导入状态展示多文件进度，不依赖轮询或专用的
  upload-progress IPC 通道。
- Renderer：预览弹窗通过类型化的资产分类 API 指定与移除图片分类。
- Renderer：画布资产面板按图片分类过滤，并将同一资产 ID 插入为 image、
  character、scene，或所选的视频引用输入。
- Main/Repository：已保存的画布图引用与已完成任务的资产结果，通过 SQLite
  `asset_references` 阻止安全资产删除。
- Main：workflow asset resolver 刷新所配置的云端 URL、拒绝外部 host，并
  回退到本地 `cc-asset://` 安全 URL。
- Renderer：`asset.changed` 使 all-assets 与 asset-by-id 查询失效，且不
  依赖轮询。
- Repository：起始分类、自定义分类、标签、分类指定、分类过滤，以及已禁用
  分类的过滤。
- IPC：分类的 list/create/update/assign/remove 均为类型化并使用仓储层边界。
- Deep scan：面向渲染层的资产记录中不包含绝对路径。
