/**
 * Safe IPC error envelopes.
 * @see docs/api-contracts/audit-observability.md
 */

import type { SafeErrorEnvelope } from '../../../../shared/ipc'

/**
 * Converts unknown handler failures into renderer-safe error envelopes.
 * @param error - Unknown internal error.
 * @param traceId - Correlation ID for diagnostics.
 * @returns Redacted safe error envelope.
 * @throws Error never intentionally; unknown input is normalized.
 * @see docs/api-contracts/audit-observability.md
 */
export function createSafeErrorEnvelope(error: unknown, traceId: string): SafeErrorEnvelope {
  void error

  return {
    errorClass: 'internal_error',
    message: 'Request failed',
    traceId,
    retryable: false
  }
}
