/**
 * 节点运行状态徽标 — 五态映射
 * idle: 灰色小圆点 | pending: 黄色脉冲 | running: 绿色呼吸光环
 * done: 绿色 checkmark | error: 红色 X（抖动）
 */
import { type FC } from 'react'
import { Check, X, Loader2, Clock } from 'lucide-react'
import { cn } from '../../lib/cn'
import type { NodeStatus } from '../../../../../../shared/nodes'

interface Props {
  status: NodeStatus
  className?: string
}

const RunStatusBadge: FC<Props> = ({ status, className }) => {
  if (status === 'idle') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium',
          'text-text-muted',
          className,
        )}
        title="空闲"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-text-muted" />
        空闲
      </span>
    )
  }

  if (status === 'pending') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium',
          'text-[var(--cc-warning)]',
          className,
        )}
        title="等待中"
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--cc-warning)] opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--cc-warning)]" />
        </span>
        <Clock className="h-3 w-3" />
        等待中
      </span>
    )
  }

  if (status === 'running') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium',
          'text-brand',
          className,
        )}
        title="生成中"
      >
        <span className="cc-generating-ring inline-flex h-2.5 w-2.5 items-center justify-center rounded-full border-2 border-brand">
          <Loader2 className="h-3 w-3 animate-spin" />
        </span>
        生成中
      </span>
    )
  }

  if (status === 'done') {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
          'text-brand',
          className,
        )}
        title="已完成"
      >
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
        已完成
      </span>
    )
  }

  // error
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
        'text-semantic-negative',
        className,
      )}
      title="失败"
    >
      <span className="cc-failed-shake inline-flex items-center rounded-full border border-semantic-negative px-0.5">
        <X className="h-3 w-3" strokeWidth={3} />
      </span>
      失败
    </span>
  )
}

export default RunStatusBadge
