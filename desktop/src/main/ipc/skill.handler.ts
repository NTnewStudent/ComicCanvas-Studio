/**
 * Skill discovery IPC handlers.
 * @see docs/api-contracts/skills.md
 */

import type { SkillListRequest } from '../../../../shared/skills'
import type { SkillRegistry } from '../skills/registry'
import type { IpcRegistrar } from './types'

function skillId(request: unknown): string {
  return typeof request === 'object' && request !== null && 'skillId' in request
    ? String(request.skillId)
    : ''
}

function listRequest(request: unknown): SkillListRequest {
  if (typeof request !== 'object' || request === null) {
    return {}
  }
  const input = request as Record<string, unknown>
  const parsed: SkillListRequest = {}

  if (input.includeDisabled === true) {
    parsed.includeDisabled = true
  }

  if (input.source === 'builtin' || input.source === 'user' || input.source === 'plugin') {
    parsed.source = input.source
  }

  return parsed
}

/**
 * Registers skill metadata IPC handlers.
 * @param ipcMain - Electron-compatible IPC registrar.
 * @param options - Skill registry dependency.
 * @see docs/api-contracts/skills.md
 */
export function registerSkillHandlers(ipcMain: IpcRegistrar, options: { registry: SkillRegistry }): void {
  ipcMain.handle('skill.list', (_event, request) => {
    const parsed = listRequest(request)
    const skills = options.registry.list(parsed.includeDisabled === true)
    return parsed.source ? skills.filter((skill) => skill.source === parsed.source) : skills
  })

  ipcMain.handle('skill.getMetadata', (_event, request) => {
    const metadata = options.registry.get(skillId(request))

    if (!metadata) {
      return {
        errorClass: 'skill_not_found',
        message: 'Skill was not found.',
        retryable: false
      }
    }

    return metadata
  })

  ipcMain.handle('skill.reload', () => ({
    reloadedSkillIds: options.registry.reload()
  }))
}
