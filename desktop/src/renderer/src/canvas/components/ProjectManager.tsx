/**
 * 画布项目管理器组件
 * - 工作流列表展示（卡片网格）
 * - 新建/重命名/删除工作流
 * - 切换工作流
 * @see REQ-077
 */

import { useCallback, useEffect, useState } from 'react'
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  FolderOpen,
  Clock,
  Box,
} from 'lucide-react'

interface WorkflowSummary {
  id: string
  name: string
  updatedAt: string
  nodeCount: number
}

interface ProjectManagerProps {
  currentWorkflowId: string
  onSwitchWorkflow: (workflowId: string, workflowName: string) => void
  onClose: () => void
}

function formatRelativeTime(isoString: string): string {
  const date = new Date(isoString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return '刚刚'
  if (diffMin < 60) return `${diffMin} 分钟前`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour} 小时前`
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 7) return `${diffDay} 天前`
  return date.toLocaleDateString('zh-CN')
}

export function ProjectManager({
  currentWorkflowId,
  onSwitchWorkflow,
  onClose,
}: ProjectManagerProps): JSX.Element {
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [newName, setNewName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchWorkflows = useCallback(async () => {
    try {
      setLoading(true)
      const list = await window.comicCanvas.listWorkflows()
      setWorkflows(list)
    } catch {
      // Silently handle error
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchWorkflows()
  }, [fetchWorkflows])

  const handleCreate = useCallback(async () => {
    const name = newName.trim() || '未命名工作流'
    try {
      const result = await window.comicCanvas.createWorkflow({ name })
      setNewName('')
      setShowCreateDialog(false)
      await fetchWorkflows()
      onSwitchWorkflow(result.id, result.name)
    } catch {
      // Silently handle error
    }
  }, [newName, fetchWorkflows, onSwitchWorkflow])

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
        // Silently handle error
      }
    },
    [renameValue, fetchWorkflows],
  )

  const handleDelete = useCallback(
    async (workflowId: string) => {
      try {
        await window.comicCanvas.deleteWorkflow({ workflowId })
        setDeletingId(null)
        await fetchWorkflows()
      } catch {
        // Silently handle error
      }
    },
    [fetchWorkflows],
  )

  const startRename = useCallback((wf: WorkflowSummary) => {
    setRenamingId(wf.id)
    setRenameValue(wf.name)
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="flex h-[520px] w-[640px] flex-col rounded-2xl border border-border-primary bg-bg-panel shadow-pop">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border-secondary px-6 py-4">
          <div className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-brand" />
            <h2 className="text-[16px] font-semibold text-text-base">项目管理</h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition hover:bg-bg-hover hover:text-text-base"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Actions bar */}
        <div className="flex items-center justify-between px-6 py-3">
          <span className="text-[13px] text-text-muted">
            {workflows.length} 个项目
          </span>
          <button
            onClick={() => setShowCreateDialog(true)}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand px-3 text-[13px] font-semibold text-bg-base transition hover:bg-brand-hover"
          >
            <Plus className="h-3.5 w-3.5" />
            新建项目
          </button>
        </div>

        {/* Create dialog inline */}
        {showCreateDialog && (
          <div className="mx-6 mb-3 flex items-center gap-2 rounded-xl border border-border-secondary bg-bg-surface p-3">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate()
                if (e.key === 'Escape') {
                  setShowCreateDialog(false)
                  setNewName('')
                }
              }}
              placeholder="输入项目名称…"
              className="flex-1 rounded-lg border border-border-secondary bg-bg-base px-3 py-2 text-[13px] text-text-base outline-none placeholder:text-text-muted focus:border-brand"
            />
            <button
              onClick={handleCreate}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand text-bg-base transition hover:bg-brand-hover"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                setShowCreateDialog(false)
                setNewName('')
              }}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-text-secondary transition hover:bg-bg-hover"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Workflow grid */}
        <div className="flex-1 overflow-y-auto px-6 pb-4">
          {loading ? (
            <div className="flex h-full items-center justify-center">
              <span className="text-[13px] text-text-muted">加载中…</span>
            </div>
          ) : workflows.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-3">
              <FolderOpen className="h-10 w-10 text-text-muted" />
              <span className="text-[13px] text-text-muted">暂无项目，点击上方按钮新建</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {workflows.map((wf) => {
                const isCurrent = wf.id === currentWorkflowId
                const isRenaming = renamingId === wf.id
                const isDeleting = deletingId === wf.id

                return (
                  <div
                    key={wf.id}
                    className={`group relative cursor-pointer rounded-xl border p-4 transition-all ${
                      isCurrent
                        ? 'border-brand bg-brand/5 ring-1 ring-brand/20'
                        : 'border-border-secondary bg-bg-surface hover:border-border-primary hover:bg-bg-hover'
                    }`}
                    onClick={() => {
                      if (!isRenaming && !isDeleting) {
                        onSwitchWorkflow(wf.id, wf.name)
                      }
                    }}
                  >
                    {/* Delete confirm overlay */}
                    {isDeleting && (
                      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 rounded-xl bg-bg-panel/95 backdrop-blur-sm">
                        <span className="text-[13px] font-medium text-text-base">确定删除？</span>
                        <div className="flex gap-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(wf.id)
                            }}
                            className="rounded-lg bg-red-500 px-3 py-1 text-[12px] font-medium text-white transition hover:bg-red-600"
                          >
                            删除
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setDeletingId(null)
                            }}
                            className="rounded-lg border border-border-secondary px-3 py-1 text-[12px] font-medium text-text-secondary transition hover:bg-bg-hover"
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Name */}
                    {isRenaming ? (
                      <div className="mb-2 flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleRename(wf.id)
                            if (e.key === 'Escape') setRenamingId(null)
                          }}
                          className="flex-1 rounded border border-border-secondary bg-bg-base px-2 py-1 text-[14px] font-semibold text-text-base outline-none focus:border-brand"
                        />
                        <button
                          onClick={() => handleRename(wf.id)}
                          className="flex h-6 w-6 items-center justify-center rounded text-green-400 transition hover:bg-bg-hover"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setRenamingId(null)}
                          className="flex h-6 w-6 items-center justify-center rounded text-text-secondary transition hover:bg-bg-hover"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <h3 className="mb-2 truncate text-[14px] font-semibold text-text-base">
                        {wf.name}
                      </h3>
                    )}

                    {/* Meta */}
                    <div className="flex items-center gap-3 text-[12px] text-text-muted">
                      <span className="inline-flex items-center gap-1">
                        <Box className="h-3 w-3" />
                        {wf.nodeCount} 节点
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {formatRelativeTime(wf.updatedAt)}
                      </span>
                    </div>

                    {/* Current badge */}
                    {isCurrent && (
                      <span className="absolute right-3 top-3 rounded-full bg-brand/10 px-2 py-0.5 text-[11px] font-medium text-brand">
                        当前
                      </span>
                    )}

                    {/* Action buttons */}
                    {!isRenaming && !isDeleting && (
                      <div className="absolute right-3 top-3 flex gap-1 opacity-0 transition group-hover:opacity-100">
                        {!isCurrent && (
                          <>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                startRename(wf)
                              }}
                              className="flex h-6 w-6 items-center justify-center rounded text-text-secondary transition hover:bg-bg-hover hover:text-text-base"
                              title="重命名"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                setDeletingId(wf.id)
                              }}
                              className="flex h-6 w-6 items-center justify-center rounded text-text-secondary transition hover:bg-bg-hover hover:text-red-400"
                              title="删除"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
