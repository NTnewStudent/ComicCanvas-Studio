/**
 * 内联权限请求块 — 消息流内批准/拒绝，替代全屏 Modal 场景。
 * @see docs/api-contracts/agents.md
 */

import { ShieldAlert } from 'lucide-react'

import type { ChatBlock } from '../../../../../../shared/chat-blocks'

export type PermissionBlockData = Extract<ChatBlock, { kind: 'permission' }>

export interface PermissionBlockProps {
  block: PermissionBlockData
  busy?: boolean | undefined
  onApprove?: ((callId: string) => void) | undefined
  onDeny?: ((callId: string) => void) | undefined
}

/**
 * 渲染一条待批准的工具调用请求；resolved 后只保留摘要。
 * @param props - 权限块数据与批准/拒绝回调。
 * @returns 权限块元素。
 */
export function PermissionBlock({ block, busy = false, onApprove, onDeny }: PermissionBlockProps): JSX.Element {
  return (
    <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 px-3 py-2 text-[12px]">
      <div className="flex items-center gap-1.5 text-text-base">
        <ShieldAlert className="h-3.5 w-3.5 text-amber-500" />
        需要批准工具调用
        <span className="font-mono text-brand">{block.toolId}</span>
      </div>
      <p className="m-0 mt-1 text-text-muted">{block.reason}</p>
      {!block.resolved && (
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => onApprove?.(block.callId)}
            className="rounded-lg bg-brand px-3 py-1 text-[12px] font-semibold text-bg-base transition-colors hover:bg-brand-hover disabled:opacity-50"
          >
            批准
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onDeny?.(block.callId)}
            className="rounded-lg border border-border-secondary px-3 py-1 text-[12px] text-text-secondary transition-colors hover:text-text-base disabled:opacity-50"
          >
            拒绝
          </button>
        </div>
      )}
    </div>
  )
}
