import { existsSync, readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

describe('M1 Electron skeleton', () => {
  it('registers desktop as a Bun workspace with root dev/build entrypoints', () => {
    const packageJson = JSON.parse(readFileSync('package.json', 'utf8')) as {
      workspaces?: string[]
      scripts?: Record<string, string>
    }

    expect(packageJson.workspaces).toContain('desktop')
    expect(packageJson.scripts?.dev).toBe('bun run rebuild:native && bun run --filter @comic-canvas/desktop dev')
    expect(packageJson.scripts?.test).toBe('bun scripts/run-vitest.mjs run')
    expect(packageJson.scripts?.build).toBe('bun run rebuild:native && bun run --filter @comic-canvas/desktop build && bun node_modules/typescript/bin/tsc -p tsconfig.build.json')
  })

  it('provides main, preload, renderer, and electron-vite entry files', () => {
    for (const filePath of [
      'desktop/package.json',
      'desktop/electron.vite.config.ts',
      'desktop/src/main/index.ts',
      'desktop/src/preload/index.ts',
      'desktop/src/renderer/index.html',
      'desktop/src/renderer/src/main.tsx',
      'desktop/src/renderer/src/App.tsx'
    ]) {
      expect(existsSync(filePath), `${filePath} should exist`).toBe(true)
    }
  })

  it('keeps Electron renderer security defaults in the BrowserWindow skeleton', () => {
    const mainSource = readFileSync('desktop/src/main/index.ts', 'utf8')

    expect(mainSource).toContain('contextIsolation: true')
    expect(mainSource).toContain('nodeIntegration: false')
    expect(mainSource).toContain('sandbox: false')
  })

  it('shows the main window after renderer load even if ready-to-show does not fire', () => {
    const mainSource = readFileSync('desktop/src/main/index.ts', 'utf8')

    expect(mainSource).toContain("window.webContents.once('did-finish-load'")
    expect(mainSource).toContain('window.show()')
  })

  it('uses port 5175 as the renderer dev-server default while still allowing PORT overrides', () => {
    const viteConfig = readFileSync('desktop/electron.vite.config.ts', 'utf8')

    expect(viteConfig).toContain('port: Number(process.env.PORT ?? 5175)')
    expect(viteConfig).not.toContain('port: Number(process.env.PORT ?? 5173)')
  })
})
