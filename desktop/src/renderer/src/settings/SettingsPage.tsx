import { useState } from 'react'
import { Globe, Bot, Wrench } from 'lucide-react'
import { cn } from '../lib/cn'
import { GatewayList } from './GatewayList'
import { AgentList } from './AgentList'
import { ToolList } from './ToolList'

type SettingsTab = 'gateway' | 'agent' | 'tool'

const tabs: { id: SettingsTab; label: string; icon: typeof Globe }[] = [
  { id: 'gateway', label: '网关', icon: Globe },
  { id: 'agent', label: 'Agent', icon: Bot },
  { id: 'tool', label: '工具', icon: Wrench },
]

export default function SettingsPage(): JSX.Element {
  const [activeTab, setActiveTab] = useState<SettingsTab>('gateway')

  return (
    <div className="flex flex-col h-full">
      {/* 选项卡导航 */}
      <nav className="flex items-center gap-1 px-6 pt-4 pb-2 border-b border-border-secondary">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-md text-sm transition-colors duration-200',
              activeTab === tab.id
                ? 'bg-bg-card text-text-base border border-border-primary'
                : 'text-text-secondary hover:text-text-base hover:bg-bg-hover'
            )}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </nav>

      {/* 选项卡内容 */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'gateway' && <GatewayList />}
        {activeTab === 'agent' && <AgentList />}
        {activeTab === 'tool' && <ToolList />}
      </div>
    </div>
  )
}
