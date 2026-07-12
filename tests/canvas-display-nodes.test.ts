import { describe, expect, it } from 'vitest'

import { projectDisplayNodes } from '../desktop/src/renderer/src/canvas/lib/display-nodes'

type TestNode = {
  id: string
  className?: string
}

function createNodes(count: number): TestNode[] {
  return Array.from({ length: count }, (_, index) => ({ id: `node-${index}` }))
}

describe('canvas display node projection', () => {
  it('keeps 1,999 of 2,000 node references stable when one related node is highlighted', () => {
    const nodes = createNodes(2_000)
    const projected = projectDisplayNodes(nodes, new Set(['node-1000']))

    expect(projected).toHaveLength(2_000)
    expect(projected[1000]).not.toBe(nodes[1000])
    expect(projected[1000]).toMatchObject({ id: 'node-1000', className: 'cc-flow-node-related' })
    expect(projected.filter((node, index) => node === nodes[index])).toHaveLength(1_999)
  })

  it('returns the original array when there are no related nodes to decorate', () => {
    const nodes = createNodes(2_000)

    expect(projectDisplayNodes(nodes, new Set())).toBe(nodes)
  })
})
