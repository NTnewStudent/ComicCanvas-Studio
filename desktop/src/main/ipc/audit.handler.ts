/**
 * Audit and health IPC handlers.
 * @see docs/api-contracts/audit-observability.md
 */

import type { AuditService, HealthCheckReport, HealthCheckResult } from '../audit/service'
import { runHealthChecks } from '../audit/service'
import type { SkillRegistry } from '../skills/registry'
import type { ToolRuntime } from '../tools/runtime'
import type { IpcRegistrar } from './types'

function auditListRequest(request: unknown): { traceId?: string; actorId?: string; capability?: string; limit: number } {
  if (typeof request !== 'object' || request === null) {
    return { limit: 50 }
  }
  const input = request as Record<string, unknown>
  return {
    ...(typeof input.traceId === 'string' ? { traceId: input.traceId } : {}),
    ...(typeof input.actorId === 'string' ? { actorId: input.actorId } : {}),
    ...(typeof input.capability === 'string' ? { capability: input.capability } : {}),
    limit: typeof input.limit === 'number' ? Math.max(1, Math.min(200, input.limit)) : 50
  }
}

/**
 * Registers audit and health IPC handlers.
 * @param ipcMain - Electron-compatible IPC registrar.
 * @param options - Audit service and health probe dependencies.
 * @see docs/api-contracts/audit-observability.md
 */
export function registerAuditHandlers(
  ipcMain: IpcRegistrar,
  options: {
    audit: AuditService
    dbReady: () => boolean
    toolRuntime: ToolRuntime
    skillRegistry: SkillRegistry
    knowledgeReady: () => boolean
    clock?: () => number
  },
): void {
  const clock = options.clock ?? Date.now

  ipcMain.handle('audit.list', (_event, request) => ({
    entries: options.audit.list(auditListRequest(request))
  }))

  ipcMain.handle('health.check', (): HealthCheckReport => {
    const checks: Array<{ component: HealthCheckResult['component']; run: () => HealthCheckResult }> = [
      {
        component: 'database',
        run: () => ({
          component: 'database',
          status: options.dbReady() ? 'ok' : 'failed',
          message: options.dbReady() ? 'SQLite ready.' : 'Database unavailable.'
        })
      },
      {
        component: 'toolRegistry',
        run: () => ({
          component: 'toolRegistry',
          status: options.toolRuntime.list().length > 0 ? 'ok' : 'degraded',
          message: `${options.toolRuntime.list(true).length} tools registered.`
        })
      },
      {
        component: 'skillRegistry',
        run: () => ({
          component: 'skillRegistry',
          status: options.skillRegistry.list(true).length > 0 ? 'ok' : 'degraded',
          message: `${options.skillRegistry.list(true).length} skills indexed.`
        })
      },
      {
        component: 'knowledgeIndex',
        run: () => ({
          component: 'knowledgeIndex',
          status: options.knowledgeReady() ? 'ok' : 'degraded',
          message: options.knowledgeReady() ? 'Knowledge index ready.' : 'Knowledge index empty.'
        })
      },
      {
        component: 'jobRuntime',
        run: () => ({
          component: 'jobRuntime',
          status: 'ok',
          message: 'Job runtime registered.'
        })
      },
      {
        component: 'agentRegistry',
        run: () => ({
          component: 'agentRegistry',
          status: 'ok',
          message: 'Agent registry registered.'
        })
      }
    ]

    return runHealthChecks(checks, clock)
  })
}
