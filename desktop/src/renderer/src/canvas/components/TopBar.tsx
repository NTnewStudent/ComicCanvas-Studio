import { useCallback, useEffect, useRef, useState, type ChangeEvent, type KeyboardEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  IconArrowLeft,
  IconArrowBackUp,
  IconArrowForwardUp,
  IconPlayerPlay,
  IconDeviceFloppy,
  IconCheck,
  IconLoader2,
  IconChevronDown,
  IconUpload,
  IconDownload,
  IconListDetails,
  IconMoon,
  IconSun,
  IconMaximize,
  IconSearch,
} from '@tabler/icons-react'

import type { CanvasSnippetView } from '../../../../../../shared/snippets'
import type { ThemePreference } from '../../stores/useThemeStore'
import { ProjectStyleSelector } from './ProjectStyleSelector'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

export interface TopBarProps {
  workflowId: string
  workflowName: string
  onRename: (name: string) => void | Promise<void>
  onOpenProjectManager: () => void
  onUndo: () => void
  canUndo: boolean
  onRedo: () => void
  canRedo: boolean
  importInputRef: React.RefObject<HTMLInputElement>
  onImportFileChange: (event: ChangeEvent<HTMLInputElement>) => void
  onImport: () => void
  onExport: () => void
  onSave: () => void
  saveStatus: SaveStatus
  onSaveSnippet: () => void
  canSaveSnippet: boolean
  snippets: CanvasSnippetView[]
  selectedSnippetId: string
  onSelectSnippet: (id: string) => void
  onInsertSnippet: () => void
  onRunAll: () => void
  onRunSelected: () => void
  showJobPanel: boolean
  onToggleJobPanel: () => void
  jobCount: number
  themePreference: ThemePreference
  onToggleTheme: () => void
  focusMode: boolean
  onToggleFocusMode: () => void
  onOpenCommandPalette: () => void
}

function toolbarButtonBase(className = ''): string {
  return `inline-flex h-8 items-center gap-1.5 rounded-full border border-border-secondary bg-bg-card px-3 text-[13px] font-medium text-text-secondary transition-all duration-200 ease-luxury hover:bg-bg-hover hover:text-text-base active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${className}`.trim()
}

function iconButtonBase(className = ''): string {
  return `inline-flex h-8 w-8 items-center justify-center rounded-full text-text-secondary transition-all duration-200 ease-luxury hover:bg-bg-hover hover:text-text-base active:scale-90 ${className}`.trim()
}

/**
 * Cinematic canvas top bar.
 * @param props - Toolbar actions and state wired by CanvasPage.
 * @returns The canvas header component.
 * @see docs/api-contracts/canvas-plan.md
 */
export function TopBar(props: TopBarProps): JSX.Element {
  const {
    workflowId,
    workflowName,
    onRename,
    onOpenProjectManager,
    onUndo,
    canUndo,
    onRedo,
    canRedo,
    importInputRef,
    onImportFileChange,
    onImport,
    onExport,
    onSave,
    saveStatus,
    onSaveSnippet,
    canSaveSnippet,
    snippets,
    selectedSnippetId,
    onSelectSnippet,
    onInsertSnippet,
    onRunAll,
    onRunSelected,
    showJobPanel,
    onToggleJobPanel,
    jobCount,
    themePreference,
    onToggleTheme,
    focusMode,
    onToggleFocusMode,
    onOpenCommandPalette,
  } = props

  const [isEditingName, setIsEditingName] = useState(false)
  const [editName, setEditName] = useState(workflowName)
  const nameInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (isEditingName) {
      nameInputRef.current?.focus()
      nameInputRef.current?.select()
    }
  }, [isEditingName])

  const commitRename = useCallback(async () => {
    const trimmed = editName.trim()
    if (!trimmed || trimmed === workflowName) {
      setEditName(workflowName)
      setIsEditingName(false)
      return
    }
    try {
      await onRename(trimmed)
      setIsEditingName(false)
    } catch {
      setEditName(workflowName)
      setIsEditingName(false)
    }
  }, [editName, workflowName, onRename])

  const cancelRename = useCallback(() => {
    setEditName(workflowName)
    setIsEditingName(false)
  }, [workflowName])

  const handleNameKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        void commitRename()
      } else if (event.key === 'Escape') {
        event.preventDefault()
        cancelRename()
      }
    },
    [commitRename, cancelRename],
  )

  const saveLabel =
    saveStatus === 'saving'
      ? '保存中...'
      : saveStatus === 'saved'
        ? '已保存'
        : saveStatus === 'error'
          ? '保存失败'
          : '保存'

  return (
    <header
      data-testid="canvas-topbar"
      className="flex h-14 shrink-0 items-center justify-between border-b border-border-subtle bg-bg-topbar px-5 shadow-float"
    >
      <div className="flex items-center gap-3">
        <Link
          to="/projects"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border-secondary bg-bg-card text-text-secondary shadow-sm transition-all duration-200 ease-luxury hover:bg-bg-hover hover:text-text-base active:scale-90"
          aria-label="返回项目"
          title="返回项目"
        >
          <IconArrowLeft className="h-4 w-4" />
        </Link>

        {isEditingName ? (
          <input
            ref={nameInputRef}
            value={editName}
            onChange={(event) => setEditName(event.target.value)}
            onBlur={() => void commitRename()}
            onKeyDown={handleNameKeyDown}
            className="h-8 rounded-md border border-border-secondary bg-bg-input px-2 text-[15px] font-semibold text-text-base outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
            aria-label="编辑工作流名称"
          />
        ) : (
          <button
            onClick={onOpenProjectManager}
            onDoubleClick={() => setIsEditingName(true)}
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[15px] font-semibold text-text-base transition-all duration-200 ease-luxury hover:bg-bg-hover active:scale-95"
            aria-label="打开工作流切换器"
            title="双击可重命名"
          >
            {workflowName}
            <IconChevronDown className="h-3.5 w-3.5 text-text-muted" />
          </button>
        )}

        <span className="inline-flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 px-2.5 py-1 text-[11px] font-semibold text-brand">
          <span className="h-1.5 w-1.5 rounded-full bg-brand" />
          画布项目
        </span>

        <ProjectStyleSelector workflowId={workflowId} />
      </div>

      <div className="flex items-center gap-2">
        <input
          ref={importInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(event) => void onImportFileChange(event)}
          aria-label="工作流 JSON 文件"
        />

        <button
          type="button"
          onClick={onUndo}
          disabled={!canUndo}
          className={toolbarButtonBase()}
          aria-label="撤销"
          title="撤销"
        >
          <IconArrowBackUp className="h-3.5 w-3.5" />
          撤销
        </button>

        <button
          type="button"
          onClick={onRedo}
          disabled={!canRedo}
          className={toolbarButtonBase()}
          aria-label="重做"
          title="重做"
        >
          <IconArrowForwardUp className="h-3.5 w-3.5" />
          重做
        </button>

        <span className="h-5 w-px bg-border-secondary" />

        <button
          type="button"
          onClick={onImport}
          className={toolbarButtonBase()}
          aria-label="导入工作流 JSON"
          title="导入工作流 JSON"
        >
          <IconUpload className="h-3.5 w-3.5" />
          导入
        </button>

        <button
          type="button"
          onClick={onExport}
          className={toolbarButtonBase()}
          aria-label="导出工作流 JSON"
          title="导出工作流 JSON"
        >
          <IconDownload className="h-3.5 w-3.5" />
          导出
        </button>

        <button
          type="button"
          onClick={() => void onSave()}
          className={toolbarButtonBase()}
          aria-label="保存工作流"
          title={saveLabel}
        >
          {saveStatus === 'saving' ? (
            <>
              <IconLoader2 className="h-3.5 w-3.5 animate-spin" />
              保存中...
            </>
          ) : saveStatus === 'saved' ? (
            <>
              <IconCheck className="h-3.5 w-3.5 text-semantic-success" />
              <span className="text-semantic-success">已保存</span>
            </>
          ) : saveStatus === 'error' ? (
            <>
              <IconDeviceFloppy className="h-3.5 w-3.5 text-semantic-negative" />
              <span className="text-semantic-negative">保存失败</span>
            </>
          ) : (
            <>
              <IconDeviceFloppy className="h-3.5 w-3.5" />
              保存
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onSaveSnippet}
          disabled={!canSaveSnippet}
          className="inline-flex h-8 items-center rounded-lg border border-border-secondary bg-bg-card px-3 text-[13px] font-medium text-text-secondary transition-all duration-200 ease-luxury hover:bg-bg-hover hover:text-text-base active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="保存片段"
          title={canSaveSnippet ? '保存选中节点为片段' : '请选择至少两个节点'}
        >
          保存片段
        </button>

        <select
          value={selectedSnippetId}
          onChange={(event) => onSelectSnippet(event.target.value)}
          className="h-8 max-w-[180px] rounded-lg border border-border-secondary bg-bg-card px-2 text-[13px] font-medium text-text-secondary outline-none transition-all duration-200 ease-luxury hover:bg-bg-hover hover:text-text-base"
          aria-label="片段库"
        >
          {snippets.length === 0 ? (
            <option value="">暂无片段</option>
          ) : (
            snippets.map((snippet) => (
              <option key={snippet.id} value={snippet.id}>
                {snippet.name} ({snippet.nodeCount})
              </option>
            ))
          )}
        </select>

        <button
          type="button"
          onClick={onInsertSnippet}
          disabled={!selectedSnippetId}
          className="inline-flex h-8 items-center rounded-lg border border-border-secondary bg-bg-card px-3 text-[13px] font-medium text-text-secondary transition-all duration-200 ease-luxury hover:bg-bg-hover hover:text-text-base active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="插入片段"
        >
          插入片段
        </button>

        <button
          type="button"
          onClick={onRunSelected}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-brand/30 bg-brand/10 px-3 text-[13px] font-semibold text-brand transition-all duration-200 ease-luxury hover:bg-brand/20 active:scale-95"
          aria-label="运行选中"
          title="运行选中"
        >
          <IconPlayerPlay className="h-3.5 w-3.5" />
          运行选中
        </button>

        <button
          type="button"
          onClick={onRunAll}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand px-3 text-[13px] font-semibold text-bg-base transition-all duration-200 ease-luxury hover:bg-brand-hover active:scale-95"
          aria-label="运行全部"
        >
          <IconPlayerPlay className="h-3.5 w-3.5" />
          运行全部
        </button>

        <button
          type="button"
          onClick={onToggleJobPanel}
          className={toolbarButtonBase(
            showJobPanel
              ? 'border-brand/30 bg-brand/10 text-brand hover:bg-brand/20'
              : '',
          )}
          aria-label="切换任务状态"
          title="运行任务"
        >
          <IconListDetails className="h-3.5 w-3.5" />
          运行任务
          {jobCount > 0 && (
            <span className="ml-0.5 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-bg-base">
              {jobCount > 99 ? '99+' : jobCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={onOpenCommandPalette}
          className={iconButtonBase()}
          aria-label="打开命令面板"
          title="命令面板"
        >
          <IconSearch className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={onToggleFocusMode}
          className={iconButtonBase(
            focusMode
              ? 'bg-brand text-bg-base hover:bg-brand-hover hover:text-bg-base'
              : '',
          )}
          aria-label={focusMode ? '退出专注模式' : '进入专注模式'}
          title={focusMode ? '退出专注模式' : '进入专注模式'}
        >
          <IconMaximize className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={onToggleTheme}
          className={iconButtonBase()}
          aria-label="切换主题"
          title={themePreference === 'dark' ? '切换到亮色' : '切换到暗色'}
        >
          {themePreference === 'dark' ? (
            <IconSun className="h-4 w-4" />
          ) : (
            <IconMoon className="h-4 w-4" />
          )}
        </button>
      </div>
    </header>
  )
}
