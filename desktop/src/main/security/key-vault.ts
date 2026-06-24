/**
 * Encrypted provider secret vault backed by Electron safeStorage-compatible APIs.
 * @see docs/api-contracts/gateway-providers.md
 */

import type { GatewayError } from '../../../../shared/gateway'

export interface SafeStorageAdapter {
  isEncryptionAvailable(): boolean
  encryptString(plainText: string): Buffer
  decryptString(encrypted: Buffer): string
}

export interface KeyVaultSecretInput {
  providerId: string
  secret: string
}

export interface KeyVaultRecord {
  keyRef: string
  ciphertext: string
}

export interface KeyVaultOptions {
  safeStorage: SafeStorageAdapter
  namespace?: string
}

export interface KeyVault {
  encryptSecret(input: KeyVaultSecretInput): KeyVaultRecord
  decryptSecret(record: KeyVaultRecord): string
}

export class KeyVaultError extends Error implements GatewayError {
  readonly errorClass: GatewayError['errorClass']
  readonly retryable: boolean

  /**
   * Creates a redacted key vault error.
   * @throws Error never intentionally; construction only stores safe envelope fields.
   * @see docs/api-contracts/gateway-providers.md
   */
  constructor() {
    super('Secret storage is unavailable')
    this.name = 'KeyVaultError'
    this.errorClass = 'gateway_secret_unavailable'
    this.retryable = false
  }
}

function assertAvailable(safeStorage: SafeStorageAdapter): void {
  if (!safeStorage.isEncryptionAvailable()) {
    // OS safe storage can be unavailable in headless or locked-keychain environments.
    throw new KeyVaultError()
  }
}

function keyRef(namespace: string, providerId: string): string {
  return `${namespace}:${providerId}`
}

function encryptedBuffer(ciphertext: string): Buffer {
  return Buffer.from(ciphertext, 'base64')
}

/**
 * Creates a key vault using Electron safeStorage semantics.
 * @param options - Safe storage adapter and optional namespace.
 * @returns Key vault API for encrypted provider secrets.
 * @throws Error never intentionally during construction; operation failures use KeyVaultError.
 * @see docs/api-contracts/gateway-providers.md
 */
export function createKeyVault(options: KeyVaultOptions): KeyVault {
  const namespace = options.namespace ?? 'gateway'

  return {
    encryptSecret(input) {
      try {
        assertAvailable(options.safeStorage)
        const encrypted = options.safeStorage.encryptString(input.secret)

        return {
          keyRef: keyRef(namespace, input.providerId),
          ciphertext: encrypted.toString('base64')
        }
      } catch {
        // Native keychain failures can contain secrets, so expose only a stable redacted error.
        throw new KeyVaultError()
      }
    },
    decryptSecret(record) {
      try {
        assertAvailable(options.safeStorage)
        return options.safeStorage.decryptString(encryptedBuffer(record.ciphertext))
      } catch {
        // Decryption failures can include sensitive material or platform details.
        throw new KeyVaultError()
      }
    }
  }
}
