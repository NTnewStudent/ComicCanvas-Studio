/**
 * Sanitizers for graph-shaped child-agent output.
 * @see docs/api-contracts/agents.md
 * @see docs/api-contracts/canvas-plan.md
 */

import type { CanvasNodeData } from '../../../../shared/nodes'

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

const executablePatterns: ReadonlyArray<RegExp> = [
  /<script\b[^>]*>[\s\S]*?<\/script>/gi,
  /<\/?script\b[^>]*>/gi,
  /javascript:[^\s?]+/gi,
  /\b(?:import|require|eval|Function)\s*\([^)]*\)/gi,
  /\b(?:window|document|globalThis|process)\s*\.[A-Za-z_$][\w$]*(?:\s*\([^)]*\))?/gi,
  /\brm\s+-rf\b[^\n\r;]*/gi,
  /\bcurl\b[^\n\r;|]*\|\s*sh\b[^\n\r;]*/gi,
  /\bpowershell(?:\.exe)?\b[^\n\r;]*/gi,
  /\bcmd\.exe\b[^\n\r;]*/gi
]

type SanitizedValue = string | number | boolean | null | SanitizedValue[] | { [key: string]: SanitizedValue }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, ' ').replace(/\s+([?.!,;:])/g, '$1').trim()
}

function stripExecutableText(value: string, location: string, dropped: string[]): string {
  let next = value

  for (const pattern of executablePatterns) {
    next = next.replace(pattern, '')
  }

  next = normalizeText(next)

  if (next !== value) {
    dropped.push(`${location}:executable_string_stripped`)
  }

  return next
}

function sanitizeValue(value: unknown, location: string, dropped: string[]): SanitizedValue | undefined {
  if (value === null) {
    return null
  }

  if (typeof value === 'string') {
    return stripExecutableText(value, location, dropped)
  }

  if (typeof value === 'number') {
    if (Number.isFinite(value)) {
      return value
    }

    dropped.push(`${location}:non_finite_number`)
    return undefined
  }

  if (typeof value === 'boolean') {
    return value
  }

  if (Array.isArray(value)) {
    const output: SanitizedValue[] = []

    value.forEach((entry, index) => {
      const sanitized = sanitizeValue(entry, `${location}[${index}]`, dropped)

      if (sanitized !== undefined) {
        output.push(sanitized)
      }
    })

    return output
  }

  if (isRecord(value)) {
    const output: { [key: string]: SanitizedValue } = {}

    for (const [key, entry] of Object.entries(value)) {
      if (DANGEROUS_KEYS.has(key)) {
        dropped.push(`${location}.${key}:unsafe_key`)
        continue
      }

      if (/^on[A-Z]/u.test(key)) {
        dropped.push(`${location}.${key}:executable_string_stripped`)
        continue
      }

      const sanitized = sanitizeValue(entry, `${location}.${key}`, dropped)

      if (sanitized !== undefined) {
        output[key] = sanitized
      }
    }

    return output
  }

  dropped.push(`${location}:unsupported_value`)
  return undefined
}

/**
 * Sanitizes child-agent graph node data while preserving node data shape.
 * @param data - Canvas node data from an isolated child draft.
 * @param location - Audit location prefix used in dropped records.
 * @param dropped - Mutable dropped-record accumulator.
 * @returns Sanitized canvas node data.
 * @throws Error never intentionally; malformed unsupported values are dropped.
 * @see docs/api-contracts/agents.md
 */
export function sanitizeGraphData(data: CanvasNodeData, location: string, dropped: string[]): CanvasNodeData {
  const sanitized = sanitizeValue(data, location, dropped)

  if (isRecord(sanitized)) {
    return sanitized as unknown as CanvasNodeData
  }

  dropped.push(`${location}:invalid_object`)
  return data
}
