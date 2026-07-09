// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'

import React from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { TurnView } from '../desktop/src/renderer/src/chat/blocks/TurnView'
import type { ChatTurn } from '../shared/chat-blocks'

afterEach(() => {
  cleanup()
})

function assistantTurn(blocks: ChatTurn['blocks'], status: ChatTurn['status'] = 'completed'): ChatTurn {
  return { id: 'turn-1', role: 'assistant', blocks, status, createdAt: 1 }
}

describe('chat block components', () => {
  it('renders markdown text with headings and highlighted code', () => {
    render(
      <TurnView
        turn={assistantTurn([
          { kind: 'text', markdown: '# 标题\n\n```ts\nconst x = 1\n```', streaming: false },
        ])}
      />,
    )

    expect(screen.getByRole('heading', { level: 1, name: '标题' })).toBeInTheDocument()
    expect(document.querySelector('code.hljs, code.language-ts')).not.toBeNull()
  })

  it('renders user turns as plain bubbles', () => {
    render(
      <TurnView
        turn={{ id: 'user-1', role: 'user', blocks: [{ kind: 'text', markdown: '生成一个短视频', streaming: false }], status: 'completed', createdAt: 1 }}
      />,
    )

    expect(screen.getByText('生成一个短视频')).toBeInTheDocument()
  })

  it('renders a collapsed thinking block that expands on click', () => {
    render(
      <TurnView
        turn={assistantTurn([
          { kind: 'thinking', lines: ['理解用户输入', '拆解需求'] },
        ])}
      />,
    )

    const summary = screen.getByText('思考过程（2）')
    expect(summary).toBeInTheDocument()
    fireEvent.click(summary)
    expect(screen.getByText('理解用户输入')).toBeInTheDocument()
  })

  it('renders tool call blocks with status and expandable result summary', () => {
    render(
      <TurnView
        turn={assistantTurn([
          {
            kind: 'toolCall',
            callId: 'call-1',
            toolId: 'canvas.createNode',
            status: 'completed',
            inputSummary: 'Create text node',
            resultSummary: 'node-1 created',
            isSubAgent: false,
          },
        ])}
      />,
    )

    const pill = screen.getByRole('button', { name: /canvas\.createNode/ })
    fireEvent.click(pill)
    expect(screen.getByText('node-1 created')).toBeInTheDocument()
  })

  it('labels sub-agent tool calls distinctly', () => {
    render(
      <TurnView
        turn={assistantTurn([
          { kind: 'toolCall', callId: 'call-2', toolId: 'agent.spawnChild', status: 'running', inputSummary: 'Spawn child agent: research', isSubAgent: true },
        ])}
      />,
    )

    expect(screen.getByText('子 Agent')).toBeInTheDocument()
  })

  it('renders permission blocks with approve and deny actions', () => {
    const onApprove = vi.fn()
    const onDeny = vi.fn()

    render(
      <TurnView
        turn={assistantTurn([
          { kind: 'permission', callId: 'call-3', toolId: 'canvas.deleteNode', reason: '删除节点需要确认', resolved: false },
        ])}
        onApprovePermission={onApprove}
        onDenyPermission={onDeny}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: '批准' }))
    expect(onApprove).toHaveBeenCalledWith('call-3')
    fireEvent.click(screen.getByRole('button', { name: '拒绝' }))
    expect(onDeny).toHaveBeenCalledWith('call-3')
  })

  it('hides permission actions once resolved', () => {
    render(
      <TurnView
        turn={assistantTurn([
          { kind: 'permission', callId: 'call-4', toolId: 'canvas.deleteNode', reason: '已处理', resolved: true },
        ])}
      />,
    )

    expect(screen.queryByRole('button', { name: '批准' })).not.toBeInTheDocument()
  })

  it('renders error blocks with the error class and usage footers', () => {
    render(
      <TurnView
        turn={assistantTurn(
          [
            { kind: 'error', errorClass: 'tool_failure_loop', message: '工具连续失败', retryable: false },
            { kind: 'usage', summary: '用量：输入 1.2k / 输出 340 tokens' },
          ],
          'failed',
        )}
      />,
    )

    expect(screen.getByText('tool_failure_loop')).toBeInTheDocument()
    expect(screen.getByText('工具连续失败')).toBeInTheDocument()
    expect(screen.getByText('用量：输入 1.2k / 输出 340 tokens')).toBeInTheDocument()
  })

  it('renders plan blocks through the provided plan renderer', () => {
    render(
      <TurnView
        turn={assistantTurn([{ kind: 'plan', planId: 'plan-1' }])}
        renderPlan={(planId) => <div data-testid="plan-slot">PlanCard:{planId}</div>}
      />,
    )

    expect(screen.getByTestId('plan-slot')).toHaveTextContent('PlanCard:plan-1')
  })
})
