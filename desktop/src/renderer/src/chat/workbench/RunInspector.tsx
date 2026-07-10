/**
 * Agent Run Inspector — projects the durable run spine into an operational view.
 * @see docs/api-contracts/agents.md
 */

import {
  Activity,
  GitBranch,
  PackageOpen,
  ShieldCheck,
  TriangleAlert,
  Wrench
} from 'lucide-react'
import { useId, useMemo, useState, type KeyboardEvent } from 'react'

import {
  AGENT_ARTIFACT_KINDS,
  type AgentArtifactViewModel,
  type AgentRunEventPayload,
  type AgentRunEventType
} from '../../../../../../shared/agent-run-events'
import {
  projectAgentArtifacts,
  projectAgentRunSnapshot
} from '../../../../../../shared/agent-run-projector'
import type { AgentRunStatus, AgentRunViewResponse } from '../../../../../../shared/agents'
import { cn } from '../../lib/cn'
import { ArtifactPanel } from './ArtifactPanel'

export interface RunInspectorProps {
  runView: AgentRunViewResponse | null
  className?: string | undefined
}

type InspectorTab = 'run' | 'artifacts'

const INSPECTOR_TABS: InspectorTab[] = ['run', 'artifacts']

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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string')
}

function isOptionalString(value: unknown): boolean {
  return value === undefined || typeof value === 'string'
}

function isArtifactKind(value: unknown): boolean {
  return AGENT_ARTIFACT_KINDS.some((kind) => kind === value)
}

function hasArtifactViewBase(value: Record<string, unknown>): boolean {
  return typeof value.id === 'string'
    && typeof value.runId === 'string'
    && isArtifactKind(value.kind)
    && typeof value.title === 'string'
    && typeof value.summary === 'string'
    && typeof value.createdAt === 'number'
    && Number.isFinite(value.createdAt)
}

function isCanvasPlanNodes(value: unknown): boolean {
  return Array.isArray(value) && value.every((entry) => {
    return isRecord(entry)
      && typeof entry.ref === 'string'
      && typeof entry.type === 'string'
      && typeof entry.title === 'string'
  })
}

function isCanvasPlanEdges(value: unknown): boolean {
  return Array.isArray(value) && value.every((entry) => {
    return isRecord(entry)
      && typeof entry.source === 'string'
      && typeof entry.target === 'string'
      && typeof entry.edgeType === 'string'
  })
}

function isCanvasPlanRunSteps(value: unknown): boolean {
  return Array.isArray(value) && value.every((entry) => {
    return isRecord(entry)
      && typeof entry.ref === 'string'
      && typeof entry.action === 'string'
  })
}

function isCanvasPatchAction(value: unknown): boolean {
  return value === 'add' || value === 'update' || value === 'remove'
}

function isCanvasPatchNodeChanges(value: unknown): boolean {
  return Array.isArray(value) && value.every((entry) => {
    return isRecord(entry)
      && isCanvasPatchAction(entry.action)
      && typeof entry.ref === 'string'
      && isOptionalString(entry.type)
      && isOptionalString(entry.title)
  })
}

function isCanvasPatchEdgeChanges(value: unknown): boolean {
  return Array.isArray(value) && value.every((entry) => {
    return isRecord(entry)
      && isCanvasPatchAction(entry.action)
      && typeof entry.source === 'string'
      && typeof entry.target === 'string'
      && isOptionalString(entry.edgeType)
  })
}

function isSearchSources(value: unknown): boolean {
  return Array.isArray(value) && value.every((entry) => {
    return isRecord(entry)
      && typeof entry.title === 'string'
      && isOptionalString(entry.url)
      && isOptionalString(entry.citation)
      && isOptionalString(entry.snippet)
  })
}

function isDiagnosticSeverity(value: unknown): boolean {
  return value === 'info' || value === 'warning' || value === 'error'
}

function isDiagnosticEntries(value: unknown): boolean {
  return Array.isArray(value) && value.every((entry) => {
    return isRecord(entry)
      && typeof entry.code === 'string'
      && isDiagnosticSeverity(entry.severity)
      && typeof entry.message === 'string'
      && isOptionalString(entry.path)
      && isOptionalString(entry.detailsPreview)
  })
}

function isProjectedArtifactView(value: unknown): value is AgentArtifactViewModel {
  if (!isRecord(value) || !hasArtifactViewBase(value)) {
    return false
  }

  switch (value.viewType) {
    case 'answer':
      return value.kind === 'answer'
        && typeof value.text === 'string'
        && isStringArray(value.dropped)
    case 'clarification':
      return value.kind === 'clarification'
        && typeof value.question === 'string'
        && isStringArray(value.missing)
        && isStringArray(value.dropped)
    case 'canvasPlan':
      return value.kind === 'canvasPlan'
        && (value.planKind === 'plan' || value.planKind === 'clarify')
        && typeof value.planSummary === 'string'
        && isOptionalString(value.question)
        && isCanvasPlanNodes(value.nodes)
        && isCanvasPlanEdges(value.edges)
        && isCanvasPlanRunSteps(value.runSteps)
        && isStringArray(value.dropped)
    case 'canvasPatchDraft':
      return value.kind === 'canvasPatchDraft'
        && typeof value.patchSummary === 'string'
        && isCanvasPatchNodeChanges(value.nodeChanges)
        && isCanvasPatchEdgeChanges(value.edgeChanges)
        && isStringArray(value.warnings)
    case 'searchSummary':
      return value.kind === 'searchSummary'
        && isOptionalString(value.query)
        && typeof value.searchSummary === 'string'
        && isSearchSources(value.sources)
        && isStringArray(value.citations)
    case 'memorySuggestion':
      return value.kind === 'memorySuggestion'
        && (value.scope === 'user' || value.scope === 'workflow' || value.scope === 'agentRole')
        && typeof value.content === 'string'
        && isOptionalString(value.rationale)
        && value.confirmationState === 'pending'
    case 'diagnostics':
      return value.kind === 'diagnosticReport'
        && isDiagnosticSeverity(value.severity)
        && isDiagnosticEntries(value.diagnostics)
    case 'fallback':
      return typeof value.reason === 'string'
        && typeof value.payloadPreview === 'string'
    default:
      return false
  }
}

function projectedArtifactViews(value: unknown): AgentArtifactViewModel[] {
  return Array.isArray(value) ? value.filter(isProjectedArtifactView) : []
}

function nextInspectorTabIndex(key: string, currentIndex: number): number | null {
  if (key === 'ArrowRight') {
    return (currentIndex + 1) % INSPECTOR_TABS.length
  }
  if (key === 'ArrowLeft') {
    return (currentIndex - 1 + INSPECTOR_TABS.length) % INSPECTOR_TABS.length
  }
  if (key === 'Home') {
    return 0
  }
  if (key === 'End') {
    return INSPECTOR_TABS.length - 1
  }
  return null
}

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
  const tabInstanceId = useId()
  const projection = useMemo(() => {
    if (runView?.projection) {
      return runView.projection
    }

    return runView?.snapshot
      ? projectAgentRunSnapshot(runView.snapshot)
      : undefined
  }, [runView?.projection, runView?.snapshot])
  const inspector = projection?.inspector
  const events = useMemo(
    () => [...(runView?.snapshot?.events ?? [])].sort((left, right) => left.sequence - right.sequence),
    [runView?.snapshot?.events]
  )
  const artifacts = useMemo(() => {
    if (runView?.snapshot) {
      return projectAgentArtifacts(runView.snapshot.artifacts)
    }

    return projectedArtifactViews(projection?.artifacts)
  }, [projection?.artifacts, runView?.snapshot])
  const runTabId = `${tabInstanceId}-inspector-tab-run`
  const artifactsTabId = `${tabInstanceId}-inspector-tab-artifacts`
  const runPanelId = `${tabInstanceId}-inspector-panel-run`
  const artifactsPanelId = `${tabInstanceId}-inspector-panel-artifacts`

  const handleTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number
  ): void => {
    const targetIndex = nextInspectorTabIndex(event.key, currentIndex)
    if (targetIndex === null) {
      return
    }

    event.preventDefault()
    const targetTab = INSPECTOR_TABS[targetIndex]
    if (!targetTab) {
      return
    }
    setTab(targetTab)
    const targetId = targetTab === 'run' ? runTabId : artifactsTabId
    document.getElementById(targetId)?.focus()
  }

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
              id={runTabId}
              type="button"
              role="tab"
              aria-selected={tab === 'run'}
              aria-controls={runPanelId}
              tabIndex={tab === 'run' ? 0 : -1}
              onClick={() => setTab('run')}
              onKeyDown={(event) => handleTabKeyDown(event, 0)}
              className="border-b-2 border-transparent text-[11px] font-medium text-text-muted transition-colors hover:text-text-base aria-selected:border-brand aria-selected:text-brand"
            >
              运行
            </button>
            <button
              id={artifactsTabId}
              type="button"
              role="tab"
              aria-selected={tab === 'artifacts'}
              aria-controls={artifactsPanelId}
              tabIndex={tab === 'artifacts' ? 0 : -1}
              onClick={() => setTab('artifacts')}
              onKeyDown={(event) => handleTabKeyDown(event, 1)}
              className="border-b-2 border-transparent text-[11px] font-medium text-text-muted transition-colors hover:text-text-base aria-selected:border-brand aria-selected:text-brand"
            >
              产物
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
            <div
              id={runPanelId}
              role="tabpanel"
              aria-labelledby={runTabId}
              tabIndex={0}
              hidden={tab !== 'run'}
              className="outline-none focus-visible:ring-1 focus-visible:ring-brand"
            >
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
            </div>
            <div
              id={artifactsPanelId}
              role="tabpanel"
              aria-labelledby={artifactsTabId}
              tabIndex={0}
              hidden={tab !== 'artifacts'}
              className="outline-none focus-visible:ring-1 focus-visible:ring-brand"
            >
              <ArtifactPanel artifacts={artifacts} />
            </div>
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
