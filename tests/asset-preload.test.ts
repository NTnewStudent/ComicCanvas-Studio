import { readFileSync } from 'node:fs'

import { describe, expect, it } from 'vitest'

describe('M5 asset preload bridge', () => {
  it('exposes typed asset library actions without raw ipcRenderer access', () => {
    const source = readFileSync('desktop/src/preload/index.ts', 'utf8')

    expect(source).toContain('listAssets')
    expect(source).toContain("invokeMain('asset.list'")
    expect(source).toContain('moveAsset')
    expect(source).toContain("invokeMain('asset.move'")
    expect(source).toContain('trashAsset')
    expect(source).toContain("invokeMain('asset.trash'")
    expect(source).toContain('getAssetFolders')
    expect(source).toContain("invokeMain('asset.getFolders'")
    expect(source).toContain('createAssetFolder')
    expect(source).toContain("invokeMain('asset.createFolder'")
    expect(source).toContain('deleteAssetFolder')
    expect(source).toContain("invokeMain('asset.deleteFolder'")
    expect(source).not.toContain('ipcRenderer: ipcRenderer')
    expect(source).not.toContain('send: ipcRenderer.send')
  })
})
