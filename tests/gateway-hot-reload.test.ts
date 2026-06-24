import { describe, expect, it } from 'vitest'

import type { GatewayRequest, GatewayResult } from '../shared/gateway'
import type { GatewayConfigView } from '../shared/gateway'
import { createGatewayConfigReloader } from '../desktop/src/main/providers/gateway-reloader'
import { createGatewayRegistry } from '../desktop/src/main/providers/registry'
import type { GatewayProvider } from '../desktop/src/main/providers/stub.provider'
import { registerGatewayHandlers, type GatewayReloader } from '../desktop/src/main/ipc/gateway.handler'

type Handler = (_event: unknown, request: unknown) => unknown

interface FakeIpcMain {
  handle(channel: string, handler: Handler): void
}

interface ControlledProvider extends GatewayProvider {
  readonly calls: GatewayRequest[]
  release(resultPrefix: string): void
  waitUntilStarted(): Promise<void>
}

function createRequest(channel: GatewayRequest['channel'], modelKey = ''): GatewayRequest {
  return {
    channel,
    modelKey,
    prompt: 'hot reload prompt',
    references: [],
    parameters: {},
    idempotencyKey: `idem-${channel}`
  }
}

function createFakeIpcMain(): { ipcMain: FakeIpcMain; handlers: Map<string, Handler> } {
  const handlers = new Map<string, Handler>()

  return {
    handlers,
    ipcMain: {
      handle(channel, handler) {
        handlers.set(channel, handler)
      }
    }
  }
}

function textResult(text: string): GatewayResult {
  return { kind: 'text', text }
}

function createControlledProvider(id: string, prefix: string, modelSuffix: string): ControlledProvider {
  let release: ((resultPrefix: string) => void) | undefined
  let started: (() => void) | undefined
  const startedPromise = new Promise<void>((resolve) => {
    started = resolve
  })
  const resultPromise = new Promise<string>((resolve) => {
    release = resolve
  })
  const calls: GatewayRequest[] = []

  return {
    id,
    capabilities: ['text', 'image', 'video'],
    modelKeys: {
      text: `${modelSuffix}-text`,
      image: `${modelSuffix}-image`,
      video: `${modelSuffix}-video`
    },
    calls,
    async invoke(request) {
      calls.push(request)
      started?.()
      const resultPrefix = await resultPromise

      return textResult(`${prefix}:${resultPrefix}:${request.channel}:${request.modelKey}`)
    },
    release(resultPrefix) {
      release?.(resultPrefix)
    },
    waitUntilStarted() {
      return startedPromise
    }
  }
}

function createImmediateProvider(id: string, prefix: string, modelSuffix: string): GatewayProvider & { calls: GatewayRequest[] } {
  const calls: GatewayRequest[] = []

  return {
    id,
    capabilities: ['text', 'image', 'video'],
    modelKeys: {
      text: `${modelSuffix}-text`,
      image: `${modelSuffix}-image`,
      video: `${modelSuffix}-video`
    },
    calls,
    invoke(request) {
      calls.push(request)
      return textResult(`${prefix}:${request.channel}:${request.modelKey}`)
    }
  }
}

describe('M3 provider hot reload and model map', () => {
  it('rebuilds registry providers from enabled gateway configs with per-channel model maps', async () => {
    const registry = createGatewayRegistry()
    const config: GatewayConfigView = {
      id: 'gw-openai',
      name: 'OpenAI compatible',
      type: 'openai_compat',
      baseUrl: 'https://api.example.test/v1',
      capabilities: ['text', 'image'],
      modelMap: { text: 'gpt-4.1-mini', image: 'gpt-image-1' },
      enabled: true,
      keyRef: 'gateway:gw-openai'
    }
    const reloader = createGatewayConfigReloader({
      registry,
      resolveSecret: (keyRef) => `secret-for-${keyRef}`,
      fetchImpl: () =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              choices: [{ message: { content: 'reloaded text' } }],
              usage: { prompt_tokens: 1, completion_tokens: 2 }
            }),
            { headers: { 'content-type': 'application/json' } }
          )
        )
    })

    expect(reloader.reload([config])).toEqual({ reloadedGatewayIds: ['gw-openai'] })

    const result = await registry.invoke('gw-openai', createRequest('text'))

    expect(result).toEqual({
      kind: 'text',
      text: 'reloaded text',
      usage: {
        inputTokens: 1,
        outputTokens: 2
      }
    })
  })

  it('reloads stub configs under their configured gateway ID and model map', async () => {
    const registry = createGatewayRegistry()
    const reloader = createGatewayConfigReloader({ registry })

    expect(
      reloader.reload([
        {
          id: 'stub-main',
          name: 'Stub local gateway',
          type: 'stub',
          baseUrl: 'local://stub',
          capabilities: ['text', 'image', 'video'],
          modelMap: { text: 'local-text', image: 'local-image', video: 'local-video' },
          enabled: true,
          keyRef: 'none'
        }
      ])
    ).toEqual({ reloadedGatewayIds: ['stub-main'] })

    const result = await registry.invoke('stub-main', createRequest('text'))

    expect(result).toMatchObject({
      kind: 'text',
      text: 'Stub response for hot reload prompt'
    })
  })

  it('keeps in-flight invocations on the original provider while future jobs use the reloaded model map', async () => {
    const registry = createGatewayRegistry()
    const original = createControlledProvider('gw-main', 'old', 'old-model')
    const reloaded = createImmediateProvider('gw-main', 'new', 'new-model')

    registry.set('gw-main', original)
    const inFlight = registry.invoke('gw-main', createRequest('text', 'old-model-text'))
    await original.waitUntilStarted()

    expect(registry.reload([reloaded])).toEqual({ reloadedGatewayIds: ['gw-main'] })

    const futureText = await registry.invoke('gw-main', createRequest('text'))
    const futureImage = await registry.invoke('gw-main', createRequest('image'))
    const futureVideo = await registry.invoke('gw-main', createRequest('video'))

    original.release('done')

    await expect(inFlight).resolves.toEqual(textResult('old:done:text:old-model-text'))
    expect(futureText).toEqual(textResult('new:text:new-model-text'))
    expect(futureImage).toEqual(textResult('new:image:new-model-image'))
    expect(futureVideo).toEqual(textResult('new:video:new-model-video'))
    expect(original.calls.map((request) => request.modelKey)).toEqual(['old-model-text'])
    expect(reloaded.calls.map((request) => `${request.channel}:${request.modelKey}`)).toEqual([
      'text:new-model-text',
      'image:new-model-image',
      'video:new-model-video'
    ])
  })

  it('registers gateway.reload and hot-reloads saved gateway configs through the handler', () => {
    const { ipcMain, handlers } = createFakeIpcMain()
    const reloadCalls: string[][] = []
    const reloader: GatewayReloader = {
      reload(configs) {
        const ids = configs.map((config) => config.id)
        reloadCalls.push(ids)

        return { reloadedGatewayIds: ids }
      }
    }

    registerGatewayHandlers(ipcMain, { reloader })

    const saved = handlers.get('gateway.save')?.(
      {},
      {
        id: 'gw-hot',
        name: 'Hot provider',
        type: 'openai_compat',
        baseUrl: 'https://api.example.test/v1',
        auth: { mode: 'existingRef', keyRef: 'gateway:gw-hot' },
        capabilities: ['text', 'image'],
        modelMap: { text: 'gpt-4.1-mini', image: 'gpt-image-1' },
        enabled: true
      }
    )

    expect(saved).toMatchObject({
      id: 'gw-hot',
      modelMap: { text: 'gpt-4.1-mini', image: 'gpt-image-1' }
    })
    expect(reloadCalls).toEqual([['gw-hot']])

    expect(handlers.get('gateway.reload')?.({}, { gatewayId: 'gw-hot' })).toEqual({ reloadedGatewayIds: ['gw-hot'] })
    expect(reloadCalls).toEqual([['gw-hot'], ['gw-hot']])
  })
})
