import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

import { AGENT_PLAN_AUTO_APPLY_ENABLED, isAgentPlanAutoApplyEnabled } from '../shared/agent-plan-apply'

describe('Task 60 Agent plan apply gate', () => {
  it('implements renderer automation behind the shared gate flag', () => {
    const readiness = readFileSync('docs/progress/task-60-agent-plan-apply-readiness.md', 'utf8')
    const chatPanelSource = readFileSync('desktop/src/renderer/src/chat/ChatPanel.tsx', 'utf8')
    const chatBoxSource = readFileSync('desktop/src/renderer/src/canvas/components/CanvasChatBox.tsx', 'utf8')

    expect(AGENT_PLAN_AUTO_APPLY_ENABLED).toBe(true)
    expect(isAgentPlanAutoApplyEnabled()).toBe(true)
    expect(readiness).toContain('Task 60 is implemented behind `shared/agent-plan-apply.ts`')
    expect(readiness).toContain('createCanvasPlanExecutionController')
    expect(chatPanelSource).toContain('applyAgentPlanOnReady')
    expect(chatBoxSource).toContain('applyAgentPlanOnReady')
  })

  it('records Task 60 reuse points and scope constraints', () => {
    const phaseTasks = readFileSync('specs/hjwall-assets-workflows-100-migration/tasks.md', 'utf8')
    const agentRequirements = readFileSync('specs/canvas-agent-orchestration/requirements.md', 'utf8')
    const readiness = readFileSync('docs/progress/task-60-agent-plan-apply-readiness.md', 'utf8')

    expect(phaseTasks).toContain('- [ ] 60. Implement Agent plan apply/run over completed workflow vocabulary.')
    expect(agentRequirements).toContain('imageRun, videoRun, textPolish')
    expect(readiness).toContain('Required Reuse Points')
    expect(readiness).toContain('renderer `applyPlan` behavior')
    expect(readiness).toContain('existing `canvas.runNode`, JobQueue, JobWorker')
    expect(readiness).toContain('No new Agent-only graph mutation')
    expect(readiness).toContain('MJ remains legacy-known but unavailable')
  })
})
