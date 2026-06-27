import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const vitestCli = fileURLToPath(new URL('../node_modules/vitest/vitest.mjs', import.meta.url))
const args = process.argv.slice(2)
const nodeBinary = process.env.NODE_BINARY ?? 'node'

if (process.versions.bun) {
  const result = spawnSync(nodeBinary, [vitestCli, ...args], {
    stdio: 'inherit',
    env: process.env,
  })

  if (result.error) {
    console.error(
      `Vitest must run in a Node.js process. Set NODE_BINARY to a Node 20+ executable or put node on PATH. Original error: ${result.error.message}`,
    )
    process.exit(1)
  }

  process.exit(result.status ?? 1)
}

const result = spawnSync(process.execPath, [vitestCli, ...args], {
  stdio: 'inherit',
  env: process.env,
})

if (result.error) {
  console.error(`Failed to start Vitest: ${result.error.message}`)
  process.exit(1)
}

process.exit(result.status ?? 1)
