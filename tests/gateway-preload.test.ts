import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

describe('M3 gateway preload bridge', () => {
  it('exposes typed gateway settings actions without raw ipcRenderer access', () => {
    const source = readFileSync('desktop/src/preload/index.ts', 'utf8')

    expect(source).toContain('listGateways')
    expect(source).toContain("invokeMain('gateway.list'")
    expect(source).toContain("invokeMain('gateway.save'")
    expect(source).toContain("invokeMain('gateway.delete'")
    expect(source).toContain("invokeMain('gateway.test'")
    expect(source).toContain('reloadGateways')
    expect(source).toContain("invokeMain('gateway.reload'")
    expect(source).toContain('sendCanvasChat')
    expect(source).toContain("invokeMain('canvas.chatSend'")
    expect(source).toContain('getCanvasPlan')
    expect(source).toContain("invokeMain('canvas.chatGetPlan'")
    expect(source).toContain('listAgents')
    expect(source).toContain("invokeMain('agent.list'")
    expect(source).toContain('saveAgent')
    expect(source).toContain("invokeMain('agent.save'")
    expect(source).toContain('deleteAgent')
    expect(source).toContain("invokeMain('agent.delete'")
    expect(source).toContain('listTools')
    expect(source).toContain("invokeMain('tool.list'")
    expect(source).toContain('enableTool')
    expect(source).toContain("invokeMain('tool.enable'")
    expect(source).toContain('disableTool')
    expect(source).toContain("invokeMain('tool.disable'")
    expect(source).toContain('invokeTool')
    expect(source).toContain("invokeMain('tool.invoke'")
    expect(source).not.toContain('ipcRenderer: ipcRenderer')
    expect(source).not.toContain('send: ipcRenderer.send')
  })
})
