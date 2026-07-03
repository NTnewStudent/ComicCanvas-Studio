/**
 * Built-in read-only filesystem tools scoped to the workspace root.
 * These give the general-purpose Agent the ability to read, list, and search
 * project files without leaving the workspace sandbox.
 * @see docs/api-contracts/tools-plugins.md
 */

import { readFileSync, readdirSync, statSync, type Dirent } from 'node:fs'
import { join, relative, resolve, sep } from 'node:path'

import { z } from 'zod'

import type { ToolDescriptor, ToolPermission } from '../../../../../shared/tools'
import { defineTool, ToolExecutionError, type ToolDefinition } from '../runtime'

export interface FsToolsOptions {
  /** Absolute path that bounds every filesystem read. */
  workspaceRoot: string
  /** Maximum bytes returned/scanned per file (default 256 KiB). */
  maxReadBytes?: number
  /** Maximum directory entries walked per glob/grep call (default 20000). */
  maxWalkEntries?: number
}

const fileReadPermission: ToolPermission = { kind: 'file.read', reason: 'Reads project files within the workspace root.' }

const IGNORED_DIRECTORIES = new Set(['.git', 'node_modules', 'dist', 'out', 'build', '.cache', '.next', 'coverage', '.turbo'])
const DEFAULT_MAX_READ_BYTES = 256 * 1024
const DEFAULT_MAX_WALK_ENTRIES = 20000

function descriptor(input: Omit<ToolDescriptor, 'category' | 'owner' | 'enabled'>): ToolDescriptor {
  return {
    ...input,
    category: 'file',
    owner: { kind: 'builtin', id: 'core' },
    enabled: true
  }
}

/** Resolves a user path inside the workspace, rejecting traversal/absolute escapes. */
function resolveWithinRoot(root: string, target: string): string {
  const resolved = resolve(root, target)

  if (resolved !== root && !resolved.startsWith(root + sep)) {
    throw new ToolExecutionError({
      code: 'path_out_of_scope',
      message: 'Path escapes the workspace root.',
      details: { path: target }
    })
  }

  return resolved
}

function toPosix(relPath: string): string {
  return relPath.split(sep).join('/')
}

/** Converts a simple glob (supporting **, *, ?) into an anchored RegExp. */
function globToRegExp(pattern: string): RegExp {
  let out = '^'

  for (let i = 0; i < pattern.length; i += 1) {
    const char = pattern[i] as string

    if (char === '*') {
      if (pattern[i + 1] === '*') {
        out += '.*'
        i += 1
        if (pattern[i + 1] === '/') {
          i += 1
        }
      } else {
        out += '[^/]*'
      }
    } else if (char === '?') {
      out += '[^/]'
    } else if ('\\^$.|+()[]{}'.includes(char)) {
      out += `\\${char}`
    } else {
      out += char
    }
  }

  return new RegExp(`${out}$`)
}

interface WalkResult {
  files: string[]
  truncated: boolean
}

function walkFiles(root: string, maxEntries: number): WalkResult {
  const files: string[] = []
  const stack: string[] = [root]
  let visited = 0

  while (stack.length > 0) {
    const dir = stack.pop() as string
    let entries: Dirent[]

    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      // Unreadable directories (permissions, races) are skipped rather than failing the whole walk.
      continue
    }

    for (const entry of entries) {
      visited += 1
      if (visited > maxEntries) {
        return { files, truncated: true }
      }

      if (entry.isDirectory()) {
        if (!IGNORED_DIRECTORIES.has(entry.name)) {
          stack.push(join(dir, entry.name))
        }
      } else if (entry.isFile()) {
        files.push(join(dir, entry.name))
      }
    }
  }

  return { files, truncated: false }
}

/** A NUL byte in the decoded text is a strong binary signal. */
function looksBinary(content: string): boolean {
  return content.includes('\u0000')
}

/**
 * Creates the built-in read-only filesystem tools for the shared ToolRuntime.
 * @param options - Workspace root that bounds every read plus optional limits.
 * @returns Tool definitions for fs.read, fs.glob, and fs.grep.
 * @throws Error never intentionally during construction; invocation returns safe tool errors.
 * @see docs/api-contracts/tools-plugins.md
 */
export function createFsTools(options: FsToolsOptions): ToolDefinition<unknown, unknown>[] {
  const root = resolve(options.workspaceRoot)
  const maxReadBytes = options.maxReadBytes ?? DEFAULT_MAX_READ_BYTES
  const maxWalkEntries = options.maxWalkEntries ?? DEFAULT_MAX_WALK_ENTRIES

  return [
    defineTool({
      descriptor: descriptor({
        id: 'fs.read',
        name: 'Read Project File',
        description: 'Reads a UTF-8 text file inside the workspace root.',
        inputSchemaRef: 'fs.read.input',
        outputSchemaRef: 'fs.read.output',
        permissions: [fileReadPermission],
        concurrency: 'readonly'
      }),
      inputSchema: z.object({
        path: z.string().min(1),
        maxBytes: z.number().int().positive().optional()
      }),
      outputSchema: z.object({
        path: z.string(),
        content: z.string(),
        bytes: z.number(),
        truncated: z.boolean()
      }),
      renderToolUseMessage: (input) => `Read ${input.path}`,
      call(input) {
        const resolved = resolveWithinRoot(root, input.path)
        let stats

        try {
          stats = statSync(resolved)
        } catch {
          throw new ToolExecutionError({ code: 'file_not_found', message: 'File not found.', details: { path: input.path } })
        }

        if (!stats.isFile()) {
          throw new ToolExecutionError({ code: 'not_a_file', message: 'Path is not a file.', details: { path: input.path } })
        }

        const limit = Math.min(input.maxBytes ?? maxReadBytes, maxReadBytes)
        const buffer = readFileSync(resolved)
        const truncated = buffer.byteLength > limit
        const content = (truncated ? buffer.subarray(0, limit) : buffer).toString('utf8')

        if (looksBinary(content)) {
          throw new ToolExecutionError({ code: 'binary_file', message: 'Refusing to read a binary file as text.', details: { path: input.path } })
        }

        return {
          path: toPosix(relative(root, resolved)),
          content,
          bytes: buffer.byteLength,
          truncated
        }
      }
    }),
    defineTool({
      descriptor: descriptor({
        id: 'fs.glob',
        name: 'Find Project Files',
        description: 'Lists workspace files matching a glob pattern (supports **, *, ?).',
        inputSchemaRef: 'fs.glob.input',
        outputSchemaRef: 'fs.glob.output',
        permissions: [fileReadPermission],
        concurrency: 'readonly'
      }),
      inputSchema: z.object({
        pattern: z.string().min(1),
        limit: z.number().int().positive().max(1000).optional()
      }),
      outputSchema: z.object({
        matches: z.array(z.string()),
        truncated: z.boolean()
      }),
      renderToolUseMessage: (input) => `Glob ${input.pattern}`,
      call(input) {
        const regex = globToRegExp(input.pattern)
        const limit = input.limit ?? 200
        const walked = walkFiles(root, maxWalkEntries)
        const matches: string[] = []
        let truncated = walked.truncated

        for (const file of walked.files) {
          const rel = toPosix(relative(root, file))
          if (regex.test(rel)) {
            if (matches.length >= limit) {
              truncated = true
              break
            }
            matches.push(rel)
          }
        }

        matches.sort()
        return { matches, truncated }
      }
    }),
    defineTool({
      descriptor: descriptor({
        id: 'fs.grep',
        name: 'Search Project Files',
        description: 'Searches workspace text files for a regular expression and returns matching lines.',
        inputSchemaRef: 'fs.grep.input',
        outputSchemaRef: 'fs.grep.output',
        permissions: [fileReadPermission],
        concurrency: 'readonly'
      }),
      inputSchema: z.object({
        query: z.string().min(1),
        include: z.string().optional(),
        caseSensitive: z.boolean().optional(),
        limit: z.number().int().positive().max(500).optional()
      }),
      outputSchema: z.object({
        matches: z.array(z.object({ path: z.string(), line: z.number(), text: z.string() })),
        truncated: z.boolean()
      }),
      renderToolUseMessage: (input) => `Grep ${input.query}`,
      call(input) {
        let regex: RegExp

        try {
          regex = new RegExp(input.query, input.caseSensitive ? 'u' : 'iu')
        } catch {
          throw new ToolExecutionError({ code: 'invalid_regex', message: 'Search query is not a valid regular expression.', details: { query: input.query } })
        }

        const includeRegex = input.include ? globToRegExp(input.include) : null
        const limit = input.limit ?? 100
        const walked = walkFiles(root, maxWalkEntries)
        const matches: Array<{ path: string; line: number; text: string }> = []
        const truncated = walked.truncated

        for (const file of walked.files) {
          const rel = toPosix(relative(root, file))
          if (includeRegex && !includeRegex.test(rel)) {
            continue
          }

          let raw: Buffer
          try {
            raw = readFileSync(file)
          } catch {
            continue
          }

          if (raw.byteLength > maxReadBytes) {
            continue
          }

          const content = raw.toString('utf8')
          if (looksBinary(content)) {
            continue
          }

          const lines = content.split(/\r?\n/u)
          for (let i = 0; i < lines.length; i += 1) {
            const line = lines[i] as string
            if (regex.test(line)) {
              if (matches.length >= limit) {
                return { matches, truncated: true }
              }
              matches.push({ path: rel, line: i + 1, text: line.slice(0, 400) })
            }
          }
        }

        return { matches, truncated }
      }
    })
  ]
}
