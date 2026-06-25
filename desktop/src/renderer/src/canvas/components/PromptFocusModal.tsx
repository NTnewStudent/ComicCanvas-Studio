/**
 * PromptFocusModal — 提示词专注模式弹窗
 * Portal 渲染到 body，半透明遮罩，居中大文本域。
 * ESC 关闭，底部确认/取消按钮。
 */
import { type FC, useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { X, Check } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  value: string
  onChange: (value: string) => void
  title?: string
}

const PromptFocusModal: FC<Props> = ({ open, onClose, value, onChange, title = '专注模式' }) => {
  // 本地编辑态，确认时才回写
  const [local, setLocal] = useState(value)

  // 打开时同步外部 value
  useEffect(() => {
    if (open) setLocal(value)
  }, [open, value])

  // ESC 关闭
  useEffect(() => {
    if (!open) return
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  const handleConfirm = useCallback(() => {
    onChange(local)
    onClose()
  }, [local, onChange, onClose])

  if (!open) return null

  return createPortal(
    <div
      className="dark wf-neo fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="relative flex h-[85vh] w-[1200px] max-w-[98vw] flex-col overflow-hidden rounded-2xl bg-bg-card shadow-pop">
        {/* Header */}
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border-secondary px-6">
          <h2 className="text-lg font-bold text-text-base">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-text-muted transition-colors hover:bg-bg-hover hover:text-text-base"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Editor Area */}
        <div className="flex flex-1 flex-col overflow-auto bg-bg-input p-8">
          <textarea
            value={local}
            onChange={(e) => setLocal(e.target.value)}
            placeholder="在此编辑提示词..."
            className="mx-auto h-full w-full max-w-7xl resize-none rounded-xl border border-transparent bg-transparent p-0 text-[15px] font-medium leading-[1.8] text-text-base outline-none placeholder:text-text-muted focus:ring-0"
          />
        </div>

        {/* Footer */}
        <div className="flex h-16 shrink-0 items-center justify-end gap-3 border-t border-border-secondary bg-bg-card px-6">
          <button
            type="button"
            onClick={onClose}
            className="cc-btn-secondary h-9 rounded-lg px-4 text-[13px] font-bold"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            className="cc-btn-primary flex h-9 items-center gap-1.5 rounded-lg px-5 text-[13px] font-bold"
          >
            <Check className="h-4 w-4" />
            确认应用
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default PromptFocusModal
