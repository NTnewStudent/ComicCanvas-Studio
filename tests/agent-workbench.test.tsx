// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { AgentArtifactViewModel, AgentRunSnapshot } from '../shared/agent-run-events'
import { projectAgentArtifacts, projectAgentRunSnapshot } from '../shared/agent-run-projector'
import type { AgentRunViewResponse } from '../shared/agents'
import { PermissionBlock } from '../desktop/src/renderer/src/chat/blocks/PermissionBlock'
import { AgentWorkbench } from '../desktop/src/renderer/src/chat/workbench/AgentWorkbench'
import { ArtifactPanel } from '../desktop/src/renderer/src/chat/workbench/ArtifactPanel'
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

const artifactSnapshot: AgentRunSnapshot = {
  ...runView.snapshot!,
  artifacts: [
    {
      id: 'artifact-answer-view',
      runId: 'run-1',
      kind: 'answer',
      title: '回答',
      summary: '普通回答',
      payload: {
        type: 'answer',
        summary: '普通回答',
        text: '这是可读的最终回答。',
        dropped: []
      },
      createdAt: 21
    },
    {
      id: 'artifact-clarification-view',
      runId: 'run-1',
      kind: 'clarification',
      title: '澄清',
      summary: '需要补充信息',
      payload: {
        type: 'clarification',
        summary: '需要补充信息',
        question: '希望画面采用横屏还是竖屏？',
        missing: ['orientation'],
        dropped: []
      },
      createdAt: 22
    },
    {
      id: 'artifact-plan-view',
      runId: 'run-1',
      kind: 'canvasPlan',
      title: 'CanvasPlan',
      summary: '生成分镜工作流',
      payload: {
        kind: 'plan',
        summary: '生成分镜工作流',
        nodes: [
          { ref: 'text-1', type: 'text', title: '分镜提示词', data: {} },
          { ref: 'image-1', type: 'image', title: '关键帧', data: {} }
        ],
        edges: [
          { source: 'text-1', target: 'image-1', edgeType: 'promptOrder' }
        ],
        runSteps: [
          { ref: 'image-1', action: 'imageRun' }
        ],
        question: null,
        dropped: []
      },
      createdAt: 23
    },
    {
      id: 'artifact-patch-view',
      runId: 'run-1',
      kind: 'canvasPatchDraft',
      title: '画布变更草稿',
      summary: '新增关键帧并连接提示词',
      payload: {
        summary: '新增关键帧并连接提示词',
        nodeChanges: [
          { action: 'add', ref: 'image-1', type: 'image', title: '关键帧' }
        ],
        edgeChanges: [
          { action: 'add', source: 'text-1', target: 'image-1', edgeType: 'promptOrder' }
        ],
        warnings: ['应用前仍需确认']
      },
      createdAt: 24
    },
    {
      id: 'artifact-search-view',
      runId: 'run-1',
      kind: 'searchSummary',
      title: '检索摘要',
      summary: '找到一个可引用来源',
      payload: {
        query: 'ComicCanvas local agent',
        summary: '找到一个可引用来源',
        sources: [
          {
            title: 'OpenAI 官方文档',
            url: 'https://platform.openai.com/docs',
            citation: '[1]',
            snippet: 'Agent 工具调用与结构化输出说明。'
          }
        ],
        citations: ['[1]']
      },
      createdAt: 25
    },
    {
      id: 'artifact-memory-view',
      runId: 'run-1',
      kind: 'memorySuggestion',
      title: '记忆建议',
      summary: '建议记住角色画风',
      payload: {
        scope: 'workflow',
        content: '主角始终使用黑白线稿风格。',
        rationale: '后续分镜需要保持视觉一致。'
      },
      createdAt: 26
    },
    {
      id: 'artifact-diagnostics-view',
      runId: 'run-1',
      kind: 'diagnosticReport',
      title: '诊断报告',
      summary: '发现一个网关告警',
      payload: {
        severity: 'warning',
        diagnostics: [
          {
            code: 'gateway_latency',
            severity: 'warning',
            message: '模型网关响应偏慢。',
            path: 'gateway.gpt-5',
            details: { latencyMs: 3200 }
          }
        ]
      },
      createdAt: 27
    },
    {
      id: 'artifact-malformed-view',
      runId: 'run-1',
      kind: 'answer',
      title: '损坏回答',
      summary: 'payload 字段类型错误',
      payload: { type: 'answer', text: 42 },
      createdAt: 28
    }
  ]
}

const artifactRunView: AgentRunViewResponse = {
  ...runView,
  snapshot: artifactSnapshot,
  projection: projectAgentRunSnapshot(artifactSnapshot)
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

  it('renders child task rows with role, status, effective tools, artifacts, and errors', () => {
    const childTaskRunView: AgentRunViewResponse = {
      ...runView,
      snapshot: {
        ...runView.snapshot!,
        childTasks: [{
          id: 'child-task-1', parentRunId: 'run-1', roleId: 'qa-verifier', inputSummary: 'Verify the draft graph.',
          effectiveTools: ['canvas.queryGraph', 'canvas.validateGraph'], status: 'failed', outputSummary: 'One invalid edge.',
          artifactIds: ['child-task-1:artifact:diagnosticReport'], errorClass: 'agent_child_run_failed', createdAt: 13, updatedAt: 18
        }]
      },
      projection: {
        ...runView.projection!,
        taskTree: [{
          id: 'child-task-1', parentRunId: 'run-1', roleId: 'qa-verifier', status: 'failed',
          summary: 'One invalid edge.', artifactIds: ['child-task-1:artifact:diagnosticReport'], errorClass: 'agent_child_run_failed'
        }]
      }
    }

    render(<RunInspector runView={childTaskRunView} />)

    expect(screen.getByRole('region', { name: '子任务' })).toHaveTextContent('qa-verifier')
    expect(screen.getByRole('region', { name: '子任务' })).toHaveTextContent('canvas.queryGraph')
    expect(screen.getByRole('region', { name: '子任务' })).toHaveTextContent('child-task-1:artifact:diagnosticReport')
    expect(screen.getByRole('region', { name: '子任务' })).toHaveTextContent('agent_child_run_failed')
  })

  it('renders persisted ContextPack sources and omissions in the run inspector', () => {
    const contextRunView = {
      ...runView,
      contextPack: {
        id: 'ctx-1', agentId: 'run-1', sources: [{ kind: 'knowledge', refId: 'story.md', priority: 5 }],
        omissions: ['message:m3:token_budget_exceeded'], warnings: ['token_budget_exhausted'],
        redactions: ['knowledge:credential'], tokenEstimate: 321, createdAt: 12
      }
    } as unknown as AgentRunViewResponse

    render(<RunInspector runView={contextRunView} />)

    expect(screen.getByRole('region', { name: '上下文' })).toHaveTextContent('story.md')
    expect(screen.getByRole('region', { name: '上下文' })).toHaveTextContent('message:m3:token_budget_exceeded')
    expect(screen.getByRole('region', { name: '上下文' })).toHaveTextContent('321')
    expect(screen.getByRole('region', { name: '上下文' })).toHaveTextContent('knowledge:credential')
  })

  it('renders accessible typed artifact tabs with detailed read-only views and malformed fallback', () => {
    render(<RunInspector runView={artifactRunView} />)

    fireEvent.click(screen.getByRole('tab', { name: '产物' }))

    expect(screen.getByRole('tablist', { name: 'Agent 产物' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: '回答' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel', { name: '回答' })).toHaveTextContent('这是可读的最终回答。')

    fireEvent.click(screen.getByRole('tab', { name: '澄清' }))
    expect(screen.getByRole('tabpanel', { name: '澄清' })).toHaveTextContent('希望画面采用横屏还是竖屏？')
    expect(screen.getByRole('tabpanel', { name: '澄清' })).toHaveTextContent('orientation')

    fireEvent.click(screen.getByRole('tab', { name: 'CanvasPlan' }))
    expect(screen.getByRole('tabpanel', { name: 'CanvasPlan' })).toHaveTextContent('2 个节点')
    expect(screen.getByRole('tabpanel', { name: 'CanvasPlan' })).toHaveTextContent('1 条连线')
    expect(screen.getByRole('tabpanel', { name: 'CanvasPlan' })).toHaveTextContent('1 个步骤')
    expect(screen.getByRole('tabpanel', { name: 'CanvasPlan' })).toHaveTextContent('text-1 → image-1')

    fireEvent.click(screen.getByRole('tab', { name: '画布变更草稿' }))
    expect(screen.getByRole('tabpanel', { name: '画布变更草稿' })).toHaveTextContent('关键帧')
    expect(screen.getByRole('tabpanel', { name: '画布变更草稿' })).toHaveTextContent('text-1 → image-1')
    expect(screen.getByRole('tabpanel', { name: '画布变更草稿' })).toHaveTextContent('应用前仍需确认')

    fireEvent.click(screen.getByRole('tab', { name: '检索摘要' }))
    expect(screen.getByRole('tabpanel', { name: '检索摘要' })).toHaveTextContent('OpenAI 官方文档')
    expect(screen.getByRole('tabpanel', { name: '检索摘要' })).toHaveTextContent('[1]')
    expect(screen.getByRole('tabpanel', { name: '检索摘要' })).toHaveTextContent('https://platform.openai.com/docs')

    fireEvent.click(screen.getByRole('tab', { name: '记忆建议' }))
    expect(screen.getByRole('tabpanel', { name: '记忆建议' })).toHaveTextContent('待确认建议')
    expect(screen.getByRole('tabpanel', { name: '记忆建议' })).toHaveTextContent('尚未写入本地记忆')
    expect(screen.getByRole('tabpanel', { name: '记忆建议' })).toHaveTextContent('主角始终使用黑白线稿风格。')

    fireEvent.click(screen.getByRole('tab', { name: '诊断报告' }))
    expect(screen.getByRole('tabpanel', { name: '诊断报告' })).toHaveTextContent('gateway_latency')
    expect(screen.getByRole('tabpanel', { name: '诊断报告' })).toHaveTextContent('模型网关响应偏慢。')
    expect(screen.getByRole('tabpanel', { name: '诊断报告' })).toHaveTextContent('"latencyMs": 3200')

    fireEvent.click(screen.getByRole('tab', { name: '损坏回答' }))
    expect(screen.getByRole('tabpanel', { name: '损坏回答' })).toHaveTextContent('无法使用类型化视图')
    expect(screen.getByRole('tabpanel', { name: '损坏回答' })).toHaveTextContent('"text": 42')
  })

  it('reconstructs run details and typed artifacts from a snapshot-only response', () => {
    const snapshotOnlyRunView: AgentRunViewResponse = {
      runId: 'run-1',
      status: 'completed',
      trace: {},
      snapshot: artifactSnapshot
    }

    render(<RunInspector runView={snapshotOnlyRunView} />)

    expect(screen.getByText('gpt-5')).toBeInTheDocument()
    expect(screen.getByRole('list', { name: '运行事件' })).toBeInTheDocument()
    expect(screen.getByText('canvas.queryGraph')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('tab', { name: '产物' }))

    expect(screen.getByRole('tablist', { name: 'Agent 产物' })).toBeInTheDocument()
    expect(screen.getByRole('tabpanel', { name: '回答' })).toHaveTextContent('这是可读的最终回答。')
  })

  it('uses snapshot artifacts when a typed projection is malformed', () => {
    const malformedProjection = {
      ...projectAgentRunSnapshot(artifactSnapshot),
      artifacts: [
        {
          id: 'artifact-plan-view',
          runId: 'run-1',
          kind: 'canvasPlan',
          title: '损坏投影计划',
          summary: 'projection 缺少计划数组',
          createdAt: 23,
          viewType: 'canvasPlan',
          planKind: 'plan',
          planSummary: 'projection 缺少 nodes、edges 与 runSteps'
        }
      ]
    } as unknown as NonNullable<AgentRunViewResponse['projection']>
    const malformedProjectionRunView: AgentRunViewResponse = {
      ...artifactRunView,
      projection: malformedProjection
    }

    render(<RunInspector runView={malformedProjectionRunView} />)

    fireEvent.click(screen.getByRole('tab', { name: '产物' }))

    expect(screen.queryByRole('tab', { name: '损坏投影计划' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('tab', { name: 'CanvasPlan' }))
    expect(screen.getByRole('tabpanel', { name: 'CanvasPlan' })).toHaveTextContent('2 个节点')
    expect(screen.getByRole('tabpanel', { name: 'CanvasPlan' })).toHaveTextContent('text-1 → image-1')
  })

  it('preserves artifact selection when appending and resets only when its run or item disappears', () => {
    const firstTwo = projectAgentArtifacts(artifactSnapshot.artifacts.slice(0, 2))
    const firstThree = projectAgentArtifacts(artifactSnapshot.artifacts.slice(0, 3))
    const runTwoArtifacts: AgentArtifactViewModel[] = firstThree.map((artifact) => ({
      ...artifact,
      runId: 'run-2'
    }))
    const { rerender } = render(<ArtifactPanel artifacts={firstTwo} />)

    fireEvent.click(screen.getByRole('tab', { name: '澄清' }))
    expect(screen.getByRole('tab', { name: '澄清' })).toHaveAttribute('aria-selected', 'true')

    rerender(<ArtifactPanel artifacts={firstThree} />)
    expect(screen.getByRole('tab', { name: '澄清' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('tabpanel', { name: '澄清' })).toHaveTextContent('希望画面采用横屏还是竖屏？')

    rerender(<ArtifactPanel artifacts={runTwoArtifacts} />)
    expect(screen.getByRole('tab', { name: '回答' })).toHaveAttribute('aria-selected', 'true')

    fireEvent.click(screen.getByRole('tab', { name: '澄清' }))
    rerender(<ArtifactPanel artifacts={[runTwoArtifacts[0]!, runTwoArtifacts[2]!]} />)
    expect(screen.getByRole('tab', { name: '回答' })).toHaveAttribute('aria-selected', 'true')
  })

  it('renders the dedicated draft graph artifact view', () => {
    const draftGraph: AgentArtifactViewModel = {
      id: 'artifact-draft-graph', runId: 'run-child', kind: 'draftGraph', title: '子画布草稿',
      summary: '隔离提案', createdAt: 30, viewType: 'draftGraph',
      nodes: [{ id: 'text-1', type: 'text', label: 'Prompt', position: { x: 0, y: 0 } }],
      edges: [{ id: 'edge-1', source: 'text-1', target: 'image-1', edgeType: 'default' }],
      lineage: { parentRunId: 'run-parent', childRunId: 'run-child', traceId: 'trace/child' },
      warnings: ['已移除不安全字段'], dropped: []
    }

    render(<ArtifactPanel artifacts={[draftGraph]} />)

    expect(screen.getByRole('tabpanel', { name: '子画布草稿' })).toHaveTextContent('1 个节点 · 1 条连线')
    expect(screen.getByRole('tabpanel', { name: '子画布草稿' })).toHaveTextContent('已移除不安全字段')
  })

  it('keeps artifact tabs in one horizontal row and constrains long citations', () => {
    const longCitation = `[${'very-long-citation'.repeat(20)}]`
    const longCitationSnapshot: AgentRunSnapshot = {
      ...artifactSnapshot,
      artifacts: [
        {
          id: 'artifact-long-citation',
          runId: 'run-1',
          kind: 'searchSummary',
          title: '超长引用',
          summary: '验证窄屏引用不会撑宽',
          payload: {
            query: 'long citation',
            summary: '验证窄屏引用不会撑宽',
            sources: [
              {
                title: '来源',
                citation: longCitation
              }
            ],
            citations: [longCitation]
          },
          createdAt: 30
        }
      ]
    }
    const longCitationRunView: AgentRunViewResponse = {
      ...artifactRunView,
      snapshot: longCitationSnapshot,
      projection: projectAgentRunSnapshot(longCitationSnapshot)
    }

    render(<RunInspector runView={longCitationRunView} />)
    fireEvent.click(screen.getByRole('tab', { name: '产物' }))

    const tablist = screen.getByRole('tablist', { name: 'Agent 产物' })
    expect(tablist).toHaveClass('flex-nowrap', 'overflow-x-auto')
    expect(tablist).not.toHaveClass('grid-rows-2')

    const panel = screen.getByRole('tabpanel', { name: '超长引用' })
    for (const citation of within(panel).getAllByText(longCitation)) {
      expect(citation).toHaveClass('max-w-full', 'min-w-0', 'break-all')
    }
  })

  it('links outer inspector tabs to labelled panels and supports roving keyboard selection', () => {
    render(<RunInspector runView={artifactRunView} />)

    const runTab = screen.getByRole('tab', { name: '运行' })
    const artifactsTab = screen.getByRole('tab', { name: '产物' })
    const runPanelId = runTab.getAttribute('aria-controls')
    const artifactsPanelId = artifactsTab.getAttribute('aria-controls')

    expect(runTab.id).not.toBe('')
    expect(artifactsTab.id).not.toBe('')
    expect(runTab.id).not.toBe(artifactsTab.id)
    expect(runPanelId).toBeTruthy()
    expect(artifactsPanelId).toBeTruthy()
    expect(runPanelId).not.toBe(artifactsPanelId)
    expect(runTab).toHaveAttribute('tabindex', '0')
    expect(artifactsTab).toHaveAttribute('tabindex', '-1')

    const runPanel = runPanelId ? document.getElementById(runPanelId) : null
    const artifactsPanel = artifactsPanelId ? document.getElementById(artifactsPanelId) : null
    expect(runPanel).toHaveAttribute('role', 'tabpanel')
    expect(runPanel).toHaveAttribute('aria-labelledby', runTab.id)
    expect(artifactsPanel).toHaveAttribute('role', 'tabpanel')
    expect(artifactsPanel).toHaveAttribute('aria-labelledby', artifactsTab.id)

    runTab.focus()
    fireEvent.keyDown(runTab, { key: 'ArrowRight' })
    expect(artifactsTab).toHaveFocus()
    expect(artifactsTab).toHaveAttribute('aria-selected', 'true')
    expect(artifactsTab).toHaveAttribute('tabindex', '0')
    expect(runTab).toHaveAttribute('tabindex', '-1')

    fireEvent.keyDown(artifactsTab, { key: 'Home' })
    expect(runTab).toHaveFocus()
    expect(runTab).toHaveAttribute('aria-selected', 'true')

    fireEvent.keyDown(runTab, { key: 'End' })
    expect(artifactsTab).toHaveFocus()
    expect(artifactsTab).toHaveAttribute('aria-selected', 'true')

    fireEvent.keyDown(artifactsTab, { key: 'ArrowLeft' })
    expect(runTab).toHaveFocus()
    expect(runTab).toHaveAttribute('aria-selected', 'true')
  })

  it('keeps every artifact tab linked to an existing labelled panel', () => {
    render(<RunInspector runView={artifactRunView} />)
    fireEvent.click(screen.getByRole('tab', { name: '产物' }))

    const artifactTablist = screen.getByRole('tablist', { name: 'Agent 产物' })
    const artifactTabs = within(artifactTablist).getAllByRole('tab')

    expect(artifactTabs.length).toBeGreaterThan(1)
    for (const artifactTab of artifactTabs) {
      const panelId = artifactTab.getAttribute('aria-controls')
      expect(panelId).toBeTruthy()

      const panel = panelId ? document.getElementById(panelId) : null
      expect(panel).toHaveAttribute('role', 'tabpanel')
      expect(panel).toHaveAttribute('aria-labelledby', artifactTab.id)
    }
  })
})
