import { useState } from 'react'
import { IconWorld, IconRobot, IconTool, IconDatabase, IconPalette } from '@tabler/icons-react'
import { cn } from '../lib/cn'
import { GatewayList } from './GatewayList'
import { AgentList } from './AgentList'
import { ToolList } from './ToolList'
import { StyleLibrary } from './StyleLibrary'
import StorageSettingsForm from './StorageSettingsForm'

type SettingsTab = 'gateway' | 'agent' | 'tool' | 'style' | 'storage'

const tabs: { id: SettingsTab; label: string; icon: typeof IconWorld }[] = [
  { id: 'gateway', label: '网关', icon: IconWorld },
  { id: 'agent', label: 'Agent', icon: IconRobot },
  { id: 'tool', label: '工具', icon: IconTool },
  { id: 'style', label: '风格', icon: IconPalette },
  { id: 'storage', label: '存储', icon: IconDatabase },
]

export default function SettingsPage(): JSX.Element {
  const [activeTab, setActiveTab] = useState<SettingsTab>('gateway')

  return (
    <div className="flex flex-col h-full">
      {/* 选项卡导航 */}
      <nav className="flex items-center gap-1 px-6 pt-4 pb-2 border-b border-border-secondary">
        {tabs.map((tab) => {
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'group relative flex items-center gap-2 rounded-md px-4 py-2 text-sm transition-all duration-200 ease-luxury',
                active
                  ? 'text-text-base'
                  : 'text-text-secondary hover:text-text-base hover:bg-bg-hover',
              )}
            >
              <tab.icon
                size={16}
                className={cn(
                  'transition-transform duration-200 ease-luxury',
                  active ? 'text-brand' : 'group-hover:scale-110',
                )}
              />
              {tab.label}
              {/* 底部滑动指示条 */}
              <span
                className={cn(
                  'absolute -bottom-2 left-1/2 h-0.5 w-8 -translate-x-1/2 rounded-full bg-brand transition-all duration-300 ease-luxury',
                  active ? 'scale-x-100 opacity-100' : 'scale-x-0 opacity-0',
                )}
              />
            </button>
          )
        })}
      </nav>

      {/* 选项卡内容 */}
      <div className="flex-1 overflow-y-auto p-6">
        <div key={activeTab} className="cc-anim-fade-in">
          {activeTab === 'gateway' && <GatewayList />}
          {activeTab === 'agent' && <AgentList />}
          {activeTab === 'tool' && <ToolList />}
          {activeTab === 'style' && <StyleLibrary />}
          {activeTab === 'storage' && <StorageSettingsForm />}
        </div>
      </div>
    </div>
  )
}
