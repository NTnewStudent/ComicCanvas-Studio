/**
 * 项目列表页 — /projects
 *
 * 展示用户所有工作流项目，支持新建项目并进入画布。
 * 参考 hjwall WorkflowProjectsPage 卡片风格。
 */
import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, Box, Clock, FolderOpen, X, Check, Trash2, Pencil } from 'lucide-react'

interface WorkflowSummary {
  id: string
  name: string
  updatedAt: string
  nodeCount: number
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

export default function ProjectsListPage(): JSX.Element {
  const navigate = useNavigate()
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
      // silently handle
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchWorkflows()
  }, [fetchWorkflows])

  const handleCreate = useCallback(async () => {
    const name = newName.trim() || '未命名项目'
    try {
      const result = await window.comicCanvas.createWorkflow({ name })
      setNewName('')
      setShowCreateDialog(false)
      navigate(`/canvas?id=${result.id}`)
    } catch {
      // silently handle
    }
  }, [newName, navigate])

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
        // silently handle
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
        // silently handle
      }
    },
    [fetchWorkflows],
  )

  const openCreateDialog = () => {
    setNewName('')
    setShowCreateDialog(true)
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-6 pt-6 pb-4">
        <div className="flex items-center gap-3">
          <FolderOpen className="h-5 w-5 text-brand" />
          <h1 className="text-xl font-bold text-text-base">我的项目</h1>
          <span className="text-[13px] text-text-muted">
            {workflows.length} 个项目
          </span>
        </div>
        <button
          onClick={openCreateDialog}
          className="cc-btn-primary inline-flex h-9 items-center gap-1.5 rounded-xl bg-brand px-4 text-[13px] font-semibold text-bg-base transition hover:bg-brand-hover"
        >
          <Plus className="h-4 w-4" />
          新建项目
        </button>
      </div>

      {/* Create dialog */}
      {showCreateDialog && (
        <div className="mx-6 mb-4 flex items-center gap-2 rounded-2xl border border-border-secondary bg-bg-surface p-4">
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
            className="flex-1 rounded-xl border border-border-secondary bg-bg-base px-4 py-2.5 text-[14px] text-text-base outline-none placeholder:text-text-muted focus:border-brand"
          />
          <button
            onClick={handleCreate}
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-bg-base transition hover:bg-brand-hover"
          >
            <Check className="h-4 w-4" />
          </button>
          <button
            onClick={() => {
              setShowCreateDialog(false)
              setNewName('')
            }}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-text-secondary transition hover:bg-bg-hover"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {loading ? (
          <div className="flex h-full items-center justify-center">
            <span className="text-[13px] text-text-muted">加载中…</span>
          </div>
        ) : workflows.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-4 py-24">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-bg-hover">
              <FolderOpen className="h-8 w-8 text-text-muted" />
            </div>
            <div className="flex flex-col items-center gap-2">
              <span className="text-[15px] font-semibold text-text-base">还没有项目</span>
              <span className="text-[13px] text-text-muted">点击"新建项目"开始创作</span>
            </div>
            <button
              onClick={openCreateDialog}
              className="mt-2 inline-flex h-10 items-center gap-2 rounded-xl bg-brand px-5 text-[14px] font-semibold text-bg-base transition hover:bg-brand-hover"
            >
              <Plus className="h-4 w-4" />
              新建项目
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            {workflows.map((wf) => {
              const isRenaming = renamingId === wf.id
              const isDeleting = deletingId === wf.id

              return (
                <div
                  key={wf.id}
                  className="group relative cursor-pointer rounded-2xl border border-border-primary bg-bg-card p-4 transition-all hover:bg-bg-hover hover:border-border-primary hover:shadow-sm"
                  onClick={() => {
                    if (!isRenaming && !isDeleting) {
                      navigate(`/canvas?id=${wf.id}`)
                    }
                  }}
                >
                  {/* Delete confirm overlay */}
                  {isDeleting && (
                    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 rounded-2xl bg-bg-panel/95 backdrop-blur-sm">
                      <span className="text-[14px] font-medium text-text-base">确定删除此项目？</span>
                      <div className="flex gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(wf.id)
                          }}
                          className="rounded-xl bg-red-500 px-4 py-1.5 text-[13px] font-medium text-white transition hover:bg-red-600"
                        >
                          删除
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setDeletingId(null)
                          }}
                          className="rounded-xl border border-border-secondary px-4 py-1.5 text-[13px] font-medium text-text-secondary transition hover:bg-bg-hover"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Cover placeholder */}
                  <div className="mb-3 flex h-24 w-full items-center justify-center overflow-hidden rounded-xl bg-bg-input">
                    <Box className="h-8 w-8 text-text-muted" />
                  </div>

                  {/* Name */}
                  {isRenaming ? (
                    <div
                      className="mb-2 flex items-center gap-1.5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRename(wf.id)
                          if (e.key === 'Escape') setRenamingId(null)
                        }}
                        className="flex-1 rounded-lg border border-border-secondary bg-bg-base px-2 py-1 text-[14px] font-semibold text-text-base outline-none focus:border-brand"
                      />
                      <button
                        onClick={() => handleRename(wf.id)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-green-500 transition hover:bg-bg-hover"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setRenamingId(null)}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-text-secondary transition hover:bg-bg-hover"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <h3 className="mb-2 truncate text-[14px] font-bold text-text-base">
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

                  {/* Action buttons */}
                  {!isRenaming && !isDeleting && (
                    <div className="absolute right-3 top-3 flex gap-1 opacity-0 transition group-hover:opacity-100">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setRenamingId(wf.id)
                          setRenameValue(wf.name)
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-text-secondary transition hover:bg-bg-card hover:text-text-base"
                        title="重命名"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeletingId(wf.id)
                        }}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-text-secondary transition hover:bg-bg-card hover:text-red-400"
                        title="删除"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
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
