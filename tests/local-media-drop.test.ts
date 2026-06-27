import { describe, expect, it } from 'vitest'

import { planLocalMediaDrop } from '../desktop/src/renderer/src/canvas/lib/local-media-drop'

describe('local media canvas drop planning', () => {
  it('plans image, video, and audio files as asset imports and canvas nodes', () => {
    expect(planLocalMediaDrop({ path: 'D:\\shots\\cover.PNG', name: 'cover.PNG', type: 'image/png' })).toEqual({
      ok: true,
      sourcePath: 'D:\\shots\\cover.PNG',
      mediaType: 'image',
      nodeType: 'image',
      label: 'cover.PNG'
    })

    expect(planLocalMediaDrop({ path: '/tmp/clip.mov', name: 'clip.mov', type: '' })).toEqual({
      ok: true,
      sourcePath: '/tmp/clip.mov',
      mediaType: 'video',
      nodeType: 'video',
      label: 'clip.mov'
    })

    expect(planLocalMediaDrop({ path: '/tmp/voice.mp3', name: 'voice.mp3', type: 'audio/mpeg' })).toEqual({
      ok: true,
      sourcePath: '/tmp/voice.mp3',
      mediaType: 'audio',
      nodeType: 'audio',
      label: 'voice.mp3'
    })
  })

  it('rejects unsupported files with a user-facing reason', () => {
    expect(planLocalMediaDrop({ path: '/tmp/archive.zip', name: 'archive.zip', type: 'application/zip' })).toEqual({
      ok: false,
      reason: '不支持的文件类型：archive.zip'
    })
  })

  it('rejects browser files without an Electron local path', () => {
    expect(planLocalMediaDrop({ path: '', name: 'cover.png', type: 'image/png' })).toEqual({
      ok: false,
      reason: '无法读取本地文件路径，请从桌面文件管理器拖入。'
    })
  })
})
