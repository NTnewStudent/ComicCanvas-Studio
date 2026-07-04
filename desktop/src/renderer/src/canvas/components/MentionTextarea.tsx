/**
 * MentionTextarea — 支持 `@` 提及的文本框
 *
 * 核心行为：
 * - textarea 输入框
 * - 输入 `@` 时弹出提及候选列表（PopoverMenu 风格 portal）
 * - 选中提及项后插入 `[nodeId|name]` token
 * - 显示已提及的 token 列表（带删除按钮）
 * - 选中 mention 时回调 `onMentionSelect`（用于自动创建连线）
 * - mention 列表变化时回调 `onMentionsChange`（用于清理被删除引用的连线）
 *
 * 底层存储格式 `[nodeId|name]`，纯 textarea 方案（非 contentEditable）。
 */
import {
  type FC,
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from 'react'
import { createPortal } from 'react-dom'
import { AtSign, X as XIcon } from 'lucide-react'
import { cn } from '../../lib/cn'

export interface MentionTarget {
  id: string
  name: string
  type: string
}

interface Props {
  value: string
  onChange: (value: string) => void
  ariaLabel?: string
  placeholder?: string
  mentionTargets?: MentionTarget[]
  onMentionChange?: (mentions: string[]) => void
  className?: string
  rows?: number
  /** 当前节点的 ID（作为连线的 source） */
  sourceNodeId?: string
  /** 当选中一个 mention 时回调（用于自动创建连线） */
  onMentionSelect?: (mentionedNodeId: string, sourceNodeId: string) => void
  /** 当 mention 列表变化时回调（用于清理被删除引用的连线） */
  onMentionsChange?: (currentMentionIds: string[], sourceNodeId: string) => void
}

/** 从 value 中提取所有 `[id|name]` token */
export function extractMentionTokens(value: string): { id: string; name: string }[] {
  const results: { id: string; name: string }[] = []
  const re = /\[([^\]|]+)\|([^\]]+)\]/g
  let m: RegExpExecArray | null
  while ((m = re.exec(value)) !== null) {
    results.push({ id: m[1]!, name: m[2]! })
  }
  return results
}

/** Removes all occurrences of one mention token while preserving surrounding text. */
export function removeMentionToken(value: string, id: string): string {
  const re = new RegExp(`\\[${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\|[^\\]]+\\]\\s?`, 'g')
  return value.replace(re, '')
}

/** 从光标前文本解析活跃 @ 引用：`@query` */
function parseActiveMention(text: string, cursorPos: number): { start: number; query: string } | null {
  const before = text.slice(0, cursorPos)
  const m = /@([^\s@[\]]*)$/.exec(before)
  if (!m) return null
  return { start: m.index, query: m[1]! }
}

const MentionTextarea: FC<Props> = ({
  value,
  onChange,
  ariaLabel,
  placeholder,
  mentionTargets = [],
  onMentionChange,
  className,
  rows = 3,
  sourceNodeId,
  onMentionSelect,
  onMentionsChange,
}) => {
  const taRef = useRef<HTMLTextAreaElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const [mentionCtx, setMentionCtx] = useState<{ start: number; query: string } | null>(null)
  const [activeIdx, setActiveIdx] = useState(0)
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null)
  const [isComposing, setIsComposing] = useState(false)

  // 过滤候选列表
  const candidates = useMemo(() => {
    if (!mentionCtx) return []
    const q = mentionCtx.query.toLowerCase()
    return mentionTargets.filter((t) => t.name.toLowerCase().includes(q))
  }, [mentionCtx, mentionTargets])

  const open = mentionCtx !== null

  // 当前已提及的 token
  const mentions = useMemo(() => extractMentionTokens(value), [value])

  // 通知 mention 变化（onMentionChange + onMentionsChange）
  useEffect(() => {
    const ids = mentions.map((m) => m.id)
    onMentionChange?.(ids)
    if (sourceNodeId) {
      onMentionsChange?.(ids, sourceNodeId)
    }
  }, [mentions, onMentionChange, onMentionsChange, sourceNodeId])

  // 计算下拉位置
  useEffect(() => {
    if (!open) {
      setDropdownPos(null)
      return
    }
    const ta = taRef.current
    if (!ta) return
    const rect = ta.getBoundingClientRect()
    setDropdownPos({
      top: rect.bottom + 4,
      left: rect.left,
    })
  }, [open, mentionCtx?.query, candidates.length])

  // 点击外部关闭
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent): void => {
      const target = e.target as Node
      if (dropdownRef.current?.contains(target) || taRef.current?.contains(target)) return
      setMentionCtx(null)
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [open])

  // 选中候选项
  const selectCandidate = useCallback(
    (target: MentionTarget) => {
      if (!mentionCtx) return
      const ta = taRef.current
      if (!ta) return

      const token = `[${target.id}|${target.name}]`
      const before = value.slice(0, mentionCtx.start)
      const after = value.slice(ta.selectionStart)
      const newValue = before + token + ' ' + after
      onChange(newValue)
      setMentionCtx(null)

      // 通知上层选中了一个 mention（用于自动创建连线）
      if (sourceNodeId) {
        onMentionSelect?.(target.id, sourceNodeId)
      }

      // 恢复焦点并移动光标到 token 后面
      requestAnimationFrame(() => {
        if (ta) {
          ta.focus()
          const newPos = (before + token + ' ').length
          ta.setSelectionRange(newPos, newPos)
        }
      })
    },
    [mentionCtx, value, onChange, sourceNodeId, onMentionSelect],
  )

  // 删除提及 token
  const removeMention = useCallback(
    (id: string) => {
      const newValue = removeMentionToken(value, id)
      onChange(newValue)
      // onMentionsChange 会在 useEffect 中由 mentions 变化自动触发
    },
    [value, onChange],
  )

  // textarea 输入处理
  const handleInput = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = e.target.value
      onChange(newValue)
      if (isComposing) return
      const cursorPos = e.target.selectionStart
      const ctx = parseActiveMention(newValue, cursorPos)
      setMentionCtx(ctx)
      setActiveIdx(0)
    },
    [isComposing, onChange],
  )

  // 键盘导航
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (!open) return

      if (e.key === 'ArrowDown') {
        e.preventDefault()
        if (candidates.length > 0) setActiveIdx((i) => (i + 1) % candidates.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        if (candidates.length > 0) setActiveIdx((i) => (i - 1 + candidates.length) % candidates.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        if (candidates.length > 0) {
          const c = candidates[activeIdx]
          if (c) selectCandidate(c)
        }
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        setMentionCtx(null)
        return
      }
    },
    [open, candidates, activeIdx, selectCandidate],
  )

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      {/* Textarea */}
      <div className="relative">
        <textarea
          ref={taRef}
          aria-label={ariaLabel}
          value={value}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => {
            setIsComposing(true)
            setMentionCtx(null)
          }}
          onCompositionEnd={(event) => {
            setIsComposing(false)
            const cursorPos = event.currentTarget.selectionStart
            setMentionCtx(parseActiveMention(event.currentTarget.value, cursorPos))
          }}
          placeholder={placeholder ?? '输入提示词，使用 @ 引用节点...'}
          rows={rows}
          className={cn(
            'w-full resize-none rounded-lg border border-border-secondary bg-bg-input px-3 py-2',
            'text-[12px] leading-normal text-text-base',
            'outline-none transition-colors',
            'placeholder:text-text-muted',
            'focus:border-brand/40 focus:ring-1 focus:ring-brand/20',
          )}
        />
      </div>

      {/* 已提及 token 列表 */}
      {mentions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {mentions.map((m) => (
            <span
              key={m.id}
              className="inline-flex items-center gap-1 rounded-full bg-success-subtle px-2 py-0.5 text-[11px] font-medium text-brand"
            >
              <AtSign className="h-3 w-3" />
              <span>{`@${m.name}`}</span>
              <button
                type="button"
                aria-label={`删除提及 ${m.name}`}
                onClick={() => removeMention(m.id)}
                className="ml-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full transition-colors hover:bg-brand/30"
              >
                <XIcon className="h-2.5 w-2.5" strokeWidth={3} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* 候选下拉（Portal） */}
      {open &&
        dropdownPos &&
        createPortal(
          <div
            ref={dropdownRef}
            role="listbox"
            aria-label="提及候选"
            className="dark wf-neo nodrag nowheel fixed z-[9999] w-[220px] max-h-[200px] overflow-y-auto rounded-xl border border-border-primary bg-bg-panel py-1.5 shadow-[0_15px_45px_rgba(0,0,0,0.18)]"
            style={{ top: dropdownPos.top, left: dropdownPos.left }}
          >
            <div className="px-3 pb-1 text-[11px] font-bold uppercase tracking-wider text-text-muted">
              引用节点
            </div>
            {candidates.length === 0 ? (
              <div className="px-3 py-2 text-[12px] text-text-muted">无匹配节点</div>
            ) : (
              candidates.map((candidate, i) => (
                <button
                  key={candidate.id}
                  type="button"
                  role="option"
                  aria-label={`${candidate.name} ${candidate.type}`}
                  aria-selected={i === activeIdx}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    selectCandidate(candidate)
                  }}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={cn(
                    'flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] transition-colors',
                    i === activeIdx
                      ? 'bg-success-subtle text-brand'
                      : 'text-text-secondary hover:bg-bg-hover hover:text-text-base',
                  )}
                >
                  <AtSign className="h-3.5 w-3.5 shrink-0 text-text-muted" />
                  <span className="truncate">{candidate.name}</span>
                  <span className="ml-auto text-[10px] text-text-muted">{candidate.type}</span>
                </button>
              ))
            )}
          </div>,
          document.body,
        )}
    </div>
  )
}

export default MentionTextarea
