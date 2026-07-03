/**
 * Local gateway bootstrap loader.
 *
 * Reads gateway definitions (including API keys) from a local, git-ignored JSON
 * file so a developer can run the app against a real provider without typing the
 * key into the settings UI on every launch. The file lives outside version
 * control; secrets are never written into tracked source.
 *
 * @see docs/api-contracts/gateway-providers.md
 */

import { existsSync, readFileSync } from 'node:fs'

import type { GatewayCapability, GatewayConfigView, GatewayModelMap, GatewayType } from '../../../../shared/gateway'

interface LocalGatewayFileEntry {
  id: string
  name?: string
  type?: GatewayType
  baseUrl: string
  apiKey?: string
  capabilities?: GatewayCapability[]
  modelMap: GatewayModelMap
  enabled?: boolean
}

interface LocalGatewayFile {
  gateways?: LocalGatewayFileEntry[]
}

export interface LoadedLocalGateways {
  /** Renderer-safe gateway config views (no secrets). */
  configs: GatewayConfigView[]
  /** Map of keyRef -> plaintext secret used only by the in-process reloader. */
  secretsByKeyRef: Record<string, string>
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeEntry(entry: unknown): { config: GatewayConfigView; apiKey?: string } | null {
  if (!isRecord(entry) || typeof entry.id !== 'string' || typeof entry.baseUrl !== 'string' || !isRecord(entry.modelMap)) {
    return null
  }

  const local = entry as unknown as LocalGatewayFileEntry
  const keyRef = `vault:${local.id}`
  const config: GatewayConfigView = {
    id: local.id,
    name: local.name ?? local.id,
    type: local.type ?? 'openai_compat',
    baseUrl: local.baseUrl,
    capabilities: local.capabilities ?? ['text'],
    modelMap: local.modelMap,
    enabled: local.enabled !== false,
    keyRef
  }

  return typeof local.apiKey === 'string' && local.apiKey.length > 0 ? { config, apiKey: local.apiKey } : { config }
}

/**
 * Loads local gateway definitions from a JSON file, if present.
 * @param filePath - Absolute path to the local gateways file.
 * @returns Parsed gateway config views and a keyRef->secret map; empty when the file is absent or invalid.
 * @throws Error never intentionally; unreadable/invalid files yield empty results.
 * @see docs/api-contracts/gateway-providers.md
 */
export function loadLocalGateways(filePath: string): LoadedLocalGateways {
  if (!existsSync(filePath)) {
    return { configs: [], secretsByKeyRef: {} }
  }

  let parsed: LocalGatewayFile
  try {
    parsed = JSON.parse(readFileSync(filePath, 'utf8')) as LocalGatewayFile
  } catch {
    // A malformed local file must not crash startup; the app falls back to the stub gateway.
    return { configs: [], secretsByKeyRef: {} }
  }

  const configs: GatewayConfigView[] = []
  const secretsByKeyRef: Record<string, string> = {}

  for (const entry of parsed.gateways ?? []) {
    const normalized = normalizeEntry(entry)
    if (!normalized) {
      continue
    }
    configs.push(normalized.config)
    if (normalized.apiKey) {
      secretsByKeyRef[normalized.config.keyRef] = normalized.apiKey
    }
  }

  return { configs, secretsByKeyRef }
}
