import { describe, expect, it } from 'vitest'

import { NODE_CONNECTION_MATRIX, canConnect } from '../shared/connection-matrix'
import type { NodeType } from '../shared/nodes'

describe('connection matrix', () => {
  const nodeTypes: NodeType[] = ['text', 'image', 'video']

  it('allows only the canonical comic-drama node flow pairs', () => {
    const allowedPairs = new Set(['text:image', 'text:video', 'image:image', 'image:video', 'video:video'])

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
