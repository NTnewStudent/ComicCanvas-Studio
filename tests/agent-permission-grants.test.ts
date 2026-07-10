import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import type { ToolPermissionResult } from '../shared/tools'
import { createAgentPermissionService } from '../desktop/src/main/agent/permission-service'
import { migrateDatabaseAtPath, openDatabaseAtPath } from '../desktop/src/main/db/migrate'
import { createAgentPermissionGrantRepository } from '../desktop/src/main/db/repositories/agent-permission-grant.repo'

const askCanvasWrite: ToolPermissionResult = {
  decision: 'ask',
  decisionReason: 'Creating nodes requires confirmation.',
  requiredPermissions: [{ kind: 'canvas.write', reason: 'Mutates canvas graph.' }]
}

const askDestructive: ToolPermissionResult = {
  decision: 'ask',
  decisionReason: 'Deleting nodes requires confirmation.',
  requiredPermissions: [
    { kind: 'canvas.write', reason: 'Mutates canvas graph.' },
    { kind: 'destructive', reason: 'Deletes graph data.' }
  ]
}

function withService<T>(run: (service: ReturnType<typeof createAgentPermissionService>) => T): T {
  const tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-permission-service-'))
  const dbPath = join(tempDir, 'permission.sqlite')
  migrateDatabaseAtPath(dbPath)
  const db = openDatabaseAtPath(dbPath)

  try {
    return run(createAgentPermissionService({
      grants: createAgentPermissionGrantRepository(db),
      workflowId: 'default',
      clock: () => 1_783_900_000_000,
      idFactory: () => 'grant-1'
    }))
  } finally {
    db.close()
    rmSync(tempDir, { recursive: true, force: true })
  }
}

describe('Agent permission grants', () => {
  it('reuses run grants only for matching run, tool, and permission kinds', () => {
    withService((service) => {
      service.rememberApproval({
        runId: 'run-1',
        toolId: 'canvas.createNode',
        permission: askCanvasWrite,
        approvedByLabel: 'user-local',
        scope: 'run'
      })

      expect(service.hasReusableGrant({
        runId: 'run-1',
        toolId: 'canvas.createNode',
        permission: askCanvasWrite
      })).toBe(true)
      expect(service.hasReusableGrant({
        runId: 'run-2',
        toolId: 'canvas.createNode',
        permission: askCanvasWrite
      })).toBe(false)
      expect(service.hasReusableGrant({
        runId: 'run-1',
        toolId: 'canvas.deleteNode',
        permission: askCanvasWrite
      })).toBe(false)
    })
  })

  it('reuses session grants across runs in the current workflow session', () => {
    withService((service) => {
      const networkPermission: ToolPermissionResult = {
        decision: 'ask',
        decisionReason: 'Network search requires confirmation.',
        requiredPermissions: [{ kind: 'network', reason: 'Uses network.' }]
      }
      service.rememberApproval({
        runId: 'run-1',
        toolId: 'web.search',
        permission: networkPermission,
        approvedByLabel: 'user-local',
        scope: 'session'
      })

      expect(service.hasReusableGrant({
        runId: 'run-2',
        toolId: 'web.search',
        permission: networkPermission
      })).toBe(true)
    })
  })

  it('never reuses once grants for a later invocation', () => {
    withService((service) => {
      service.rememberApproval({
        runId: 'run-1',
        toolId: 'canvas.createNode',
        permission: askCanvasWrite,
        approvedByLabel: 'user-local',
        scope: 'once'
      })

      expect(service.hasReusableGrant({
        runId: 'run-1',
        toolId: 'canvas.createNode',
        permission: askCanvasWrite
      })).toBe(false)
    })
  })

  it('downgrades destructive session approvals so they cannot bypass later prompts', () => {
    withService((service) => {
      const grant = service.rememberApproval({
        runId: 'run-1',
        toolId: 'canvas.deleteNode',
        permission: askDestructive,
        approvedByLabel: 'user-local',
        scope: 'session'
      })

      expect(grant.scope).toBe('once')
      expect(service.hasReusableGrant({
        runId: 'run-2',
        toolId: 'canvas.deleteNode',
        permission: askDestructive
      })).toBe(false)
    })
  })

  it('keeps persisted session grants as audit history after an app-session restart', () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-permission-session-'))
    const dbPath = join(tempDir, 'permission-session.sqlite')
    migrateDatabaseAtPath(dbPath)
    const db = openDatabaseAtPath(dbPath)

    try {
      const grants = createAgentPermissionGrantRepository(db)
      const firstSession = createAgentPermissionService({
        grants,
        workflowId: 'default',
        clock: () => 100,
        sessionStartedAt: 100,
        idFactory: () => 'grant-session'
      })
      firstSession.rememberApproval({
        runId: 'run-1',
        toolId: 'canvas.createNode',
        permission: askCanvasWrite,
        approvedByLabel: 'user-local',
        scope: 'session'
      })

      const restartedSession = createAgentPermissionService({
        grants,
        workflowId: 'default',
        clock: () => 200,
        sessionStartedAt: 200
      })

      expect(restartedSession.hasReusableGrant({
        runId: 'run-2',
        toolId: 'canvas.createNode',
        permission: askCanvasWrite
      })).toBe(false)
      expect(grants.listByRunId('run-1')).toHaveLength(1)
    } finally {
      db.close()
      rmSync(tempDir, { recursive: true, force: true })
    }
  })
})
