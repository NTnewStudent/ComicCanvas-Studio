import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { afterEach, describe, expect, it, vi } from 'vitest'

import type { StorageConfigInput } from '../shared/ipc'
import type { SafeStorageAdapter } from '../desktop/src/main/security/key-vault'
import type { IpcRegistrar } from '../desktop/src/main/ipc/types'
import type { StorageProvider } from '../desktop/src/main/storage/storage-provider'
import type * as StorageHandlerModule from '../desktop/src/main/ipc/storage.handler'
import { migrateDatabaseAtPath, openDatabaseAtPath } from '../desktop/src/main/db/migrate'
import { createStorageConfigRepository, type StorageConfigRepository } from '../desktop/src/main/db/repositories/storage.repo'

const secret = 'unit-test-storage-secret'

function createAvailableSafeStorage(): SafeStorageAdapter {
  return {
    isEncryptionAvailable: () => true,
    encryptString: (plainText) => Buffer.from(`encrypted:${plainText}`, 'utf8'),
    decryptString: (encrypted) => {
      const text = Buffer.from(encrypted).toString('utf8')
      if (!text.startsWith('encrypted:')) {
        // Test adapter rejects malformed encrypted payloads.
        throw new Error('bad encrypted payload')
      }

      return text.slice('encrypted:'.length)
    }
  }
}

function createInput(overrides: Partial<StorageConfigInput> = {}): StorageConfigInput {
  return {
    provider: 'r2',
    endpoint: 'https://example-account.r2.cloudflarestorage.com',
    region: 'auto',
    bucket: 'unit-test-bucket',
    accessKeyId: 'unit-test-access-key',
    secretAccessKey: secret,
    publicUrlPrefix: '',
    ...overrides
  }
}

function createRegistrar(): { ipcMain: IpcRegistrar; handlers: Map<string, (event: unknown, request: unknown) => unknown> } {
  const handlers = new Map<string, (event: unknown, request: unknown) => unknown>()

  return {
    ipcMain: {
      handle(channel, handler) {
        handlers.set(channel, handler)
      }
    },
    handlers
  }
}

async function loadStorageHandler(): Promise<typeof StorageHandlerModule> {
  vi.resetModules()
  return import('../desktop/src/main/ipc/storage.handler')
}

function createStorageContext(tempDirs: string[], openDbs: Array<ReturnType<typeof openDatabaseAtPath>>): { dbPath: string; repository: StorageConfigRepository } {
  const configDir = mkdtempSync(join(tmpdir(), 'comic-canvas-storage-'))
  tempDirs.push(configDir)
  const dbPath = join(configDir, 'storage.sqlite')
  migrateDatabaseAtPath(dbPath)
  const db = openDatabaseAtPath(dbPath)
  openDbs.push(db)

  return {
    dbPath,
    repository: createStorageConfigRepository(db)
  }
}

describe('storage IPC handler persistence', () => {
  const tempDirs: string[] = []
  const openDbs: Array<ReturnType<typeof openDatabaseAtPath>> = []

  afterEach(() => {
    vi.restoreAllMocks()
    for (const db of openDbs.splice(0)) {
      db.close()
    }
    for (const dir of tempDirs.splice(0)) {
      rmSync(dir, { force: true, recursive: true })
    }
  })

  it('persists R2 credentials encrypted and redacts secrets from renderer reads', async () => {
    const { dbPath, repository } = createStorageContext(tempDirs, openDbs)
    const { registerStorageHandlers, getCurrentStorageConfig } = await loadStorageHandler()
    const { ipcMain, handlers } = createRegistrar()

    registerStorageHandlers(ipcMain, { repository, safeStorage: createAvailableSafeStorage(), clock: () => 1_783_400_000_000 })
    handlers.get('storage.saveConfig')?.(null, createInput())

    const savedText = readFileSync(dbPath, 'utf8')
    expect(savedText).not.toContain(secret)
    expect(repository.getById('cloud-media')).toMatchObject({
      id: 'cloud-media',
      provider: 'r2',
      region: 'auto',
      bucket: 'unit-test-bucket',
      accessKeyId: 'unit-test-access-key',
      secret: {
        keyRef: 'storage:cloud-media'
      }
    })

    expect(handlers.get('storage.getConfig')?.(null, undefined)).toMatchObject({
      provider: 'r2',
      endpoint: 'https://example-account.r2.cloudflarestorage.com',
      region: 'auto',
      bucket: 'unit-test-bucket',
      accessKeyId: 'unit-test-access-key',
      secretAccessKey: ''
    })
    expect(getCurrentStorageConfig()?.secretAccessKey).toBe(secret)
  })

  it('reloads encrypted config and reuses the previous secret when the renderer submits a blank secret', async () => {
    const { dbPath, repository } = createStorageContext(tempDirs, openDbs)
    const safeStorage = createAvailableSafeStorage()
    let module = await loadStorageHandler()
    let registrar = createRegistrar()

    module.registerStorageHandlers(registrar.ipcMain, { repository, safeStorage, clock: () => 1_783_400_000_000 })
    registrar.handlers.get('storage.saveConfig')?.(null, createInput())

    module = await loadStorageHandler()
    registrar = createRegistrar()
    module.registerStorageHandlers(registrar.ipcMain, { repository, safeStorage, clock: () => 1_783_400_000_100 })
    registrar.handlers.get('storage.saveConfig')?.(null, createInput({
      secretAccessKey: '',
      publicUrlPrefix: 'https://cdn.example.test'
    }))

    expect(module.getCurrentStorageConfig()?.secretAccessKey).toBe(secret)
    expect(registrar.handlers.get('storage.getConfig')?.(null, undefined)).toMatchObject({
      publicUrlPrefix: 'https://cdn.example.test',
      secretAccessKey: ''
    })
    expect(readFileSync(dbPath, 'utf8')).not.toContain(secret)
  })

  it('reuses the persisted secret for connection tests when renderer submits a redacted secret', async () => {
    const { repository } = createStorageContext(tempDirs, openDbs)
    const safeStorage = createAvailableSafeStorage()
    const module = await loadStorageHandler()
    const { storageFactory } = await import('../desktop/src/main/storage/storage-factory')
    const provider: StorageProvider = {
      id: 'mock',
      name: 'Mock Storage Provider',
      upload: () => Promise.resolve(''),
      query: () => Promise.resolve(''),
      rename: () => Promise.resolve(''),
      delete: () => Promise.resolve(),
      testConnection: () => Promise.resolve(true)
    }
    const createSpy = vi.spyOn(storageFactory, 'create').mockReturnValue(provider)
    const registrar = createRegistrar()

    module.registerStorageHandlers(registrar.ipcMain, { repository, safeStorage, clock: () => 1_783_400_000_000 })
    registrar.handlers.get('storage.saveConfig')?.(null, createInput())
    await registrar.handlers.get('storage.testConnection')?.(null, createInput({ secretAccessKey: '' }))

    expect(createSpy).toHaveBeenLastCalledWith(expect.objectContaining({
      bucket: 'unit-test-bucket',
      secretAccessKey: secret
    }))
  })
})
