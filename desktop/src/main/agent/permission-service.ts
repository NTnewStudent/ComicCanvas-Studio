/**
 * Local permission grant matching for Agent tool approvals.
 * @see docs/api-contracts/agents.md
 */

import type {
  LocalPermissionGrant,
  PermissionGrantScope
} from '../../../../shared/agent-run-events'
import type { ToolPermissionKind, ToolPermissionResult } from '../../../../shared/tools'
import type { AgentPermissionGrantRepository } from '../db/repositories/agent-permission-grant.repo'
import type { ToolPermissionGrantStore } from '../tools/runtime'

/** User approval metadata to remember after an ask decision. */
export interface RememberApprovalInput {
  runId: string
  toolId: string
  permission: ToolPermissionResult
  approvedByLabel: string
  scope: PermissionGrantScope
}

/** Tool invocation attributes used to find a reusable grant. */
export interface ReusableGrantInput {
  runId: string
  toolId: string
  permission: ToolPermissionResult
}

/** Local approval persistence and reuse policy. */
export interface AgentPermissionService {
  rememberApproval(input: RememberApprovalInput): LocalPermissionGrant
  hasReusableGrant(input: ReusableGrantInput): boolean
}

/** Dependencies and current-session boundary for local grants. */
export interface AgentPermissionServiceOptions {
  grants: AgentPermissionGrantRepository
  workflowId: string
  idFactory?: () => string
  clock?: () => number
  sessionStartedAt?: number
}

function permissionKinds(permission: ToolPermissionResult): ToolPermissionKind[] {
  return [...new Set(permission.requiredPermissions.map((entry) => entry.kind))].sort()
}

function effectiveScope(
  requested: PermissionGrantScope,
  kinds: ToolPermissionKind[]
): PermissionGrantScope {
  return kinds.includes('destructive') ? 'once' : requested
}

/**
 * Creates the workflow-scoped local permission service.
 * @param options - Grant repository, workflow, session boundary, IDs, and clock.
 * @returns Approval persistence and reusable-grant lookup operations.
 * @throws Error when asked to remember a non-ask permission decision.
 * @see docs/api-contracts/agents.md
 */
export function createAgentPermissionService(options: AgentPermissionServiceOptions): AgentPermissionService {
  const clock = options.clock ?? Date.now
  const idFactory = options.idFactory ?? (() => `grant-${crypto.randomUUID()}`)
  const sessionStartedAt = options.sessionStartedAt ?? clock()

  return {
    rememberApproval(input) {
      if (input.permission.decision !== 'ask') {
        // Only explicit user decisions for ask-gated tools belong in the grant ledger.
        throw new Error('Only ask permission decisions can be approved.')
      }

      const now = clock()
      const kinds = permissionKinds(input.permission)
      const scope = effectiveScope(input.scope, kinds)
      const existing = options.grants.findActive({
        runId: input.runId,
        workflowId: options.workflowId,
        toolId: input.toolId,
        permissionKinds: kinds,
        now,
        sessionStartedAt
      })

      if (existing?.scope === scope) {
        return existing
      }

      return options.grants.save({
        id: idFactory(),
        runId: input.runId,
        workflowId: options.workflowId,
        toolId: input.toolId,
        permissionKinds: kinds,
        scope,
        approvedByLabel: input.approvedByLabel,
        createdAt: now
      })
    },
    hasReusableGrant(input) {
      if (input.permission.decision !== 'ask') {
        return false
      }

      const grant = options.grants.findActive({
        runId: input.runId,
        workflowId: options.workflowId,
        toolId: input.toolId,
        permissionKinds: permissionKinds(input.permission),
        now: clock(),
        sessionStartedAt
      })

      return grant !== null && grant.scope !== 'once'
    }
  }
}

/**
 * Adapts the Agent permission service to ToolRuntime's reusable-grant boundary.
 * Tool invocation trace IDs are Agent run IDs on the orchestrator path.
 * @param service - Workflow-scoped persistent permission service.
 * @returns ToolRuntime grant store backed by SQLite grants.
 * @see docs/api-contracts/agents.md
 */
export function createToolPermissionGrantStore(service: AgentPermissionService): ToolPermissionGrantStore {
  return {
    remember(input, permission) {
      const approval = input.approvedInvocation
      if (!approval) {
        return
      }

      service.rememberApproval({
        runId: input.traceId,
        toolId: input.toolId,
        permission,
        approvedByLabel: approval.approvedBy.id,
        scope: approval.scope ?? 'session'
      })
    },
    has(input, permission) {
      return service.hasReusableGrant({
        runId: input.traceId,
        toolId: input.toolId,
        permission
      })
    }
  }
}
