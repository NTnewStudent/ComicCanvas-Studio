/**
 * Minimal Agent tool-call trace pill for canvas chat.
 * @see docs/api-contracts/agents.md
 */

import { CheckCircle2, Loader2, ShieldAlert, XCircle } from 'lucide-react'
import { useState } from 'react'

export interface AgentToolTraceItem {
  callId: string
  toolId: string
  status: 'running' | 'completed' | 'failed' | 'denied'
  inputSummary?: string
  summary?: string
}

function statusIcon(status: AgentToolTraceItem['status']): JSX.Element {
  if (status === 'running') {
    return <Loader2 className="h-3 w-3 animate-spin text-brand" />
  }

  if (status === 'completed') {
    return <CheckCircle2 className="h-3 w-3 text-emerald-500" />
  }

  if (status === 'denied') {
    return <ShieldAlert className="h-3 w-3 text-amber-500" />
  }

  return <XCircle className="h-3 w-3 text-red-500" />
}

/**
 * Renders one tool invocation summary pill with optional detail expansion.
 * @param props - Tool trace item.
 * @returns Compact pill UI.
 */
export function AgentToolPill({ item }: { item: AgentToolTraceItem }): JSX.Element {
  const [open, setOpen] = useState(false)
  const detail = item.summary ?? item.inputSummary

  return (
    <div className="inline-flex max-w-full flex-col">
      <button
        type="button"
        onClick={() => detail && setOpen((value) => !value)}
        className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border-secondary bg-bg-card px-2.5 py-1 text-[11px] text-text-secondary"
        title={detail ?? item.toolId}
      >
        {statusIcon(item.status)}
        <span className="truncate font-mono">{item.toolId}</span>
      </button>
      {open && detail && (
        <pre className="mt-1 max-h-24 overflow-auto rounded-lg bg-bg-input/80 p-2 text-[10px] text-text-muted">{detail}</pre>
      )}
    </div>
  )
}

/**
 * Renders the current Agent tool audit strip.
 * @param props - Ordered tool trace items for the active run.
 * @returns Horizontal pill list.
 */
export function AgentToolTrace({ items }: { items: AgentToolTraceItem[] }): JSX.Element | null {
  if (items.length === 0) {
    return null
  }

  return (
    <div className="mb-2 flex flex-wrap gap-1.5 rounded-lg border border-border-secondary bg-bg-input/40 p-2">
      <span className="w-full text-[11px] font-medium text-text-muted">工具调用</span>
      {items.map((item) => (
        <AgentToolPill key={item.callId} item={item} />
      ))}
    </div>
  )
}
