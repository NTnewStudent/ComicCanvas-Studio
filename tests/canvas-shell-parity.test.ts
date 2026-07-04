import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const CANVAS_PAGE = 'desktop/src/renderer/src/canvas/CanvasPage.tsx'

describe('Task 20 canvas shell parity', () => {
  it('wires hjwall-style top bar actions into CanvasPage', () => {
    const source = readFileSync(CANVAS_PAGE, 'utf8')

    expect(source).toContain('data-testid="canvas-topbar"')
    expect(source).toContain('aria-label="返回项目"')
    expect(source).toContain('aria-label="导入工作流 JSON"')
    expect(source).toContain('aria-label="导出工作流 JSON"')
    expect(source).toContain('aria-label="保存工作流"')
    expect(source).toContain('aria-label="切换任务状态"')
    expect(source).toContain('aria-label="切换主题"')
    expect(source).toContain('ProjectStyleSelector')
  })

  it('wires hjwall-style left toolbar panels and help affordances into CanvasPage', () => {
    const source = readFileSync(CANVAS_PAGE, 'utf8')

    expect(source).toContain('data-testid="canvas-left-toolbar"')
    expect(source).toContain('aria-label={isAddMenuOpen ? \'关闭添加菜单\' : \'添加节点\'}')
    expect(source).toContain('aria-label="切换资产库"')
    expect(source).toContain('aria-label="切换对话面板"')
    expect(source).toContain('aria-label="切换快捷键帮助"')
    expect(source).toContain('画布快捷键')
    expect(source).toContain('保存工作流')
    expect(source).toContain('命令面板')
  })

  it('keeps viewport controls separate from creation tools', () => {
    const source = readFileSync(CANVAS_PAGE, 'utf8')

    expect(source).toContain('data-testid="canvas-viewport-toolbar"')
    expect(source).toContain('aria-label="适配视图"')
    expect(source).toContain('aria-label="缩小"')
    expect(source).toContain('aria-label="放大"')
    expect(source).toContain('zoomIn()')
    expect(source).toContain('zoomOut()')
  })

  it('surfaces one-shot generation recovery feedback without polling', () => {
    const source = readFileSync(CANVAS_PAGE, 'utf8')

    expect(source).toContain('buildGenerationTaskStatusList(restoredNodes, jobs)')
    expect(source).toContain('setGenerationRecoveryFeedback')
    expect(source).toContain('data-testid="generation-recovery-feedback"')
    expect(source).not.toContain('setInterval')
  })
})
