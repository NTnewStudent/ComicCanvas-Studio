import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'

const forbiddenTrackedRoots = ['hjwall', 'cc-haha-main', 'coze-studio-main', 'tmp', '.claude/specs']
const requiredIgnorePatterns = ['hjwall/', 'cc-haha-main/', 'coze-studio-main/', 'tmp/', '.claude/specs/']
const requiredFiles = [
  'specs/README.md',
  'docs/ci-cd.md',
  '.github/workflows/ci.yml',
  '.github/workflows/release.yml',
  'tsconfig.json',
  'tsconfig.build.json',
  'vitest.config.ts',
  'eslint.config.js'
]

function runGit(args) {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

const gitignore = readFileSync('.gitignore', 'utf8')
for (const pattern of requiredIgnorePatterns) {
  assert(gitignore.includes(pattern), `.gitignore must include ${pattern}`)
}

for (const file of requiredFiles) {
  assert(existsSync(file), `Required repository file is missing: ${file}`)
}

for (const root of forbiddenTrackedRoots) {
  const tracked = runGit(['ls-files', '--', root])
  assert(tracked.length === 0, `Reference or legacy path must not be tracked: ${root}`)
}

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'))
const requiredScripts = ['lint', 'typecheck', 'test', 'build', 'verify:repo', 'release:dry-run', 'ci']
for (const script of requiredScripts) {
  assert(typeof packageJson.scripts?.[script] === 'string', `package.json missing script: ${script}`)
}

console.log('Repository verification passed.')
