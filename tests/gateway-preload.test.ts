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
    expect(source).not.toContain('ipcRenderer: ipcRenderer')
    expect(source).not.toContain('send: ipcRenderer.send')
  })
})
