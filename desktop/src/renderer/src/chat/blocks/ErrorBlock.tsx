/**
 * 错误块 — 稳定 errorClass + 用户可读消息。
 * @see docs/api-contracts/agents.md
 */

import { XCircle } from 'lucide-react'

import type { ChatBlock } from '../../../../../../shared/chat-blocks'

export type ErrorBlockData = Extract<ChatBlock, { kind: 'error' }>

/**
 * 渲染一条 run 失败原因。
 * @param props - 错误块数据。
 * @returns 错误块元素。
 */
export function ErrorBlock({ block }: { block: ErrorBlockData }): JSX.Element {
  return (
    <div className="rounded-lg border border-red-500/40 bg-red-500/5 px-3 py-2 text-[12px]">
      <div className="flex items-center gap-1.5">
        <XCircle className="h-3.5 w-3.5 text-red-500" />
        <span className="font-mono text-red-500">{block.errorClass}</span>
        {block.retryable && <span className="text-text-muted">可重试</span>}
      </div>
      <p className="m-0 mt-1 text-text-secondary">{block.message}</p>
    </div>
  )
}
