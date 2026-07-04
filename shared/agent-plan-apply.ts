/**
 * Agent Plan apply/run automation gate for Task 60.
 * @see docs/progress/task-60-agent-plan-apply-readiness.md
 */

import type { CanvasPlan } from './plan'

/** Task 60 automation is enabled; renderer still requires `autoExecute` or agent `autoRun`. */
export const AGENT_PLAN_AUTO_APPLY_ENABLED = true as const

export interface AgentPlanAutoApplyInput {
  planKind: CanvasPlan['kind']
  /** Chat UI「自动执行」开关。 */
  uiAutoExecute: boolean
  /** Agent `triggerPolicy.autoRun`（计划就绪后自动应用并执行）。 */
  agentAutoRun?: boolean
}

export interface AgentPlanAutoApplyOptions {
  autoExecute: boolean
}

/**
 * Whether Task 60 Agent plan apply/run automation is enabled globally.
 * @returns True when the shared gate allows renderer auto-apply.
 */
export function isAgentPlanAutoApplyEnabled(): boolean {
  return AGENT_PLAN_AUTO_APPLY_ENABLED
}

/**
 * Resolves renderer apply options when a CanvasPlan becomes ready.
 * @param input - Plan kind plus UI and agent auto-run preferences.
 * @returns Apply options when automation should run; otherwise null for manual PlanCard apply.
 */
export function resolveAgentPlanAutoApplyOptions(
  input: AgentPlanAutoApplyInput,
): AgentPlanAutoApplyOptions | null {
  if (!AGENT_PLAN_AUTO_APPLY_ENABLED) {
    return null
  }

  if (input.planKind !== 'plan') {
    return null
  }

  const autoExecute = input.uiAutoExecute || input.agentAutoRun === true
  if (!autoExecute) {
    return null
  }

  return { autoExecute }
}
