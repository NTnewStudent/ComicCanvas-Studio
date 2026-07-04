import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { enrichToolDescriptorWithInputSchema, zodInputSchemaToJson } from '../desktop/src/main/lib/tool-schema'
import type { ToolDescriptor } from '../shared/tools'

describe('tool-schema', () => {
  it('exports Zod input schemas as JSON Schema with field descriptions', () => {
    const schema = z.object({
      nodeId: z.string().describe('Canvas node ID.'),
      offset: z.number().optional().describe('Optional offset.')
    })

    const json = zodInputSchemaToJson(schema)

    expect(json.type).toBe('object')
    expect((json.properties as Record<string, { description?: string }>).nodeId?.description).toBe('Canvas node ID.')
  })

  it('enriches tool descriptors for tool.list responses', () => {
    const descriptor: ToolDescriptor = {
      id: 'canvas.queryGraph',
      name: 'Query Canvas Graph',
      description: 'Reads graph.',
      category: 'canvas',
      owner: { kind: 'builtin', id: 'core' },
      inputSchemaRef: 'canvas.queryGraph.input',
      outputSchemaRef: 'canvas.graph.output',
      permissions: [],
      concurrency: 'readonly',
      enabled: true
    }

    const enriched = enrichToolDescriptorWithInputSchema(descriptor, z.object({}))

    expect(enriched.inputParametersJsonSchema).toMatchObject({
      type: 'object'
    })
  })
})
