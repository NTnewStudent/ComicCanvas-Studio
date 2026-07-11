import { describe, expect, it } from 'vitest'

import {
  createSafeErrorEnvelope,
  redactHiddenPrompt,
  redactSensitiveData,
  redactSensitiveText
} from '../desktop/src/main/security/redaction'
import { createAuditService, runHealthChecks } from '../desktop/src/main/audit/service'

describe('redaction and audit observability', () => {
  it('redacts api keys, auth headers, hidden prompts, and absolute paths', () => {
    const raw = [
      'Authorization: Bearer sk-testsecret1234567890',
      'C:\\Users\\secret\\project\\file.txt',
      '<!-- hidden -->do not leak<!-- /hidden -->'
    ].join('\n')

    const redacted = redactHiddenPrompt(redactSensitiveText(raw))
    expect(redacted).not.toContain('sk-testsecret1234567890')
    expect(redacted).not.toContain('C:\\Users\\secret')
    expect(redacted).toContain('[REDACTED_SECRET]')
    expect(redacted).toContain('[REDACTED_PATH]')
    expect(redacted).toContain('[REDACTED_HIDDEN_PROMPT]')
  })

  it('redacts bearer and basic credentials without treating ordinary auth prose as credentials', () => {
    expect(redactSensitiveText('Bearer fake-auth-token-value')).toBe('[REDACTED_SECRET]')
    expect(redactSensitiveText('Bearer sk-leak')).toBe('[REDACTED_SECRET]')
    expect(redactSensitiveText('Bearer abc.def-123_X')).toBe('[REDACTED_SECRET]')
    expect(redactSensitiveText('Bearer ZmFrZS10b2tlbi0xMjM0NQ==')).toBe('[REDACTED_SECRET]')
    expect(redactSensitiveText('Basic ZmFrZTpwYXNzMTIz')).toBe('[REDACTED_SECRET]')
    expect(redactSensitiveText('Authorization: Bearer fake-auth-token-value')).toBe(
      'Authorization: [REDACTED_SECRET]'
    )
    expect(redactSensitiveText('Bearer authorization')).toBe('Bearer authorization')
    expect(redactSensitiveText('Bearer credentials')).toBe('Bearer credentials')
    expect(redactSensitiveText('The bearer authorization process stays visible.')).toBe(
      'The bearer authorization process stays visible.'
    )
    expect(redactSensitiveText('A basic authorization process stays visible.')).toBe(
      'A basic authorization process stays visible.'
    )
    expect(redactSensitiveText('prefixBearer fake-auth-token-value')).toBe(
      'prefixBearer fake-auth-token-value'
    )
  })

  it('redacts alphabetic-only bearer credentials in explicit authorization headers', () => {
    expect(redactSensitiveText('Authorization: Bearer abcdefghijklmnop')).toBe(
      'Authorization: [REDACTED_SECRET]'
    )
    expect(redactSensitiveText('authorization = bearer ponmlkjihgfedcba')).toBe(
      'authorization = [REDACTED_SECRET]'
    )
    expect(redactSensitiveText('{"Authorization":"Bearer abcdefghijklmnop"}')).toBe(
      '{"Authorization":"[REDACTED_SECRET]"}'
    )
    expect(redactSensitiveText("'Authorization': 'Bearer abcdefghijklmnop'")).toBe(
      "'Authorization': '[REDACTED_SECRET]'"
    )
    expect(redactSensitiveText('Bearer authorization')).toBe('Bearer authorization')
    expect(redactSensitiveText('Bearer credentials')).toBe('Bearer credentials')
  })

  it('redacts alphabetic-only bearer credentials in escaped serialized authorization headers', () => {
    expect(redactSensitiveText(
      String.raw`{\"Authorization\":\"Bearer abcdefghijklmnop\"}`
    )).toBe(
      String.raw`{\"Authorization\":\"[REDACTED_SECRET]\"}`
    )
    expect(redactSensitiveText(
      String.raw`{\\\"Authorization\\\":\\\"Bearer abcdefghijklmnop\\\"}`
    )).toBe(
      String.raw`{\\\"Authorization\\\":\\\"[REDACTED_SECRET]\\\"}`
    )
    expect(redactSensitiveText('Bearer authorization')).toBe('Bearer authorization')
    expect(redactSensitiveText('The bearer authorization process stays visible.')).toBe(
      'The bearer authorization process stays visible.'
    )
  })

  it('redacts common POSIX absolute paths without redacting URL paths', () => {
    expect(redactSensitiveText('/Applications/ComicCanvas.app/Contents/MacOS/ComicCanvas')).toBe(
      '[REDACTED_PATH]'
    )
    expect(redactSensitiveText('/Library/Preferences/com.comiccanvas.studio.plist')).toBe(
      '[REDACTED_PATH]'
    )
    expect(redactSensitiveText('/mnt/comiccanvas/private/story.txt')).toBe('[REDACTED_PATH]')

    const urls = [
      'https://example.test/Applications/ComicCanvas/download',
      'https://example.test/Library/Application-Support/guide',
      'https://example.test/mnt/assets/story.txt',
      'https://example.test/Users/example/docs'
    ]
    expect(urls.map(redactSensitiveText)).toEqual(urls)
  })

  it('redacts unsafe URL components while preserving ordinary http paths', () => {
    expect(redactSensitiveText('file:///Users/example/private/story.txt')).toBe('[REDACTED_PATH]')
    expect(redactSensitiveText('https://alice:secret@example.test/public/story')).toBe(
      'https://[REDACTED_SECRET]@example.test/public/story'
    )
    expect(redactSensitiveText(
      'https://example.test/public/story?chapter=1&token=secret-value#api_key=fragment-secret'
    )).toBe(
      'https://example.test/public/story?chapter=1&token=[REDACTED_SECRET]#api_key=[REDACTED_SECRET]'
    )
    expect(redactSensitiveText(
      'https://example.test/public/story?password=hunter2&view=reader#section-2'
    )).toBe(
      'https://example.test/public/story?password=[REDACTED_SECRET]&view=reader#section-2'
    )
  })

  it('redacts signed URL secrets after safely decoding parameter key names', () => {
    expect(redactSensitiveText(
      'https://s3.example.test/public/story.png?chapter=1'
      + '&X-Amz-Signature=aws-signature'
      + '&X-Amz-Credential=aws-credential'
      + '&X-Amz-Security-Token=aws-session'
      + '&x-amz-%73ignature=encoded-signature'
      + '&sig=azure-signature'
      + '&shared%41ccessSignature=sas-signature'
      + '&bad%ZZ=visible#page=2'
    )).toBe(
      'https://s3.example.test/public/story.png?chapter=1'
      + '&X-Amz-Signature=[REDACTED_SECRET]'
      + '&X-Amz-Credential=[REDACTED_SECRET]'
      + '&X-Amz-Security-Token=[REDACTED_SECRET]'
      + '&x-amz-%73ignature=[REDACTED_SECRET]'
      + '&sig=[REDACTED_SECRET]'
      + '&shared%41ccessSignature=[REDACTED_SECRET]'
      + '&bad%ZZ=visible#page=2'
    )
  })

  it('redacts unterminated hidden prompts through the end of the string', () => {
    expect(redactHiddenPrompt('Visible. <!-- hidden -->private tail')).toBe(
      'Visible. [REDACTED_HIDDEN_PROMPT]'
    )
  })

  it('recursively redacts structured data without mutating safe counters or the input', () => {
    const input = {
      usage: {
        inputTokens: 12,
        outputTokens: 3,
        tokenEstimate: 21
      },
      provider: {
        apiKey: 'fake-provider-key-value',
        headers: {
          Authorization: 'Bearer fake-auth-token-value'
        }
      },
      messages: [
        'Visible text',
        '<!-- hidden -->private provider instructions<!-- /hidden -->',
        'Read /Users/example/private/story.txt before continuing.'
      ]
    }
    const original = structuredClone(input)

    const redacted = redactSensitiveData(input)

    expect(input).toEqual(original)
    expect(redacted).not.toBe(input)
    expect(redacted.usage).toEqual({
      inputTokens: 12,
      outputTokens: 3,
      tokenEstimate: 21
    })
    expect(redacted.provider.apiKey).toBe('[REDACTED_SECRET]')
    expect(redacted.provider.headers.Authorization).toBe('[REDACTED_SECRET]')
    expect(redacted.messages).toEqual([
      'Visible text',
      '[REDACTED_HIDDEN_PROMPT]',
      'Read [REDACTED_PATH] before continuing.'
    ])
  })

  it('redacts provider secrets in nested strings and fails closed for cyclic or accessor values', () => {
    const cyclic: Record<string, unknown> = {
      providerMessage: 'Provider rejected sk-proj-fakecredentialvalue1234567890',
      safe: true
    }
    cyclic.self = cyclic
    Object.defineProperty(cyclic, 'hiddenValue', {
      enumerable: true,
      get() {
        throw new Error('accessor should not execute')
      }
    })

    const redacted = redactSensitiveData(cyclic)

    expect(redacted).toEqual({
      providerMessage: 'Provider rejected [REDACTED_SECRET]',
      safe: true,
      self: '[REDACTED_UNSERIALIZABLE]',
      hiddenValue: '[REDACTED_UNSERIALIZABLE]'
    })
  })

  it('records audit entries and aggregates health checks', () => {
    const audit = createAuditService({ clock: () => 1 })
    audit.record({
      traceId: 'trace-1',
      actorId: 'agent-1',
      capability: 'tool.invoke',
      targetId: 'canvas.runNode',
      decision: 'allow'
    })

    expect(audit.list({ traceId: 'trace-1', limit: 10 })).toHaveLength(1)

    const report = runHealthChecks([
      { component: 'database', run: () => ({ component: 'database', status: 'ok', message: 'ready' }) },
      { component: 'toolRegistry', run: () => ({ component: 'toolRegistry', status: 'degraded', message: 'empty' }) }
    ], () => 2)

    expect(report.status).toBe('degraded')
    expect(report.checks).toHaveLength(2)
    expect(createSafeErrorEnvelope({
      errorClass: 'internal_error',
      message: 'Bearer fake-auth-token-value',
      traceId: 'trace-safe'
    }).message).not.toContain('fake-auth-token-value')
  })
})
