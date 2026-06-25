import type { StorageProvider } from './storage-provider'
import type { StorageConfig } from './storage-config'
import { S3StorageProvider } from './providers/s3-provider'

/**
 * 存储提供者工厂 — Factory Pattern
 */
export class StorageFactory {
  private registry = new Map<string, new (config: StorageConfig) => StorageProvider>()

  register(providerId: string, ProviderClass: new (config: StorageConfig) => StorageProvider): void {
    this.registry.set(providerId, ProviderClass)
  }

  create(config: StorageConfig): StorageProvider {
    const ProviderClass = this.registry.get(config.provider)
    if (!ProviderClass) {
      // 默认 fallback 到 S3（大部分云存储都兼容 S3 协议）
      return new S3StorageProvider(config)
    }
    return new ProviderClass(config)
  }
}

const factory = new StorageFactory()
factory.register('s3', S3StorageProvider)
factory.register('r2', S3StorageProvider)
factory.register('cos', S3StorageProvider)
factory.register('oss', S3StorageProvider)

export { factory as storageFactory }
