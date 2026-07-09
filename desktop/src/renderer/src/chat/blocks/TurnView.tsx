/**
 * 回合渲染器 — 按 blocks 顺序渲染一个 ChatTurn 的全部消息块。
 *
 * plan 块通过 `renderPlan` 插槽渲染（宿主注入 PlanCard 及 apply 行为），
 * 保持块组件库与画布执行逻辑解耦。
 *
 * @see docs/api-contracts/agents.md
 */

import type { ReactNode } from 'react'

import type { ChatBlock, ChatTurn } from '../../../../../../shared/chat-blocks'
import { cn } from '../../lib/cn'
import { ErrorBlock } from './ErrorBlock'
import { PermissionBlock } from './PermissionBlock'
import { TextBlock } from './TextBlock'
import { ThinkingBlock } from './ThinkingBlock'
import { ToolCallBlock } from './ToolCallBlock'
import { UsageFooter } from './UsageFooter'

export interface TurnViewProps {
  turn: ChatTurn
  /** plan 块渲染插槽：宿主返回 PlanCard 等元素。缺省渲染占位提示。 */
  renderPlan?: ((planId: string) => ReactNode) | undefined
  onApprovePermission?: ((callId: string) => void) | undefined
  onDenyPermission?: ((callId: string) => void) | undefined
  permissionBusy?: boolean | undefined
}

function blockKey(block: ChatBlock, index: number): string {
  if (block.kind === 'toolCall' || block.kind === 'permission') {
    return `${block.kind}-${block.callId}`
  }
  if (block.kind === 'plan') {
    return `plan-${block.planId}`
  }
  return `${block.kind}-${index}`
}

/**
 * 渲染一个会话回合。
 * @param props - 回合数据、plan 插槽与权限回调。
 * @returns 回合元素。
 */
export function TurnView({ turn, renderPlan, onApprovePermission, onDenyPermission, permissionBusy }: TurnViewProps): JSX.Element {
  const live = turn.status === 'pending' || turn.status === 'streaming'

  return (
    <div className={cn('flex flex-col gap-1.5', turn.role === 'user' ? 'items-end' : 'items-start')}>
      {turn.blocks.map((block, index) => {
        const key = blockKey(block, index)

        switch (block.kind) {
          case 'text':
            return <TextBlock key={key} markdown={block.markdown} streaming={block.streaming} role={turn.role} />
          case 'thinking':
            return <ThinkingBlock key={key} lines={block.lines} live={live} />
          case 'toolCall':
            return <ToolCallBlock key={key} block={block} />
          case 'plan':
            return (
              <div key={key} className="w-full">
                {renderPlan ? renderPlan(block.planId) : (
                  <p className="m-0 rounded-lg bg-bg-card px-3 py-2 text-[13px] text-text-secondary">计划已就绪：{block.planId}</p>
                )}
              </div>
            )
          case 'permission':
            return (
              <PermissionBlock
                key={key}
                block={block}
                busy={permissionBusy}
                onApprove={onApprovePermission}
                onDeny={onDenyPermission}
              />
            )
          case 'error':
            return <ErrorBlock key={key} block={block} />
          case 'usage':
            return <UsageFooter key={key} summary={block.summary} />
        }
      })}
    </div>
  )
}
