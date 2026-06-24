import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

const nodeFiles = [
  'desktop/src/renderer/src/canvas/nodes/TextNode.tsx',
  'desktop/src/renderer/src/canvas/nodes/ImageNode.tsx',
  'desktop/src/renderer/src/canvas/nodes/VideoNode.tsx'
]

describe('M2 NodeResizer integration', () => {
  it('uses @xyflow/react NodeResizer in text, image, and video canvas nodes', () => {
    for (const file of nodeFiles) {
      const source = readFileSync(file, 'utf8')
      expect(source).toContain("from '@xyflow/react'")
      expect(source).toContain('<NodeResizer')
      expect(source).toContain('NODE_RESIZER_CLASS_NAMES')
    }
  })
})
