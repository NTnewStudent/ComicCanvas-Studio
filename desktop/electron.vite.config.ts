import { copyFileSync, mkdirSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'

import react from '@vitejs/plugin-react'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'

const preferSourceExtensions = ['.ts', '.tsx', '.mts', '.mjs', '.js', '.jsx', '.json']

/** Vite plugin: copy src/main/db/migrations/*.sql → out/main/migrations/ */
function copyMigrationsPlugin() {
  return {
    name: 'copy-migrations',
    closeBundle() {
      const src = resolve(__dirname, 'src/main/db/migrations')
      const dest = resolve(__dirname, 'out/main/migrations')
      mkdirSync(dest, { recursive: true })
      for (const f of readdirSync(src)) {
        if (f.endsWith('.sql')) copyFileSync(join(src, f), join(dest, f))
      }
    }
  }
}

export default defineConfig({
  main: {
    resolve: {
      extensions: preferSourceExtensions
    },
    plugins: [externalizeDepsPlugin(), copyMigrationsPlugin()],
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'src/main/index.ts')
      }
    }
  },
  preload: {
    resolve: {
      extensions: preferSourceExtensions
    },
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: resolve(__dirname, 'src/preload/index.ts')
      }
    }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    resolve: {
      extensions: preferSourceExtensions
    },
    plugins: [react()],
    server: {
      port: Number(process.env.PORT ?? 5175)
    }
  }
})
