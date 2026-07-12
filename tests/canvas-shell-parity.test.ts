import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const CANVAS_PAGE = 'desktop/src/renderer/src/canvas/CanvasPage.tsx'
const CANVAS_CSS = 'desktop/src/renderer/src/canvas/canvas.css'
const NODE_SIZING = 'desktop/src/renderer/src/canvas/lib/node-sizing.ts'

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

  it('declares wheel, pinch, and double-click zoom on the React Flow canvas', () => {
    const source = readFileSync(CANVAS_PAGE, 'utf8')

    expect(source).toContain('zoomOnScroll')
    expect(source).toContain('zoomOnPinch')
    expect(source).toContain('zoomOnDoubleClick')
    expect(source).toContain('panOnScroll={false}')
  })

  it('defers non-visual work while a node drag is active', () => {
    const source = readFileSync(CANVAS_PAGE, 'utf8')

    expect(source).toContain("import { EMPTY_RELATED_NODE_IDS, projectDisplayNodes } from './lib/display-nodes'")
    expect(source).toContain('const [isDraggingNode, setIsDraggingNode] = useState(false)')
    expect(source).toContain('projectDisplayNodes(rfNodes, isDraggingNode ? EMPTY_RELATED_NODE_IDS : relatedNodeIds)')
    expect(source).toContain('if (isDraggingNode) return')
    expect(source).toContain('{!isDraggingNode && !isViewportMoving && <MiniMap position="bottom-right" pannable zoomable />}')
  })

  it('pauses the minimap while the viewport moves so large graphs keep wheel zoom responsive', () => {
    const source = readFileSync(CANVAS_PAGE, 'utf8')

    expect(source).toContain('const [isViewportMoving, setIsViewportMoving] = useState(false)')
    expect(source).toContain('const handleViewportMoveStart = useCallback(() => {')
    expect(source).toContain('setIsViewportMoving(true)')
    expect(source).toContain('setIsViewportMoving(false)')
    expect(source).toContain('onMoveStart={handleViewportMoveStart}')
    expect(source).toContain('{!isDraggingNode && !isViewportMoving && <MiniMap position="bottom-right" pannable zoomable />}')
  })

  it('does not animate every idle connection handle on a large canvas', () => {
    const css = readFileSync(CANVAS_CSS, 'utf8')

    expect(css).not.toContain('.react-flow__handle-left.connectable {')
    expect(css).toContain('.react-flow__handle.connectingfrom,')
    expect(css).toContain('.react-flow__handle.connectingto {')
  })

  it('surfaces one-shot generation recovery feedback without polling', () => {
    const source = readFileSync(CANVAS_PAGE, 'utf8')

    expect(source).toContain('buildGenerationTaskStatusList(restoredNodes, jobs)')
    expect(source).toContain('setGenerationRecoveryFeedback')
    expect(source).toContain('data-testid="generation-recovery-feedback"')
    expect(source).not.toContain('setInterval')
  })

  it('defines the approved light workbench and compact shared node visual language', () => {
    const css = readFileSync(CANVAS_CSS, 'utf8')
    const sizing = readFileSync(NODE_SIZING, 'utf8')

    expect(css).toContain('--cc-workbench-bg: #f3f5f6')
    expect(css).toContain('--cc-node-border: #d9dee2')
    expect(css).toContain('--cc-node-divider: #eaedef')
    expect(css).toContain('--cc-node-text: #202428')
    expect(css).toContain('--cc-editor-shadow: 0 18px 46px rgba(32, 36, 40, 0.08)')
    expect(css).toContain('border-radius: 8px')
    expect(css).toContain('box-shadow: none')
    expect(css).toContain('width: 10px !important')
    expect(css).toContain('height: 10px !important')
    expect(sizing).toContain("text-[13px] font-semibold")
    expect(sizing).toContain("text-[11px]")
  })
})
