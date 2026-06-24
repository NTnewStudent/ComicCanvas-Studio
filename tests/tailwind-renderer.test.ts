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
})
