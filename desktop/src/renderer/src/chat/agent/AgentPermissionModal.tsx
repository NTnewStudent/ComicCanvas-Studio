/**
 * Minimal permission gate for destructive Agent tool calls.
 * @see docs/api-contracts/agents.md
 */

export interface AgentPermissionRequest {
  runId: string
  callId: string
  toolId: string
  reason: string
}

export interface AgentPermissionModalProps {
  request: AgentPermissionRequest | null
  busy?: boolean
  onApprove: () => void
  onDismiss: () => void
}

/**
 * Shows a lightweight approval dialog for paused Agent tool execution.
 * @param props - Pending permission request and callbacks.
 * @returns Modal overlay or null.
 */
export function AgentPermissionModal({ request, busy = false, onApprove, onDismiss }: AgentPermissionModalProps): JSX.Element | null {
  if (!request) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border-primary bg-bg-panel p-4 shadow-pop">
        <h3 className="m-0 text-[14px] font-semibold text-text-base">需要批准工具调用</h3>
        <p className="mt-2 text-[13px] text-text-secondary">
          Agent 请求执行 <span className="font-mono text-brand">{request.toolId}</span>
        </p>
        <p className="mt-1 text-[12px] text-text-muted">{request.reason}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onDismiss}
            disabled={busy}
            className="rounded-lg border border-border-secondary px-3 py-1.5 text-[13px] text-text-secondary hover:bg-bg-hover disabled:opacity-50"
          >
            拒绝
          </button>
          <button
            type="button"
            onClick={onApprove}
            disabled={busy}
            className="rounded-lg bg-brand px-3 py-1.5 text-[13px] text-bg-base hover:opacity-90 disabled:opacity-50"
          >
            批准并继续
          </button>
        </div>
      </div>
    </div>
  )
}
