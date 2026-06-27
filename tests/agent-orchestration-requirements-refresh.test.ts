import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

describe('Agent orchestration requirements refresh after Phase A', () => {
  it('keeps future Agent planning aligned with the migrated canvas vocabulary and Phase A gate', () => {
    const requirements = readFileSync('specs/canvas-agent-orchestration/requirements.md', 'utf8')
    const design = readFileSync('specs/canvas-agent-orchestration/design.md', 'utf8')
    const tasks = readFileSync('specs/canvas-agent-orchestration/tasks.md', 'utf8')
    const toolsAgents = readFileSync('docs/api-contracts/tools-agents.md', 'utf8')

    for (const content of [requirements, design, tasks, toolsAgents]) {
      expect(content).toContain('Phase A acceptance gate')
      expect(content).toContain('HDR-PHASEA-001')
      expect(content).toContain('text, image, video, imageConfigV2, videoConfigV2, character, scene, audio, videoCompose, superResolution, muxAudioVideo')
      expect(content).toContain('MJ is legacy-known but unavailable')
      expect(content).toContain('promptOrder, imageOrder, imageRole, outputLink, reference, default')
      expect(content).toContain('clarify branches')
      expect(content).toContain('dropped warnings')
    }

    expect(requirements).toContain('REQ-A59')
    expect(design).toContain('Agent Vocabulary Refresh')
    expect(design).toContain('Task 60 Readiness Gate')
    expect(tasks).toContain('- [x] A59. Reopen Agent orchestration requirements after manual parity gate.')
    expect(tasks).toContain('docs/progress/task-60-agent-plan-apply-readiness.md')
    expect(toolsAgents).toContain('Task 60 preflight: `docs/progress/task-60-agent-plan-apply-readiness.md`')
  })
})
