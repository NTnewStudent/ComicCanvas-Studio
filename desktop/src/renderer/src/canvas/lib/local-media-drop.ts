/**
 * Local file drop classification for canvas asset imports.
 * @see docs/api-contracts/assets-files.md
 * @see docs/api-contracts/canvas-plan.md
 */

import type { AssetMediaType } from '../../../../../../shared/assets'
import type { NodeType } from '../../../../../../shared/nodes'

export interface LocalDropFileLike {
  name: string
  path?: string
  type?: string
}

export type LocalMediaDropPlan =
  | {
      ok: true
      sourcePath: string
      mediaType: Extract<AssetMediaType, 'image' | 'video' | 'audio'>
      nodeType: Extract<NodeType, 'image' | 'video' | 'audio'>
      label: string
    }
  | {
      ok: false
      reason: string
    }

const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.svg'])
const videoExtensions = new Set(['.mp4', '.webm', '.mov', '.avi', '.mkv'])
const audioExtensions = new Set(['.mp3', '.wav', '.m4a', '.aac', '.flac', '.ogg'])

function extensionOf(name: string): string {
  const dotIndex = name.lastIndexOf('.')
  return dotIndex >= 0 ? name.slice(dotIndex).toLowerCase() : ''
}

function classifyFile(file: LocalDropFileLike): Extract<AssetMediaType, 'image' | 'video' | 'audio'> | null {
  const mime = file.type?.toLowerCase() ?? ''
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'

  const ext = extensionOf(file.name)
  if (imageExtensions.has(ext)) return 'image'
  if (videoExtensions.has(ext)) return 'video'
  if (audioExtensions.has(ext)) return 'audio'
  return null
}

/**
 * Converts one dropped local file into a safe asset-import and node-creation plan.
 * @param file - Browser/Electron File-like object from a drag event.
 * @returns A supported image/video/audio plan or a Chinese user-facing rejection reason.
 * @throws Error never intentionally; malformed files return an explicit rejection.
 * @see docs/api-contracts/assets-files.md
 * @see docs/api-contracts/canvas-plan.md
 */
export function planLocalMediaDrop(file: LocalDropFileLike): LocalMediaDropPlan {
  const sourcePath = file.path?.trim()
  if (!sourcePath) {
    return {
      ok: false,
      reason: '无法读取本地文件路径，请从桌面文件管理器拖入。'
    }
  }

  const mediaType = classifyFile(file)
  if (!mediaType) {
    return {
      ok: false,
      reason: `不支持的文件类型：${file.name || sourcePath}`
    }
  }

  return {
    ok: true,
    sourcePath,
    mediaType,
    nodeType: mediaType,
    label: file.name || sourcePath
  }
}
