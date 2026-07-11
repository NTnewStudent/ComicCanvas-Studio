/**
 * Centralized redaction for logs, errors, and audit payloads.
 * @see docs/api-contracts/audit-observability.md
 */

const SECRET_PATTERNS = [
  /\bsk-(?:proj-|ant-)?[A-Za-z0-9_-]{16,}\b/giu,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/gu,
  /\bAIza[A-Za-z0-9_-]{20,}\b/gu,
  /\b(?:gh[pousr]_[A-Za-z0-9_]{16,}|github_pat_[A-Za-z0-9_]{16,})\b/gu,
  /\bxox[baprs]-[A-Za-z0-9-]{12,}\b/gu,
  /(?<!\p{L})Bearer\s+(?=[A-Za-z0-9._~+/=-]*[0-9._~+/=-])[A-Za-z0-9._~+/=-]{6,}(?![A-Za-z0-9._~+/=-])/giu,
  /(?<!\p{L})Basic\s+(?:[A-Za-z0-9+/]{4}){2,}(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?(?![A-Za-z0-9+/=])/giu,
  /\bapi[_-]?key["'\s:=]+["']?[A-Za-z0-9._-]{8,}/giu
]

const URL_OR_ABSOLUTE_PATH_PATTERN = /[A-Za-z][A-Za-z0-9+.-]*:\/\/[^\s"'`]+|(?:[A-Za-z]:\\|\/(?:Applications|Library|Users|Volumes|home|root|private|var|tmp|etc|mnt|opt|usr)\/)[^\s"'`]+/gu
const HTTP_URL_PATTERN = /^https?:\/\//iu
const URL_AUTHORITY_PATTERN = /^(https?:\/\/)([^/?#]*)([\s\S]*)$/iu
const URL_PARAMETER_PATTERN = /([?&#;])([^=?&#;]+)=([^&#;]*)/gu
const AUTHORIZATION_BEARER_PATTERN = /((?<!\p{L})\\*["']?\s*authorization\s*\\*["']?\s*[:=]\s*\\*["']?\s*)Bearer\s+[A-Za-z0-9._~+/=-]{6,}(?![A-Za-z0-9._~+/=-])/giu
const HIDDEN_PROMPT_PATTERN = /<!--\s*hidden\s*-->[\s\S]*?(?:<!--\s*\/hidden\s*-->|$)/giu
const REDACTED_SECRET = '[REDACTED_SECRET]' as const
const REDACTED_UNSERIALIZABLE = '[REDACTED_UNSERIALIZABLE]' as const
const SENSITIVE_KEY_PARTS = [
  'authorization',
  'authheader',
  'apikey',
  'accesskey',
  'clientsecret',
  'credential',
  'cookie',
  'password',
  'passwd',
  'privatekey',
  'secret',
  'session',
  'token'
] as const
const SAFE_TOKEN_COUNT_KEYS = new Set([
  'cachedtokens',
  'completiontokens',
  'inputtokens',
  'outputtokens',
  'prompttokens',
  'reasoningtokens',
  'tokencount',
  'tokenestimate',
  'totaltokens'
])

function normalizedKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]/gu, '')
}

function isSafeTokenCount(key: string, value: unknown): boolean {
  return typeof value === 'number'
    && Number.isFinite(value)
    && SAFE_TOKEN_COUNT_KEYS.has(normalizedKey(key))
}

function isSensitiveKey(key: string): boolean {
  const normalized = normalizedKey(key)
  return SENSITIVE_KEY_PARTS.some((part) => normalized.includes(part))
}

function decodedUrlKey(key: string): string {
  try {
    return decodeURIComponent(key)
  } catch {
    // Malformed percent escapes must remain visible without bypassing other URL redaction.
    return key
  }
}

function isSensitiveUrlKey(key: string): boolean {
  const decoded = decodedUrlKey(key)
  const normalized = normalizedKey(decoded)
  return isSensitiveKey(decoded)
    || normalized === 'sig'
    || normalized === 'sas'
    || normalized.endsWith('signature')
}

function redactUrl(value: string): string {
  if (!HTTP_URL_PATTERN.test(value)) {
    return '[REDACTED_PATH]'
  }

  const match = URL_AUTHORITY_PATTERN.exec(value)
  if (!match) {
    return '[REDACTED_PATH]'
  }

  const scheme = match[1]
  const authority = match[2]
  const remainder = match[3]
  if (scheme === undefined || authority === undefined || remainder === undefined) {
    return '[REDACTED_PATH]'
  }

  const userInfoEnd = authority.lastIndexOf('@')
  const safeAuthority = userInfoEnd >= 0
    ? `${REDACTED_SECRET}@${authority.slice(userInfoEnd + 1)}`
    : authority
  const safeRemainder = remainder.replace(
    URL_PARAMETER_PATTERN,
    (parameter, delimiter: string, key: string) => (
      isSensitiveUrlKey(key)
        ? `${delimiter}${key}=${REDACTED_SECRET}`
        : parameter
    )
  )

  return `${scheme}${safeAuthority}${safeRemainder}`
}

/**
 * Redacts sensitive substrings from arbitrary text.
 * @param input - Raw text that may contain secrets or absolute paths.
 * @returns Redacted text safe for IPC envelopes and audit rows.
 */
export function redactSensitiveText(input: string): string {
  let output = input.replace(
    URL_OR_ABSOLUTE_PATH_PATTERN,
    (value) => redactUrl(value)
  )
  output = output.replace(
    AUTHORIZATION_BEARER_PATTERN,
    (_credential, prefix: string) => `${prefix}${REDACTED_SECRET}`
  )
  for (const pattern of SECRET_PATTERNS) {
    output = output.replace(pattern, REDACTED_SECRET)
  }
  return output
}

/**
 * Redacts hidden prompt sections while preserving non-sensitive structure.
 * @param prompt - Prompt text that may include hidden sections.
 * @returns Prompt with hidden blocks replaced.
 */
export function redactHiddenPrompt(prompt: string): string {
  return prompt.replace(HIDDEN_PROMPT_PATTERN, '[REDACTED_HIDDEN_PROMPT]')
}

function redactValue(
  value: unknown,
  key: string | undefined,
  seen: WeakSet<object>,
  depth: number
): unknown {
  if (key && isSensitiveKey(key) && !isSafeTokenCount(key, value)) {
    return REDACTED_SECRET
  }

  if (typeof value === 'string') {
    return redactSensitiveText(redactHiddenPrompt(value))
  }

  if (value === null || typeof value === 'boolean' || typeof value === 'number') {
    return value
  }

  if (typeof value !== 'object' || depth > 100 || seen.has(value)) {
    return REDACTED_UNSERIALIZABLE
  }

  seen.add(value)

  if (Array.isArray(value)) {
    return value.map((entry) => redactValue(entry, undefined, seen, depth + 1))
  }

  const redacted: Record<string, unknown> = {}
  const descriptors = Object.getOwnPropertyDescriptors(value)
  for (const [property, descriptor] of Object.entries(descriptors)) {
    if (!descriptor.enumerable) {
      continue
    }
    redacted[property] = 'value' in descriptor
      ? redactValue(descriptor.value, property, seen, depth + 1)
      : REDACTED_UNSERIALIZABLE
  }
  return redacted
}

/**
 * Recursively clones structured data while redacting durable secret-bearing fields.
 * Safe numeric token counters remain available for usage and context accounting.
 * @param input - Structured data headed to logs, audit records, or durable events.
 * @returns A non-mutating redacted clone with unsupported values replaced fail-closed.
 */
export function redactSensitiveData<Value>(input: Value): Value {
  return redactValue(input, undefined, new WeakSet<object>(), 0) as Value
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
