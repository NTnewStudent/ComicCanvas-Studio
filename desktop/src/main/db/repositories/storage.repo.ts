/**
 * Storage configuration repository for encrypted S3-compatible provider settings.
 * @see docs/api-contracts/storage-config.md
 */

import type { Database as BetterSqliteDatabase } from 'better-sqlite3'

import type { KeyVaultRecord } from '../../security/key-vault'

export interface PersistedStorageConfig {
  id: string
  provider: string
  endpoint: string
  region?: string
  bucket: string
  accessKeyId: string
  secret: KeyVaultRecord
  publicUrlPrefix?: string
  updatedAt: number
}

export interface StorageConfigSaveInput {
  id: string
  provider: string
  endpoint: string
  region?: string
  bucket: string
  accessKeyId: string
  secret: KeyVaultRecord
  publicUrlPrefix?: string
  updatedAt: number
}

export interface StorageConfigRepository {
  getById(id: string): PersistedStorageConfig | null
  save(input: StorageConfigSaveInput): PersistedStorageConfig
}

interface StorageConfigRow {
  id: string
  provider: string
  endpoint: string
  region: string | null
  bucket: string
  access_key_id: string
  key_ref: string
  ciphertext: string
  public_url_prefix: string | null
  updated_at: number
}

function storageConfigFromRow(row: StorageConfigRow): PersistedStorageConfig {
  const config: PersistedStorageConfig = {
    id: row.id,
    provider: row.provider,
    endpoint: row.endpoint,
    bucket: row.bucket,
    accessKeyId: row.access_key_id,
    secret: {
      keyRef: row.key_ref,
      ciphertext: row.ciphertext
    },
    updatedAt: row.updated_at
  }

  if (row.region != null) config.region = row.region
  if (row.public_url_prefix != null) config.publicUrlPrefix = row.public_url_prefix
  return config
}

/**
 * Creates a repository for storage provider configuration.
 * @param db - Open SQLite database handle.
 * @returns Storage configuration repository API.
 * @throws Error when repository SQL statements cannot be prepared.
 * @see docs/api-contracts/storage-config.md
 */
export function createStorageConfigRepository(db: BetterSqliteDatabase): StorageConfigRepository {
  const selectById = db.prepare('SELECT * FROM storage_configs WHERE id = ?')
  const upsert = db.prepare(`
    INSERT INTO storage_configs (
      id, provider, endpoint, region, bucket, access_key_id, key_ref, ciphertext, public_url_prefix, updated_at
    )
    VALUES (
      @id, @provider, @endpoint, @region, @bucket, @accessKeyId, @keyRef, @ciphertext, @publicUrlPrefix, @updatedAt
    )
    ON CONFLICT(id) DO UPDATE SET
      provider = excluded.provider,
      endpoint = excluded.endpoint,
      region = excluded.region,
      bucket = excluded.bucket,
      access_key_id = excluded.access_key_id,
      key_ref = excluded.key_ref,
      ciphertext = excluded.ciphertext,
      public_url_prefix = excluded.public_url_prefix,
      updated_at = excluded.updated_at
  `)

  return {
    getById(id) {
      const row = selectById.get(id) as StorageConfigRow | undefined
      return row ? storageConfigFromRow(row) : null
    },
    save(input) {
      upsert.run({
        id: input.id,
        provider: input.provider,
        endpoint: input.endpoint,
        region: input.region ?? null,
        bucket: input.bucket,
        accessKeyId: input.accessKeyId,
        keyRef: input.secret.keyRef,
        ciphertext: input.secret.ciphertext,
        publicUrlPrefix: input.publicUrlPrefix ?? null,
        updatedAt: input.updatedAt
      })

      const row = selectById.get(input.id) as StorageConfigRow | undefined
      if (!row) {
        // If SQLite did not return the saved row, the repository cannot prove persistence succeeded.
        throw new Error('storage_config_save_failed')
      }

      return storageConfigFromRow(row)
    }
  }
}
