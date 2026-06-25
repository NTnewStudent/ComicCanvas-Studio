/**
 * 存储提供者接口 — Strategy Pattern
 * 所有云存储厂商实现此接口。
 * @see docs/api-contracts/storage-provider.md
 */
export interface StorageProvider {
  /** 提供者标识 */
  readonly id: string
  /** 提供者名称 */
  readonly name: string

  /**
   * 上传文件到云存储
   * @param filePath 本地文件绝对路径
   * @param key 云端对象 key
   * @returns 云端公开访问 URL
   */
  upload(filePath: string, key: string): Promise<string>

  /**
   * 查询文件访问 URL
   * @param key 云端对象 key
   * @returns 公开 URL 或预签名 URL
   */
  query(key: string): Promise<string>

  /**
   * 修改云端文件名称
   * @param oldKey 原对象 key
   * @param newKey 新对象 key
   * @returns 新的公开访问 URL
   */
  rename(oldKey: string, newKey: string): Promise<string>

  /**
   * 删除云端文件
   */
  delete(key: string): Promise<void>

  /**
   * 测试连接是否正常
   */
  testConnection(): Promise<boolean>
}
