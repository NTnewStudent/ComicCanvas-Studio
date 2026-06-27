import { defineConfig } from 'vitest/config'
import { resolve } from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      '@xyflow/react': resolve(import.meta.dirname, 'desktop/node_modules/@xyflow/react'),
      'react-router-dom': resolve(import.meta.dirname, 'desktop/node_modules/react-router-dom'),
    },
  },
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    environment: 'node'
  }
})
