/**
 * Runtime skill discovery and invocation contracts.
 * @see docs/api-contracts/skills.md
 */

import type { ToolPermission, ToolPermissionKind } from './tools'

export type SkillSource = 'builtin' | 'user' | 'plugin'

export interface SkillReference {
  id: string
  path: string
  kind: 'instructions' | 'reference' | 'asset'
  required: boolean
}

export interface SkillDefinition {
  id: string
  source: SkillSource
  version: string
  name: string
  description: string
  entry: string
  references: SkillReference[]
  requiredTools: string[]
  requiredPermissions: ToolPermission[]
  enabled: boolean
}

export interface SkillListRequest {
  includeDisabled?: boolean
  source?: SkillSource
}

export interface SkillInvokeRequest {
  skillId: string
  agentRunId: string
  input: Record<string, unknown>
  requiredReferences?: string[]
}

export interface SkillInvocationRecord {
  id: string
  skillId: string
  version: string
  agentRunId: string
  loadedReferences: SkillReference[]
  requiredPermissionKinds: ToolPermissionKind[]
  status: 'completed' | 'failed'
}
