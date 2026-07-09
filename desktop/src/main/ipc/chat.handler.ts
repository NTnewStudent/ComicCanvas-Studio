/**
 * Chat history IPC handlers.
 * @see docs/api-contracts/agents.md
 */

import type { ChatMessageRepository } from '../db/repositories/chat-message.repo'
import { chatHistoryFromMessages } from './chat-history'
import type { IpcRegistrar } from './types'

/**
 * Registers the `chat.history` invoke handler for workflow session restore.
 * @param ipcMain - Electron-compatible IPC registrar.
 * @param options - Chat message repository dependency.
 * @throws Error when the registrar rejects handler registration.
 * @see docs/api-contracts/agents.md
 */
export function registerChatHandlers(ipcMain: IpcRegistrar, options: { chatMessages: ChatMessageRepository }): void {
  ipcMain.handle('chat.history', (_event, request) => {
    const workflowId = typeof request === 'object' && request !== null && 'workflowId' in request && typeof request.workflowId === 'string'
      ? request.workflowId
      : 'default'

    return chatHistoryFromMessages(options.chatMessages.listByWorkflowId(workflowId))
  })
}
