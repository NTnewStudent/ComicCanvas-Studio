import { describe, expect, it } from 'vitest'

import {
  gatewayToolCallsToAgentCalls,
  loopMessagesToGatewayMessages,
  resolveAgentToolProtocol,
  toolDescriptorsToGatewayTools
} from '../desktop/src/main/lib/agent-gateway-tools'
import type { ToolDescriptor } from '../shared/tools'

const OPENAI_TOOL_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/

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

const webSearchDescriptor: ToolDescriptor = {
  ...queryGraphDescriptor,
  id: 'web.search',
  name: 'Web search',
  description: 'Searches the web.',
  category: 'web',
  inputSchemaRef: 'web.search.input',
  outputSchemaRef: 'web.search.output',
  permissions: [{ kind: 'network', reason: 'Searches the web.' }]
}

const fsReadDescriptor: ToolDescriptor = {
  ...queryGraphDescriptor,
  id: 'fs.read',
  name: 'Read file',
  description: 'Reads a project file.',
  category: 'file',
  inputSchemaRef: 'fs.read.input',
  outputSchemaRef: 'fs.read.output',
  permissions: [{ kind: 'file.read', reason: 'Reads a project file.' }]
}

describe('agent-gateway-tools', () => {
  it('selects native protocol only for openai_compat gateways', () => {
    expect(resolveAgentToolProtocol('openai_compat')).toBe('native')
    expect(resolveAgentToolProtocol('stub')).toBe('json')
    expect(resolveAgentToolProtocol(undefined)).toBe('json')
  })

  it('maps dotted tool IDs to OpenAI-compatible gateway tool names', () => {
    const tools = toolDescriptorsToGatewayTools([
      queryGraphDescriptor,
      webSearchDescriptor,
      fsReadDescriptor
    ])

    expect(tools.map((tool) => tool.function.name)).toEqual([
      'tool_canvas_d_queryGraph',
      'tool_web_d_search',
      'tool_fs_d_read'
    ])
    expect(tools.every((tool) => OPENAI_TOOL_NAME_PATTERN.test(tool.function.name))).toBe(true)
  })

  it('maps provider-safe gateway tool calls back into Agent loop calls', () => {
    const [queryGraphTool] = toolDescriptorsToGatewayTools([queryGraphDescriptor])

    const calls = gatewayToolCallsToAgentCalls([
      {
        id: 'call-1',
        type: 'function',
        function: {
          name: queryGraphTool?.function.name ?? '',
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

    expect(messages[2]?.tool_calls?.[0]?.function.name).toBe('tool_canvas_d_queryGraph')
    expect(messages[3]).toMatchObject({
      role: 'tool',
      tool_call_id: 'call-1',
      name: 'tool_canvas_d_queryGraph'
    })
  })

  it('keeps the model tool call id separate from the ToolRuntime invocation id', () => {
    const messages = loopMessagesToGatewayMessages([
      {
        role: 'assistant',
        content: '',
        toolCalls: [{ id: 'call-from-model', toolId: 'canvas.queryGraph', input: {} }]
      },
      {
        role: 'tool',
        toolId: 'canvas.queryGraph',
        invocationId: 'tool-invocation-runtime',
        status: 'completed',
        content: '{"nodeCount":0}'
      }
    ])

    expect(messages[1]).toMatchObject({
      role: 'tool',
      tool_call_id: 'call-from-model',
      name: 'tool_canvas_d_queryGraph'
    })
  })
})
