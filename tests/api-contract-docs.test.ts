import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const requiredContractDocs = [
  'canvas-plan.md',
  'jobs.md',
  'assets-files.md',
  'gateway-providers.md',
  'tools-plugins.md',
  'agents.md',
  'skills.md',
  'knowledge-context.md',
  'audit-observability.md',
  'storage-config.md'
]

const requiredSections = [
  '## Owner',
  '## Scope',
  '## Request/Response Contracts',
  '## Errors',
  '## Permissions',
  '## Tests'
]

const requiredSectionsByDoc: Record<string, string[]> = {
  'tools-plugins.md': ['## Owner', '## Scope', '## 请求/响应契约', '## 错误', '## 权限', '## 测试']
}

describe('foundation API contract docs', () => {
  it('provides the full M0 contract set with required sections', () => {
    for (const docName of requiredContractDocs) {
      const filePath = join('docs', 'api-contracts', docName)

      expect(existsSync(filePath), `${docName} should exist`).toBe(true)

      const content = readFileSync(filePath, 'utf8')
      const sections = requiredSectionsByDoc[docName] ?? requiredSections

      for (const section of sections) {
        expect(content, `${docName} should include ${section}`).toContain(section)
      }
    }
  })

  it('documents Phase A asset category, upload progress, and reference boundaries', () => {
    const content = readFileSync(join('docs', 'api-contracts', 'assets-files.md'), 'utf8')

    expect(content).toContain('内置的起始图片分类 SHALL 为角色、场景、道具与生物。')
    expect(content).toContain('资产分类的指定 SHALL 保留底层资产记录')
    expect(content).toContain('blockingReferences: AssetReference[]')
    expect(content).toContain('资产的创建/更新/回收/墓碑化变更 SHALL 通过 `asset.changed` IPC 事件发出。')
    expect(content).toContain('渲染层的上传进度 SHALL 建模为本地多文件导入状态')
    expect(content).toContain('不引入 `asset.uploadProgress` IPC 通道')
  })
})
