/**
 * Converts Agent loop state into OpenAI-compatible gateway tool/message payloads.
 * @see docs/api-contracts/agents.md
 * @see docs/api-contracts/gateway-providers.md
 */

import type { GatewayChatMessage, GatewayToolCall, GatewayToolDefinition, GatewayType } from '../../../../shared/gateway'
import type { ToolDescriptor } from '../../../../shared/tools'
import type { AgentLoopMessage, AgentToolCall } from '../agent/context-loop'

export type AgentToolProtocol = 'native' | 'json'

const EMPTY_PARAMETERS: Record<string, unknown> = {
  type: 'object',
  properties: {},
  additionalProperties: false
}

/**
 * Resolves whether the Agent loop should use native gateway tools or JSON toolCalls.
 * @param gatewayType - Configured gateway type when known.
 * @returns `native` for OpenAI-compatible gateways; `json` for stub and unknown gateways.
 * @see docs/api-contracts/agents.md
 */
export function resolveAgentToolProtocol(gatewayType?: GatewayType): AgentToolProtocol {
  return gatewayType === 'openai_compat' ? 'native' : 'json'
}

/**
 * Maps ToolRuntime descriptors to OpenAI-compatible tool definitions.
 * @param tools - Allowed tool descriptors for the current loop turn.
 * @returns Gateway tool definitions keyed by tool ID.
 * @see docs/api-contracts/tools-plugins.md
 */
export function toolDescriptorsToGatewayTools(tools: readonly ToolDescriptor[]): GatewayToolDefinition[] {
  return tools.map((tool) => ({
    type: 'function',
    function: {
      name: tool.id,
      description: tool.description,
      parameters: tool.inputParametersJsonSchema ?? EMPTY_PARAMETERS
    }
  }))
}

/**
 * Converts Agent loop messages into gateway chat messages for native tool calling.
 * @param messages - Loop messages including tool observations.
 * @returns OpenAI-compatible chat transcript.
 * @see docs/api-contracts/agents.md
 */
export function loopMessagesToGatewayMessages(messages: readonly AgentLoopMessage[]): GatewayChatMessage[] {
  const out: GatewayChatMessage[] = []

  for (const message of messages) {
    if (message.role === 'system' || message.role === 'user') {
      out.push({ role: message.role, content: message.content })
      continue
    }

    if (message.role === 'assistant') {
      if (message.toolCalls && message.toolCalls.length > 0) {
        out.push({
          role: 'assistant',
          content: message.content.length > 0 ? message.content : null,
          tool_calls: message.toolCalls.map((call) => ({
            id: call.id,
            type: 'function',
            function: {
              name: call.toolId,
              arguments: stableJson(call.input)
            }
          }))
        })
      } else {
        out.push({ role: 'assistant', content: message.content })
      }
      continue
    }

    out.push({
      role: 'tool',
      tool_call_id: message.invocationId,
      name: message.toolId,
      content: message.content
    })
  }

  return out
}

/**
 * Parses provider-native tool calls into Agent loop tool calls.
 * @param toolCalls - Tool calls returned by the gateway.
 * @param allowedToolIds - Tool IDs permitted for this Agent run.
 * @returns Normalized Agent tool calls with stable IDs.
 * @see docs/api-contracts/agents.md
 */
export function gatewayToolCallsToAgentCalls(
  toolCalls: readonly GatewayToolCall[],
  allowedToolIds: ReadonlySet<string>
): AgentToolCall[] {
  const calls: AgentToolCall[] = []

  toolCalls.forEach((entry, index) => {
    if (entry.type !== 'function' || typeof entry.function?.name !== 'string') {
      return
    }

    const toolId = entry.function.name
    if (!allowedToolIds.has(toolId)) {
      return
    }

    let input: unknown = {}
    const rawArgs = entry.function.arguments

    if (typeof rawArgs === 'string' && rawArgs.trim().length > 0) {
      try {
        input = JSON.parse(rawArgs) as unknown
      } catch {
        input = {}
      }
    }

    calls.push({
      id: entry.id?.trim().length ? entry.id : `model-tool-call-${index + 1}`,
      toolId,
      input
    })
  })

  return calls
}

function stableJson(value: unknown): string {
  return JSON.stringify(value ?? {})
}
