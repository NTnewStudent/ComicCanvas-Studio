/**
 * CanvasPlan preview card for the renderer chat panel.
 * @see docs/api-contracts/canvas-plan.md
 */

import { AlertTriangle, Check, Play, Sparkles } from 'lucide-react'

import type { CanvasPlan } from '../../../../../shared/plan'
import type { NodeType } from '../../../../../shared/nodes'
import type { RunAction } from '../../../../../shared/plan'
import { cn } from '../lib/cn'

export interface ApplyPlanOptions {
  autoExecute: boolean
}

export interface PlanCardProps {
  plan: CanvasPlan
  autoExecute: boolean
  onAutoExecuteChange: (value: boolean) => void
  onApplyPlan: (plan: CanvasPlan, options: ApplyPlanOptions) => void
}

function planCounts(plan: CanvasPlan): string[] {
  return [`${plan.nodes.length} 个节点`, `${plan.edges.length} 条边`, `${plan.runSteps.length} 个运行步骤`]}

const NODE_LABELS: Partial<Record<NodeType, string>> = {
  text: '文本',
  image: '图片',
  video: '视频',
  character: '角色',
  scene: '场景',
  audio: '音频',
  imageConfigV2: '生图配置',
  videoConfigV2: '视频配置',
  videoCompose: '视频合成',
  superResolution: '超分',
  muxAudioVideo: '音视频合成',
  mjImage: 'MJ 出图',
}

const ACTION_LABELS: Partial<Record<RunAction, string>> = {
  imageRun: '图片生成',
  videoRun: '视频生成',
  textPolish: '文本润色',
}

function uniqueLabels(values: string[]): string[] {
  return Array.from(new Set(values)).filter(Boolean)
}

function planNodeLabels(plan: CanvasPlan): string[] {
  return uniqueLabels(plan.nodes.map((node) => NODE_LABELS[node.type] ?? node.type))
}

function planActionLabels(plan: CanvasPlan): string[] {
  return uniqueLabels(plan.runSteps.map((step) => ACTION_LABELS[step.action] ?? step.action))
}

function planSummaryLabels(plan: CanvasPlan): string[] {
  return uniqueLabels([...planNodeLabels(plan), ...planActionLabels(plan)])
}

/**
 * Renders a sanitized CanvasPlan summary and apply controls.
 * @param props - Plan, auto-execute state, and apply handlers.
 * @returns Plan preview card.
 * @throws Error never intentionally; user actions are reported via callbacks.
 * @see docs/api-contracts/canvas-plan.md
 */
export function PlanCard({ plan, autoExecute, onAutoExecuteChange, onApplyPlan }: PlanCardProps): JSX.Element {
  const isClarify = plan.kind === 'clarify'
  const isGeneralAnswer = isClarify && plan.summary.includes('普通问题')

  return (
    <article className="rounded-xl border border-border-secondary bg-bg-card p-4 shadow-card" aria-label="画布计划预览">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border-secondary bg-bg-input text-brand">
          {isClarify ? <AlertTriangle className="h-4 w-4" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="m-0 text-[13px] font-semibold uppercase text-text-muted">
              {isGeneralAnswer ? 'Agent 回复' : isClarify ? '澄清请求' : '画布计划'}
            </p>
            {!isClarify && (
              <span className="inline-flex items-center gap-1 rounded-pill border border-border-secondary px-2 py-0.5 text-[12px] text-semantic-success">
                <Check className="h-3 w-3" aria-hidden="true" />
                已净化
              </span>
            )}
          </div>
          <p className="mt-2 text-[14px] leading-relaxed text-text-base">{isClarify ? plan.question : plan.summary}</p>
          {!isClarify && (
            <div className="mt-3 flex flex-wrap gap-2">
              {planCounts(plan).map((count) => (
                <span key={count} className="rounded-pill bg-bg-input px-2.5 py-1 text-[12px] text-text-secondary">
                  {count}
                </span>
              ))}
            </div>
          )}
          {!isClarify && (
            <div className="mt-3 flex flex-wrap gap-2" aria-label="计划节点和运行摘要">
              {planSummaryLabels(plan).map((label) => (
                <span key={label} className="rounded-lg border border-border-secondary px-2 py-1 text-[12px] text-text-secondary">
                  {label}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {plan.dropped.length > 0 && (
        <div className="mt-3 rounded-lg border border-semantic-warning/40 bg-bg-input px-3 py-2 text-[12px] text-text-secondary">
          {plan.dropped.length} 项在计划净化过程中被丢弃
        </div>
      )}

      {!isClarify && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] text-text-secondary">
            <input
              type="checkbox"
              role="switch"
              aria-label="自动执行计划运行步骤"
              checked={autoExecute}
              onChange={(event) => onAutoExecuteChange(event.currentTarget.checked)}
              className="h-4 w-4 accent-brand"
            />
            自动执行
          </label>
          <button
            type="button"
            className={cn(
              'inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-3 text-[13px] font-semibold text-bg-base',
              'transition-transform duration-200 ease-luxury hover:bg-brand-hover active:scale-[0.98]'
            )}
            aria-label="应用计划"
            onClick={() => onApplyPlan(plan, { autoExecute })}
          >
            <Play className="h-4 w-4" aria-hidden="true" />
            应用计划
          </button>
        </div>
      )}
    </article>
  )
}
