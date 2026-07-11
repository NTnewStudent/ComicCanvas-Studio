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
const UNKNOWN_GATEWAY_TOOL_ID_PREFIX = 'unknown.gateway-tool'

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

    const matchedCall = takePendingToolCall(pendingToolCalls, message.toolId, message.toolCallId)
    out.push({
      role: 'tool',
      tool_call_id: message.toolCallId ?? matchedCall?.id ?? message.invocationId,
      name: gatewayToolNameFromToolId(message.toolId),
      content: message.content
    })
  }

  return out
}

function takePendingToolCall(pendingToolCalls: AgentToolCall[], toolId: string, toolCallId?: string): AgentToolCall | undefined {
  const idIndex = toolCallId ? pendingToolCalls.findIndex((call) => call.id === toolCallId) : -1
  const matchingIndex = idIndex >= 0 ? idIndex : pendingToolCalls.findIndex((call) => call.toolId === toolId)
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
  const occupiedCallIds = new Set(
    toolCalls
      .map((entry) => entry.id)
      .filter((id): id is string => typeof id === 'string' && id.trim().length > 0)
  )
  const seenCallIds = new Set<string>()

  toolCalls.forEach((entry, index) => {
    if (entry.type !== 'function' || typeof entry.function?.name !== 'string') {
      return
    }

    const providerCallId = typeof entry.id === 'string' && entry.id.trim().length > 0 ? entry.id : undefined
    const duplicateProviderCallId = providerCallId !== undefined && seenCallIds.has(providerCallId)
    let input: unknown = {}
    let invalidArguments = false
    const rawArgs = entry.function.arguments

    if (typeof rawArgs === 'string' && rawArgs.trim().length > 0) {
      try {
        input = JSON.parse(rawArgs) as unknown
      } catch {
        // Invalid provider arguments are quarantined before ToolRuntime schema validation.
        invalidArguments = true
        input = {}
      }
    }

    const needsSyntheticCallId = providerCallId === undefined || duplicateProviderCallId || invalidArguments
    const syntheticBase = duplicateProviderCallId
      ? `model-tool-call-duplicate-${index + 1}`
      : `model-tool-call-${index + 1}`
    const callId = needsSyntheticCallId
      ? uniqueSyntheticCallId(syntheticBase, occupiedCallIds, seenCallIds)
      : providerCallId
    seenCallIds.add(callId)

    const canonicalAllowedToolId = gatewayNameToToolId.get(entry.function.name)
    const decodedToolId = canonicalAllowedToolId ?? gatewayToolIdFromName(entry.function.name)
    const nonCanonicalAllowedTool = canonicalAllowedToolId === undefined
      && decodedToolId !== undefined
      && allowedToolIds.has(decodedToolId)
    const malformedCall = needsSyntheticCallId || decodedToolId === undefined || nonCanonicalAllowedTool
    const toolId = malformedCall
      ? uniqueUnknownToolId(duplicateProviderCallId ? 'duplicate' : 'malformed', index, allowedToolIds)
      : decodedToolId

    calls.push({
      id: callId,
      toolId,
      input
    })
  })

  return calls
}

function uniqueSyntheticCallId(base: string, occupied: ReadonlySet<string>, seen: ReadonlySet<string>): string {
  let candidate = base
  let suffix = 2

  while (occupied.has(candidate) || seen.has(candidate)) {
    candidate = `${base}-${suffix}`
    suffix += 1
  }

  return candidate
}

function uniqueUnknownToolId(reason: 'duplicate' | 'malformed', index: number, allowedToolIds: ReadonlySet<string>): string {
  const base = `${UNKNOWN_GATEWAY_TOOL_ID_PREFIX}.${reason}.${index + 1}`
  let candidate = base
  let suffix = 2

  while (allowedToolIds.has(candidate)) {
    candidate = `${base}.${suffix}`
    suffix += 1
  }

  return candidate
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

function gatewayToolIdFromName(name: string): string | undefined {
  if (!name.startsWith(GATEWAY_TOOL_NAME_PREFIX)) {
    return name
  }

  const encoded = name.slice(GATEWAY_TOOL_NAME_PREFIX.length)
  let decoded = ''
  let index = 0

  while (index < encoded.length) {
    if (encoded.startsWith('_d_', index)) {
      decoded += '.'
      index += 3
      continue
    }

    if (encoded.startsWith('_u_', index)) {
      decoded += '_'
      index += 3
      continue
    }

    const codePoint = encoded.slice(index).match(/^_x([0-9a-f]+)_/u)
    if (codePoint?.[1]) {
      const value = Number.parseInt(codePoint[1], 16)
      if (value > 0x10FFFF || (value >= 0xD800 && value <= 0xDFFF)) {
        return undefined
      }
      decoded += String.fromCodePoint(value)
      index += codePoint[0].length
      continue
    }

    decoded += encoded[index]
    index += 1
  }

  return gatewayToolNameFromToolId(decoded) === name ? decoded : undefined
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
