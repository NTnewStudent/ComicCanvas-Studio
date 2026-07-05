/**
 * Centralized redaction for logs, errors, and audit payloads.
 * @see docs/api-contracts/audit-observability.md
 */

const API_KEY_PATTERNS = [
  /\bsk-[A-Za-z0-9]{16,}\b/g,
  /\bBearer\s+[A-Za-z0-9._-]+\b/gi,
  /\bapi[_-]?key["'\s:=]+["']?[A-Za-z0-9._-]{8,}/gi
]

const ABSOLUTE_PATH_PATTERN = /(?:[A-Za-z]:\\|\/(?:Users|home|var|tmp|etc)\/)[^\s"'`]+/g

/**
 * Redacts sensitive substrings from arbitrary text.
 * @param input - Raw text that may contain secrets or absolute paths.
 * @returns Redacted text safe for IPC envelopes and audit rows.
 */
export function redactSensitiveText(input: string): string {
  let output = input
  for (const pattern of API_KEY_PATTERNS) {
    output = output.replace(pattern, '[REDACTED_SECRET]')
  }
  output = output.replace(ABSOLUTE_PATH_PATTERN, '[REDACTED_PATH]')
  return output
}

/**
 * Redacts hidden prompt sections while preserving non-sensitive structure.
 * @param prompt - Prompt text that may include hidden sections.
 * @returns Prompt with hidden blocks replaced.
 */
export function redactHiddenPrompt(prompt: string): string {
  return prompt.replace(/<!--\s*hidden\s*-->[\s\S]*?<!--\s*\/hidden\s*-->/gi, '[REDACTED_HIDDEN_PROMPT]')
}

/**
 * Builds a safe error envelope for IPC boundaries.
 * @param options - Error metadata and trace id.
 * @returns Safe error envelope without stack traces or secrets.
 */
export function createSafeErrorEnvelope(options: {
  errorClass: string
  message: string
  traceId: string
  retryable?: boolean
}): { errorClass: string; message: string; traceId: string; retryable: boolean } {
  return {
    errorClass: options.errorClass,
    message: redactSensitiveText(redactHiddenPrompt(options.message)),
    traceId: options.traceId,
    retryable: options.retryable ?? false
  }
}
