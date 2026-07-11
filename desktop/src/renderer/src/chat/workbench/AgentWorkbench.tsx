/**
 * Shared Agent Workbench used by the full chat page and the compact canvas entry.
 * @see docs/api-contracts/agents.md
 */

import { AtSign, Bot, Loader2, PanelRight } from 'lucide-react'
import { useState, type ReactNode, type Ref } from 'react'

import type { AgentArtifactViewModel, PermissionGrantScope } from '../../../../../../shared/agent-run-events'
import type { AgentRunViewResponse } from '../../../../../../shared/agents'
import type { ChatTurn } from '../../../../../../shared/chat-blocks'
import { cn } from '../../lib/cn'
import { TurnView } from '../blocks/TurnView'
import { RunInspector } from './RunInspector'

export interface AgentWorkbenchProps {
  variant: 'full' | 'compact'
  title: string
  statusText: string
  agentName: string
  agentEnabled?: boolean | undefined
  ariaLabel?: string | undefined
  turns: ChatTurn[]
  busy: boolean
  permissionBusy: boolean
  runView: AgentRunViewResponse | null
  transcriptRef?: Ref<HTMLDivElement> | undefined
  renderPlan: (planId: string) => ReactNode
  onApprovePermission: (callId: string, scope: PermissionGrantScope) => void
  onDenyPermission: (callId: string) => void
  onApplyDraftGraph?: ((artifact: Extract<AgentArtifactViewModel, { viewType: 'draftGraph' }>) => Promise<void>) | undefined
  getChildRun?: ((runId: string) => Promise<AgentRunViewResponse>) | undefined
  headerActions?: ReactNode
  composer: ReactNode
  emptyText?: string | undefined
}

/**
 * Renders the shared conversational surface and optional run inspector.
 * @param props - Workbench data, actions, and host composer slot.
 * @returns Full or compact workbench.
 */
export function AgentWorkbench({
  variant,
  title,
  statusText,
  agentName,
  agentEnabled = true,
  ariaLabel = '画布 Agent 对话',
  turns,
  busy,
  permissionBusy,
  runView,
  transcriptRef,
  renderPlan,
  onApprovePermission,
  onDenyPermission,
  onApplyDraftGraph,
  getChildRun,
  headerActions,
  composer,
  emptyText = '让内置 Agent 起草文本、图片和视频节点，或直接提问、读取与检索项目文件。'
}: AgentWorkbenchProps): JSX.Element {
  const [compactInspectorOpen, setCompactInspectorOpen] = useState(false)
  const showInspector = variant === 'full' || compactInspectorOpen
  const showTranscript = variant === 'full' || turns.length > 0 || busy

  return (
    <section
      aria-label={ariaLabel}
      className={cn(
        'flex min-h-0 flex-col overflow-hidden rounded-md border border-border-primary bg-bg-panel text-text-base',
        variant === 'full'
          ? 'h-full shadow-float'
          : (compactInspectorOpen
              ? 'h-[calc(100vh-3rem)] max-h-[720px] shadow-pop'
              : 'h-auto max-h-[calc(100vh-3rem)] shadow-pop')
      )}
    >
      <header className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-border-secondary px-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border-secondary bg-bg-input text-brand">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Bot className="h-4 w-4" aria-hidden="true" />}
          </span>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="m-0 truncate text-[14px] font-semibold text-text-base">{title}</h2>
              <span className="inline-flex min-w-0 items-center gap-1 rounded-md border border-border-secondary bg-bg-input px-1.5 py-0.5 text-[10px] text-text-muted">
                <AtSign className="h-2.5 w-2.5 shrink-0 text-brand" aria-hidden="true" />
                <span className="truncate">{agentName}</span>
              </span>
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-text-muted">
              <span className={cn('h-1.5 w-1.5 rounded-full', busy ? 'bg-semantic-info' : 'bg-semantic-success')} aria-hidden="true" />
              <span>{statusText}</span>
              {!agentEnabled && <span>· Agent 自动编排未启用</span>}
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {headerActions}
          {variant === 'compact' && (
            <button
              type="button"
              aria-label={compactInspectorOpen ? '关闭运行检查器' : '打开运行检查器'}
              aria-pressed={compactInspectorOpen}
              onClick={() => setCompactInspectorOpen((open) => !open)}
              className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-bg-hover hover:text-text-base"
              title="运行检查器"
            >
              <PanelRight className="h-4 w-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </header>

      <div
        className={cn(
          'grid min-h-0 flex-1',
          showInspector
            ? (variant === 'full' ? 'grid-cols-[minmax(0,1fr)_320px]' : 'grid-cols-[minmax(0,1fr)_280px]')
            : 'grid-cols-1'
        )}
      >
        <div className="flex min-h-0 min-w-0 flex-col bg-bg-base">
          {showTranscript && (
            <div
              ref={transcriptRef}
              aria-label="对话记录"
              className={cn(
                'min-h-0 space-y-3 overflow-y-auto',
                variant === 'full' ? 'flex-1 px-5 py-4' : 'max-h-[46vh] px-4 py-3'
              )}
            >
              {turns.length === 0 ? (
                <div className="flex h-full min-h-44 flex-col items-center justify-center gap-2 px-6 text-center">
                  <Bot className="h-7 w-7 text-text-muted" aria-hidden="true" />
                  <p className="m-0 max-w-md text-[12px] leading-relaxed text-text-muted">{emptyText}</p>
                </div>
              ) : (
                turns.map((turn) => (
                  <TurnView
                    key={turn.id}
                    turn={turn}
                    renderPlan={renderPlan}
                    permissionBusy={permissionBusy}
                    onApprovePermission={onApprovePermission}
                    onDenyPermission={onDenyPermission}
                  />
                ))
              )}
              {busy && variant === 'compact' && (
                <div className="flex items-center gap-2 text-[11px] text-text-muted">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" aria-hidden="true" />
                  <span>AI 思考中…</span>
                </div>
              )}
            </div>
          )}
          <div className="shrink-0 border-t border-border-secondary bg-bg-panel">{composer}</div>
        </div>

        {showInspector && (
          <RunInspector
            runView={runView}
            {...(onApplyDraftGraph ? { onApplyDraftGraph } : {})}
            {...(getChildRun ? { getChildRun } : {})}
          />
        )}
      </div>
    </section>
  )
}
