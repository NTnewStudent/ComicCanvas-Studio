/**
 * Chip — 芯片按钮组件
 * 用于模型/比例/画风/时长等选项选择，圆角 pill 形态。
 * 基础样式复用 canvas.css 中 `.cc-btn-secondary` 色彩逻辑。
 */
import { type FC, type ReactNode } from 'react'
import { cn } from '../../lib/cn'

interface ChipProps {
  icon?: ReactNode
  label: string
  value?: string
  onClick?: () => void
  active?: boolean
  disabled?: boolean
  className?: string
}

const Chip: FC<ChipProps> = ({ icon, label, value, onClick, active, disabled, className }) => (
  <button
    type="button"
    disabled={disabled}
    data-value={value}
    onClick={onClick}
    className={cn(
      // 基础 pill 形态
      'nodrag flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3',
      'text-[12px] font-semibold transition-all',
      // 默认态
      'border-border-secondary/50 bg-bg-input text-text-secondary hover:bg-bg-hover hover:text-text-base',
      // active 态：品牌色边框 + 淡底
      active && 'border-brand/30 bg-success-subtle text-brand',
      // disabled 态
      disabled && 'pointer-events-none opacity-45',
      className,
    )}
  >
    {icon && <span className="flex items-center opacity-80">{icon}</span>}
    <span className="max-w-[150px] truncate">{label}</span>
  </button>
)

export default Chip
