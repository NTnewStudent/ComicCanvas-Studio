/**
 * 存储配置
 * @see docs/api-contracts/storage-config.md
 */
export interface StorageConfig {
  /** 提供者 ID（'s3' | 'r2' | 'cos' | 'oss'） */
  provider: string
  /** 服务端点 URL */
  endpoint: string
  /** 区域（R2 用 'auto'） */
  region?: string
  /** 存储桶名称 */
  bucket: string
  /** 访问密钥 ID */
  accessKeyId: string
  /** 访问密钥 */
  secretAccessKey: string
  /** 公开 URL 前缀（CDN 域名等，可选） */
  publicUrlPrefix?: string
}
