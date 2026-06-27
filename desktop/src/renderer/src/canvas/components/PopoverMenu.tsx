/**
 * PopoverMenu — 弹出选择菜单
 * 点击 trigger 展开/收起，absolute 定位在 trigger 下方。
 * 选中项高亮，点击外部关闭，ESC 关闭。
 * 参考 hjwall PopoverMenu（portal + fixed 定位）。
 */
import { type ReactNode, useState, useRef, useEffect, useCallback, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { Check } from 'lucide-react'
import { cn } from '../../lib/cn'

interface PopoverMenuItem<T> {
  value: T
  label: string
  icon?: ReactNode
}

interface PopoverMenuProps<T> {
  trigger: ReactNode
  items: PopoverMenuItem<T>[]
  selected?: T
  onSelect: (value: T) => void
  className?: string
}

function PopoverMenuInner<T>({
  trigger,
  items,
  selected,
  onSelect,
  className,
}: PopoverMenuProps<T>): JSX.Element {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number; flipUp: boolean } | null>(null)

  const toggle = useCallback(() => setOpen((v) => !v), [])
  const close = useCallback(() => setOpen(false), [])

  // 计算菜单位置（fixed 定位，跟随 anchor）
  useLayoutEffect(() => {
    if (!open) return
    const update = (): void => {
      const rect = triggerRef.current?.getBoundingClientRect()
      if (!rect) return
      const spaceBelow = window.innerHeight - rect.bottom
      const flipUp = spaceBelow < 220 && rect.top > spaceBelow
      setPos({
        top: flipUp ? rect.top : rect.bottom + 4,
        left: rect.left + rect.width / 2,
        flipUp,
      })
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [open])

  // 点击外部 / ESC 关闭
  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: MouseEvent): void => {
      const target = e.target as Node
      if (menuRef.current?.contains(target) || triggerRef.current?.contains(target)) return
      close()
    }
    const onKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open, close])

  const handleSelect = useCallback(
    (value: T) => {
      onSelect(value)
      close()
    },
    [onSelect, close],
  )

  return (
    <div className={cn('relative inline-flex', className)}>
      {/* Trigger */}
      <div ref={triggerRef} onClick={toggle} className="cursor-pointer">
        {trigger}
      </div>

      {/* Menu portal */}
      {open &&
        pos &&
        createPortal(
          <div
            ref={menuRef}
            className="dark wf-neo nodrag nowheel fixed z-[9999] min-w-[180px] max-w-[300px] overflow-hidden rounded-xl border border-border-primary bg-bg-panel py-1.5 shadow-[0_15px_45px_rgba(0,0,0,0.18)]"
            style={{
              top: pos.top,
              left: pos.left,
              transform: pos.flipUp
                ? 'translateX(-50%) translateY(-100%)'
                : 'translateX(-50%)',
            }}
          >
            {items.map((item) => {
              const isSelected = selected === item.value
              return (
                <button
                  key={String(item.value)}
                  type="button"
                  onClick={() => handleSelect(item.value)}
                  className={cn(
                    'flex w-full items-center justify-between border-none bg-transparent px-3 py-2 text-[12px] text-text-secondary transition-colors hover:bg-bg-hover hover:text-text-base',
                    isSelected && 'bg-success-subtle text-brand',
                  )}
                >
                  {item.icon && <span className="flex h-4 w-4 shrink-0 items-center">{item.icon}</span>}
                  <span className="flex-1 truncate">{item.label}</span>
                  {isSelected && <Check className="h-3.5 w-3.5 shrink-0" strokeWidth={3} />}
                </button>
              )
            })}
          </div>,
          document.body,
        )}
    </div>
  )
}

// 导出泛型组件需要类型断言，保持 FC 签名
const PopoverMenu = PopoverMenuInner

export default PopoverMenu
