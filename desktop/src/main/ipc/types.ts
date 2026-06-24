/**
 * Minimal IPC registration types for testable Electron handler modules.
 * @see docs/api-contracts/audit-observability.md
 */

export interface IpcRegistrar {
  handle(channel: string, handler: (event: unknown, request: unknown) => unknown): void
}
