import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { AGENT_PLAN_AUTO_APPLY_ENABLED, isAgentPlanAutoApplyEnabled } from '../shared/agent-plan-apply'

describe('Task 60 Agent plan apply gate', () => {
  it('implements renderer automation behind the shared gate flag', () => {
    const readiness = readFileSync('docs/progress/task-60-agent-plan-apply-readiness.md', 'utf8')
    const chatStoreSource = readFileSync('desktop/src/renderer/src/chat/store/chat.store.ts', 'utf8')
    const chatPanelSource = readFileSync('desktop/src/renderer/src/chat/ChatPanel.tsx', 'utf8')
    const chatBoxSource = readFileSync('desktop/src/renderer/src/canvas/components/CanvasChatBox.tsx', 'utf8')

    expect(AGENT_PLAN_AUTO_APPLY_ENABLED).toBe(true)
    expect(isAgentPlanAutoApplyEnabled()).toBe(true)
    expect(readiness).toContain('Task 60 已在 `shared/agent-plan-apply.ts` 背后实现')
    expect(readiness).toContain('createCanvasPlanExecutionController')
    // Task 60 自动 apply 判定统一收敛到共享 chat store，两个聊天入口都消费它。
    expect(chatStoreSource).toContain('applyAgentPlanOnReady')
    expect(chatPanelSource).toContain('createChatStore')
    expect(chatBoxSource).toContain('createChatStore')
  })

  it('records Task 60 reuse points and scope constraints', () => {
    const phaseTasks = readFileSync('specs/hjwall-assets-workflows-100-migration/tasks.md', 'utf8')
    const agentRequirements = readFileSync('specs/canvas-agent-orchestration/requirements.md', 'utf8')
    const readiness = readFileSync('docs/progress/task-60-agent-plan-apply-readiness.md', 'utf8')

    expect(phaseTasks).toContain('- [x] 60. Implement Agent plan apply/run over completed workflow vocabulary.')
    expect(agentRequirements).toContain('imageRun, videoRun, textPolish')
    expect(readiness).toContain('必须复用的现有能力')
    expect(readiness).toContain('渲染层 `applyPlan` 行为')
    expect(readiness).toContain('现有的 `canvas.runNode`、JobQueue、JobWorker')
    expect(readiness).toContain('任何新的仅供 Agent 使用的图变更')
    expect(readiness).toContain('MJ 仍作为已知的旧版功能保留，但不可用。')
  })
})
