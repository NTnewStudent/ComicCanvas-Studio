/**
 * Deprecated compatibility barrel for the old combined Tool/Agent contract.
 *
 * New authoritative contracts are split by domain:
 * - `shared/tools.ts`
 * - `shared/agents.ts`
 * - `shared/gateway.ts`
 * - `shared/assets.ts`
 *
 * @deprecated Import focused contracts from the domain-specific files instead.
 * @see docs/api-contracts/tools-plugins.md
 * @see docs/api-contracts/agents.md
 */

export type {
  PermissionDecision,
  PluginDiagnostic,
  PluginManifest,
  ToolActor,
  ToolCategory,
  ToolConcurrency,
  ToolDescriptor as ToolDefinition,
  ToolError,
  ToolInvocationRecord,
  ToolOwner,
  ToolPermission,
  ToolPermissionKind,
  ToolPermissionResult,
  ToolProgress
} from './tools'

export type {
  AgentContextPolicy,
  AgentDefinition,
  AgentEffort,
  AgentGatewayPolicy,
  AgentPermissionPolicy,
  AgentRunRequest,
  AgentRunStatus,
  AgentRunTicket,
  AgentSource as AgentType,
  SpawnSubAgentInput,
  SpawnSubAgentResult,
  SubAgentSpec
} from './agents'

export { MAX_SPAWN_DEPTH } from './agents'

export type { GatewayConfigView as GatewayConfig, GatewayModelMap, GatewayType } from './gateway'

export type { AssetFolder } from './assets'
