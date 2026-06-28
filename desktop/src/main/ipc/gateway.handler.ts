/**
 * Gateway IPC handler skeleton.
 * @see docs/api-contracts/gateway-providers.md
 */

import type { GatewayAuthInput, GatewayCapability, GatewayConfigInput, GatewayConfigView, GatewayFetchedModel, GatewayFetchModelsRequest, GatewayType } from '../../../../shared/gateway'
import type { IpcResponseMap } from '../../../../shared/ipc'
import type { JobTicket } from '../../../../shared/jobs'
import { buildModelCatalog } from '../../../../shared/workflow-node-definitions'
import { createSafeErrorEnvelope } from './safe-error'
import type { IpcRegistrar } from './types'

const gatewayConfigs = new Map<string, GatewayConfigView>()

export interface GatewayReloader {
  reload(configs: GatewayConfigView[]): IpcResponseMap['gateway.reload']
}

export interface GatewayHandlerOptions {
  reloader?: GatewayReloader
}

function createGatewayTicket(gatewayId: string): JobTicket {
  return {
    jobId: `job-gateway-${gatewayId}`,
    status: 'pending',
    createdAt: 1
  }
}

function createDefaultGateway(): GatewayConfigView {
  return {
    id: 'stub-main',
    name: 'Stub local gateway',
    type: 'stub',
    baseUrl: 'local://stub',
    capabilities: ['text', 'image', 'video'],
    modelMap: { text: 'stub-text', image: 'stub-image', video: 'stub-video' },
    enabled: true,
    keyRef: 'local-stub'
  }
}

function ensureDefaultGateway(): void {
  if (gatewayConfigs.size === 0) {
    const stub = createDefaultGateway()
    gatewayConfigs.set(stub.id, stub)
  }
}

function gatewayId(input: GatewayConfigInput): string {
  return input.id ?? `gateway-${input.name.trim().toLowerCase().replace(/[^a-z0-9]+/gu, '-').replace(/^-|-$/gu, '') || 'provider'}`
}

function gatewayType(value: unknown): GatewayType {
  return value === 'async_media_task' || value === 'stub' ? value : 'openai_compat'
}

function capabilities(value: unknown): GatewayCapability[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.filter((item): item is GatewayCapability => ['text', 'image', 'video', 'image.edit', 'video.firstFrame', 'video.lastFrame'].includes(String(item)))
}

function viewFromInput(input: GatewayConfigInput): GatewayConfigView {
  const id = gatewayId(input)
  const existing = gatewayConfigs.get(id)
  const keyRef =
    input.auth.mode === 'apiKey'
      ? `vault:${id}`
      : input.auth.mode === 'existingRef'
        ? input.auth.keyRef
        : existing?.keyRef ?? 'none'

  return {
    id,
    name: input.name,
    type: gatewayType(input.type),
    baseUrl: input.baseUrl,
    capabilities: capabilities(input.capabilities),
    modelMap: input.modelMap,
    enabled: input.enabled,
    keyRef
  }
}

function selectedConfigs(gatewayId?: string): GatewayConfigView[] {
  if (gatewayId) {
    const config = gatewayConfigs.get(gatewayId)
    return config?.enabled === true ? [config] : []
  }

  return Array.from(gatewayConfigs.values()).filter((config) => config.enabled)
}

function reloadGateways(reloader: GatewayReloader | undefined, gatewayId?: string): IpcResponseMap['gateway.reload'] {
  const configs = selectedConfigs(gatewayId)

  if (!reloader) {
    return { reloadedGatewayIds: configs.map((config) => config.id) }
  }

  return reloader.reload(configs)
}

function modelsEndpoint(baseUrl: string): string {
  return `${baseUrl.replace(/\/+$/u, '')}/models`
}

function apiKeyFromAuth(auth: GatewayAuthInput | undefined): string | null {
  return auth?.mode === 'apiKey' && auth.secret.trim().length > 0 ? auth.secret.trim() : null
}

function readModelRecord(value: unknown): GatewayFetchedModel | null {
  if (typeof value !== 'object' || value === null || !('id' in value) || typeof value.id !== 'string' || value.id.trim().length === 0) {
    return null
  }

  const record = value as Record<string, unknown>
  const id = value.id.trim()
  const model: GatewayFetchedModel = { id }
  if (typeof record.owned_by === 'string' && record.owned_by.length > 0) model.ownedBy = record.owned_by
  if (typeof record.ownedBy === 'string' && record.ownedBy.length > 0) model.ownedBy = record.ownedBy
  if (typeof record.created === 'number') model.created = record.created
  return model
}

function parseModelsResponse(body: unknown): GatewayFetchedModel[] {
  const data = typeof body === 'object' && body !== null && 'data' in body ? (body as { data?: unknown }).data : body
  if (!Array.isArray(data)) {
    return []
  }

  const models = data.map(readModelRecord).filter((item): item is GatewayFetchedModel => item !== null)
  const unique = new Map<string, GatewayFetchedModel>()
  for (const model of models) {
    if (!unique.has(model.id)) {
      unique.set(model.id, model)
    }
  }

  return Array.from(unique.values()).sort((left, right) => left.id.localeCompare(right.id))
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return null
  }
}

async function fetchGatewayModels(request: GatewayFetchModelsRequest): Promise<IpcResponseMap['gateway.fetchModels']> {
  const saved = request.gatewayId ? gatewayConfigs.get(request.gatewayId) : undefined
  const baseUrl = request.baseUrl?.trim() || saved?.baseUrl
  if (!baseUrl) {
    throw new Error('gateway_base_url_required')
  }

  const apiKey = apiKeyFromAuth(request.auth)
  const headers: Record<string, string> = {}
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`
  }

  const response = await fetch(modelsEndpoint(baseUrl), { headers })
  const body = await readJson(response)
  if (!response.ok) {
    throw new Error(`gateway_models_request_failed:${response.status}`)
  }

  return {
    ...(saved ? { gatewayId: saved.id } : {}),
    models: parseModelsResponse(body)
  }
}

/**
 * Registers gateway invoke handlers.
 * @param ipcMain - Electron-compatible IPC registrar.
 * @param options - Optional runtime integrations for hot reload.
 * @returns void.
 * @throws Error when the registrar rejects handler registration.
 * @see docs/api-contracts/gateway-providers.md
 */
export function registerGatewayHandlers(ipcMain: IpcRegistrar, options: GatewayHandlerOptions = {}): void {
  ensureDefaultGateway()

  ipcMain.handle('gateway.list', () => Array.from(gatewayConfigs.values()))
  ipcMain.handle('gateway.save', (_event, request) => {
    const input = request as GatewayConfigInput
    const saved = viewFromInput(input)
    gatewayConfigs.set(saved.id, saved)
    reloadGateways(options.reloader, saved.id)

    return saved
  })
  ipcMain.handle('gateway.delete', (_event, request) => {
    const gatewayId = typeof request === 'object' && request !== null && 'gatewayId' in request ? String(request.gatewayId) : 'unknown'
    gatewayConfigs.delete(gatewayId)

    return { gatewayId, deleted: true as const }
  })
  ipcMain.handle('gateway.test', (_event, request) => {
    const gatewayId = typeof request === 'object' && request !== null && 'gatewayId' in request ? String(request.gatewayId) : 'unknown'

    return createGatewayTicket(gatewayId)
  })
  ipcMain.handle('gateway.reload', (_event, request) => {
    const gatewayId = typeof request === 'object' && request !== null && 'gatewayId' in request && typeof request.gatewayId === 'string' ? request.gatewayId : undefined

    return reloadGateways(options.reloader, gatewayId)
  })
  ipcMain.handle('gateway.models', () => buildModelCatalog(Array.from(gatewayConfigs.values())))
  ipcMain.handle('gateway.fetchModels', (_event, request) => fetchGatewayModels(request as GatewayFetchModelsRequest))
}

/**
 * Returns the current renderer-safe model catalog from gateway configuration.
 * @returns Model catalog grouped by channel without secret references.
 * @throws Error never intentionally.
 * @see docs/api-contracts/gateway-providers.md
 */
export function getGatewayModelCatalog(): IpcResponseMap['gateway.models'] {
  ensureDefaultGateway()
  return buildModelCatalog(Array.from(gatewayConfigs.values()))
}

export { createSafeErrorEnvelope }
