/**
 * Shared style preset contracts and deterministic prompt composition.
 * @see docs/api-contracts/styles.md
 */

export interface StylePromptParts {
  /** Prompt text inserted before content. */
  promptBefore?: string | null
  /** Prompt text inserted after content. */
  promptAfter?: string | null
  /** Legacy style prompt used only when promptBefore and promptAfter are empty. */
  legacyPromptPreset?: string | null
}

export interface StylePresetView extends StylePromptParts {
  id: string
  code: string
  name: string
  description: string | null
  negativePrompt: string | null
  coverAssetId: string | null
  coverUrl: string | null
  tags: string[]
  enabled: boolean
  sortOrder: number
  createdAt: number
  updatedAt: number
}

export interface StylePresetSaveInput extends StylePromptParts {
  id?: string
  code: string
  name: string
  description?: string | null
  negativePrompt?: string | null
  coverAssetId?: string | null
  tags?: string[]
  enabled?: boolean
  sortOrder?: number
}

export interface StyleProjectDefaultRequest {
  workflowId: string
  stylePresetId: string | null
}

export interface StyleResolutionInput {
  nodeStylePresetId?: string | null
  projectDefaultStylePresetId?: string | null
  styles: StylePresetView[]
}

export interface StyleResolutionError {
  errorClass: 'style_not_found' | 'style_disabled'
  message: string
  presetId: string
  retryable: boolean
}

function clean(value: string | null | undefined): string {
  return value?.trim() ?? ''
}

/**
 * Composes content with a style preset using the same pure rule for preview and runtime.
 * @param content - Base prompt from node and upstream graph composition.
 * @param style - Style prompt parts, or null for no style injection.
 * @returns Final prompt with empty style parts skipped.
 * @see docs/api-contracts/styles.md
 */
export function composeStyledPrompt(content: string, style: StylePromptParts | null | undefined): string {
  const base = clean(content)
  if (!style) return base

  const before = clean(style.promptBefore)
  const after = clean(style.promptAfter)

  if (before || after) {
    return [before, base, after].filter((part) => part.length > 0).join('\n')
  }

  const legacy = clean(style.legacyPromptPreset)
  if (!legacy) return base
  return base ? `${base}\n\n画面风格：${legacy}` : `画面风格：${legacy}`
}

function styleError(errorClass: StyleResolutionError['errorClass'], presetId: string): StyleResolutionError {
  return {
    errorClass,
    message: `Style preset ${presetId} is ${errorClass === 'style_disabled' ? 'disabled' : 'unavailable'}.`,
    presetId,
    retryable: errorClass === 'style_disabled',
  }
}

/**
 * Resolves the effective style for a node run. Node override wins over project default.
 * @param input - Node style ID, project default style ID, and available style views.
 * @returns The enabled style preset, null when no style is selected, or a recoverable error.
 * @see docs/api-contracts/styles.md
 */
export function resolveEffectiveStylePreset(input: StyleResolutionInput): StylePresetView | StyleResolutionError | null {
  const effectiveId = input.nodeStylePresetId ?? input.projectDefaultStylePresetId ?? null
  if (!effectiveId) return null

  const preset = input.styles.find((style) => style.id === effectiveId)
  if (!preset) return styleError('style_not_found', effectiveId)
  if (!preset.enabled) return styleError('style_disabled', effectiveId)

  return preset
}
