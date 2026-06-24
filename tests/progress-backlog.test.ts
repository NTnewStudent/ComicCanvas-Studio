import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

describe('M0 progress reconciliation', () => {
  it('marks evidence-backed M0 tasks complete in the canonical backlog', () => {
    const backlog = readFileSync('docs/progress/backlog.md', 'utf8')

    expect(backlog).toContain('| REQ-008 | `shared/composed-prompt.ts` 确定性 prompt 拼接纯函数 | ✅ |')
    expect(backlog).toContain('| REQ-009 | LTM 初始化（ltm/bin/ltm.py selftest 通过） | ✅ |')
    expect(backlog).toContain('| REQ-019 | `docs/api-contracts/*` 模块契约拆分登记（jobs/assets/gateway/tools/agents/skills/knowledge/audit） | ✅ |')
  })

  it('marks milestone M0 backlog reconciliation complete', () => {
    const milestoneTasks = readFileSync('specs/milestone-execution-plan/tasks.md', 'utf8')

    expect(milestoneTasks).toContain('- [x] 4. Reconcile M0 backlog status.')
  })
})
