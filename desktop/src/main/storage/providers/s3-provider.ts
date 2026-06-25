import { S3Client, PutObjectCommand, GetObjectCommand, CopyObjectCommand, DeleteObjectCommand, ListBucketsCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import * as fs from 'fs/promises'
import * as path from 'path'
import type { StorageProvider } from '../storage-provider'
import type { StorageConfig } from '../storage-config'

/**
 * S3 兼容存储提供者
 * 覆盖 Cloudflare R2 / 腾讯云 COS / 阿里云 OSS / MinIO 等
 */
export class S3StorageProvider implements StorageProvider {
  readonly id = 's3'
  readonly name = 'S3 兼容存储'

  private client: S3Client
  private config: StorageConfig

  constructor(config: StorageConfig) {
    this.config = config
    this.client = new S3Client({
      endpoint: config.endpoint,
      region: config.region || 'auto',
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      forcePathStyle: true,  // 兼容 MinIO 等非 AWS 端点
    })
  }

  async upload(filePath: string, key: string): Promise<string> {
    const fileBuffer = await fs.readFile(filePath)
    const contentType = this.inferContentType(filePath)

    await this.client.send(new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
      Body: fileBuffer,
      ContentType: contentType,
    }))

    // 返回公开 URL
    return this.buildPublicUrl(key)
  }

  async query(key: string): Promise<string> {
    // 如果配置了 publicUrlPrefix，直接拼接
    if (this.config.publicUrlPrefix) {
      return this.buildPublicUrl(key)
    }
    // 否则生成预签名 URL（有效期 7 天）
    const command = new GetObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
    })
    return getSignedUrl(this.client, command, { expiresIn: 604800 })
  }

  async rename(oldKey: string, newKey: string): Promise<string> {
    // S3 没有原生 rename，用 copy + delete 实现
    await this.client.send(new CopyObjectCommand({
      Bucket: this.config.bucket,
      CopySource: `${this.config.bucket}/${oldKey}`,
      Key: newKey,
    }))
    await this.client.send(new DeleteObjectCommand({
      Bucket: this.config.bucket,
      Key: oldKey,
    }))
    return this.buildPublicUrl(newKey)
  }

  async delete(key: string): Promise<void> {
    await this.client.send(new DeleteObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
    }))
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.client.send(new ListBucketsCommand({}))
      return true
    } catch {
      return false
    }
  }

  private buildPublicUrl(key: string): string {
    if (this.config.publicUrlPrefix) {
      const prefix = this.config.publicUrlPrefix.replace(/\/$/, '')
      return `${prefix}/${key}`
    }
    // fallback: 拼接 endpoint + bucket + key
    const endpoint = this.config.endpoint.replace(/\/$/, '')
    return `${endpoint}/${this.config.bucket}/${key}`
  }

  private inferContentType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase()
    const mimeMap: Record<string, string> = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mov': 'video/quicktime',
    }
    return mimeMap[ext] || 'application/octet-stream'
  }
}
