/**
 * 声明式 Canvas Plan 类型 — orchestrator-agent 产出，清洗后落画布
 * @see docs/api-contracts/canvas-plan.md
 */

import type { NodeType, EdgeType, ImageRole, Orientation } from './nodes'

/** Plan 执行动作白名单 */
export type RunAction =
  | 'imageRun'
  | 'videoRun'
  | 'textPolish'

export interface PlanNode {
  /** Plan 内部引用 ID */
  ref: string
  type: NodeType
  title: string
  data: {
    promptOverride?: string
    modelId?: string
    orientation?: Orientation
    durationSeconds?: number
    [key: string]: unknown
  }
}

export interface PlanEdge {
  source: string   // ref
  target: string   // ref
  edgeType: EdgeType
  imageRole?: ImageRole
}

export interface PlanRunStep {
  ref: string
  action: RunAction
}

export interface CanvasPlan {
  kind: 'plan' | 'clarify'
  summary: string
  nodes: PlanNode[]
  edges: PlanEdge[]
  runSteps: PlanRunStep[]
  /** kind==='clarify' 时非空 */
  question: string | null
  /** 清洗时剔除的非法项说明 */
  dropped: string[]
}
