import { describe, expect, it } from 'vitest'

import type { GatewayRequest } from '../shared/gateway'
import { createCreativeMediaProvider } from '../desktop/src/main/providers/creative-media.provider'

interface FetchCall {
  input: Parameters<typeof fetch>[0]
  init: Parameters<typeof fetch>[1]
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })
}

function requestBody(call: FetchCall | undefined): Record<string, unknown> {
  if (typeof call?.init?.body !== 'string') {
    throw new Error('expected JSON request body')
  }
  return JSON.parse(call.init.body) as Record<string, unknown>
}

function createFetchMock(): typeof fetch & { calls: FetchCall[] } {
  const calls: FetchCall[] = []
  const fetchMock = (async (input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    calls.push({ input, init })
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url

    if (url.endsWith('/chat/completions')) {
      return jsonResponse({ choices: [{ message: { content: 'hello creator' } }] })
    }

    return jsonResponse({ data: [{ b64_json: Buffer.from('image-result').toString('base64') }] })
  }) as typeof fetch & { calls: FetchCall[] }
  fetchMock.calls = calls
  return fetchMock
}

function request(overrides: Partial<GatewayRequest>): GatewayRequest {
  return {
    channel: 'text',
    modelKey: 'chat-1',
    prompt: 'hello',
    references: [],
    parameters: {},
    idempotencyKey: 'creative-media-test',
    ...overrides
  }
}

describe('Creative Media provider', () => {
  it('maps text routes to OpenAI chat completions with allowlisted parameters', async () => {
    const fetchMock = createFetchMock()
    const provider = createCreativeMediaProvider({
      id: 'creative-media',
      baseUrl: 'https://media.example.test/v1',
      apiKey: 'sk-creative-secret',
      routes: [{ channel: 'text', modelKey: 'chat-1', profile: 'openai_chat' }],
      fetchImpl: fetchMock
    })

    const result = await provider.invoke(request({ parameters: { temperature: 0.4, max_tokens: 120, vendor_only: true } }))

    expect(fetchMock.calls[0]?.input).toBe('https://media.example.test/v1/chat/completions')
    expect(requestBody(fetchMock.calls[0])).toEqual({
      model: 'chat-1',
      messages: [{ role: 'user', content: 'hello' }],
      temperature: 0.4,
      max_tokens: 120
    })
    expect(result).toEqual({ kind: 'text', text: 'hello creator' })
  })

  it('maps Nano Banana references without leaking unrelated parameters', async () => {
    const fetchMock = createFetchMock()
    const provider = createCreativeMediaProvider({
      id: 'creative-media',
      baseUrl: 'https://media.example.test/v1',
      apiKey: 'sk-creative-secret',
      routes: [{ channel: 'image', modelKey: 'nano-banana-2', profile: 'nano_banana' }],
      fetchImpl: fetchMock
    })

    const result = await provider.invoke(request({
      channel: 'image',
      modelKey: 'nano-banana-2',
      references: [{ assetId: 'asset-1', mediaType: 'image', url: 'https://assets.example.test/reference.png', role: 'reference' }],
      parameters: { size: '1024x1024', quality: 'hd', vendor_only: 'drop-me' }
    }))

    expect(fetchMock.calls[0]?.input).toBe('https://media.example.test/v1/images/generations')
    expect(requestBody(fetchMock.calls[0])).toEqual({
      model: 'nano-banana-2',
      prompt: 'hello',
      n: 1,
      response_format: 'b64_json',
      size: '1024x1024',
      quality: 'hd',
      images: ['https://assets.example.test/reference.png']
    })
    expect(result).toMatchObject({ kind: 'assetBytes', mediaType: 'image' })
  })

  it('maps Seedream images with its own defaults instead of Nano Banana fields', async () => {
    const fetchMock = createFetchMock()
    const provider = createCreativeMediaProvider({
      id: 'creative-media',
      baseUrl: 'https://media.example.test/v1',
      apiKey: 'sk-creative-secret',
      routes: [{ channel: 'image', modelKey: 'seedream-5', profile: 'seedream' }],
      fetchImpl: fetchMock
    })

    await provider.invoke(request({
      channel: 'image',
      modelKey: 'seedream-5',
      parameters: { resolution: '4K', quality: 'should-not-pass', vendor_only: 'drop-me' }
    }))

    expect(requestBody(fetchMock.calls[0])).toEqual({
      model: 'seedream-5',
      prompt: 'hello',
      size: '4K',
      response_format: 'url',
      watermark: false,
      stream: false
    })
  })
})
