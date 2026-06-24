/**
 * ToolRuntime and plugin tool contracts.
 * @see docs/api-contracts/tools-plugins.md
 */

export type ToolCategory = 'canvas' | 'asset' | 'job' | 'gateway' | 'knowledge' | 'file' | 'web' | 'model' | 'custom'

export type ToolOwner =
  | { kind: 'builtin'; id: 'core' }
  | { kind: 'plugin'; id: string }

export type ToolPermissionKind = 'canvas.read' | 'canvas.write' | 'file.read' | 'file.write' | 'network' | 'provider.spend' | 'destructive' | 'diagnostics'

export type ToolConcurrency = 'readonly' | 'serial-write' | 'exclusive'

export type PermissionDecision = 'allow' | 'ask' | 'deny'

export interface ToolPermission {
  kind: ToolPermissionKind
  reason: string
}

export interface ToolDescriptor {
  id: string
  name: string
  description: string
  category: ToolCategory
  owner: ToolOwner
  inputSchemaRef: string
  outputSchemaRef: string
  permissions: ToolPermission[]
  concurrency: ToolConcurrency
  enabled: boolean
}

export interface ToolProgress {
  message: string
  progress?: number
  data?: Record<string, unknown>
}

export interface ToolActor {
  type: 'user' | 'agent' | 'system'
  id: string
}

export interface ToolPermissionResult {
  decision: PermissionDecision
  decisionReason: string
  requiredPermissions: ToolPermission[]
}

export interface ToolInvocationRecord {
  invocationId: string
  toolId: string
  actor: ToolActor
  traceId: string
  status: 'accepted' | 'running' | 'completed' | 'failed' | 'denied'
  createdAt: number
}

export interface ToolError {
  errorClass: string
  message: string
  retryable: boolean
}

export interface PluginManifest {
  id: string
  name: string
  version: string
  entrypoint: string
  requestedPermissions: ToolPermission[]
  tools: ToolDescriptor[]
}

export interface PluginDiagnostic {
  pluginId: string
  status: 'loaded' | 'disabled' | 'quarantined'
  messages: string[]
}
