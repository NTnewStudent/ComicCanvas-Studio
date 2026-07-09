/**
 * 工具调用块 — 状态图标 + 可展开输入/结果摘要；子 Agent 调用带标签。
 * @see docs/api-contracts/agents.md
 */

import { useState } from 'react'
import { Bot, CheckCircle2, Loader2, ShieldAlert, XCircle } from 'lucide-react'

import type { ChatBlock } from '../../../../../../shared/chat-blocks'

export type ToolCallBlockData = Extract<ChatBlock, { kind: 'toolCall' }>

function statusIcon(status: ToolCallBlockData['status']): JSX.Element {
  if (status === 'running') return <Loader2 className="h-3 w-3 animate-spin text-brand" />
  if (status === 'completed') return <CheckCircle2 className="h-3 w-3 text-emerald-500" />
  if (status === 'denied') return <ShieldAlert className="h-3 w-3 text-amber-500" />
  return <XCircle className="h-3 w-3 text-red-500" />
}

/**
 * 渲染一次工具调用的摘要 pill 与可展开详情。
 * @param props - 工具调用块数据。
 * @returns 工具块元素。
 */
export function ToolCallBlock({ block }: { block: ToolCallBlockData }): JSX.Element {
  const [open, setOpen] = useState(false)
  const detail = block.resultSummary ?? block.inputSummary

  return (
    <div className="inline-flex max-w-full flex-col">
      <button
        type="button"
        onClick={() => detail && setOpen((value) => !value)}
        className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-border-secondary bg-bg-card px-2.5 py-1 text-[11px] text-text-secondary"
        title={detail ?? block.toolId}
      >
        {statusIcon(block.status)}
        {block.isSubAgent && (
          <span className="inline-flex items-center gap-0.5 rounded-full bg-brand/10 px-1.5 text-[10px] text-brand">
            <Bot className="h-2.5 w-2.5" />
            子 Agent
          </span>
        )}
        <span className="truncate font-mono">{block.toolId}</span>
      </button>
      {open && detail && (
        <pre className="mt-1 max-h-24 overflow-auto whitespace-pre-wrap rounded-lg bg-bg-input/80 p-2 text-[10px] text-text-muted">{detail}</pre>
      )}
    </div>
  )
}
