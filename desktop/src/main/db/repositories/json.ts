/**
 * JSON helpers used by SQLite repositories.
 * @see docs/architecture/core-platform-implementation-readiness.md
 */

/**
 * Serializes repository payloads for SQLite JSON text columns.
 * @param value - JSON-compatible value to serialize.
 * @returns Stable JSON text.
 * @throws Error when the value cannot be serialized.
 */
export function encodeJson(value: unknown): string {
  return JSON.stringify(value)
}

/**
 * Parses repository JSON text columns.
 * @param value - JSON text or nullish value.
 * @returns Parsed JSON value or undefined for missing columns.
 * @throws Error when the text is not valid JSON.
 */
export function decodeJson<T>(value: string | null | undefined): T | undefined {
  if (value === null || value === undefined) {
    return undefined
  }

  return JSON.parse(value) as T
}
