import { existsSync, readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

describe('infinite canvas architecture note', () => {
  it('records the Phase 11 architecture invariants before implementation work', () => {
    const notePath = 'docs/architecture/infinite-canvas-architecture.md'
    expect(existsSync(notePath)).toBe(true)

    const note = readFileSync(notePath, 'utf8')
    const tasks = readFileSync('specs/hjwall-assets-workflows-100-migration/tasks.md', 'utf8')

    for (const section of [
      '## 图状态归属',
      '## 视口数学',
      '## 虚拟化策略',
      '## 空间索引',
      '## 选择模型',
      '## 小地图',
      '## 持久化与自动保存不变量',
      '## 性能门槛'
    ]) {
      expect(note).toContain(section)
    }

    expect(note).toContain('Zustand 拥有持久化图快照')
    expect(note).toContain('React Flow 拥有瞬态视口手势')
    expect(note).toContain('screenToFlowPosition')
    expect(note).toContain('可见节点查询')
    expect(note).toContain('100、500、1000 节点')
    expect(note).toContain('Phase A 验收门槛')
    expect(note).toContain('Task 61')
    expect(tasks).toContain('- [x] 61. Write infinite canvas architecture note.')
  })
})
