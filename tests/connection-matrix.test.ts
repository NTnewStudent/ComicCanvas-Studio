import { describe, expect, it } from 'vitest'

import { NODE_CONNECTION_MATRIX, canConnect } from '../shared/connection-matrix'
import type { NodeType } from '../shared/nodes'

describe('connection matrix', () => {
  const nodeTypes: NodeType[] = ['text', 'image', 'video', 'imageConfigV2', 'videoConfigV2']

  it('allows only the canonical comic-drama node flow pairs', () => {
    const allowedPairs = new Set([
      'text:image', 'text:video', 'text:imageConfigV2', 'text:videoConfigV2',
      'image:image', 'image:video', 'image:imageConfigV2', 'image:videoConfigV2',
      'video:video',
      'imageConfigV2:image', 'imageConfigV2:video', 'imageConfigV2:imageConfigV2', 'imageConfigV2:videoConfigV2',
      'videoConfigV2:video',
    ])

    for (const source of nodeTypes) {
      for (const target of nodeTypes) {
        expect(canConnect(source, target)).toBe(allowedPairs.has(`${source}:${target}`))
      }
    }
  })

  it('keeps matrix keys aligned with known node types', () => {
    expect(Object.keys(NODE_CONNECTION_MATRIX).sort()).toEqual([...nodeTypes].sort())
  })
})
