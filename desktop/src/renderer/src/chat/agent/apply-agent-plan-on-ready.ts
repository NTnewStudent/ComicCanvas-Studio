/**
 * Task 60 helper: auto-apply a ready CanvasPlan through the renderer applyPlan path.
 * @see docs/api-contracts/canvas-plan.md
 */

import { resolveAgentPlanAutoApplyOptions } from '../../../../../../shared/agent-plan-apply'
import type { CanvasPlan } from '../../../../../shared/plan'
import type { ApplyPlanOptions } from '../PlanCard'

export interface ApplyAgentPlanOnReadyInput {
  plan: CanvasPlan
  uiAutoExecute: boolean
  agentAutoRun?: boolean
  applyPlan: (plan: CanvasPlan, options: ApplyPlanOptions) => void
}

/**
 * Applies a ready CanvasPlan when Task 60 automation is enabled and auto-run is requested.
 * @param input - Ready plan, auto-run flags, and renderer apply callback.
 * @returns True when applyPlan was invoked.
 */
export function applyAgentPlanOnReady(input: ApplyAgentPlanOnReadyInput): boolean {
  const options = resolveAgentPlanAutoApplyOptions({
    planKind: input.plan.kind,
    uiAutoExecute: input.uiAutoExecute,
    agentAutoRun: input.agentAutoRun,
  })

  if (!options) {
    return false
  }

  input.applyPlan(input.plan, options)
  return true
}
