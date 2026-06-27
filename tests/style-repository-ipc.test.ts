import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { migrateDatabaseAtPath, openDatabaseAtPath } from '../desktop/src/main/db/migrate'
import { createStyleRepository } from '../desktop/src/main/db/repositories/style.repo'
import { createWorkflowRepository } from '../desktop/src/main/db/repositories/workflow.repo'
import { registerStyleHandlers } from '../desktop/src/main/ipc/style.handler'
import type { StylePresetView } from '../shared/styles'
import type { IpcInvokeChannel } from '../shared/ipc'

type Handler = (_event: unknown, request: unknown) => unknown

function createFakeIpcMain(): { handlers: Map<string, Handler>; ipcMain: { handle(channel: string, handler: Handler): void } } {
  const handlers = new Map<string, Handler>()

  return {
    handlers,
    ipcMain: {
      handle(channel, handler) {
        handlers.set(channel, handler)
      },
    },
  }
}

async function withStyles(
  run: (dependencies: {
    handlers: Map<string, Handler>
    repo: ReturnType<typeof createStyleRepository>
    workflows: ReturnType<typeof createWorkflowRepository>
  }) => Promise<void> | void
): Promise<void> {
  const tempDir = mkdtempSync(join(tmpdir(), 'comiccanvas-styles-'))
  const dbPath = join(tempDir, 'styles.sqlite')
  migrateDatabaseAtPath(dbPath)
  const db = openDatabaseAtPath(dbPath)

  try {
    const repo = createStyleRepository(db)
    const workflows = createWorkflowRepository(db)
    const { ipcMain, handlers } = createFakeIpcMain()
    registerStyleHandlers(ipcMain, {
      styles: repo,
      clock: () => 1_783_700_000_000,
      idFactory: () => 'style-generated',
    })
    await run({ handlers, repo, workflows })
  } finally {
    db.close()
    rmSync(tempDir, { recursive: true, force: true })
  }
}

describe('REQ-094 style repository and IPC', () => {
  it('registers style management handlers', () => {
    const { ipcMain, handlers } = createFakeIpcMain()

    registerStyleHandlers(ipcMain)

    expect(Array.from(handlers.keys()).sort()).toEqual([
      'style.delete',
      'style.getProjectDefault',
      'style.list',
      'style.save',
      'style.setProjectDefault',
    ] satisfies IpcInvokeChannel[])
  })

  it('persists style presets, lists enabled presets in sort order, and can include disabled presets', async () => {
    await withStyles(async ({ handlers }) => {
      await handlers.get('style.save')?.({}, {
        id: 'style-ink',
        code: 'ink',
        name: '水墨',
        description: '黑白漫画水墨',
        promptBefore: '水墨漫画',
        promptAfter: '宣纸肌理',
        legacyPromptPreset: 'legacy ink',
        negativePrompt: '低清晰度',
        coverAssetId: 'asset-cover',
        tags: ['comic', 'ink'],
        enabled: true,
        sortOrder: 20,
      })
      await handlers.get('style.save')?.({}, {
        id: 'style-disabled',
        code: 'old',
        name: '旧风格',
        promptBefore: '旧风格',
        enabled: false,
        sortOrder: 10,
      })

      const enabledOnly = await handlers.get('style.list')?.({}, { includeDisabled: false }) as StylePresetView[]
      expect(enabledOnly.map((style) => style.id)).toEqual(['style-ink'])
      expect(enabledOnly[0]).toMatchObject({
        code: 'ink',
        name: '水墨',
        promptBefore: '水墨漫画',
        promptAfter: '宣纸肌理',
        legacyPromptPreset: 'legacy ink',
        negativePrompt: '低清晰度',
        coverAssetId: 'asset-cover',
        coverUrl: 'cc-asset://asset/asset-cover',
        tags: ['comic', 'ink'],
        enabled: true,
        sortOrder: 20,
      })

      const all = await handlers.get('style.list')?.({}, { includeDisabled: true }) as StylePresetView[]
      expect(all.map((style) => style.id)).toEqual(['style-disabled', 'style-ink'])
    })
  })

  it('soft-deletes styles and persists project default style selection', async () => {
    await withStyles(async ({ handlers, repo, workflows }) => {
      workflows.create({
        id: 'workflow-1',
        name: 'Style workflow',
        createdAt: 1_783_700_000_000,
        updatedAt: 1_783_700_000_000,
      })
      await handlers.get('style.save')?.({}, {
        id: 'style-project',
        code: 'project-style',
        name: '项目画风',
        promptBefore: '统一画风',
        enabled: true,
        sortOrder: 1,
      })

      expect(await handlers.get('style.setProjectDefault')?.({}, {
        workflowId: 'workflow-1',
        stylePresetId: 'style-project',
      })).toEqual({ workflowId: 'workflow-1', stylePresetId: 'style-project' })
      expect(await handlers.get('style.getProjectDefault')?.({}, {
        workflowId: 'workflow-1',
      })).toEqual({ workflowId: 'workflow-1', stylePresetId: 'style-project' })
      expect(repo.getProjectDefault('workflow-1')).toBe('style-project')

      expect(await handlers.get('style.delete')?.({}, { stylePresetId: 'style-project' })).toEqual({
        stylePresetId: 'style-project',
        deleted: true,
      })
      expect(await handlers.get('style.list')?.({}, { includeDisabled: false })).toEqual([])
      expect(repo.getProjectDefault('workflow-1')).toBe('style-project')

      expect(await handlers.get('style.setProjectDefault')?.({}, {
        workflowId: 'workflow-1',
        stylePresetId: null,
      })).toEqual({ workflowId: 'workflow-1', stylePresetId: null })
      expect(await handlers.get('style.getProjectDefault')?.({}, {
        workflowId: 'workflow-1',
      })).toEqual({ workflowId: 'workflow-1', stylePresetId: null })
      expect(repo.getProjectDefault('workflow-1')).toBeNull()
    })
  })
})
