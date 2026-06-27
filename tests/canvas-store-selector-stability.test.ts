import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const canvasRendererFiles = [
  'desktop/src/renderer/src/canvas/CanvasPage.tsx',
  'desktop/src/renderer/src/canvas/nodes/ImageConfigV2Node.tsx',
  'desktop/src/renderer/src/canvas/nodes/VideoConfigV2Node.tsx',
]

describe('canvas store selector stability', () => {
  it('does not return newly-created functions from Zustand selectors', () => {
    const unstableSelector = /useStore\(\s*canvasStore\s*,\s*\([^)]*\)\s*=>\s*\([^)]*\)\s*=>/u
    const offenders = canvasRendererFiles.filter((file) => unstableSelector.test(readFileSync(file, 'utf8')))

    expect(offenders).toEqual([])
  })
})
