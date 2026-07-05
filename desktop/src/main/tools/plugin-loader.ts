/**
 * Local plugin manifest loader with validation and quarantine diagnostics.
 * @see docs/api-contracts/tools-plugins.md
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

import { z } from 'zod'

import type { PluginDiagnostic, PluginManifest, ToolDescriptor, ToolPermission } from '../../../../shared/tools'
import { defineTool, type ToolDefinition, type ToolRuntime } from './runtime'

const permissionSchema = z.object({
  kind: z.enum(['canvas.read', 'canvas.write', 'file.read', 'file.write', 'network', 'provider.spend', 'destructive', 'diagnostics']),
  reason: z.string().min(1)
})

const toolDescriptorSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  category: z.enum(['canvas', 'asset', 'job', 'gateway', 'knowledge', 'file', 'web', 'model', 'custom']),
  owner: z.object({
    kind: z.literal('plugin'),
    id: z.string().min(1)
  }),
  inputSchemaRef: z.string().min(1),
  outputSchemaRef: z.string().min(1),
  permissions: z.array(permissionSchema),
  concurrency: z.enum(['readonly', 'serial-write', 'exclusive']),
  enabled: z.boolean()
})

const manifestSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.string().min(1),
  entrypoint: z.string().min(1),
  requestedPermissions: z.array(permissionSchema),
  tools: z.array(toolDescriptorSchema).min(1)
})

export interface PluginLoader {
  /** Returns diagnostics for loaded, disabled, and quarantined plugins. */
  listDiagnostics(): PluginDiagnostic[]
  /** Scans a plugins directory and registers valid plugin tools. */
  loadFromDirectory(pluginsDir: string): PluginDiagnostic[]
  /** Unloads all tools owned by a plugin id. */
  unload(pluginId: string): void
}

/**
 * Validates a plugin manifest payload.
 * @param raw - Parsed JSON manifest candidate.
 * @returns Valid manifest or null when validation fails.
 */
export function validatePluginManifest(raw: unknown): PluginManifest | null {
  const parsed = manifestSchema.safeParse(raw)
  if (!parsed.success) {
    return null
  }
  return parsed.data as PluginManifest
}

function createPluginToolDefinition(tool: ToolDescriptor, pluginId: string): ToolDefinition<Record<string, unknown>, Record<string, unknown>> {
  const descriptor: ToolDescriptor = {
    ...tool,
    owner: { kind: 'plugin', id: pluginId },
    enabled: false
  }

  return defineTool({
    descriptor,
    inputSchema: z.record(z.unknown()),
    outputSchema: z.record(z.unknown()),
    renderToolUseMessage: () => `Invoke plugin tool ${descriptor.id}`,
    call(input) {
      return {
        pluginId,
        toolId: descriptor.id,
        echo: input,
        status: 'plugin_stub_completed'
      }
    }
  })
}

/**
 * Creates a filesystem plugin loader wired to ToolRuntime.
 * @param options - Tool runtime dependency.
 * @returns Plugin loader API.
 */
export function createPluginLoader(options: { runtime: ToolRuntime }): PluginLoader {
  const diagnostics = new Map<string, PluginDiagnostic>()
  const loadedPluginIds = new Set<string>()

  return {
    listDiagnostics() {
      return [...diagnostics.values()].sort((left, right) => left.pluginId.localeCompare(right.pluginId))
    },
    loadFromDirectory(pluginsDir) {
      if (!existsSync(pluginsDir)) {
        return []
      }

      const entries = readdirSync(pluginsDir, { withFileTypes: true }).filter((entry) => entry.isDirectory())

      for (const entry of entries) {
        const pluginDir = join(pluginsDir, entry.name)
        const manifestPath = join(pluginDir, 'manifest.json')

        if (!existsSync(manifestPath)) {
          diagnostics.set(entry.name, {
            pluginId: entry.name,
            status: 'quarantined',
            messages: ['Missing manifest.json.']
          })
          continue
        }

        let raw: unknown
        try {
          raw = JSON.parse(readFileSync(manifestPath, 'utf8')) as unknown
        } catch {
          diagnostics.set(entry.name, {
            pluginId: entry.name,
            status: 'quarantined',
            messages: ['Manifest JSON parse failed.']
          })
          continue
        }

        const manifest = validatePluginManifest(raw)
        if (!manifest) {
          diagnostics.set(entry.name, {
            pluginId: entry.name,
            status: 'quarantined',
            messages: ['Plugin manifest failed validation.']
          })
          continue
        }

        if (manifest.id !== entry.name) {
          diagnostics.set(entry.name, {
            pluginId: entry.name,
            status: 'quarantined',
            messages: ['Manifest id must match plugin folder name.']
          })
          continue
        }

        for (const tool of manifest.tools) {
          options.runtime.register(createPluginToolDefinition(tool, manifest.id))
        }

        loadedPluginIds.add(manifest.id)
        diagnostics.set(manifest.id, {
          pluginId: manifest.id,
          status: 'loaded',
          messages: [`Registered ${manifest.tools.length} plugin tools (disabled by default).`]
        })
      }

      return this.listDiagnostics()
    },
    unload(pluginId) {
      for (const tool of options.runtime.list(true)) {
        if (tool.owner.kind === 'plugin' && tool.owner.id === pluginId) {
          options.runtime.disable(tool.id)
        }
      }
      loadedPluginIds.delete(pluginId)
      diagnostics.set(pluginId, {
        pluginId,
        status: 'disabled',
        messages: ['Plugin tools disabled and unloaded from active registry.']
      })
    }
  }
}
