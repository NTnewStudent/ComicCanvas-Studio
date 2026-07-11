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

  it.each([
    ['raw tool ID', 'canvas.queryGraph'],
    ['alternate encoding', 'tool_canvas_x2e_queryGraph']
  ])('quarantines a %s even when it identifies an allowed tool', (_label, name) => {
    const calls = gatewayToolCallsToAgentCalls([
      {
        id: 'provider-call-non-canonical',
        type: 'function',
        function: { name, arguments: '{"page":1}' }
      }
    ], new Set(['canvas.queryGraph']))

    expect(calls).toEqual([{
      id: 'provider-call-non-canonical',
      toolId: 'unknown.gateway-tool.malformed.1',
      input: { page: 1 }
    }])
  })

  it.each([
    {
      label: 'empty provider ID',
      id: '',
      arguments: '{}',
      expectedId: 'model-tool-call-1'
    },
    {
      label: 'invalid JSON arguments',
      id: 'provider-call-invalid-json',
      arguments: '{"page":',
      expectedId: 'model-tool-call-1'
    }
  ])('quarantines canonical calls with $label behind a synthetic transcript ID', ({ id, arguments: rawArguments, expectedId }) => {
    const calls = gatewayToolCallsToAgentCalls([
      {
        id,
        type: 'function',
        function: { name: 'tool_canvas_d_queryGraph', arguments: rawArguments }
      }
    ], new Set(['canvas.queryGraph']))

    expect(calls).toEqual([{
      id: expectedId,
      toolId: 'unknown.gateway-tool.malformed.1',
      input: {}
    }])
  })

  it('normalizes unknown native tool names for denied transcript closure while preserving provider IDs', () => {
    const calls = gatewayToolCallsToAgentCalls([
      {
        id: 'provider-call-unknown',
        type: 'function',
        function: {
          name: 'tool_canvas_d_deleteAll',
          arguments: '{"confirmed":true}'
        }
      }
    ], new Set(['canvas.queryGraph']))

    expect(calls).toEqual([{
      id: 'provider-call-unknown',
      toolId: 'canvas.deleteAll',
      input: { confirmed: true }
    }])
  })

  it('normalizes duplicate provider call IDs to unique denied calls after the first occurrence', () => {
    const calls = gatewayToolCallsToAgentCalls([
      {
        id: 'provider-call-duplicate',
        type: 'function',
        function: { name: 'tool_canvas_d_queryGraph', arguments: '{"page":1}' }
      },
      {
        id: 'provider-call-duplicate',
        type: 'function',
        function: { name: 'tool_canvas_d_queryGraph', arguments: '{"page":2}' }
      }
    ], new Set(['canvas.queryGraph']))

    expect(calls[0]).toEqual({
      id: 'provider-call-duplicate',
      toolId: 'canvas.queryGraph',
      input: { page: 1 }
    })
    expect(calls[1]).toEqual({
      id: 'model-tool-call-duplicate-2',
      toolId: 'unknown.gateway-tool.duplicate.2',
      input: { page: 2 }
    })
    expect(new Set(calls.map((call) => call.id)).size).toBe(2)
  })

  it('decodes malformed native tool names as safe opaque unknown tools', () => {
    expect(() => gatewayToolCallsToAgentCalls([
      {
        id: 'provider-call-malformed',
        type: 'function',
        function: { name: 'tool__x110000_', arguments: '{}' }
      }
    ], new Set(['canvas.queryGraph']))).not.toThrow()

    const [call] = gatewayToolCallsToAgentCalls([
      {
        id: 'provider-call-malformed',
        type: 'function',
        function: { name: 'tool__x110000_', arguments: '{}' }
      }
    ], new Set(['canvas.queryGraph']))

    expect(call?.id).toBe('provider-call-malformed')
    expect(call?.toolId).toContain('unknown')
    expect(call?.toolId).not.toBe('canvas.queryGraph')

    if (!call) {
      throw new Error('expected_malformed_call_to_be_normalized')
    }
    const closed = loopMessagesToGatewayMessages([
      { role: 'assistant', content: '', toolCalls: [call] },
      {
        role: 'tool',
        toolId: call.toolId,
        invocationId: call.id,
        toolCallId: call.id,
        status: 'denied',
        content: 'Tool denied by agent policy.'
      }
    ])
    expect(closed[1]).toMatchObject({
      role: 'tool',
      tool_call_id: 'provider-call-malformed',
      content: 'Tool denied by agent policy.'
    })
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

  it('matches repeated calls to the same tool by distinct provider call IDs', () => {
    const messages = loopMessagesToGatewayMessages([
      {
        role: 'assistant',
        content: '',
        toolCalls: [
          { id: 'call-page-1', toolId: 'canvas.queryGraph', input: { page: 1 } },
          { id: 'call-page-2', toolId: 'canvas.queryGraph', input: { page: 2 } }
        ]
      },
      {
        role: 'tool',
        toolId: 'canvas.queryGraph',
        invocationId: 'runtime-2',
        toolCallId: 'call-page-2',
        status: 'completed',
        content: '{"page":2}'
      },
      {
        role: 'tool',
        toolId: 'canvas.queryGraph',
        invocationId: 'runtime-1',
        toolCallId: 'call-page-1',
        status: 'completed',
        content: '{"page":1}'
      }
    ])

    expect(messages.slice(1).map((message) => message.tool_call_id)).toEqual(['call-page-2', 'call-page-1'])
  })
})
