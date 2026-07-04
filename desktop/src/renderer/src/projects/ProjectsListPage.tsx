/**
 * Projects list page for workflow-level management.
 * Keeps project creation, rename, deletion, and portable JSON import/export in one local-first surface.
 */
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconBox, IconCheck, IconClock, IconFolderOpen, IconHistory, IconPencil, IconPlus, IconRefresh, IconTrash, IconX } from '@tabler/icons-react'

import { cn } from '../lib/cn'
import type { WorkflowSummaryView, WorkflowVersionSummaryView } from '../../../../../shared/ipc'

type ProjectTab = 'mine' | 'public'

type WorkflowSummary = WorkflowSummaryView

const t = {
  title: '\u6211\u7684\u9879\u76ee',
  projectCount: '\u4e2a\u9879\u76ee',
  myProjects: '\u6211\u7684\u9879\u76ee',
  publicTemplates: '\u516c\u5171\u6a21\u677f',
  noPublicTemplates: '\u6682\u65e0\u516c\u5171\u6a21\u677f',
  noPublicTemplatesHint: '\u5f53\u524d\u6ca1\u6709\u5df2\u53d1\u5e03\u7684\u516c\u5171\u6a21\u677f\u3002',
  copyTemplate: '\u590d\u5236\u6a21\u677f',
  publicVisibility: '\u516c\u5171',
  privateVisibility: '\u79c1\u6709',
  newProject: '\u65b0\u5efa\u9879\u76ee',
  unnamedProject: '\u672a\u547d\u540d\u9879\u76ee',
  namePlaceholder: '\u8f93\u5165\u9879\u76ee\u540d\u79f0...',
  emptyTitle: '\u8fd8\u6ca1\u6709\u9879\u76ee',
  emptyHint: '\u70b9\u51fb\u201c\u65b0\u5efa\u9879\u76ee\u201d\u5f00\u59cb\u521b\u4f5c',
  deleteConfirm: '\u786e\u5b9a\u5220\u9664\u6b64\u9879\u76ee\uff1f',
  delete: '\u5220\u9664',
  cancel: '\u53d6\u6d88',
  rename: '\u91cd\u547d\u540d',
  nodes: '\u8282\u70b9',
  edges: '\u8fde\u7ebf',
  archived: '\u5df2\u5f52\u6863',
  warning: '\u4e2a\u8b66\u544a',
  status: {
    idle: '\u672a\u8fd0\u884c',
    pending: '\u7b49\u5f85\u4e2d',
    running: '\u8fd0\u884c\u4e2d',
    done: '\u5df2\u5b8c\u6210',
    error: '\u5931\u8d25',
  },
  justNow: '\u521a\u521a',
  minutesAgo: '\u5206\u949f\u524d',
  hoursAgo: '\u5c0f\u65f6\u524d',
  daysAgo: '\u5929\u524d',
  importWorkflow: '\u5bfc\u5165\u5de5\u4f5c\u6d41',
  exportWorkflow: '\u5bfc\u51fa',
  jsonTitle: '\u5de5\u4f5c\u6d41 JSON',
  jsonHint: '\u5bfc\u51fa\u4f1a\u751f\u6210\u53ef\u8fc1\u79fb JSON\uff1b\u5bfc\u5165\u4f1a\u8fc7\u6ee4\u4e0d\u517c\u5bb9\u8282\u70b9\u548c\u4e0d\u5b89\u5168\u8def\u5f84\u3002',
  closeJsonPanel: '\u5173\u95ed\u5de5\u4f5c\u6d41 JSON \u9762\u677f',
  importName: '\u5bfc\u5165\u540d\u79f0',
  importNamePlaceholder: '\u5bfc\u5165\u540d\u79f0\uff08\u53ef\u9009\uff09',
  confirmImport: '\u786e\u8ba4\u5bfc\u5165',
  exportFailureFallback: '\u5bfc\u51fa\u5931\u8d25\uff0c\u8bf7\u7a0d\u540e\u91cd\u8bd5\u3002',
  importFailureFallback: '\u5bfc\u5165\u5931\u8d25\uff0c\u8bf7\u68c0\u67e5 JSON \u540e\u91cd\u8bd5\u3002',
  versions: '\u7248\u672c',
  versionPanelTitle: '\u7248\u672c\u548c\u8c03\u8bd5\u4fe1\u606f',
  versionPanelHint: '\u7248\u672c\u4e3a\u4e0d\u53ef\u53d8\u66f4\u56fe\u5feb\u7167\uff1b\u6062\u590d\u4f1a\u521b\u5efa\u65b0\u7684\u6700\u65b0\u7248\u672c\u3002',
  restoreVersion: '\u6062\u590d',
  restoredFrom: '\u6062\u590d\u6765\u6e90',
  checksum: '\u6821\u9a8c',
  noVersions: '\u6682\u65e0\u7248\u672c',
  versionLoadFailed: '\u7248\u672c\u52a0\u8f7d\u5931\u8d25\u3002',
  versionRestoreFailed: '\u7248\u672c\u6062\u590d\u5931\u8d25\u3002',
}

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return t.justNow
  if (diffMin < 60) return `${diffMin} ${t.minutesAgo}`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour} ${t.hoursAgo}`
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 7) return `${diffDay} ${t.daysAgo}`
  return date.toLocaleDateString('zh-CN')
}

function countWarnings(workflow: WorkflowSummary): number {
  return workflow.warningSummary.unsupportedNodes + workflow.warningSummary.invalidEdges
}

function normalizeWorkflowSummary(workflow: WorkflowSummaryView): WorkflowSummary {
  const partial = workflow as Partial<WorkflowSummaryView>
  return {
    id: workflow.id,
    name: workflow.name,
    scope: partial.scope ?? 'draft',
    published: partial.published ?? false,
    description: partial.description ?? null,
    visibility: partial.visibility ?? 'private',
    ownerId: partial.ownerId ?? 'user-local',
    ownedByCurrentUser: partial.ownedByCurrentUser ?? true,
    tags: partial.tags ?? [],
    thumbnailUrl: partial.thumbnailUrl ?? null,
    updatedAt: workflow.updatedAt,
    nodeCount: workflow.nodeCount,
    edgeCount: partial.edgeCount ?? 0,
    coverAssetId: partial.coverAssetId ?? null,
    latestRunStatus: partial.latestRunStatus ?? 'idle',
    defaultStylePresetId: partial.defaultStylePresetId ?? null,
    archived: partial.archived ?? false,
    versionChecksum: partial.versionChecksum ?? '',
    warningSummary: partial.warningSummary ?? {
      unsupportedNodes: 0,
      invalidEdges: 0,
    },
  }
}

export default function ProjectsListPage(): JSX.Element {
  const navigate = useNavigate()
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([])
  const [templates, setTemplates] = useState<WorkflowSummary[]>([])
  const [activeTab, setActiveTab] = useState<ProjectTab>('mine')
  const [loading, setLoading] = useState(true)
  const [templatesLoading, setTemplatesLoading] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newName, setNewName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showWorkflowJsonPanel, setShowWorkflowJsonPanel] = useState(false)
  const [workflowJson, setWorkflowJson] = useState('')
  const [importName, setImportName] = useState('')
  const [workflowJsonStatus, setWorkflowJsonStatus] = useState<string | null>(null)
  const [workflowJsonError, setWorkflowJsonError] = useState<string | null>(null)
  const [versionWorkflow, setVersionWorkflow] = useState<WorkflowSummary | null>(null)
  const [versions, setVersions] = useState<WorkflowVersionSummaryView[]>([])
  const [versionsLoading, setVersionsLoading] = useState(false)
  const [versionStatus, setVersionStatus] = useState<string | null>(null)
  const [versionError, setVersionError] = useState<string | null>(null)

  const fetchWorkflows = useCallback(async () => {
    try {
      setLoading(true)
      const list = await window.comicCanvas.listWorkflows()
      setWorkflows(list.map(normalizeWorkflowSummary))
    } catch {
      setWorkflows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchWorkflows()
  }, [fetchWorkflows])

  const fetchTemplates = useCallback(async () => {
    try {
      setTemplatesLoading(true)
      const list = await window.comicCanvas.listWorkflowTemplates({ scope: 'public' })
      setTemplates(list.map(normalizeWorkflowSummary))
    } catch {
      setTemplates([])
    } finally {
      setTemplatesLoading(false)
    }
  }, [])

  useEffect(() => {
    if (activeTab === 'public') {
      void fetchTemplates()
    }
  }, [activeTab, fetchTemplates])

  const handleCreate = useCallback(async () => {
    const name = newName.trim() || t.unnamedProject
    try {
      const result = await window.comicCanvas.createWorkflow({ name })
      setNewName('')
      setShowCreateDialog(false)
      void navigate(`/canvas?id=${result.id}`)
    } catch {
      // Keep the project list stable when creation fails.
    }
  }, [navigate, newName])

  const handleRename = useCallback(
    async (workflowId: string) => {
      const name = renameValue.trim()
      if (!name) {
        setRenamingId(null)
        return
      }
      try {
        await window.comicCanvas.renameWorkflow({ workflowId, name })
        setRenamingId(null)
        setRenameValue('')
        await fetchWorkflows()
      } catch {
        // Keep inline edit state untouched on failure.
      }
    },
    [fetchWorkflows, renameValue],
  )

  const handleDelete = useCallback(
    async (workflowId: string) => {
      try {
        await window.comicCanvas.deleteWorkflow({ workflowId })
        setDeletingId(null)
        await fetchWorkflows()
      } catch {
        // Delete failures are non-destructive and leave the card visible.
      }
    },
    [fetchWorkflows],
  )

  const handleExport = useCallback(async (workflow: WorkflowSummary) => {
    try {
      const exported = await window.comicCanvas.exportWorkflow({ workflowId: workflow.id })
      setWorkflowJson(JSON.stringify(exported, null, 2))
      setImportName(exported.name)
      setShowWorkflowJsonPanel(true)
      setWorkflowJsonError(null)
      setWorkflowJsonStatus(`\u5df2\u5bfc\u51fa ${workflow.name}\uff0c\u53ef\u590d\u5236 JSON\u3002`)
    } catch (error) {
      const message = error instanceof Error ? error.message : t.exportFailureFallback
      setWorkflowJsonError(`\u5bfc\u51fa\u5931\u8d25\uff1a${message}`)
      setWorkflowJsonStatus(null)
    }
  }, [])

  const handleImport = useCallback(async () => {
    try {
      const result = await window.comicCanvas.importWorkflow({
        json: workflowJson,
        ...(importName.trim() ? { name: importName.trim() } : {}),
      })

      if ('errorClass' in result) {
        setWorkflowJsonError(`\u5bfc\u5165\u5931\u8d25\uff1a${result.message}`)
        setWorkflowJsonStatus(null)
        return
      }

      await fetchWorkflows()
      setWorkflowJsonError(null)
      setWorkflowJsonStatus(`\u5df2\u5bfc\u5165\u5de5\u4f5c\u6d41\uff0c\u6e05\u7406 ${result.dropped.length} \u9879\u4e0d\u517c\u5bb9\u5185\u5bb9\u3002`)
      void navigate(`/canvas?id=${result.workflowId}`)
    } catch (error) {
      const message = error instanceof Error ? error.message : t.importFailureFallback
      setWorkflowJsonError(`\u5bfc\u5165\u5931\u8d25\uff1a${message}`)
      setWorkflowJsonStatus(null)
    }
  }, [fetchWorkflows, importName, navigate, workflowJson])

  const handleCopyTemplate = useCallback(
    async (template: WorkflowSummary) => {
      try {
        const result = await window.comicCanvas.copyWorkflowTemplate({ templateId: template.id })
        if ('errorClass' in result) {
          return
        }
        void navigate(`/canvas?id=${result.workflowId}`)
      } catch {
        // Keep the public template list visible when copy fails.
      }
    },
    [navigate],
  )

  const openCreateDialog = () => {
    setNewName('')
    setShowCreateDialog(true)
  }

  const openImportPanel = () => {
    setShowWorkflowJsonPanel(true)
    setWorkflowJson('')
    setImportName('')
    setWorkflowJsonError(null)
    setWorkflowJsonStatus(null)
  }

  const loadVersions = useCallback(async (workflow: WorkflowSummary) => {
    try {
      setVersionsLoading(true)
      setVersionError(null)
      const list = await window.comicCanvas.listWorkflowVersions({ workflowId: workflow.id, limit: 20 })
      setVersions(list)
    } catch {
      setVersions([])
      setVersionError(t.versionLoadFailed)
    } finally {
      setVersionsLoading(false)
    }
  }, [])

  const openVersionPanel = useCallback(
    async (workflow: WorkflowSummary) => {
      setVersionWorkflow(workflow)
      setVersionStatus(null)
      await loadVersions(workflow)
    },
    [loadVersions],
  )

  const handleRestoreVersion = useCallback(
    async (version: WorkflowVersionSummaryView) => {
      if (!versionWorkflow) return
      try {
        const result = await window.comicCanvas.restoreWorkflowVersion({
          workflowId: versionWorkflow.id,
          versionId: version.id,
        })
        if ('errorClass' in result) {
          setVersionError(`\u6062\u590d\u5931\u8d25\uff1a${result.message}`)
          setVersionStatus(null)
          return
        }
        setVersionStatus(`\u5df2\u6062\u590d\u7248\u672c ${version.id}\uff0c\u65b0\u7248\u672c ${result.graphVersion}\u3002`)
        setVersionError(null)
        await fetchWorkflows()
        await loadVersions(versionWorkflow)
      } catch {
        setVersionError(t.versionRestoreFailed)
        setVersionStatus(null)
      }
    },
    [fetchWorkflows, loadVersions, versionWorkflow],
  )

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-6 pb-4 pt-6">
        <div className="flex items-center gap-3">
          <IconFolderOpen className="h-5 w-5 text-brand" />
          <h1 className="text-xl font-bold text-text-base">{t.title}</h1>
          <span className="text-[13px] text-text-muted">
            {workflows.length} {t.projectCount}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={openImportPanel}
            className="inline-flex h-9 items-center rounded-xl border border-border-secondary px-4 text-[13px] font-semibold text-text-secondary transition hover:bg-bg-hover hover:text-text-base"
          >
            {t.importWorkflow}
          </button>
          <button
            onClick={openCreateDialog}
            className="cc-anim-breathe cc-btn-primary inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand px-4 text-[13px] font-semibold text-bg-base transition-all duration-200 ease-luxury hover:bg-brand-hover active:scale-95"
          >
            <IconPlus className="h-4 w-4" />
            {t.newProject}
          </button>
        </div>
      </div>

      <div className="mx-6 mb-4 inline-flex w-fit rounded-xl border border-border-secondary bg-bg-surface p-1" role="tablist" aria-label="工作流项目视图">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'mine'}
          onClick={() => setActiveTab('mine')}
          className={cn(
            'h-8 rounded-lg px-3 text-[13px] font-semibold transition',
            activeTab === 'mine' ? 'bg-brand text-bg-base' : 'text-text-secondary hover:bg-bg-hover hover:text-text-base',
          )}
        >
          {t.myProjects} {workflows.length}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'public'}
          onClick={() => setActiveTab('public')}
          className={cn(
            'h-8 rounded-lg px-3 text-[13px] font-semibold transition',
            activeTab === 'public' ? 'bg-brand text-bg-base' : 'text-text-secondary hover:bg-bg-hover hover:text-text-base',
          )}
        >
          {t.publicTemplates}
        </button>
      </div>

      {showCreateDialog && (
        <div className="mx-6 mb-4 flex items-center gap-2 rounded-2xl border border-border-secondary bg-bg-surface p-4">
          <input
            autoFocus
            value={newName}
            onChange={(event) => setNewName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') void handleCreate()
              if (event.key === 'Escape') {
                setShowCreateDialog(false)
                setNewName('')
              }
            }}
            placeholder={t.namePlaceholder}
            className="flex-1 rounded-xl border border-border-secondary bg-bg-base px-4 py-2.5 text-[14px] text-text-base outline-none placeholder:text-text-muted focus:border-brand"
          />
          <button onClick={() => void handleCreate()} className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-bg-base transition hover:bg-brand-hover">
            <IconCheck className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              setShowCreateDialog(false)
              setNewName('')
            }}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-text-secondary transition hover:bg-bg-hover"
          >
            <IconX className="h-4 w-4" />
          </button>
        </div>
      )}

      {showWorkflowJsonPanel && (
        <div className="mx-6 mb-4 rounded-2xl border border-border-secondary bg-bg-surface p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-[14px] font-semibold text-text-base">{t.jsonTitle}</h2>
              <p className="mt-1 text-[12px] text-text-muted">{t.jsonHint}</p>
            </div>
            <button
              onClick={() => setShowWorkflowJsonPanel(false)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition hover:bg-bg-hover"
              aria-label={t.closeJsonPanel}
            >
              <IconX className="h-4 w-4" />
            </button>
          </div>
          <input
            value={importName}
            onChange={(event) => setImportName(event.target.value)}
            aria-label={t.importName}
            placeholder={t.importNamePlaceholder}
            className="mb-3 w-full rounded-xl border border-border-secondary bg-bg-base px-3 py-2 text-[13px] text-text-base outline-none placeholder:text-text-muted focus:border-brand"
          />
          <textarea
            value={workflowJson}
            onChange={(event) => setWorkflowJson(event.target.value)}
            aria-label={t.jsonTitle}
            className="h-40 w-full resize-none rounded-xl border border-border-secondary bg-bg-base px-3 py-2 font-mono text-[12px] text-text-base outline-none placeholder:text-text-muted focus:border-brand"
            placeholder='{"schemaVersion":1,"name":"Storyboard","graph":{"nodes":[],"edges":[],"viewport":{"x":0,"y":0,"zoom":1}}}'
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="min-h-5 text-[12px]">
              {workflowJsonStatus && <span className="text-green-500">{workflowJsonStatus}</span>}
              {workflowJsonError && (
                <span role="alert" className="text-red-400">
                  {workflowJsonError}
                </span>
              )}
            </div>
            <button onClick={() => void handleImport()} className="inline-flex h-8 items-center rounded-lg bg-brand px-3 text-[13px] font-semibold text-bg-base transition hover:bg-brand-hover">
              {t.confirmImport}
            </button>
          </div>
        </div>
      )}

      {versionWorkflow && (
        <div className="mx-6 mb-4 rounded-2xl border border-border-secondary bg-bg-surface p-4">
          <div className="mb-3 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[14px] font-semibold text-text-base">{t.versionPanelTitle}</h2>
              <p className="mt-1 text-[12px] text-text-muted">{versionWorkflow.name} · {t.versionPanelHint}</p>
            </div>
            <button
              type="button"
              onClick={() => setVersionWorkflow(null)}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition hover:bg-bg-hover"
              aria-label="关闭版本面板"
            >
              <IconX className="h-4 w-4" />
            </button>
          </div>
          <div className="mb-3 min-h-5 text-[12px]">
            {versionStatus && <span className="text-green-500">{versionStatus}</span>}
            {versionError && (
              <span role="alert" className="text-red-400">
                {versionError}
              </span>
            )}
          </div>
          {versionsLoading ? (
            <div className="cc-skeleton h-16 rounded-xl border border-border-primary" />
          ) : versions.length === 0 ? (
            <div className="rounded-xl border border-border-primary px-3 py-4 text-[13px] text-text-muted">{t.noVersions}</div>
          ) : (
            <div className="space-y-2">
              {versions.map((version, index) => (
                <div key={version.id} className="flex items-center justify-between gap-3 rounded-xl border border-border-primary bg-bg-base px-3 py-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-[12px] text-text-muted">
                      <span className="font-mono text-[12px] font-semibold text-text-base">{version.id}</span>
                      <span>{new Date(version.createdAt).toLocaleString('zh-CN')}</span>
                      <span>{version.createdBy}</span>
                      {index === 0 && <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-semibold text-brand">Latest</span>}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
                      <span>{version.nodeCount} {t.nodes}</span>
                      <span>{version.edgeCount} {t.edges}</span>
                      <span>{t.checksum} {version.checksum.slice(0, 8)}</span>
                      <span>{version.warningSummary.unsupportedNodes + version.warningSummary.invalidEdges} {t.warning}</span>
                      {version.restoreSourceVersionId && <span>{t.restoredFrom} {version.restoreSourceVersionId}</span>}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void handleRestoreVersion(version)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border-secondary px-3 text-[12px] font-semibold text-text-secondary transition hover:bg-bg-hover hover:text-text-base"
                    aria-label={`${t.restoreVersion} ${version.id}`}
                  >
                    <IconRefresh className="h-3.5 w-3.5" />
                    {t.restoreVersion}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {activeTab === 'public' ? (
          templatesLoading ? (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              {[0, 1, 2].map((index) => (
                <div key={index} className="cc-skeleton rounded-2xl border border-border-primary p-4" style={{ animationDelay: `${index * 40}ms` }}>
                  <div className="cc-skeleton mb-3 h-24 w-full rounded-xl" />
                  <div className="cc-skeleton mb-2 h-4 w-2/3 rounded-lg" />
                  <div className="cc-skeleton h-3 w-1/2 rounded-lg" />
                </div>
              ))}
            </div>
          ) : templates.length === 0 ? (
            <div className="cc-anim-fade-in flex h-full flex-col items-center justify-center gap-4 py-24">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-bg-hover">
                <IconFolderOpen className="h-8 w-8 text-text-muted" />
              </div>
              <div className="flex flex-col items-center gap-2 text-center">
                <span className="text-[15px] font-semibold text-text-base">{t.noPublicTemplates}</span>
                <span className="max-w-md text-[13px] text-text-muted">{t.noPublicTemplatesHint}</span>
              </div>
              <button
                type="button"
                disabled
                className="inline-flex h-10 items-center rounded-xl border border-border-secondary px-4 text-[14px] font-semibold text-text-muted opacity-60"
              >
                {t.copyTemplate}
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
              {templates.map((template, index) => (
                <div
                  key={template.id}
                  className="group relative rounded-2xl border border-border-primary bg-bg-card p-4 transition-all duration-200 ease-luxury cc-anim-fade-in-up hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-float"
                  style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}
                >
                  <div className="mb-3 flex h-24 w-full items-center justify-center overflow-hidden rounded-xl bg-bg-input">
                    {template.coverAssetId ? (
                      <img
                        src={`cc-asset://asset/${template.coverAssetId}`}
                        alt={`${template.name} \u5c01\u9762`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <IconBox className="h-8 w-8 text-text-muted" />
                    )}
                  </div>
                  <h3 className="mb-2 truncate text-[14px] font-bold text-text-base">{template.name}</h3>
                  {template.description && (
                    <p className="mb-2 line-clamp-2 min-h-8 text-[12px] leading-4 text-text-secondary">{template.description}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-2 text-[12px] text-text-muted">
                    <span>{template.nodeCount} {t.nodes}</span>
                    <span>{template.edgeCount} {t.edges}</span>
                    <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-semibold text-brand">
                      {template.visibility === 'public' ? t.publicVisibility : t.privateVisibility}
                    </span>
                    <span className="rounded-full bg-bg-input px-2 py-0.5 text-[11px] font-semibold text-text-secondary">{template.ownerId}</span>
                  </div>
                  {template.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {template.tags.map((tag) => (
                        <span key={tag} className="rounded-full border border-border-secondary px-2 py-0.5 text-[11px] font-medium text-text-muted">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleCopyTemplate(template)}
                    className="mt-4 inline-flex h-9 items-center rounded-xl bg-brand px-4 text-[13px] font-semibold text-bg-base transition hover:bg-brand-hover"
                    aria-label={`${t.copyTemplate} ${template.name}`}
                  >
                    {t.copyTemplate}
                  </button>
                </div>
              ))}
            </div>
          )
        ) : loading ? (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <div key={index} className="cc-skeleton rounded-2xl border border-border-primary p-4" style={{ animationDelay: `${index * 40}ms` }}>
                <div className="cc-skeleton mb-3 h-24 w-full rounded-xl" />
                <div className="cc-skeleton mb-2 h-4 w-2/3 rounded-lg" />
                <div className="cc-skeleton h-3 w-1/2 rounded-lg" />
              </div>
            ))}
          </div>
        ) : workflows.length === 0 ? (
          <div className="cc-anim-fade-in flex h-full flex-col items-center justify-center gap-4 py-24">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-bg-hover transition-transform duration-300 ease-luxury hover:scale-110">
              <IconFolderOpen className="h-8 w-8 text-text-muted" />
            </div>
            <div className="flex flex-col items-center gap-2">
              <span className="text-[15px] font-semibold text-text-base">{t.emptyTitle}</span>
              <span className="text-[13px] text-text-muted">{t.emptyHint}</span>
            </div>
            <button
              onClick={openCreateDialog}
              className="cc-anim-breathe mt-2 inline-flex h-10 items-center gap-2 rounded-xl bg-brand px-5 text-[14px] font-semibold text-bg-base transition-all duration-200 ease-luxury hover:bg-brand-hover active:scale-95"
            >
              <IconPlus className="h-4 w-4" />
              {t.newProject}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            {workflows.map((workflow, index) => {
              const isRenaming = renamingId === workflow.id
              const isDeleting = deletingId === workflow.id

              return (
                <div
                  key={workflow.id}
                  className={cn(
                    'group relative cursor-pointer rounded-2xl border border-border-primary bg-bg-card p-4 transition-all duration-200 ease-luxury cc-anim-fade-in-up',
                    'hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-float',
                  )}
                  style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}
                  onClick={() => {
                    if (!isRenaming && !isDeleting) {
                      void navigate(`/canvas?id=${workflow.id}`)
                    }
                  }}
                >
                  {isDeleting && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-2xl bg-bg-panel/95 backdrop-blur-sm">
                      <span className="text-[14px] font-medium text-text-base">{t.deleteConfirm}</span>
                      <div className="flex gap-2">
                        <button
                          onClick={(event) => {
                            event.stopPropagation()
                            void handleDelete(workflow.id)
                          }}
                          className="rounded-xl bg-red-500 px-4 py-1.5 text-[13px] font-medium text-white transition hover:bg-red-600"
                        >
                          {t.delete}
                        </button>
                        <button
                          onClick={(event) => {
                            event.stopPropagation()
                            setDeletingId(null)
                          }}
                          className="rounded-xl border border-border-secondary px-4 py-1.5 text-[13px] font-medium text-text-secondary transition hover:bg-bg-hover"
                        >
                          {t.cancel}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="mb-3 flex h-24 w-full items-center justify-center overflow-hidden rounded-xl bg-bg-input">
                    {workflow.coverAssetId ? (
                      <img
                        src={`cc-asset://asset/${workflow.coverAssetId}`}
                        alt={`${workflow.name} \u5c01\u9762`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <IconBox className="h-8 w-8 text-text-muted" />
                    )}
                  </div>

                  {isRenaming ? (
                    <div className="mb-2 flex items-center gap-1.5" onClick={(event) => event.stopPropagation()}>
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(event) => setRenameValue(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') void handleRename(workflow.id)
                          if (event.key === 'Escape') setRenamingId(null)
                        }}
                        className="flex-1 rounded-lg border border-border-secondary bg-bg-base px-2 py-1 text-[14px] font-semibold text-text-base outline-none focus:border-brand"
                      />
                      <button onClick={() => void handleRename(workflow.id)} className="flex h-7 w-7 items-center justify-center rounded-lg text-green-500 transition hover:bg-bg-hover">
                        <IconCheck className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => setRenamingId(null)} className="flex h-7 w-7 items-center justify-center rounded-lg text-text-secondary transition hover:bg-bg-hover">
                        <IconX className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <h3 className="mb-2 truncate text-[14px] font-bold text-text-base">{workflow.name}</h3>
                  )}

                  <div className="flex flex-wrap items-center gap-2 text-[12px] text-text-muted">
                    <span className="inline-flex items-center gap-1">
                      <IconBox className="h-3 w-3" />
                      {workflow.nodeCount} {t.nodes}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      {workflow.edgeCount} {t.edges}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <IconClock className="h-3 w-3" />
                      {formatRelativeTime(workflow.updatedAt)}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-bg-input px-2 py-0.5 text-[11px] font-semibold text-text-secondary">
                      {t.status[workflow.latestRunStatus]}
                    </span>
                    {workflow.archived && (
                      <span className="inline-flex items-center rounded-full bg-bg-input px-2 py-0.5 text-[11px] font-semibold text-text-secondary">
                        {t.archived}
                      </span>
                    )}
                    {countWarnings(workflow) > 0 && (
                      <span className="inline-flex items-center rounded-full bg-red-500/10 px-2 py-0.5 text-[11px] font-semibold text-red-400">
                        {countWarnings(workflow)} {t.warning}
                      </span>
                    )}
                  </div>

                  {!isRenaming && !isDeleting && (
                    <div className="absolute right-3 top-3 flex gap-1 opacity-0 transition group-hover:opacity-100">
                      <button
                        onClick={(event) => {
                          event.stopPropagation()
                          void handleExport(workflow)
                        }}
                        className="flex h-7 items-center justify-center rounded-lg px-2 text-[12px] text-text-secondary transition hover:bg-bg-card hover:text-text-base"
                        aria-label={`${t.exportWorkflow} ${workflow.name}`}
                      >
                        {t.exportWorkflow}
                      </button>
                      <button
                        onClick={(event) => {
                          event.stopPropagation()
                          void openVersionPanel(workflow)
                        }}
                        className="flex h-7 items-center justify-center rounded-lg px-2 text-[12px] text-text-secondary transition hover:bg-bg-card hover:text-text-base"
                        aria-label={`${t.versions} ${workflow.name}`}
                      >
                        <IconHistory className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(event) => {
                          event.stopPropagation()
                          setRenamingId(workflow.id)
                          setRenameValue(workflow.name)
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-text-secondary transition hover:bg-bg-card hover:text-text-base"
                        title={t.rename}
                        aria-label={`${t.rename} ${workflow.name}`}
                      >
                        <IconPencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(event) => {
                          event.stopPropagation()
                          setDeletingId(workflow.id)
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-text-secondary transition hover:bg-bg-card hover:text-red-400"
                        title={t.delete}
                        aria-label={`${t.delete} ${workflow.name}`}
                      >
                        <IconTrash className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
