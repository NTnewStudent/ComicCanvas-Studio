/**
 * Imported media metadata extraction helpers.
 * @see docs/api-contracts/assets-files.md
 */

import { createHash } from 'node:crypto'

import type { AssetMediaType, AssetMetadata } from '../../../../shared/assets'
import { classifyOrientation } from './pipeline'

function pngDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  const buffer = Buffer.from(bytes)
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

  if (buffer.length < 24 || !buffer.subarray(0, 8).equals(signature)) {
    return null
  }

  return {
    width: buffer.readUInt32BE(16),
    height: buffer.readUInt32BE(20)
  }
}

function jpegDimensions(bytes: Uint8Array): { width: number; height: number } | null {
  const buffer = Buffer.from(bytes)
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return null
  }

  let offset = 2
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1
      continue
    }

    const marker = buffer[offset + 1]
    if (marker === undefined) {
      return null
    }
    const length = buffer.readUInt16BE(offset + 2)
    const isSof = marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)
    if (isSof && offset + 8 < buffer.length) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7)
      }
    }

    if (length <= 0) {
      return null
    }
    offset += 2 + length
  }

  return null
}

function dimensionsFor(bytes: Uint8Array, mimeType: string): { width: number; height: number } | null {
  if (mimeType === 'image/png') return pngDimensions(bytes)
  if (mimeType === 'image/jpeg') return jpegDimensions(bytes)
  return null
}

const mpeg1Layer3BitratesKbps = [
  null,
  32,
  40,
  48,
  56,
  64,
  80,
  96,
  112,
  128,
  160,
  192,
  224,
  256,
  320,
  null
] as const

const mpeg1SampleRates = [44100, 48000, 32000, null] as const

function skipId3v2(bytes: Buffer): number {
  if (bytes.length < 10 || bytes.subarray(0, 3).toString('ascii') !== 'ID3') {
    return 0
  }

  const size =
    ((bytes.readUInt8(6) & 0x7f) << 21) |
    ((bytes.readUInt8(7) & 0x7f) << 14) |
    ((bytes.readUInt8(8) & 0x7f) << 7) |
    (bytes.readUInt8(9) & 0x7f)
  return Math.min(bytes.length, 10 + size)
}

function mp3DurationMs(bytes: Uint8Array): number | null {
  const buffer = Buffer.from(bytes)
  let offset = skipId3v2(buffer)
  while (offset + 4 <= buffer.length) {
    const header = buffer.readUInt32BE(offset)
    const sync = ((header & 0xffe00000) >>> 0) === 0xffe00000
    const versionBits = (header >> 19) & 0x3
    const layerBits = (header >> 17) & 0x3
    const bitrateIndex = (header >> 12) & 0xf
    const sampleRateIndex = (header >> 10) & 0x3
    const bitrateKbps = mpeg1Layer3BitratesKbps[bitrateIndex]
    const sampleRate = mpeg1SampleRates[sampleRateIndex]
    if (sync && versionBits === 0x3 && layerBits === 0x1 && typeof bitrateKbps === 'number' && typeof sampleRate === 'number') {
      const audioBytes = buffer.length - offset
      return Math.max(1, Math.round((audioBytes * 8) / (bitrateKbps * 1000) * 1000))
    }
    offset += 1
  }

  return null
}

function durationFor(bytes: Uint8Array, mediaType: AssetMediaType, mimeType: string): number | null {
  if (mediaType === 'audio' && mimeType === 'audio/mpeg') {
    return mp3DurationMs(bytes)
  }

  return null
}

/**
 * Extracts safe import metadata without throwing for unsupported media headers.
 * @param input - Media type, bytes, MIME type, and file size.
 * @returns Asset metadata with hash, size, MIME, and best-effort dimensions.
 * @throws Error when discovered dimensions are invalid.
 * @see docs/api-contracts/assets-files.md
 */
export function inferImportedAssetMetadata(input: {
  mediaType: AssetMediaType
  bytes: Uint8Array
  mimeType: string
  sizeBytes: number
}): AssetMetadata {
  const metadata: AssetMetadata = {
    mimeType: input.mimeType,
    sizeBytes: input.sizeBytes,
    hash: createHash('md5').update(input.bytes).digest('hex')
  }
  const dimensions = input.mediaType === 'image' ? dimensionsFor(input.bytes, input.mimeType) : null
  const durationMs = durationFor(input.bytes, input.mediaType, input.mimeType)

  if (dimensions) {
    metadata.width = dimensions.width
    metadata.height = dimensions.height
    metadata.orientation = classifyOrientation(dimensions.width, dimensions.height)
  }
  if (durationMs !== null) metadata.durationMs = durationMs

  return metadata
}
