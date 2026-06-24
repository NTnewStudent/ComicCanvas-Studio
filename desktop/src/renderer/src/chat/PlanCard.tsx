/**
 * CanvasPlan preview card for the renderer chat panel.
 * @see docs/api-contracts/canvas-plan.md
 */

import { AlertTriangle, Check, Play, Sparkles } from 'lucide-react'

import type { CanvasPlan } from '../../../../../shared/plan'
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
  return [`${plan.nodes.length} nodes`, `${plan.edges.length} edges`, `${plan.runSteps.length} run steps`]
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

  return (
    <article className="rounded-xl border border-border-secondary bg-bg-card p-4 shadow-card" aria-label="Canvas plan preview">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border-secondary bg-bg-input text-brand">
          {isClarify ? <AlertTriangle className="h-4 w-4" aria-hidden="true" /> : <Sparkles className="h-4 w-4" aria-hidden="true" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="m-0 text-[13px] font-semibold uppercase text-text-muted">{isClarify ? 'Clarify request' : 'Canvas Plan'}</p>
            {!isClarify && (
              <span className="inline-flex items-center gap-1 rounded-pill border border-border-secondary px-2 py-0.5 text-[12px] text-semantic-success">
                <Check className="h-3 w-3" aria-hidden="true" />
                sanitized
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
        </div>
      </div>

      {plan.dropped.length > 0 && (
        <div className="mt-3 rounded-lg border border-semantic-warning/40 bg-bg-input px-3 py-2 text-[12px] text-text-secondary">
          {plan.dropped.length} item dropped during plan sanitization
        </div>
      )}

      {!isClarify && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] text-text-secondary">
            <input
              type="checkbox"
              role="switch"
              aria-label="Auto execute plan run steps"
              checked={autoExecute}
              onChange={(event) => onAutoExecuteChange(event.currentTarget.checked)}
              className="h-4 w-4 accent-brand"
            />
            Auto execute
          </label>
          <button
            type="button"
            className={cn(
              'inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-3 text-[13px] font-semibold text-[#06070a]',
              'transition-transform duration-200 ease-luxury hover:bg-brand-hover active:scale-[0.98]'
            )}
            aria-label="Apply plan"
            onClick={() => onApplyPlan(plan, { autoExecute })}
          >
            <Play className="h-4 w-4" aria-hidden="true" />
            Apply plan
          </button>
        </div>
      )}
    </article>
  )
}
