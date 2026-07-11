/** Local-only explicit memory contracts. */

export type LocalMemoryScope = 'user' | 'workflow' | 'agentRole'

export interface LocalMemoryRecord {
  id: string
  scope: LocalMemoryScope
  userId?: string
  workflowId?: string
  agentRoleId?: string
  content: string
  createdAt: number
  updatedAt: number
}

export interface MemorySaveRequest {
  scope: LocalMemoryScope
  content: string
  workflowId?: string
  agentRoleId?: string
}

export interface MemoryConfirmSuggestionRequest {
  artifactId: string
  confirmed: boolean
}

export type LocalMemoryResponse = LocalMemoryRecord | { errorClass: string; message: string; retryable: false }
