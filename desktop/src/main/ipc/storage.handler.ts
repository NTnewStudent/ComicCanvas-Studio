/**
 * Storage configuration IPC handlers.
 * Manages S3-compatible storage configuration (get/save/testConnection).
 * @see docs/api-contracts/storage-config.md
 */

import type { StorageConfigInput, StorageConnectionTestResult } from '../../../../shared/ipc'
import type { IpcRegistrar } from './types'
import { createKeyVault, type SafeStorageAdapter } from '../security/key-vault'
import { storageFactory } from '../storage/storage-factory'
import type { StorageConfig } from '../storage/storage-config'
import type { PersistedStorageConfig, StorageConfigRepository } from '../db/repositories/storage.repo'

let currentConfig: StorageConfig | null = null
let persistedRecord: PersistedStorageConfig | null = null
const storageConfigId = 'cloud-media'

/** Options injected by Electron bootstrap for encrypted storage config persistence. */
export interface StorageHandlerOptions {
  repository?: StorageConfigRepository
  safeStorage?: SafeStorageAdapter
  clock?: () => number
}

/**
 * Returns the current storage configuration for use by other handlers.
 * @returns Current StorageConfig or null if not yet configured.
 */
export function getCurrentStorageConfig(): StorageConfig | null {
  return currentConfig
}

/**
 * Maps the shared IPC StorageConfigInput to the internal StorageConfig type.
 * Strips undefined optional fields to satisfy exactOptionalPropertyTypes.
 * @param input - Storage configuration from the renderer process.
 * @returns Internal StorageConfig compatible with StorageFactory.
 */
function toInternalConfig(input: StorageConfigInput): StorageConfig {
  const config: StorageConfig = {
    provider: input.provider,
    endpoint: input.endpoint,
    bucket: input.bucket,
    accessKeyId: input.accessKeyId,
    secretAccessKey: input.secretAccessKey
  }
  // 仅在有值时设置可选字段，避免 exactOptionalPropertyTypes 冲突
  if (input.region != null) config.region = input.region
  if (input.publicUrlPrefix != null) config.publicUrlPrefix = input.publicUrlPrefix
  return config
}

function toRendererConfig(config: StorageConfig | null): StorageConfigInput | null {
  if (!config) {
    return null
  }

  const input: StorageConfigInput = {
    provider: config.provider,
    endpoint: config.endpoint,
    bucket: config.bucket,
    accessKeyId: config.accessKeyId,
    secretAccessKey: ''
  }

  if (config.region != null) input.region = config.region
  if (config.publicUrlPrefix != null) input.publicUrlPrefix = config.publicUrlPrefix
  return input
}

function assertStorageAvailable(options: StorageHandlerOptions): SafeStorageAdapter {
  if (!options.safeStorage) {
    throw new Error('storage_secret_unavailable')
  }

  return options.safeStorage
}

function persistedToRuntimeConfig(parsed: PersistedStorageConfig, safeStorage: SafeStorageAdapter): StorageConfig {
  const vault = createKeyVault({ safeStorage, namespace: 'storage' })
  const runtime: StorageConfig = {
    provider: parsed.provider,
    endpoint: parsed.endpoint,
    bucket: parsed.bucket,
    accessKeyId: parsed.accessKeyId,
    secretAccessKey: vault.decryptSecret(parsed.secret)
  }

  if (parsed.region != null) runtime.region = parsed.region
  if (parsed.publicUrlPrefix != null) runtime.publicUrlPrefix = parsed.publicUrlPrefix
  return runtime
}

function loadInitialConfig(options: StorageHandlerOptions): void {
  if (!options.repository || !options.safeStorage) {
    return
  }

  const loaded = options.repository.getById(storageConfigId)
  if (!loaded) {
    return
  }

  persistedRecord = loaded
  currentConfig = persistedToRuntimeConfig(loaded, options.safeStorage)
}

function saveToRepository(input: StorageConfigInput, encryptedSecret: PersistedStorageConfig['secret'], options: Required<Pick<StorageHandlerOptions, 'repository' | 'clock'>>): PersistedStorageConfig {
  const saved = options.repository.save({
    id: storageConfigId,
    provider: input.provider,
    endpoint: input.endpoint,
    ...(input.region != null ? { region: input.region } : {}),
    bucket: input.bucket,
    accessKeyId: input.accessKeyId,
    secret: encryptedSecret,
    ...(input.publicUrlPrefix != null ? { publicUrlPrefix: input.publicUrlPrefix } : {}),
    updatedAt: options.clock()
  })

  return saved
}

function requireRepository(options: StorageHandlerOptions): StorageConfigRepository | null {
  if (!options.repository) {
    return null
  }

  return options.repository
}

function saveConfig(input: StorageConfigInput, options: StorageHandlerOptions): void {
  const repository = requireRepository(options)
  if (!repository) {
    currentConfig = toInternalConfig(input)
    return
  }

  const safeStorage = assertStorageAvailable(options)
  const vault = createKeyVault({ safeStorage, namespace: 'storage' })
  const encryptedSecret = input.secretAccessKey.length > 0
    ? vault.encryptSecret({ providerId: 'cloud-media', secret: input.secretAccessKey })
    : persistedRecord?.secret

  if (!encryptedSecret) {
    throw new Error('storage_secret_required')
  }

  persistedRecord = saveToRepository(input, encryptedSecret, {
    repository,
    clock: options.clock ?? Date.now
  })
  currentConfig = {
    ...toInternalConfig(input),
    secretAccessKey: input.secretAccessKey.length > 0 ? input.secretAccessKey : vault.decryptSecret(encryptedSecret)
  }
}

function isSameStorageTarget(input: StorageConfigInput, config: StorageConfig): boolean {
  return input.provider === config.provider
    && input.endpoint === config.endpoint
    && input.bucket === config.bucket
    && input.accessKeyId === config.accessKeyId
}

function toTestConfig(input: StorageConfigInput): StorageConfig {
  const config = toInternalConfig(input)
  if (config.secretAccessKey.length > 0 || !currentConfig || !isSameStorageTarget(input, currentConfig)) {
    return config
  }

  return {
    ...config,
    secretAccessKey: currentConfig.secretAccessKey
  }
}

/**
 * Registers storage configuration IPC handlers on the given registrar.
 * @param ipcMain - IPC registrar (Electron ipcMain or test stub).
 * @see docs/api-contracts/storage-config.md
 */
export function registerStorageHandlers(ipcMain: IpcRegistrar, options: StorageHandlerOptions = {}): void {
  loadInitialConfig(options)

  /**
   * Returns the current storage configuration or null if not yet configured.
   * @returns Current StorageConfig or null.
   */
  ipcMain.handle('storage.getConfig', () => {
    return toRendererConfig(currentConfig)
  })

  /**
   * Saves a storage configuration to the repository with encrypted secret material.
   * @see docs/api-contracts/storage-config.md
   */
  ipcMain.handle('storage.saveConfig', (_event: unknown, request: unknown) => {
    const config = request as StorageConfigInput
    saveConfig(config, options)
  })

  /**
   * Tests a storage provider connection using the supplied configuration.
   * @returns Connection test result with ok flag and optional error message.
   * @see docs/api-contracts/storage-config.md
   */
  ipcMain.handle('storage.testConnection', async (_event: unknown, request: unknown): Promise<StorageConnectionTestResult> => {
    const config = request as StorageConfigInput
    try {
      const provider = storageFactory.create(toTestConfig(config))
      const ok = await provider.testConnection()
      // 连接测试失败时附带错误信息
      if (!ok) {
        return { ok: false, error: '连接失败' }
      }
      return { ok: true }
    } catch (err: unknown) {
      // 捕获 provider 构造或网络异常，返回安全错误信息
      const message = err instanceof Error ? err.message : '未知错误'
      return { ok: false, error: message }
    }
  })
}
