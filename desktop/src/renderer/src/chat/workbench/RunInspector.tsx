/**
 * Agent Run Inspector — projects the durable run spine into an operational view.
 * @see docs/api-contracts/agents.md
 */

import {
  Activity,
  Boxes,
  GitBranch,
  PackageOpen,
  ShieldCheck,
  TriangleAlert,
  Wrench
} from 'lucide-react'
import { useMemo, useState } from 'react'

import type {
  AgentRunEventPayload,
  AgentRunEventType
} from '../../../../../../shared/agent-run-events'
import type { AgentRunStatus, AgentRunViewResponse } from '../../../../../../shared/agents'
import { cn } from '../../lib/cn'

export interface RunInspectorProps {
  runView: AgentRunViewResponse | null
  className?: string | undefined
}

type InspectorTab = 'run' | 'artifacts'

const STATUS_LABELS: Record<AgentRunStatus, string> = {
  pending: '等待执行',
  running: '运行中',
  completed: '已完成',
  failed: '已失败',
  aborted: '已停止',
  max_turns_exceeded: '达到轮次上限',
  approval_required: '等待授权'
}

const STATUS_STYLES: Record<AgentRunStatus, string> = {
  pending: 'border-border-secondary bg-bg-input text-text-secondary',
  running: 'border-semantic-info/35 bg-semantic-info/10 text-semantic-info',
  completed: 'border-semantic-success/35 bg-semantic-success/10 text-semantic-success',
  failed: 'border-semantic-negative/35 bg-semantic-negative/10 text-semantic-negative',
  aborted: 'border-border-secondary bg-bg-input text-text-muted',
  max_turns_exceeded: 'border-semantic-warning/35 bg-semantic-warning/10 text-semantic-warning',
  approval_required: 'border-semantic-warning/35 bg-semantic-warning/10 text-semantic-warning'
}

const EVENT_LABELS: Record<AgentRunEventType, string> = {
  'run.created': '创建运行',
  'run.started': '开始执行',
  'intent.analyzed': '需求已分析',
  'context.built': '上下文已构建',
  progress: '执行进度',
  'model.delta': '模型输出',
  'tool.started': '调用工具',
  'tool.completed': '工具完成',
  'permission.requested': '请求授权',
  'permission.resolved': '授权完成',
  'artifact.created': '产物已保存',
  'plan.ready': '计划已就绪',
  'response.ready': '回复已就绪',
  'run.completed': '运行完成',
  'run.failed': '运行失败'
}

const TRIGGER_LABELS = {
  manual: '手动',
  mention: '@ 提及',
  canvasChat: '画布对话',
  workflowEvent: '工作流事件'
} as const

function payloadValue(payload: AgentRunEventPayload, key: string): unknown {
  return (payload as Record<string, unknown>)[key]
}

function payloadText(payload: AgentRunEventPayload, key: string): string | undefined {
  const value = payloadValue(payload, key)
  return typeof value === 'string' && value.length > 0 ? value : undefined
}

function eventSummary(type: AgentRunEventType, payload: AgentRunEventPayload): string | undefined {
  if (type === 'tool.started' || type === 'tool.completed') {
    const toolId = payloadText(payload, 'toolId')
    const detail = payloadText(payload, 'summary') ?? payloadText(payload, 'inputSummary')
    return [toolId, detail].filter(Boolean).join(' · ') || undefined
  }

  if (type === 'permission.requested') {
    return payloadText(payload, 'reason') ?? payloadText(payload, 'toolId')
  }

  if (type === 'permission.resolved') {
    if (payloadValue(payload, 'decision') === 'denied') {
      return '已拒绝'
    }
    const scope = payloadText(payload, 'scope')
    return scope ? `已批准 · 授权范围：${scope}` : '已批准'
  }

  if (type === 'model.delta') {
    return '正在生成回复'
  }

  return payloadText(payload, 'message')
    ?? payloadText(payload, 'summary')
    ?? payloadText(payload, 'title')
    ?? payloadText(payload, 'errorClass')
}

function formatEventTime(timestamp: number): string {
  return new Intl.DateTimeFormat('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(timestamp)
}

/**
 * Renders a replayable view of one Agent run.
 * @param props - Active run snapshot and optional layout class.
 * @returns Inspector sidebar.
 */
export function RunInspector({ runView, className }: RunInspectorProps): JSX.Element {
  const [tab, setTab] = useState<InspectorTab>('run')
  const projection = runView?.projection
  const inspector = projection?.inspector
  const events = useMemo(
    () => [...(runView?.snapshot?.events ?? [])].sort((left, right) => left.sequence - right.sequence),
    [runView?.snapshot?.events]
  )
  const artifacts = runView?.snapshot?.artifacts.length
    ? runView.snapshot.artifacts
    : (projection?.artifacts.length ? projection.artifacts : (inspector?.artifacts ?? []))

  return (
    <aside
      aria-label="运行检查器"
      className={cn('flex min-h-0 flex-col border-l border-border-secondary bg-bg-surface', className)}
    >
      <div className="flex min-h-14 shrink-0 items-center justify-between gap-3 border-b border-border-secondary px-4">
        <div className="flex min-w-0 items-center gap-2">
          <Activity className="h-4 w-4 shrink-0 text-brand" aria-hidden="true" />
          <h3 className="m-0 truncate text-[13px] font-semibold text-text-base">运行检查器</h3>
        </div>
        {runView && (
          <span className={cn('shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-semibold', STATUS_STYLES[runView.status])}>
            {STATUS_LABELS[runView.status]}
          </span>
        )}
      </div>

      {!runView || !inspector ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 text-center">
          <PackageOpen className="h-7 w-7 text-text-muted" aria-hidden="true" />
          <p className="mb-0 mt-3 text-[13px] font-medium text-text-secondary">尚无运行记录</p>
          <p className="mb-0 mt-1 text-[11px] leading-relaxed text-text-muted">发送消息后，这里会显示 Agent 的执行轨迹与产物。</p>
        </div>
      ) : (
        <>
          <div className="grid shrink-0 grid-cols-2 gap-x-3 gap-y-2 border-b border-border-secondary px-4 py-3 text-[11px]">
            <div className="min-w-0">
              <span className="block text-text-muted">Agent</span>
              <span className="mt-0.5 block truncate font-mono text-text-secondary" title={inspector.agentId}>{inspector.agentId}</span>
            </div>
            <div className="min-w-0">
              <span className="block text-text-muted">模型</span>
              <span className="mt-0.5 block truncate font-mono text-text-secondary" title={inspector.modelLabel}>{inspector.modelLabel}</span>
            </div>
            <div className="min-w-0">
              <span className="block text-text-muted">触发方式</span>
              <span className="mt-0.5 block truncate text-text-secondary">{TRIGGER_LABELS[inspector.trigger]}</span>
            </div>
            <div className="min-w-0">
              <span className="block text-text-muted">Run</span>
              <span className="mt-0.5 block truncate font-mono text-text-secondary" title={inspector.runId}>{inspector.runId}</span>
            </div>
          </div>

          <div role="tablist" aria-label="检查器视图" className="grid h-10 shrink-0 grid-cols-2 border-b border-border-secondary px-3">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'run'}
              onClick={() => setTab('run')}
              className="border-b-2 border-transparent text-[11px] font-medium text-text-muted transition-colors hover:text-text-base aria-selected:border-brand aria-selected:text-brand"
            >
              运行
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'artifacts'}
              onClick={() => setTab('artifacts')}
              className="border-b-2 border-transparent text-[11px] font-medium text-text-muted transition-colors hover:text-text-base aria-selected:border-brand aria-selected:text-brand"
            >
              产物
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            {tab === 'run' ? (
              <div className="space-y-5">
                {inspector.error && (
                  <section aria-label="运行错误" className="border-l-2 border-semantic-negative pl-3">
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-semantic-negative">
                      <TriangleAlert className="h-3.5 w-3.5" aria-hidden="true" />
                      {inspector.error.errorClass}
                    </div>
                    <p className="mb-0 mt-1 text-[11px] leading-relaxed text-text-secondary">{inspector.error.message}</p>
                  </section>
                )}

                <section aria-labelledby="run-events-heading">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <h4 id="run-events-heading" className="m-0 text-[10px] font-semibold uppercase text-text-muted">事件轨道</h4>
                    <span className="font-mono text-[10px] text-text-muted">{events.length} events</span>
                  </div>
                  {events.length > 0 ? (
                    <ol aria-label="运行事件" className="m-0 list-none space-y-0 p-0">
                      {events.map((event, index) => {
                        const summary = eventSummary(event.type, event.payload)
                        return (
                          <li key={event.id} className="relative grid grid-cols-[38px_minmax(0,1fr)] gap-2 pb-3 last:pb-0">
                            {index < events.length - 1 && (
                              <span className="absolute bottom-0 left-[18px] top-4 w-px bg-border-secondary" aria-hidden="true" />
                            )}
                            <span className="relative z-[1] flex h-5 items-center justify-center rounded-sm border border-border-secondary bg-bg-surface font-mono text-[9px] text-brand">
                              #{String(event.sequence).padStart(2, '0')}
                            </span>
                            <div className="min-w-0 pt-0.5">
                              <div className="flex items-start justify-between gap-2">
                                <span className="text-[11px] font-medium text-text-secondary">{EVENT_LABELS[event.type]}</span>
                                <time className="shrink-0 font-mono text-[9px] text-text-muted">{formatEventTime(event.createdAt)}</time>
                              </div>
                              {summary && <p className="mb-0 mt-0.5 break-words text-[10px] leading-relaxed text-text-muted">{summary}</p>}
                            </div>
                          </li>
                        )
                      })}
                    </ol>
                  ) : (
                    <p className="m-0 text-[11px] text-text-muted">等待持久化事件。</p>
                  )}
                </section>

                {inspector.tools.length > 0 && (
                  <InspectorRows
                    icon={<Wrench className="h-3.5 w-3.5" aria-hidden="true" />}
                    title="工具调用"
                    rows={inspector.tools.map((tool) => ({
                      id: tool.callId,
                      label: tool.toolId,
                      status: tool.status,
                      detail: tool.summary
                    }))}
                  />
                )}

                {inspector.permissions.length > 0 && (
                  <InspectorRows
                    icon={<ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />}
                    title="授权"
                    rows={inspector.permissions.map((permission) => ({
                      id: permission.callId,
                      label: permission.toolId,
                      status: permission.decision ?? (permission.resolved ? 'resolved' : 'waiting'),
                      detail: permission.reason
                    }))}
                  />
                )}

                {projection.taskTree.length > 0 && (
                  <InspectorRows
                    icon={<GitBranch className="h-3.5 w-3.5" aria-hidden="true" />}
                    title="子任务"
                    rows={projection.taskTree.map((task) => ({
                      id: task.id,
                      label: task.roleId,
                      status: task.status,
                      detail: task.summary
                    }))}
                  />
                )}
              </div>
            ) : (
              <section aria-label="运行产物">
                {artifacts.length > 0 ? (
                  <div className="divide-y divide-border-secondary">
                    {artifacts.map((artifact) => (
                      <article key={artifact.id} className="py-3 first:pt-0 last:pb-0">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <Boxes className="h-3.5 w-3.5 shrink-0 text-brand" aria-hidden="true" />
                            <h4 className="m-0 truncate text-[11px] font-semibold text-text-base">{artifact.title}</h4>
                          </div>
                          <span className="shrink-0 font-mono text-[9px] uppercase text-text-muted">{artifact.kind}</span>
                        </div>
                        <p className="mb-0 mt-1.5 text-[11px] leading-relaxed text-text-secondary">{artifact.summary}</p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center py-8 text-center">
                    <PackageOpen className="h-6 w-6 text-text-muted" aria-hidden="true" />
                    <p className="mb-0 mt-2 text-[11px] text-text-muted">本次运行还没有产物</p>
                  </div>
                )}
              </section>
            )}
          </div>
        </>
      )}
    </aside>
  )
}

interface InspectorRow {
  id: string
  label: string
  status: string
  detail?: string | undefined
}

interface InspectorRowsProps {
  icon: JSX.Element
  title: string
  rows: InspectorRow[]
}

function InspectorRows({ icon, title, rows }: InspectorRowsProps): JSX.Element {
  return (
    <section>
      <h4 className="m-0 flex items-center gap-1.5 text-[10px] font-semibold uppercase text-text-muted">
        {icon}
        {title}
      </h4>
      <div className="mt-2 divide-y divide-border-secondary border-y border-border-secondary">
        {rows.map((row) => (
          <div key={row.id} className="py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate font-mono text-[10px] text-text-secondary" title={row.label}>{row.label}</span>
              <span className="shrink-0 font-mono text-[9px] uppercase text-text-muted">{row.status}</span>
            </div>
            {row.detail && <p className="mb-0 mt-1 text-[10px] leading-relaxed text-text-muted">{row.detail}</p>}
          </div>
        ))}
      </div>
    </section>
  )
}
