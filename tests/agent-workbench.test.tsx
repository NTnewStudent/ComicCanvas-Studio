// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { AgentRunViewResponse } from '../shared/agents'
import { PermissionBlock } from '../desktop/src/renderer/src/chat/blocks/PermissionBlock'
import { AgentWorkbench } from '../desktop/src/renderer/src/chat/workbench/AgentWorkbench'
import { RunInspector } from '../desktop/src/renderer/src/chat/workbench/RunInspector'

const runView: AgentRunViewResponse = {
  runId: 'run-1',
  status: 'completed',
  trace: {},
  snapshot: {
    run: {
      id: 'run-1',
      threadId: 'thread-1',
      workflowId: 'default',
      agentId: 'general-purpose',
      status: 'completed',
      trigger: 'canvasChat',
      messageId: 'message-1',
      policyProfileId: 'local-default',
      modelId: 'gpt-5',
      trace: {},
      createdAt: 10,
      updatedAt: 20
    },
    events: [
      {
        id: 'event-1',
        runId: 'run-1',
        sequence: 1,
        type: 'run.created',
        payload: {
          threadId: 'thread-1',
          workflowId: 'default',
          agentId: 'general-purpose',
          trigger: 'canvasChat',
          messageId: 'message-1',
          policyProfileId: 'local-default',
          modelId: 'gpt-5'
        },
        createdAt: 10
      },
      {
        id: 'event-2',
        runId: 'run-1',
        sequence: 2,
        type: 'tool.started',
        payload: { callId: 'call-1', toolId: 'canvas.queryGraph', inputSummary: '读取当前画布' },
        createdAt: 12
      },
      {
        id: 'event-3',
        runId: 'run-1',
        sequence: 3,
        type: 'run.completed',
        payload: { status: 'completed' },
        createdAt: 20
      }
    ],
    artifacts: [
      {
        id: 'artifact-1',
        runId: 'run-1',
        kind: 'answer',
        title: '回答',
        summary: '已读取画布并完成回答。',
        payload: { type: 'answer', summary: '已完成', text: '你好', dropped: [] },
        createdAt: 19
      }
    ],
    permissionGrants: [],
    childTasks: []
  },
  projection: {
    chatTurn: {
      id: 'assistant-1',
      role: 'assistant',
      runId: 'run-1',
      messageId: 'message-1',
      blocks: [{ kind: 'text', markdown: '你好', streaming: false }],
      status: 'completed',
      createdAt: 10
    },
    taskTree: [
      {
        id: 'child-1',
        parentRunId: 'run-1',
        roleId: 'qa-verifier',
        status: 'completed',
        summary: '检查画布结果',
        artifactIds: []
      }
    ],
    inspector: {
      runId: 'run-1',
      status: 'completed',
      agentId: 'general-purpose',
      workflowId: 'default',
      trigger: 'canvasChat',
      modelLabel: 'gpt-5',
      latestEventType: 'run.completed',
      tools: [{ callId: 'call-1', toolId: 'canvas.queryGraph', status: 'completed', summary: '读取完成' }],
      permissions: [],
      artifacts: [{ id: 'artifact-1', kind: 'answer', title: '回答', summary: '已读取画布并完成回答。' }],
      childTasks: [
        {
          id: 'child-1',
          parentRunId: 'run-1',
          roleId: 'qa-verifier',
          status: 'completed',
          summary: '检查画布结果',
          artifactIds: []
        }
      ]
    },
    artifacts: []
  }
}

afterEach(() => {
  cleanup()
})

describe('Agent Workbench', () => {
  it('renders a deterministic event rail and projected run details', () => {
    render(<RunInspector runView={runView} />)

    expect(screen.getByRole('complementary', { name: '运行检查器' })).toBeInTheDocument()
    expect(screen.getByText('已完成')).toBeInTheDocument()
    expect(screen.getByText('gpt-5')).toBeInTheDocument()
    expect(screen.getByRole('list', { name: '运行事件' })).toBeInTheDocument()
    expect(screen.getByText('#01')).toBeInTheDocument()
    expect(screen.getByText('创建运行')).toBeInTheDocument()
    expect(screen.getByText('canvas.queryGraph')).toBeInTheDocument()
    expect(screen.getByText('qa-verifier')).toBeInTheDocument()
  })

  it('switches from run details to persisted artifacts', () => {
    render(<RunInspector runView={runView} />)

    fireEvent.click(screen.getByRole('tab', { name: '产物' }))

    expect(screen.getByRole('tab', { name: '产物' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('回答')).toBeInTheDocument()
    expect(screen.getByText('已读取画布并完成回答。')).toBeInTheDocument()
    expect(screen.queryByRole('list', { name: '运行事件' })).not.toBeInTheDocument()
  })

  it('keeps the inspector available behind a compact canvas control', () => {
    render(
      <AgentWorkbench
        variant="compact"
        title="AI 对话"
        statusText="就绪"
        agentName="General Purpose"
        turns={[]}
        busy={false}
        permissionBusy={false}
        runView={runView}
        renderPlan={() => null}
        onApprovePermission={vi.fn()}
        onDenyPermission={vi.fn()}
        composer={<div>Composer</div>}
      />,
    )

    expect(screen.queryByRole('complementary', { name: '运行检查器' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '打开运行检查器' }))
    expect(screen.getByRole('complementary', { name: '运行检查器' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '关闭运行检查器' })).toBeInTheDocument()
  })

  it('shows a useful empty state before the first run', () => {
    render(<RunInspector runView={null} />)

    expect(screen.getByText('尚无运行记录')).toBeInTheDocument()
  })

  it('renders denied permissions as denied instead of approved', () => {
    render(
      <PermissionBlock
        block={{
          kind: 'permission',
          callId: 'call-denied',
          toolId: 'web.search',
          reason: 'Search requires approval.',
          resolved: true,
          decision: 'denied'
        }}
      />
    )

    expect(screen.getByText('已拒绝此工具调用')).toBeInTheDocument()
    expect(screen.queryByText(/已批准/)).not.toBeInTheDocument()
  })

  it('shows denied permission decisions in the run inspector', () => {
    const deniedRunView: AgentRunViewResponse = {
      ...runView,
      status: 'aborted',
      snapshot: {
        ...runView.snapshot!,
        run: {
          ...runView.snapshot!.run,
          status: 'aborted',
          errorClass: 'agent_tool_denied'
        },
        events: [
          ...runView.snapshot!.events.slice(0, 1),
          {
            id: 'event-permission-requested',
            runId: 'run-1',
            sequence: 2,
            type: 'permission.requested',
            payload: {
              callId: 'call-denied',
              toolId: 'web.search',
              reason: 'Search requires approval.',
              requiredPermissions: [{ kind: 'network', reason: 'Queries the public web.' }]
            },
            createdAt: 11
          },
          {
            id: 'event-permission-denied',
            runId: 'run-1',
            sequence: 3,
            type: 'permission.resolved',
            payload: {
              callId: 'call-denied',
              decision: 'denied',
              deniedByLabel: 'user-local'
            },
            createdAt: 12
          }
        ]
      },
      projection: {
        ...runView.projection!,
        inspector: {
          ...runView.projection!.inspector,
          status: 'aborted',
          latestEventType: 'permission.resolved',
          permissions: [{
            callId: 'call-denied',
            toolId: 'web.search',
            reason: 'Search requires approval.',
            resolved: true,
            decision: 'denied'
          }]
        }
      }
    }

    render(<RunInspector runView={deniedRunView} />)

    expect(screen.getByText('已拒绝')).toBeInTheDocument()
    expect(screen.getByText('denied')).toBeInTheDocument()
  })
})
