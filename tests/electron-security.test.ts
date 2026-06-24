import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

function listSourceFiles(root: string): string[] {
  return readdirSync(root).flatMap((entry) => {
    const path = join(root, entry)
    const stat = statSync(path)

    if (stat.isDirectory()) {
      return listSourceFiles(path)
    }

    return path
  })
}

describe('Electron renderer security', () => {
  it('keeps BrowserWindow isolation defaults enabled', () => {
    const source = readFileSync('desktop/src/main/index.ts', 'utf8')

    expect(source).toContain('contextIsolation: true')
    expect(source).toContain('nodeIntegration: false')
    expect(source).toContain('sandbox: true')
  })

  it('uses typed preload wrappers instead of exposing raw ipcRenderer', () => {
    const source = readFileSync('desktop/src/preload/index.ts', 'utf8')

    expect(source).toContain('contextBridge.exposeInMainWorld')
    expect(source).toContain('function invokeMain')
    expect(source).not.toContain('ipcRenderer: ipcRenderer')
    expect(source).not.toContain('...ipcRenderer')
    expect(source).not.toContain('send: ipcRenderer.send')
    expect(source).not.toContain('on: ipcRenderer.on')
  })

  it('keeps renderer source free of Electron and Node runtime imports', () => {
    const files = listSourceFiles('desktop/src/renderer/src').filter((file) => /\.(ts|tsx)$/.test(file))

    for (const file of files) {
      const source = readFileSync(file, 'utf8')

      expect(source, `${file} must not import Electron`).not.toMatch(/from ['"]electron['"]/)
      expect(source, `${file} must not import node builtins`).not.toMatch(/from ['"]node:/)
      expect(source, `${file} must not use raw ipcRenderer`).not.toContain('ipcRenderer')
    }
  })
})
