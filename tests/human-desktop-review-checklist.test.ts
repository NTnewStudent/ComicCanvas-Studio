import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

describe('human desktop review checklist', () => {
  it('covers every Phase A assets/workflows migration review area', () => {
    const checklist = readFileSync('docs/progress/human-desktop-review-checklist.md', 'utf8')

    const requiredRows = [
      'HDR-ASSET-001',
      'HDR-ASSET-009',
      'HDR-WF-006',
      'HDR-CANVAS-005',
      'HDR-NODE-002',
      'HDR-RUNTIME-002',
      'HDR-TOOLS-001',
      'HDR-PHASEA-001'
    ]

    for (const rowId of requiredRows) {
      expect(checklist, `${rowId} row`).toContain(`| ${rowId} |`)
    }

    expect(checklist).toContain('人工 Phase A 验收矩阵')
    expect(checklist).toContain('资产与自定义图片分类')
    expect(checklist).toContain('项目/模板与片段（snippets）')
    expect(checklist).toContain('画布外壳与迁移后的非 MJ 节点')
    expect(checklist).toContain('运行时、风格、模型与工具等价性')
    expect(checklist).toContain('Agent 自动化仍不在 Phase A 范围内')
    expect(checklist).toContain('MJ 节点/组件相关操作被排除在人工 Phase A 验收之外')
  })
})
