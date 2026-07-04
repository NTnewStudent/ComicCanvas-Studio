/**
 * Sub-agent task panel for agent.spawnChild tool invocations.
 * @see docs/api-contracts/agents.md
 */

import { Bot, CheckCircle2, Loader2, XCircle } from 'lucide-react'

import type { AgentToolTraceItem } from './AgentToolPill'

export interface AgentSubAgentItem {
  callId: string
  status: AgentToolTraceItem['status']
  task: string
  summary?: string
}

/**
 * Extracts sub-agent trace rows from the generic tool audit list.
 * @param items - Tool trace items for the active Agent run.
 * @returns Sub-agent rows for spawnChild calls only.
 */
export function extractSubAgentItems(items: AgentToolTraceItem[]): AgentSubAgentItem[] {
  return items
    .filter((item) => item.toolId === 'agent.spawnChild')
    .map((item) => ({
      callId: item.callId,
      status: item.status,
      task: item.inputSummary?.replace(/^Spawn child agent:\s*/i, '').trim() || '子 Agent 任务',
      ...(item.summary ? { summary: item.summary } : {})
    }))
}

function statusIcon(status: AgentSubAgentItem['status']): JSX.Element {
  if (status === 'running') {
    return <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" />
  }

  if (status === 'completed') {
    return <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
  }

  return <XCircle className="h-3.5 w-3.5 text-red-500" />
}

/**
 * Renders spawned child-agent tasks separately from generic tool pills.
 * @param props - Sub-agent rows derived from tool trace.
 * @returns Panel or null when no sub-agent calls exist.
 */
export function AgentSubAgentPanel({ items }: { items: AgentSubAgentItem[] }): JSX.Element | null {
  if (items.length === 0) {
    return null
  }

  return (
    <div className="mb-2 rounded-lg border border-border-secondary bg-bg-input/40 p-2">
      <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-text-muted">
        <Bot className="h-3.5 w-3.5 text-brand" />
        子 Agent 任务
      </div>
      <div className="space-y-1.5">
        {items.map((item) => (
          <div key={item.callId} className="rounded-lg border border-border-secondary bg-bg-card px-2.5 py-2 text-[12px]">
            <div className="flex items-start gap-2">
              {statusIcon(item.status)}
              <div className="min-w-0 flex-1">
                <p className="m-0 font-medium text-text-base">{item.task}</p>
                {item.summary && (
                  <pre className="mt-1 max-h-20 overflow-auto whitespace-pre-wrap text-[11px] text-text-muted">{item.summary}</pre>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
