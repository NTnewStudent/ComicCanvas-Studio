/**
 * Projects list page for workflow-level management.
 * Keeps project creation, rename, deletion, and portable JSON import/export in one local-first surface.
 */
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { IconBox, IconCheck, IconClock, IconFolderOpen, IconPencil, IconPlus, IconTrash, IconX } from '@tabler/icons-react'

import { cn } from '../lib/cn'

interface WorkflowSummary {
  id: string
  name: string
  updatedAt: string
  nodeCount: number
}

const t = {
  title: '\u6211\u7684\u9879\u76ee',
  projectCount: '\u4e2a\u9879\u76ee',
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

export default function ProjectsListPage(): JSX.Element {
  const navigate = useNavigate()
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([])
  const [loading, setLoading] = useState(true)
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

  const fetchWorkflows = useCallback(async () => {
    try {
      setLoading(true)
      const list = await window.comicCanvas.listWorkflows()
      setWorkflows(list)
    } catch {
      setWorkflows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchWorkflows()
  }, [fetchWorkflows])

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
    } catch (error) {
      const message = error instanceof Error ? error.message : t.importFailureFallback
      setWorkflowJsonError(`\u5bfc\u5165\u5931\u8d25\uff1a${message}`)
      setWorkflowJsonStatus(null)
    }
  }, [fetchWorkflows, importName, workflowJson])

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

      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {loading ? (
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
                    <IconBox className="h-8 w-8 text-text-muted" />
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

                  <div className="flex items-center gap-3 text-[12px] text-text-muted">
                    <span className="inline-flex items-center gap-1">
                      <IconBox className="h-3 w-3" />
                      {workflow.nodeCount} {t.nodes}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <IconClock className="h-3 w-3" />
                      {formatRelativeTime(workflow.updatedAt)}
                    </span>
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
                          setRenamingId(workflow.id)
                          setRenameValue(workflow.name)
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-text-secondary transition hover:bg-bg-card hover:text-text-base"
                        title={t.rename}
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
