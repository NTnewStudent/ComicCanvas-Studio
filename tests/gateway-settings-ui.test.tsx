// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'

import React from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, type Mock, vi } from 'vitest'

import type { GatewayConfigInput, GatewayConfigView } from '../shared/gateway'
import { GatewayForm } from '../desktop/src/renderer/src/settings/GatewayForm'
import { GatewayList, type GatewaySettingsApi } from '../desktop/src/renderer/src/settings/GatewayList'

const existingGateways: GatewayConfigView[] = [
  {
    id: 'gw-openai',
    name: 'OpenAI 主通道',
    type: 'openai_compat',
    baseUrl: 'https://api.openai.example/v1',
    capabilities: ['text', 'image'],
    modelMap: { text: 'gpt-4.1-mini', image: 'gpt-image-1' },
    enabled: true,
    keyRef: 'vault:openai-main'
  },
  {
    id: 'gw-video',
    name: '视频异步通道',
    type: 'async_media_task',
    baseUrl: 'https://video.example/v1',
    capabilities: ['video'],
    modelMap: { video: 'video-task-model' },
    enabled: false,
    keyRef: 'vault:video-main'
  }
]

function createApi(overrides: Partial<GatewaySettingsApi> = {}): GatewaySettingsApi {
  return {
    listGateways: vi.fn().mockResolvedValue(existingGateways),
    saveGateway: vi.fn().mockImplementation((input: GatewayConfigInput) =>
      Promise.resolve({
        id: input.id ?? 'gw-new',
        name: input.name,
        type: input.type,
        baseUrl: input.baseUrl,
        capabilities: input.capabilities,
        modelMap: input.modelMap,
        enabled: input.enabled,
        keyRef: input.auth.mode === 'apiKey' ? 'vault:new-key' : 'vault:existing'
      } satisfies GatewayConfigView)
    ),
    deleteGateway: vi.fn().mockResolvedValue({ gatewayId: 'gw-video', deleted: true }),
    testGateway: vi.fn().mockResolvedValue({ jobId: 'job-gateway-gw-openai', status: 'pending', createdAt: 1 }),
    fetchGatewayModels: vi.fn().mockResolvedValue({
      models: [
        { id: 'gpt-4.1-mini' },
        { id: 'gpt-image-1' },
        { id: 'wan-video-1' },
      ],
    }),
    ...overrides
  }
}

function mockOf<T extends (...args: never[]) => unknown>(fn: T): Mock {
  return fn as unknown as Mock
}

afterEach(() => {
  cleanup()
})

describe('M3 Gateway settings UI', () => {
  it('renders gateway cards with masked keys, model mapping, and enabled state', async () => {
    render(<GatewayList api={createApi()} />)

    expect(await screen.findByText('OpenAI 主通道')).toBeInTheDocument()
    expect(screen.getByText('视频异步通道')).toBeInTheDocument()
    expect(screen.getByText('vault:op...main')).toBeInTheDocument()
    expect(screen.getByText('gpt-4.1-mini')).toBeInTheDocument()
    expect(screen.getByText('gpt-image-1')).toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'OpenAI 主通道 enabled' })).toBeChecked()
    expect(screen.getByRole('switch', { name: '视频异步通道 enabled' })).not.toBeChecked()
  })

  it('saves a new gateway with API key, capabilities, and model mappings', async () => {
    const api = createApi({ listGateways: vi.fn().mockResolvedValue([]) })
    render(<GatewayList api={api} />)

    fireEvent.click(await screen.findByRole('button', { name: '添加网关' }))
    fireEvent.change(screen.getByRole('textbox', { name: '网关名称' }), { target: { value: '即梦视频' } })
    fireEvent.change(screen.getByRole('textbox', { name: '基础 URL' }), { target: { value: 'https://video.example/v1' } })
    fireEvent.change(screen.getByLabelText('API key'), { target: { value: 'sk-video-secret' } })
    fireEvent.click(screen.getByRole('checkbox', { name: '视频能力' }))
    fireEvent.change(screen.getByRole('textbox', { name: '视频模型键' }), { target: { value: 'video-task-model' } })
    fireEvent.click(screen.getByRole('button', { name: '保存网关' }))

    const saveGateway = mockOf(api.saveGateway)
    await waitFor(() => expect(saveGateway).toHaveBeenCalledTimes(1))
    expect(saveGateway).toHaveBeenCalledWith({
      name: '即梦视频',
      type: 'openai_compat',
      baseUrl: 'https://video.example/v1',
      auth: { mode: 'apiKey', secret: 'sk-video-secret' },
      capabilities: ['text', 'image', 'video'],
      modelMap: {
        video: 'video-task-model'
      },
      enabled: true
    })
  })

  it('edits enabled state and tests a gateway through IPC actions', async () => {
    const api = createApi()
    render(<GatewayList api={api} />)

    const openaiCard = await screen.findByText('OpenAI 主通道')
    expect(openaiCard).toBeInTheDocument()

    fireEvent.click(screen.getByRole('switch', { name: 'OpenAI 主通道 enabled' }))
    const saveGateway = mockOf(api.saveGateway)
    await waitFor(() => expect(saveGateway).toHaveBeenCalled())
    expect(saveGateway).toHaveBeenLastCalledWith({
      id: 'gw-openai',
      name: 'OpenAI 主通道',
      type: 'openai_compat',
      baseUrl: 'https://api.openai.example/v1',
      auth: { mode: 'existingRef', keyRef: 'vault:openai-main' },
      capabilities: ['text', 'image'],
      modelMap: { text: 'gpt-4.1-mini', image: 'gpt-image-1' },
      enabled: false
    })

    fireEvent.click(screen.getByRole('button', { name: '测试 OpenAI 主通道' }))
    const testGateway = mockOf(api.testGateway)
    await waitFor(() => expect(testGateway).toHaveBeenCalledWith({ gatewayId: 'gw-openai', channel: 'text' }))
    expect(await screen.findByText('测试已排队：job-gateway-gw-openai')).toBeInTheDocument()
  })

  it('confirms before deleting a gateway', async () => {
    const api = createApi()
    render(<GatewayList api={api} />)

    await screen.findByText('视频异步通道')
    fireEvent.click(screen.getByRole('button', { name: '删除 视频异步通道' }))

    expect(screen.getByRole('alertdialog', { name: '删除网关 视频异步通道' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '确认删除' }))

    const deleteGateway = mockOf(api.deleteGateway)
    await waitFor(() => expect(deleteGateway).toHaveBeenCalledWith({ gatewayId: 'gw-video' }))
  })

  it('submits existing key refs when editing without a new secret', () => {
    const onSubmit = vi.fn()

    render(<GatewayForm gateway={existingGateways[0]} onSubmit={onSubmit} onCancel={vi.fn()} />)

    fireEvent.change(screen.getByRole('textbox', { name: '图片模型键' }), { target: { value: 'gpt-image-2' } })
    fireEvent.click(screen.getByRole('button', { name: '保存网关' }))

    expect(onSubmit).toHaveBeenCalledWith({
      id: 'gw-openai',
      name: 'OpenAI 主通道',
      type: 'openai_compat',
      baseUrl: 'https://api.openai.example/v1',
      auth: { mode: 'existingRef', keyRef: 'vault:openai-main' },
      capabilities: ['text', 'image'],
      modelMap: { text: 'gpt-4.1-mini', image: 'gpt-image-2' },
      enabled: true
    })
  })

  it('fetches OpenAI-compatible models and drag-routes one into a channel', async () => {
    const onSubmit = vi.fn()
    const fetchModels = vi.fn().mockResolvedValue({
      models: [
        { id: 'gpt-4.1-mini' },
        { id: 'gpt-image-1' },
        { id: 'wan-video-1' },
      ],
    })

    render(<GatewayForm onSubmit={onSubmit} onCancel={vi.fn()} fetchModels={fetchModels} />)

    fireEvent.change(screen.getByRole('textbox', { name: '网关名称' }), { target: { value: '统一网关' } })
    fireEvent.change(screen.getByRole('textbox', { name: '基础 URL' }), { target: { value: 'https://api.openai.example/v1' } })
    fireEvent.change(screen.getByLabelText('API key'), { target: { value: 'sk-test' } })
    fireEvent.click(screen.getByRole('button', { name: '获取模型列表' }))

    await screen.findByText('已获取 3 个模型，拖到下方分类即可。')
    const dataTransfer = {
      data: '',
      setData(_type: string, value: string) {
        this.data = value
      },
      getData() {
        return this.data
      },
    }
    fireEvent.dragStart(screen.getByRole('button', { name: '模型 wan-video-1' }), { dataTransfer })
    fireEvent.drop(screen.getByRole('textbox', { name: '视频模型键' }).previousElementSibling as HTMLElement, { dataTransfer })
    fireEvent.click(screen.getByRole('button', { name: '保存网关' }))

    expect(fetchModels).toHaveBeenCalledWith({
      baseUrl: 'https://api.openai.example/v1',
      auth: { mode: 'apiKey', secret: 'sk-test' },
    })
    expect(onSubmit).toHaveBeenCalledWith({
      name: '统一网关',
      type: 'openai_compat',
      baseUrl: 'https://api.openai.example/v1',
      auth: { mode: 'apiKey', secret: 'sk-test' },
      capabilities: ['text', 'image', 'video'],
      modelMap: { video: 'wan-video-1' },
      enabled: true,
    })
  })
})
