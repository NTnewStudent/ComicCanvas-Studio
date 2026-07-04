import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import {
  gatewayToolCallsToAgentCalls,
  loopMessagesToGatewayMessages,
  resolveAgentToolProtocol,
  toolDescriptorsToGatewayTools
} from '../desktop/src/main/lib/agent-gateway-tools'
import type { ToolDescriptor } from '../shared/tools'

const queryGraphDescriptor: ToolDescriptor = {
  id: 'canvas.queryGraph',
  name: 'Query graph',
  description: 'Reads the current canvas graph snapshot.',
  category: 'canvas',
  owner: { kind: 'builtin', id: 'core' },
  inputSchemaRef: 'canvas.queryGraph.input',
  outputSchemaRef: 'canvas.graph.output',
  permissions: [{ kind: 'canvas.read', reason: 'Reads graph.' }],
  concurrency: 'readonly',
  enabled: true,
  inputParametersJsonSchema: { type: 'object', properties: {}, additionalProperties: false }
}

describe('agent-gateway-tools', () => {
  it('selects native protocol only for openai_compat gateways', () => {
    expect(resolveAgentToolProtocol('openai_compat')).toBe('native')
    expect(resolveAgentToolProtocol('stub')).toBe('json')
    expect(resolveAgentToolProtocol(undefined)).toBe('json')
  })

  it('maps tool descriptors and gateway tool calls into Agent loop calls', () => {
    const tools = toolDescriptorsToGatewayTools([queryGraphDescriptor])
    expect(tools[0]?.function.name).toBe('canvas.queryGraph')

    const calls = gatewayToolCallsToAgentCalls([
      {
        id: 'call-1',
        type: 'function',
        function: {
          name: 'canvas.queryGraph',
          arguments: '{}'
        }
      }
    ], new Set(['canvas.queryGraph']))

    expect(calls).toEqual([{ id: 'call-1', toolId: 'canvas.queryGraph', input: {} }])
  })

  it('converts assistant tool calls and tool observations into gateway messages', () => {
    const messages = loopMessagesToGatewayMessages([
      { role: 'system', content: 'system' },
      { role: 'user', content: 'create nodes' },
      {
        role: 'assistant',
        content: 'read graph first',
        toolCalls: [{ id: 'call-1', toolId: 'canvas.queryGraph', input: {} }]
      },
      {
        role: 'tool',
        toolId: 'canvas.queryGraph',
        invocationId: 'call-1',
        status: 'completed',
        content: '{"nodeCount":0}'
      }
    ])

    expect(messages[2]?.tool_calls?.[0]?.function.name).toBe('canvas.queryGraph')
    expect(messages[3]).toMatchObject({
      role: 'tool',
      tool_call_id: 'call-1',
      name: 'canvas.queryGraph'
    })
  })
})
