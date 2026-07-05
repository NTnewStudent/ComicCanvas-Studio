import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it } from 'vitest'

import { createPluginLoader, validatePluginManifest } from '../desktop/src/main/tools/plugin-loader'
import { createToolRuntime } from '../desktop/src/main/tools/runtime'

describe('PluginLoader', () => {
  let tempRoot = ''

  afterEach(() => {
    if (tempRoot) {
      rmSync(tempRoot, { recursive: true, force: true })
      tempRoot = ''
    }
  })

  it('quarantines invalid plugin manifests', () => {
    tempRoot = mkdtempSync(join(tmpdir(), 'cc-plugin-'))
    const pluginDir = join(tempRoot, 'bad-plugin')
    mkdirSync(pluginDir, { recursive: true })
    writeFileSync(join(pluginDir, 'manifest.json'), JSON.stringify({ id: 'wrong' }), 'utf8')

    const runtime = createToolRuntime()
    const loader = createPluginLoader({ runtime })
    const diagnostics = loader.loadFromDirectory(tempRoot)

    expect(diagnostics.find((entry) => entry.pluginId === 'bad-plugin')?.status).toBe('quarantined')
    expect(runtime.list(true).some((tool) => tool.owner.kind === 'plugin')).toBe(false)
  })

  it('registers valid plugin tools disabled by default and rejects invoke until enabled', async () => {
    tempRoot = mkdtempSync(join(tmpdir(), 'cc-plugin-valid-'))
    const pluginDir = join(tempRoot, 'demo-plugin')
    mkdirSync(pluginDir, { recursive: true })

    const manifest = {
      id: 'demo-plugin',
      name: 'Demo Plugin',
      version: '1.0.0',
      entrypoint: 'index.js',
      requestedPermissions: [{ kind: 'diagnostics', reason: 'Diagnostics only.' }],
      tools: [{
        id: 'demo.echo',
        name: 'Echo',
        description: 'Echoes input.',
        category: 'custom',
        owner: { kind: 'plugin', id: 'demo-plugin' },
        inputSchemaRef: 'demo.echo.input',
        outputSchemaRef: 'demo.echo.output',
        permissions: [{ kind: 'diagnostics', reason: 'Diagnostics only.' }],
        concurrency: 'readonly',
        enabled: true
      }]
    }

    expect(validatePluginManifest(manifest)).not.toBeNull()
    writeFileSync(join(pluginDir, 'manifest.json'), JSON.stringify(manifest), 'utf8')

    const runtime = createToolRuntime()
    const loader = createPluginLoader({ runtime })
    loader.loadFromDirectory(tempRoot)

    const disabled = await runtime.invoke({
      toolId: 'demo.echo',
      input: { hello: 'world' },
      actor: { type: 'user', id: 'tester' },
      traceId: 'trace-plugin'
    })
    expect(disabled.error?.errorClass).toBe('tool_not_found')

    runtime.enable('demo.echo')
    const enabled = await runtime.invoke({
      toolId: 'demo.echo',
      input: { hello: 'world' },
      actor: { type: 'user', id: 'tester' },
      traceId: 'trace-plugin-2'
    })
    expect(enabled.record.status).toBe('completed')
  })
})
