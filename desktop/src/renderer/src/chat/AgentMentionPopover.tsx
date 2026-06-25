import { AtSign, Bot } from 'lucide-react'

import type { AgentDefinition } from '../../../../../shared/agents'
import { cn } from '../lib/cn'

export interface AgentMentionPopoverProps {
  agents: AgentDefinition[]
  activeIndex: number
  onActiveIndexChange: (index: number) => void
  onSelect: (agent: AgentDefinition) => void
}

/**
 * Renders the agent `@mention` selector for the chat composer.
 * @param props - Filtered agents, active item, and selection handlers.
 * @returns Agent selector popover, or null when no agents are available.
 * @throws Error never intentionally.
 * @see docs/api-contracts/agents.md
 */
export function AgentMentionPopover({ agents, activeIndex, onActiveIndexChange, onSelect }: AgentMentionPopoverProps): JSX.Element | null {
  if (agents.length === 0) {
    return null
  }

  return (
    <div className="absolute bottom-[calc(100%+8px)] left-0 z-30 w-full max-w-[360px] overflow-hidden rounded-xl border border-border-secondary bg-bg-card shadow-pop">
      <div className="flex items-center gap-2 border-b border-border-secondary px-3 py-2 text-[12px] font-semibold text-text-secondary">
        <AtSign className="h-3.5 w-3.5 text-brand" aria-hidden="true" />
        Agent selector
      </div>
      <div id="agent-mention-selector" role="listbox" aria-label="Agent mention selector" className="max-h-64 overflow-y-auto p-1.5">
        {agents.map((agent, index) => (
          <button
            key={agent.id}
            type="button"
            role="option"
            aria-label={`${agent.name} agent`}
            aria-selected={index === activeIndex}
            onClick={() => onSelect(agent)}
            onMouseEnter={() => onActiveIndexChange(index)}
            className={cn(
              'flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors duration-150 ease-luxury',
              index === activeIndex ? 'bg-bg-hover text-text-base' : 'text-text-secondary hover:bg-bg-input'
            )}
          >
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border-input bg-bg-input text-brand">
              <Bot className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-semibold">{agent.name}</span>
              <span className="mt-0.5 block truncate text-[12px] text-text-muted">{agent.description}</span>
            </span>
            <span className="rounded-pill border border-border-input px-2 py-0.5 text-[11px] text-text-muted">@{agent.id}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
