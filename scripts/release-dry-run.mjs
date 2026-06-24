import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

function gitValue(args, fallback) {
  try {
    return execFileSync('git', args, { encoding: 'utf8' }).trim()
  } catch {
    return fallback
  }
}

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
const commit = process.env.GITHUB_SHA ?? gitValue(['rev-parse', 'HEAD'], 'unknown')
const tag = process.env.GITHUB_REF_NAME ?? gitValue(['describe', '--tags', '--always'], 'untagged')
const generatedAt = new Date().toISOString()

const manifest = {
  name: packageJson.name,
  version: packageJson.version,
  tag,
  commit,
  generatedAt,
  releaseStage: 'foundation-dry-run',
  artifacts: ['dist/shared', 'release-manifest.json'],
  note: 'Electron installer packaging starts after the M1 desktop skeleton is implemented.'
}

mkdirSync('dist', { recursive: true })
writeFileSync('dist/release-manifest.json', `${JSON.stringify(manifest, null, 2)}\n`)
console.log(`Release dry-run manifest written for ${manifest.name}@${manifest.version}.`)
