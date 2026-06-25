/**
 * 独立资产管理页 — /assets
 *
 * 从设置中移出，作为独立一级导航选项卡。
 */
import { AssetPanel } from './AssetPanel'

export default function AssetPage(): JSX.Element {
  return (
    <div className="flex flex-col h-full p-6">
      <h1 className="text-xl font-bold text-text-base mb-4">资产管理</h1>
      <AssetPanel />
    </div>
  )
}
