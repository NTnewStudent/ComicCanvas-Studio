import { describe, expect, it } from 'vitest'

import { createSafeErrorEnvelope, redactHiddenPrompt, redactSensitiveText } from '../desktop/src/main/security/redaction'
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
      message: 'Bearer sk-leak',
      traceId: 'trace-safe'
    }).message).not.toContain('sk-leak')
  })
})
