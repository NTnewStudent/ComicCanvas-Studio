/**
 * 内联权限请求块 — 消息流内批准/拒绝，替代全屏 Modal 场景。
 * @see docs/api-contracts/agents.md
 */

import { ShieldAlert, ShieldCheck, X } from 'lucide-react'
import { useState } from 'react'

import type { PermissionGrantScope } from '../../../../../../shared/agent-run-events'
import type { ChatBlock } from '../../../../../../shared/chat-blocks'

export type PermissionBlockData = Extract<ChatBlock, { kind: 'permission' }>

export interface PermissionBlockProps {
  block: PermissionBlockData
  busy?: boolean | undefined
  onApprove?: ((callId: string, scope: PermissionGrantScope) => void) | undefined
  onDeny?: ((callId: string) => void) | undefined
}

const SCOPE_OPTIONS: ReadonlyArray<{ scope: PermissionGrantScope; label: string }> = [
  { scope: 'once', label: '仅本次' },
  { scope: 'run', label: '当前任务' },
  { scope: 'session', label: '本次会话' }
]

const SCOPE_LABELS: Record<PermissionGrantScope, string> = {
  once: '仅本次',
  run: '当前任务',
  session: '本次会话'
}

/**
 * 渲染一条待批准的工具调用请求；resolved 后只保留摘要。
 * @param props - 权限块数据与批准/拒绝回调。
 * @returns 权限块元素。
 */
export function PermissionBlock({ block, busy = false, onApprove, onDeny }: PermissionBlockProps): JSX.Element {
  const destructive = block.requiredPermissions?.some((permission) => permission.kind === 'destructive') ?? false
  const [scope, setScope] = useState<PermissionGrantScope>(destructive ? 'once' : 'session')
  const resolvedScope = block.scope ?? (destructive ? 'once' : scope)
  const permissionKinds = block.requiredPermissions?.map((permission) => permission.kind).join(' · ')
  const StatusIcon = block.resolved ? ShieldCheck : ShieldAlert

  return (
    <div className="w-full max-w-[560px] rounded-md border border-semantic-warning/40 bg-semantic-warning/5 px-3 py-2.5 text-[12px]">
      <div className="flex min-w-0 items-center gap-1.5 text-text-base">
        <StatusIcon className="h-3.5 w-3.5 shrink-0 text-semantic-warning" aria-hidden="true" />
        <span className="shrink-0 font-semibold">{block.resolved ? '授权已处理' : '需要授权'}</span>
        <span className="min-w-0 truncate font-mono text-brand" title={block.toolId}>{block.toolId}</span>
      </div>
      <p className="m-0 mt-1 text-text-muted">{block.reason}</p>
      {permissionKinds && (
        <p className="m-0 mt-1 font-mono text-[10px] uppercase text-text-muted">{permissionKinds}</p>
      )}
      {block.resolved ? (
        <div className="mt-2 flex items-center gap-1.5 text-semantic-success">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          <span>已批准 · {SCOPE_LABELS[resolvedScope]}</span>
        </div>
      ) : (
        <div className="mt-2.5">
          <div
            role="group"
            aria-label="授权范围"
            className="grid h-8 grid-cols-3 overflow-hidden rounded-md border border-border-secondary bg-bg-input"
          >
            {SCOPE_OPTIONS.map((option) => {
              const disabled = busy || (destructive && option.scope !== 'once')
              const selected = scope === option.scope

              return (
                <button
                  key={option.scope}
                  type="button"
                  disabled={disabled}
                  aria-pressed={selected}
                  onClick={() => setScope(option.scope)}
                  className="border-r border-border-secondary px-2 text-[11px] text-text-secondary transition-colors last:border-r-0 hover:bg-bg-hover hover:text-text-base aria-pressed:bg-bg-highlight aria-pressed:font-semibold aria-pressed:text-brand disabled:cursor-not-allowed disabled:opacity-35"
                >
                  {option.label}
                </button>
              )
            })}
          </div>
          {destructive && (
            <p className="m-0 mt-1.5 text-[11px] text-semantic-warning">破坏性操作仅支持单次授权</p>
          )}
          <div className="mt-2.5 flex items-center gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => onApprove?.(block.callId, destructive ? 'once' : scope)}
            className="h-8 rounded-md bg-brand px-3 text-[12px] font-semibold text-bg-base transition-colors hover:bg-brand-hover disabled:opacity-50"
          >
            批准并继续
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onDeny?.(block.callId)}
            className="inline-flex h-8 items-center gap-1 rounded-md border border-border-secondary px-2.5 text-[12px] text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-base disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            拒绝
          </button>
        </div>
        </div>
      )}
    </div>
  )
}
