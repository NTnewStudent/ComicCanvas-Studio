/**
 * Typed read-only Agent artifact tabs for the Run Inspector.
 * @see docs/api-contracts/agents.md
 */

import {
  Activity,
  Brain,
  CircleHelp,
  FileText,
  GitBranch,
  Network,
  PackageOpen,
  Search,
  TriangleAlert,
  type LucideIcon
} from 'lucide-react'
import {
  useEffect,
  useId,
  useMemo,
  useState,
  type KeyboardEvent,
  type ReactNode
} from 'react'

import type {
  AgentArtifactViewModel,
  AgentCanvasPatchAction,
  AgentDiagnosticSeverity,
  AgentMemorySuggestionScope
} from '../../../../../../shared/agent-run-events'
import { cn } from '../../lib/cn'

/** Inputs for the typed read-only artifact tab panel. */
export interface ArtifactPanelProps {
  artifacts: AgentArtifactViewModel[]
}

const ARTIFACT_ICONS: Record<AgentArtifactViewModel['viewType'], LucideIcon> = {
  answer: FileText,
  clarification: CircleHelp,
  canvasPlan: Network,
  canvasPatchDraft: GitBranch,
  searchSummary: Search,
  memorySuggestion: Brain,
  diagnostics: Activity,
  fallback: TriangleAlert
}

const PATCH_ACTION_LABELS: Record<AgentCanvasPatchAction, string> = {
  add: '新增',
  update: '更新',
  remove: '移除'
}

const PATCH_ACTION_STYLES: Record<AgentCanvasPatchAction, string> = {
  add: 'border-semantic-success/35 text-semantic-success',
  update: 'border-semantic-info/35 text-semantic-info',
  remove: 'border-semantic-negative/35 text-semantic-negative'
}

const DIAGNOSTIC_LABELS: Record<AgentDiagnosticSeverity, string> = {
  info: '信息',
  warning: '警告',
  error: '错误'
}

const DIAGNOSTIC_STYLES: Record<AgentDiagnosticSeverity, string> = {
  info: 'border-semantic-info/35 text-semantic-info',
  warning: 'border-semantic-warning/35 text-semantic-warning',
  error: 'border-semantic-negative/35 text-semantic-negative'
}

const MEMORY_SCOPE_LABELS: Record<AgentMemorySuggestionScope, string> = {
  user: '用户记忆',
  workflow: '当前工作流',
  agentRole: 'Agent 角色'
}

const RUN_ACTION_LABELS: Record<string, string> = {
  imageRun: '图片生成',
  videoRun: '视频生成',
  textPolish: '文本润色'
}

function nextTabIndex(
  key: string,
  currentIndex: number,
  artifactCount: number
): number | null {
  if (artifactCount === 0) {
    return null
  }

  if (key === 'ArrowRight' || key === 'ArrowDown') {
    return (currentIndex + 1) % artifactCount
  }
  if (key === 'ArrowLeft' || key === 'ArrowUp') {
    return (currentIndex - 1 + artifactCount) % artifactCount
  }
  if (key === 'Home') {
    return 0
  }
  if (key === 'End') {
    return artifactCount - 1
  }
  return null
}

interface DetailSectionProps {
  title: string
  children: ReactNode
}

function DetailSection({ title, children }: DetailSectionProps): JSX.Element {
  return (
    <section className="min-w-0">
      <h5 className="m-0 text-[10px] font-semibold uppercase text-text-muted">{title}</h5>
      <div className="mt-1.5 min-w-0">{children}</div>
    </section>
  )
}

function InlineList({ values }: { values: string[] }): JSX.Element {
  return (
    <ul className="m-0 flex min-w-0 list-none flex-wrap gap-1.5 p-0">
      {values.map((value, index) => (
        <li
          key={`${value}-${index}`}
          className="max-w-full min-w-0 break-all rounded-sm border border-border-secondary px-1.5 py-0.5 font-mono text-[9px] text-text-secondary"
        >
          {value}
        </li>
      ))}
    </ul>
  )
}

function AnswerView({
  artifact
}: {
  artifact: Extract<AgentArtifactViewModel, { viewType: 'answer' }>
}): JSX.Element {
  return (
    <div className="min-w-0 space-y-4">
      <p className="m-0 whitespace-pre-wrap break-words text-[12px] leading-relaxed text-text-base">
        {artifact.text}
      </p>
      {artifact.dropped.length > 0 && (
        <DetailSection title="忽略项">
          <InlineList values={artifact.dropped} />
        </DetailSection>
      )}
    </div>
  )
}

function ClarificationView({
  artifact
}: {
  artifact: Extract<AgentArtifactViewModel, { viewType: 'clarification' }>
}): JSX.Element {
  return (
    <div className="min-w-0 space-y-4">
      <div className="border-l-2 border-semantic-warning pl-3">
        <p className="m-0 text-[10px] font-semibold text-semantic-warning">需要补充信息</p>
        <p className="mb-0 mt-1 whitespace-pre-wrap break-words text-[12px] leading-relaxed text-text-base">
          {artifact.question}
        </p>
      </div>
      {artifact.missing.length > 0 && (
        <DetailSection title="缺少字段">
          <InlineList values={artifact.missing} />
        </DetailSection>
      )}
      {artifact.dropped.length > 0 && (
        <DetailSection title="忽略项">
          <InlineList values={artifact.dropped} />
        </DetailSection>
      )}
    </div>
  )
}

function CanvasPlanView({
  artifact
}: {
  artifact: Extract<AgentArtifactViewModel, { viewType: 'canvasPlan' }>
}): JSX.Element {
  return (
    <div className="min-w-0 space-y-4">
      {artifact.planSummary !== artifact.summary && (
        <p className="m-0 break-words text-[11px] leading-relaxed text-text-secondary">
          {artifact.planSummary}
        </p>
      )}
      {artifact.question && (
        <p className="m-0 border-l-2 border-semantic-warning pl-3 text-[11px] leading-relaxed text-text-secondary">
          {artifact.question}
        </p>
      )}
      <div className="grid min-w-0 grid-cols-3 divide-x divide-border-secondary border-y border-border-secondary py-2 text-center">
        <span className="min-w-0 break-words px-1 text-[10px] text-text-secondary">{artifact.nodes.length} 个节点</span>
        <span className="min-w-0 break-words px-1 text-[10px] text-text-secondary">{artifact.edges.length} 条连线</span>
        <span className="min-w-0 break-words px-1 text-[10px] text-text-secondary">{artifact.runSteps.length} 个步骤</span>
      </div>

      {artifact.nodes.length > 0 && (
        <DetailSection title="节点">
          <div className="divide-y divide-border-secondary border-y border-border-secondary">
            {artifact.nodes.map((node) => (
              <div key={node.ref} className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] gap-2 py-2">
                <div className="min-w-0">
                  <p className="m-0 break-words text-[10px] font-medium text-text-secondary">{node.title}</p>
                  <p className="mb-0 mt-0.5 break-all font-mono text-[9px] text-text-muted">{node.ref}</p>
                </div>
                <span className="self-start rounded-sm border border-border-secondary px-1.5 py-0.5 font-mono text-[9px] text-text-muted">
                  {node.type}
                </span>
              </div>
            ))}
          </div>
        </DetailSection>
      )}

      {artifact.edges.length > 0 && (
        <DetailSection title="连线">
          <div className="divide-y divide-border-secondary border-y border-border-secondary">
            {artifact.edges.map((edge, index) => (
              <div key={`${edge.source}-${edge.target}-${index}`} className="min-w-0 py-2">
                <p className="m-0 break-all font-mono text-[10px] text-text-secondary">
                  {edge.source} → {edge.target}
                </p>
                <p className="mb-0 mt-0.5 break-all font-mono text-[9px] text-text-muted">{edge.edgeType}</p>
              </div>
            ))}
          </div>
        </DetailSection>
      )}

      {artifact.runSteps.length > 0 && (
        <DetailSection title="运行步骤">
          <ol className="m-0 list-none divide-y divide-border-secondary border-y border-border-secondary p-0">
            {artifact.runSteps.map((step, index) => (
              <li key={`${step.ref}-${step.action}-${index}`} className="grid min-w-0 grid-cols-[20px_minmax(0,1fr)] gap-2 py-2">
                <span className="font-mono text-[9px] text-brand">{index + 1}</span>
                <span className="min-w-0 break-words text-[10px] text-text-secondary">
                  <span className="font-mono">{step.ref}</span>
                  {' · '}
                  {RUN_ACTION_LABELS[step.action] ?? step.action}
                </span>
              </li>
            ))}
          </ol>
        </DetailSection>
      )}

      {artifact.dropped.length > 0 && (
        <DetailSection title="净化提示">
          <InlineList values={artifact.dropped} />
        </DetailSection>
      )}
    </div>
  )
}

function PatchActionBadge({ action }: { action: AgentCanvasPatchAction }): JSX.Element {
  return (
    <span className={cn(
      'shrink-0 rounded-sm border px-1.5 py-0.5 text-[9px] font-semibold',
      PATCH_ACTION_STYLES[action]
    )}>
      {PATCH_ACTION_LABELS[action]}
    </span>
  )
}

function CanvasPatchDraftView({
  artifact
}: {
  artifact: Extract<AgentArtifactViewModel, { viewType: 'canvasPatchDraft' }>
}): JSX.Element {
  return (
    <div className="min-w-0 space-y-4">
      {artifact.patchSummary !== artifact.summary && (
        <p className="m-0 break-words text-[11px] leading-relaxed text-text-secondary">
          {artifact.patchSummary}
        </p>
      )}
      <div className="grid min-w-0 grid-cols-2 divide-x divide-border-secondary border-y border-border-secondary py-2 text-center">
        <span className="min-w-0 break-words px-1 text-[10px] text-text-secondary">
          {artifact.nodeChanges.length} 项节点变更
        </span>
        <span className="min-w-0 break-words px-1 text-[10px] text-text-secondary">
          {artifact.edgeChanges.length} 项连线变更
        </span>
      </div>

      {artifact.nodeChanges.length > 0 && (
        <DetailSection title="节点变更">
          <div className="divide-y divide-border-secondary border-y border-border-secondary">
            {artifact.nodeChanges.map((change, index) => (
              <div key={`${change.ref}-${change.action}-${index}`} className="flex min-w-0 items-start gap-2 py-2">
                <PatchActionBadge action={change.action} />
                <div className="min-w-0 flex-1">
                  <p className="m-0 break-words text-[10px] font-medium text-text-secondary">
                    {change.title ?? change.ref}
                  </p>
                  <p className="mb-0 mt-0.5 break-all font-mono text-[9px] text-text-muted">
                    {[change.ref, change.type].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </DetailSection>
      )}

      {artifact.edgeChanges.length > 0 && (
        <DetailSection title="连线变更">
          <div className="divide-y divide-border-secondary border-y border-border-secondary">
            {artifact.edgeChanges.map((change, index) => (
              <div key={`${change.source}-${change.target}-${change.action}-${index}`} className="flex min-w-0 items-start gap-2 py-2">
                <PatchActionBadge action={change.action} />
                <div className="min-w-0 flex-1">
                  <p className="m-0 break-all font-mono text-[10px] text-text-secondary">
                    {change.source} → {change.target}
                  </p>
                  {change.edgeType && (
                    <p className="mb-0 mt-0.5 break-all font-mono text-[9px] text-text-muted">{change.edgeType}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </DetailSection>
      )}

      {artifact.warnings.length > 0 && (
        <DetailSection title="应用提示">
          <ul className="m-0 list-none space-y-1 border-l-2 border-semantic-warning pl-3">
            {artifact.warnings.map((warning, index) => (
              <li key={`${warning}-${index}`} className="break-words text-[10px] leading-relaxed text-text-secondary">
                {warning}
              </li>
            ))}
          </ul>
        </DetailSection>
      )}
    </div>
  )
}

function SearchSummaryView({
  artifact
}: {
  artifact: Extract<AgentArtifactViewModel, { viewType: 'searchSummary' }>
}): JSX.Element {
  return (
    <div className="min-w-0 space-y-4">
      {artifact.query && (
        <DetailSection title="检索词">
          <p className="m-0 break-all font-mono text-[10px] text-text-secondary">{artifact.query}</p>
        </DetailSection>
      )}
      {artifact.searchSummary !== artifact.summary && (
        <p className="m-0 break-words text-[11px] leading-relaxed text-text-secondary">
          {artifact.searchSummary}
        </p>
      )}
      {artifact.sources.length > 0 && (
        <DetailSection title={`来源 ${artifact.sources.length}`}>
          <ol className="m-0 list-none divide-y divide-border-secondary border-y border-border-secondary p-0">
            {artifact.sources.map((source, index) => (
              <li key={`${source.title}-${index}`} className="max-w-full min-w-0 py-2">
                <div className="flex min-w-0 items-start justify-between gap-2">
                  <span className="min-w-0 flex-1 break-words text-[10px] font-medium text-text-secondary">{source.title}</span>
                  {source.citation && (
                    <span className="max-w-full min-w-0 break-all rounded-sm border border-border-secondary px-1.5 py-0.5 font-mono text-[9px] text-brand">
                      {source.citation}
                    </span>
                  )}
                </div>
                {source.snippet && (
                  <p className="mb-0 mt-1 break-words text-[10px] leading-relaxed text-text-muted">{source.snippet}</p>
                )}
                {source.url && (
                  <p className="mb-0 mt-1 break-all font-mono text-[9px] leading-relaxed text-text-muted">{source.url}</p>
                )}
              </li>
            ))}
          </ol>
        </DetailSection>
      )}
      {artifact.citations.length > 0 && (
        <DetailSection title="引用">
          <InlineList values={artifact.citations} />
        </DetailSection>
      )}
    </div>
  )
}

function MemorySuggestionView({
  artifact
}: {
  artifact: Extract<AgentArtifactViewModel, { viewType: 'memorySuggestion' }>
}): JSX.Element {
  return (
    <div className="min-w-0 space-y-4">
      <div className="border-y border-semantic-warning/35 bg-semantic-warning/5 py-2">
        <p className="m-0 text-[10px] font-semibold text-semantic-warning">待确认建议</p>
        <p className="mb-0 mt-0.5 text-[10px] leading-relaxed text-text-secondary">尚未写入本地记忆</p>
      </div>
      <DetailSection title="建议范围">
        <span className="inline-flex max-w-full rounded-sm border border-border-secondary px-1.5 py-0.5 text-[10px] text-text-secondary">
          {MEMORY_SCOPE_LABELS[artifact.scope]}
        </span>
      </DetailSection>
      <DetailSection title="建议内容">
        <p className="m-0 whitespace-pre-wrap break-words text-[11px] leading-relaxed text-text-base">{artifact.content}</p>
      </DetailSection>
      {artifact.rationale && (
        <DetailSection title="建议原因">
          <p className="m-0 break-words text-[10px] leading-relaxed text-text-secondary">{artifact.rationale}</p>
        </DetailSection>
      )}
    </div>
  )
}

function DiagnosticsView({
  artifact
}: {
  artifact: Extract<AgentArtifactViewModel, { viewType: 'diagnostics' }>
}): JSX.Element {
  return (
    <div className="min-w-0 space-y-4">
      <div className="flex min-w-0 items-center justify-between gap-2 border-y border-border-secondary py-2">
        <span className="min-w-0 break-words text-[10px] text-text-secondary">
          {artifact.diagnostics.length} 项结构化诊断
        </span>
        <span className={cn(
          'shrink-0 rounded-sm border px-1.5 py-0.5 text-[9px] font-semibold',
          DIAGNOSTIC_STYLES[artifact.severity]
        )}>
          {DIAGNOSTIC_LABELS[artifact.severity]}
        </span>
      </div>
      {artifact.diagnostics.length > 0 ? (
        <ol className="m-0 list-none divide-y divide-border-secondary border-y border-border-secondary p-0">
          {artifact.diagnostics.map((diagnostic, index) => (
            <li key={`${diagnostic.code}-${index}`} className="min-w-0 py-2">
              <div className="flex min-w-0 items-start justify-between gap-2">
                <code className="min-w-0 break-all text-[10px] font-semibold text-text-secondary">{diagnostic.code}</code>
                <span className={cn(
                  'shrink-0 rounded-sm border px-1.5 py-0.5 text-[9px]',
                  DIAGNOSTIC_STYLES[diagnostic.severity]
                )}>
                  {DIAGNOSTIC_LABELS[diagnostic.severity]}
                </span>
              </div>
              <p className="mb-0 mt-1 break-words text-[10px] leading-relaxed text-text-secondary">{diagnostic.message}</p>
              {diagnostic.path && (
                <p className="mb-0 mt-1 break-all font-mono text-[9px] text-text-muted">{diagnostic.path}</p>
              )}
              {diagnostic.detailsPreview && (
                <pre className="mb-0 mt-2 max-w-full overflow-x-auto whitespace-pre-wrap break-all border-l-2 border-border-secondary pl-2 font-mono text-[9px] leading-relaxed text-text-muted">
                  {diagnostic.detailsPreview}
                </pre>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p className="m-0 text-[10px] text-text-muted">没有诊断条目。</p>
      )}
    </div>
  )
}

function FallbackView({
  artifact
}: {
  artifact: Extract<AgentArtifactViewModel, { viewType: 'fallback' }>
}): JSX.Element {
  return (
    <div className="min-w-0 space-y-3">
      <div className="border-l-2 border-semantic-warning pl-3">
        <p className="m-0 text-[10px] font-semibold text-semantic-warning">无法使用类型化视图</p>
        <p className="mb-0 mt-1 break-words text-[10px] leading-relaxed text-text-secondary">{artifact.reason}</p>
      </div>
      <pre className="m-0 max-w-full overflow-x-auto whitespace-pre-wrap break-all border-y border-border-secondary py-2 font-mono text-[9px] leading-relaxed text-text-muted">
        {artifact.payloadPreview}
      </pre>
    </div>
  )
}

function ArtifactBody({ artifact }: { artifact: AgentArtifactViewModel }): JSX.Element {
  switch (artifact.viewType) {
    case 'answer':
      return <AnswerView artifact={artifact} />
    case 'clarification':
      return <ClarificationView artifact={artifact} />
    case 'canvasPlan':
      return <CanvasPlanView artifact={artifact} />
    case 'canvasPatchDraft':
      return <CanvasPatchDraftView artifact={artifact} />
    case 'searchSummary':
      return <SearchSummaryView artifact={artifact} />
    case 'memorySuggestion':
      return <MemorySuggestionView artifact={artifact} />
    case 'diagnostics':
      return <DiagnosticsView artifact={artifact} />
    case 'fallback':
      return <FallbackView artifact={artifact} />
  }
}

/**
 * Renders one run's typed artifacts as accessible, scrollable read-only tabs.
 * @param props - Projected artifact view models.
 * @returns Artifact tablist and selected detail panel.
 */
export function ArtifactPanel({ artifacts }: ArtifactPanelProps): JSX.Element {
  const instanceId = useId()
  const selectionKeys = useMemo(
    () => new Set(artifacts.map((artifact) => `${artifact.runId}:${artifact.id}`)),
    [artifacts]
  )
  const firstSelectionKey = artifacts[0]
    ? `${artifacts[0].runId}:${artifacts[0].id}`
    : null
  const [selectedKey, setSelectedKey] = useState<string | null>(firstSelectionKey)

  useEffect(() => {
    setSelectedKey((currentKey) => {
      return currentKey && selectionKeys.has(currentKey)
        ? currentKey
        : firstSelectionKey
    })
  }, [firstSelectionKey, selectionKeys])

  const selectedArtifact = artifacts.find(
    (artifact) => `${artifact.runId}:${artifact.id}` === selectedKey
  ) ?? artifacts[0]

  if (!selectedArtifact) {
    return (
      <section aria-label="运行产物" className="flex min-w-0 flex-col items-center py-8 text-center">
        <PackageOpen className="h-6 w-6 text-text-muted" aria-hidden="true" />
        <p className="mb-0 mt-2 text-[11px] text-text-muted">本次运行还没有产物</p>
      </section>
    )
  }

  const handleTabKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    currentIndex: number
  ): void => {
    const targetIndex = nextTabIndex(event.key, currentIndex, artifacts.length)
    if (targetIndex === null) {
      return
    }

    event.preventDefault()
    const targetArtifact = artifacts[targetIndex]
    if (!targetArtifact) {
      return
    }
    setSelectedKey(`${targetArtifact.runId}:${targetArtifact.id}`)
    document.getElementById(`${instanceId}-artifact-tab-${targetIndex}`)?.focus()
  }

  return (
    <section aria-label="运行产物" className="min-w-0">
      <div
        role="tablist"
        aria-label="Agent 产物"
        aria-orientation="horizontal"
        className="flex min-w-0 flex-nowrap gap-px overflow-x-auto overflow-y-hidden border-b border-border-secondary pb-2"
      >
        {artifacts.map((artifact, index) => {
          const selected = artifact.id === selectedArtifact.id
          const Icon = ARTIFACT_ICONS[artifact.viewType]
          const tabId = `${instanceId}-artifact-tab-${index}`
          const panelId = `${instanceId}-artifact-panel-${index}`

          return (
            <button
              key={`${artifact.runId}-${artifact.id}`}
              id={tabId}
              type="button"
              role="tab"
              aria-label={artifact.title}
              aria-selected={selected}
              aria-controls={panelId}
              tabIndex={selected ? 0 : -1}
              onClick={() => setSelectedKey(`${artifact.runId}:${artifact.id}`)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
              className={cn(
                'flex h-8 max-w-44 min-w-0 shrink-0 items-center gap-1.5 border-b-2 px-2 text-left text-[10px] transition-colors',
                selected
                  ? 'border-brand bg-bg-hover text-text-base'
                  : 'border-transparent text-text-muted hover:bg-bg-hover hover:text-text-secondary'
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span className="min-w-0 truncate">{artifact.title}</span>
            </button>
          )
        })}
      </div>

      {artifacts.map((artifact, index) => {
        const selected = artifact.id === selectedArtifact.id
        const Icon = ARTIFACT_ICONS[artifact.viewType]

        return (
          <article
            key={`${artifact.runId}-${artifact.id}`}
            id={`${instanceId}-artifact-panel-${index}`}
            role="tabpanel"
            aria-labelledby={`${instanceId}-artifact-tab-${index}`}
            tabIndex={selected ? 0 : -1}
            hidden={!selected}
            className="min-w-0 py-3 outline-none focus-visible:ring-1 focus-visible:ring-brand"
          >
            <div className="mb-3 min-w-0 border-b border-border-secondary pb-3">
              <div className="flex min-w-0 items-center gap-2">
                <Icon className="h-3.5 w-3.5 shrink-0 text-brand" aria-hidden="true" />
                <span className="min-w-0 break-all font-mono text-[9px] text-text-muted">{artifact.kind}</span>
              </div>
              <p className="mb-0 mt-1.5 break-words text-[11px] leading-relaxed text-text-secondary">
                {artifact.summary}
              </p>
            </div>
            <ArtifactBody artifact={artifact} />
          </article>
        )
      })}
    </section>
  )
}
