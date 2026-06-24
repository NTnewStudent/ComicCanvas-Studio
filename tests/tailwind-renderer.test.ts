import { existsSync, readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

describe('renderer Tailwind foundation', () => {
  it('keeps Tailwind and PostCSS configured for the desktop renderer', () => {
    expect(existsSync('desktop/tailwind.config.ts')).toBe(true)
    expect(existsSync('desktop/postcss.config.js')).toBe(true)

    const tailwindConfig = readFileSync('desktop/tailwind.config.ts', 'utf8')
    expect(tailwindConfig).toContain("content: ['./src/renderer/index.html', './src/renderer/src/**/*.{ts,tsx}']")
    expect(tailwindConfig).toContain("'canvas-surface'")
    expect(tailwindConfig).toContain('withAlpha')
  })

  it('uses Tailwind layers from the renderer stylesheet and exposes a cn helper', () => {
    const stylesheet = readFileSync('desktop/src/renderer/src/styles.css', 'utf8')
    expect(stylesheet).toContain('@tailwind base;')
    expect(stylesheet).toContain('@tailwind components;')
    expect(stylesheet).toContain('@tailwind utilities;')

    const cnHelper = readFileSync('desktop/src/renderer/src/lib/cn.ts', 'utf8')
    expect(cnHelper).toContain('clsx')
    expect(cnHelper).toContain('tailwind-merge')
  })

  it('documents Tailwind and pc-client reuse as the global renderer UI baseline', () => {
    const tasks = readFileSync('specs/milestone-execution-plan/tasks.md', 'utf8')
    const requirements = readFileSync('specs/milestone-execution-plan/requirements.md', 'utf8')
    const pmAgent = readFileSync('.codex/agents/pm-agent.toml', 'utf8')

    expect(tasks).toContain('## Global Frontend UI Baseline')
    expect(tasks).toContain('All renderer UI tasks in M2-M5 must use the desktop Tailwind pipeline')
    expect(tasks).toContain('hjwall/pc-client/src/modules/workflow-canvas/components/CanvasChatBox.tsx')
    expect(requirements).toContain('Renderer UI Reuse Baseline')
    expect(requirements).toContain('Tailwind CSS plus the shared `cn` helper')
    expect(pmAgent).toContain('For every renderer UI requirement')
    expect(pmAgent).toContain('Tailwind CSS, the shared renderer cn helper')
    expect(pmAgent).toContain('hjwall/pc-client reference module')
  })
})
