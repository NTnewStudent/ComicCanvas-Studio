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

const GATEWAY_TOOL_NAME_PREFIX = 'tool_'

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
      name: gatewayToolNameFromToolId(tool.id),
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
  const pendingToolCalls: AgentToolCall[] = []

  for (const message of messages) {
    if (message.role === 'system' || message.role === 'user') {
      out.push({ role: message.role, content: message.content })
      continue
    }

    if (message.role === 'assistant') {
      if (message.toolCalls && message.toolCalls.length > 0) {
        pendingToolCalls.push(...message.toolCalls)
        out.push({
          role: 'assistant',
          content: message.content.length > 0 ? message.content : null,
          tool_calls: message.toolCalls.map((call) => ({
            id: call.id,
            type: 'function',
            function: {
              name: gatewayToolNameFromToolId(call.toolId),
              arguments: stableJson(call.input)
            }
          }))
        })
      } else {
        out.push({ role: 'assistant', content: message.content })
      }
      continue
    }

    const matchedCall = takePendingToolCall(pendingToolCalls, message.toolId)
    out.push({
      role: 'tool',
      tool_call_id: message.toolCallId ?? matchedCall?.id ?? message.invocationId,
      name: gatewayToolNameFromToolId(message.toolId),
      content: message.content
    })
  }

  return out
}

function takePendingToolCall(pendingToolCalls: AgentToolCall[], toolId: string): AgentToolCall | undefined {
  const matchingIndex = pendingToolCalls.findIndex((call) => call.toolId === toolId)
  const index = matchingIndex >= 0 ? matchingIndex : 0
  const [call] = pendingToolCalls.splice(index, 1)
  return call
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
  const gatewayNameToToolId = buildGatewayToolNameMap(allowedToolIds)

  toolCalls.forEach((entry, index) => {
    if (entry.type !== 'function' || typeof entry.function?.name !== 'string') {
      return
    }

    const toolId = gatewayNameToToolId.get(entry.function.name) ?? (
      allowedToolIds.has(entry.function.name) ? entry.function.name : undefined
    )
    if (!toolId) {
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

function buildGatewayToolNameMap(allowedToolIds: ReadonlySet<string>): Map<string, string> {
  const out = new Map<string, string>()

  for (const toolId of allowedToolIds) {
    out.set(gatewayToolNameFromToolId(toolId), toolId)
  }

  return out
}

function gatewayToolNameFromToolId(toolId: string): string {
  return `${GATEWAY_TOOL_NAME_PREFIX}${Array.from(toolId).map(encodeToolNameChar).join('')}`
}

function encodeToolNameChar(char: string): string {
  if (/^[a-zA-Z0-9-]$/.test(char)) {
    return char
  }

  if (char === '.') {
    return '_d_'
  }

  if (char === '_') {
    return '_u_'
  }

  return `_x${char.codePointAt(0)?.toString(16) ?? '0'}_`
}
