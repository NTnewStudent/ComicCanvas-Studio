/**
 * 独立资产管理页 — /assets
 *
 * 从设置中移出，作为独立一级导航选项卡。
 */
import { AssetPanel } from './AssetPanel'

export default function AssetPage(): JSX.Element {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <AssetPanel />
    </div>
  )
}
