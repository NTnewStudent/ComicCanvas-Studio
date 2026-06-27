import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

describe('Task 60 Agent plan apply gate', () => {
  it('keeps Agent plan apply/run disabled until Phase A human acceptance', () => {
    const phaseTasks = readFileSync('specs/hjwall-assets-workflows-100-migration/tasks.md', 'utf8')
    const agentRequirements = readFileSync('specs/canvas-agent-orchestration/requirements.md', 'utf8')
    const checklist = readFileSync('docs/progress/human-desktop-review-checklist.md', 'utf8')
    const report = readFileSync('docs/progress/test-report.md', 'utf8')
    const readiness = readFileSync('docs/progress/task-60-agent-plan-apply-readiness.md', 'utf8')

    expect(phaseTasks).toContain('- [ ] 60. Implement Agent plan apply/run over completed workflow vocabulary.')
    expect(phaseTasks).toContain('Blocked: do not implement until `HDR-PHASEA-001` is Pass')
    expect(agentRequirements).toContain('Task 60 may start only after human review pass or explicit product deferral.')
    expect(checklist).toContain('| HDR-050 | Ask Agent for a short comic-drama image-to-video chain with named character and style. | Pending |')
    expect(checklist).toContain('| HDR-051 | Review PlanCard migrated node/action summary and apply the plan. | Pending |')
    expect(report).toContain('Task 60 is blocked and Agent plan apply/run automation remains disabled')
    expect(readiness).toContain('Task 60 is not implemented. Agent plan apply/run automation remains disabled')
    expect(readiness).toContain('Required Reuse Points')
    expect(readiness).toContain('renderer `applyPlan` behavior')
    expect(readiness).toContain('existing `canvas.runNode`, JobQueue, JobWorker')
    expect(readiness).toContain('current `createCanvasTools` descriptors and ToolRuntime structured')
    expect(readiness).toContain('No new Agent-only graph mutation')
    expect(readiness).toContain('Enable MJ planning')
  })
})
