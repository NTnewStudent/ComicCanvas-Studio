/**
 * Storage configuration IPC handlers.
 * Manages S3-compatible storage configuration (get/save/testConnection).
 * @see docs/api-contracts/storage-config.md
 */

import type { StorageConfigInput, StorageConnectionTestResult } from '../../../../shared/ipc'
import type { IpcRegistrar } from './types'
import { storageFactory } from '../storage/storage-factory'
import type { StorageConfig } from '../storage/storage-config'

/** In-memory storage config (TODO: persist to appData/storage-config.json with encrypted secrets) */
let currentConfig: StorageConfig | null = null

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

/**
 * Registers storage configuration IPC handlers on the given registrar.
 * @param ipcMain - IPC registrar (Electron ipcMain or test stub).
 * @see docs/api-contracts/storage-config.md
 */
export function registerStorageHandlers(ipcMain: IpcRegistrar): void {
  /**
   * Returns the current storage configuration or null if not yet configured.
   * @returns Current StorageConfig or null.
   */
  ipcMain.handle('storage.getConfig', () => {
    return currentConfig
  })

  /**
   * Saves a new storage configuration (in-memory for now).
   * @see docs/api-contracts/storage-config.md
   */
  ipcMain.handle('storage.saveConfig', (_event: unknown, request: unknown) => {
    const config = request as StorageConfigInput
    currentConfig = toInternalConfig(config)
    // TODO: persist to appData/storage-config.json (encrypt secretAccessKey via key-vault / safeStorage)
  })

  /**
   * Tests a storage provider connection using the supplied configuration.
   * @returns Connection test result with ok flag and optional error message.
   * @see docs/api-contracts/storage-config.md
   */
  ipcMain.handle('storage.testConnection', async (_event: unknown, request: unknown): Promise<StorageConnectionTestResult> => {
    const config = request as StorageConfigInput
    try {
      const provider = storageFactory.create(toInternalConfig(config))
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
