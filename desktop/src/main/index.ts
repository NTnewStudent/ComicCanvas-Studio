/**
 * Electron main-process entrypoint for the ComicCanvas desktop shell.
 * @see docs/api-contracts/audit-observability.md
 */

import { join } from 'node:path'

import { app, BrowserWindow, ipcMain } from 'electron'

const rendererDevServerUrl = process.env.ELECTRON_RENDERER_URL

/**
 * Creates the main application window with renderer isolation enabled.
 * @returns The created BrowserWindow instance.
 * @throws Error when Electron cannot create or load the application window.
 * @see docs/api-contracts/audit-observability.md
 */
export async function createMainWindow(): Promise<BrowserWindow> {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  window.once('ready-to-show', () => {
    window.show()
  })

  if (rendererDevServerUrl) {
    await window.loadURL(rendererDevServerUrl)
  } else {
    await window.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return window
}

ipcMain.handle('app.health', () => ({
  status: 'ok' as const,
  checkedAt: Date.now()
}))

app.whenReady()
  .then(async () => {
    await createMainWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        void createMainWindow()
      }
    })
  })
  .catch((error: unknown) => {
    // Main-process startup failures must be visible during development.
    console.error('Failed to start ComicCanvas desktop shell', error)
    app.exit(1)
  })

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
