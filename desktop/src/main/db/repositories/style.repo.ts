/**
 * Style preset repository for project and node 画风 selection.
 * @see docs/api-contracts/styles.md
 */

import type { Database as BetterSqliteDatabase } from 'better-sqlite3'

import type { StylePresetSaveInput, StylePresetView } from '../../../../../shared/styles'
import { decodeJson, encodeJson } from './json'

interface StyleRow {
  id: string
  code: string
  name: string
  description: string | null
  prompt_before: string | null
  prompt_after: string | null
  legacy_prompt_preset: string | null
  negative_prompt: string | null
  cover_asset_id: string | null
  tags_json: string
  enabled: number
  sort_order: number
  created_at: number
  updated_at: number
}

export interface StyleRepository {
  list(options?: { includeDisabled?: boolean }): StylePresetView[]
  save(input: StylePresetSaveInput, timestamp: number, idFactory?: () => string): StylePresetView
  delete(stylePresetId: string, timestamp: number): boolean
  setProjectDefault(workflowId: string, stylePresetId: string | null): void
  getProjectDefault(workflowId: string): string | null
}

function safeTags(value: string): string[] {
  const decoded = decodeJson<unknown>(value)
  return Array.isArray(decoded) ? decoded.filter((item): item is string => typeof item === 'string') : []
}

function styleFromRow(row: StyleRow): StylePresetView {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    description: row.description,
    promptBefore: row.prompt_before,
    promptAfter: row.prompt_after,
    legacyPromptPreset: row.legacy_prompt_preset,
    negativePrompt: row.negative_prompt,
    coverAssetId: row.cover_asset_id,
    coverUrl: row.cover_asset_id ? `cc-asset://asset/${row.cover_asset_id}` : null,
    tags: safeTags(row.tags_json),
    enabled: Boolean(row.enabled),
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function normalizeId(input: StylePresetSaveInput, idFactory?: () => string): string {
  return input.id ?? idFactory?.() ?? `style-${input.code.trim().toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '') || 'preset'}`
}

/**
 * Creates a repository for style presets and workflow default style selection.
 * @param db - Open SQLite database handle.
 * @returns Style repository API.
 * @throws Error when repository SQL statements cannot be prepared.
 * @see docs/api-contracts/styles.md
 */
export function createStyleRepository(db: BetterSqliteDatabase): StyleRepository {
  const selectAll = db.prepare(`
    SELECT * FROM style_presets
    WHERE deleted_at IS NULL
    ORDER BY sort_order ASC, name ASC, id ASC
  `)
  const selectById = db.prepare('SELECT * FROM style_presets WHERE id = ? AND deleted_at IS NULL')
  const upsertStyle = db.prepare(`
    INSERT INTO style_presets (
      id, code, name, description, prompt_before, prompt_after, legacy_prompt_preset,
      negative_prompt, cover_asset_id, tags_json, enabled, sort_order, created_at, updated_at
    )
    VALUES (
      @id, @code, @name, @description, @promptBefore, @promptAfter, @legacyPromptPreset,
      @negativePrompt, @coverAssetId, @tagsJson, @enabled, @sortOrder, @createdAt, @updatedAt
    )
    ON CONFLICT(id) DO UPDATE SET
      code = excluded.code,
      name = excluded.name,
      description = excluded.description,
      prompt_before = excluded.prompt_before,
      prompt_after = excluded.prompt_after,
      legacy_prompt_preset = excluded.legacy_prompt_preset,
      negative_prompt = excluded.negative_prompt,
      cover_asset_id = excluded.cover_asset_id,
      tags_json = excluded.tags_json,
      enabled = excluded.enabled,
      sort_order = excluded.sort_order,
      updated_at = excluded.updated_at,
      deleted_at = NULL
  `)
  const softDeleteStyle = db.prepare('UPDATE style_presets SET enabled = 0, deleted_at = @deletedAt, updated_at = @deletedAt WHERE id = @stylePresetId AND deleted_at IS NULL')
  const setWorkflowDefault = db.prepare('UPDATE workflows SET default_style_preset_id = @stylePresetId, updated_at = @updatedAt WHERE id = @workflowId')
  const selectWorkflowDefault = db.prepare('SELECT default_style_preset_id FROM workflows WHERE id = ? AND deleted_at IS NULL')

  return {
    list(options = {}) {
      return (selectAll.all() as StyleRow[]).map(styleFromRow).filter((style) => options.includeDisabled || style.enabled)
    },
    save(input, timestamp, idFactory) {
      const id = normalizeId(input, idFactory)
      upsertStyle.run({
        id,
        code: input.code,
        name: input.name,
        description: input.description ?? null,
        promptBefore: input.promptBefore ?? null,
        promptAfter: input.promptAfter ?? null,
        legacyPromptPreset: input.legacyPromptPreset ?? null,
        negativePrompt: input.negativePrompt ?? null,
        coverAssetId: input.coverAssetId ?? null,
        tagsJson: encodeJson(input.tags ?? []),
        enabled: input.enabled ?? true ? 1 : 0,
        sortOrder: input.sortOrder ?? 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      })

      return styleFromRow(selectById.get(id) as StyleRow)
    },
    delete(stylePresetId, timestamp) {
      const result = softDeleteStyle.run({ stylePresetId, deletedAt: timestamp })
      return result.changes > 0
    },
    setProjectDefault(workflowId, stylePresetId) {
      setWorkflowDefault.run({ workflowId, stylePresetId, updatedAt: Date.now() })
    },
    getProjectDefault(workflowId) {
      const row = selectWorkflowDefault.get(workflowId) as { default_style_preset_id: string | null } | undefined
      return row?.default_style_preset_id ?? null
    },
  }
}
