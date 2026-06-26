/**
 * 独立资产管理页 — /assets
 *
 * 整体布局完全对齐 hjwall 资产页：
 * 顶部胶囊类型标签 + 搜索/排序工具栏，
 * 左侧文件夹树导航，右侧资产网格/列表。
 */
import { AssetPanel } from './AssetPanel'

export default function AssetPage(): JSX.Element {
  return (
    <div className="h-full overflow-hidden bg-bg-base">
      <AssetPanel />
    </div>
  )
}
