# Canvas General Agent Assistant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the canvas general-purpose Agent so it can chat, summarize internet-backed information when a search tool is available, analyze system-design requests, and perform current-canvas operations through safe Agent/CanvasPlan contracts.

**Architecture:** Keep the existing `canvas.chatSend` and `agent.responseReady` event flow. Add a richer intent taxonomy, short-circuit local responses for no-model greetings and planning prompts, expose a controlled `web.search` ToolRuntime tool for gateway-backed agents, and make renderer chat panels show job failures instead of silently waiting.

**Tech Stack:** Electron main process, TypeScript strict, React 18, Vitest, Zod, existing ToolRuntime, existing CanvasPlan sanitizer and IPC event bus.

---

## File Structure

- Modify `desktop/src/main/agent/intent-analysis.ts`: replace the old four-way route with the six-route assistant taxonomy.
- Modify `desktop/src/main/agent/orchestrator.ts`: make the deterministic planner return visible `answer`/`clarification` responses for small talk, search-summary fallback, requirement planning, and unclear requests before CanvasPlan generation.
- Modify `desktop/src/main/agent/gateway-loop-model.ts`: short-circuit no-model runs through the deterministic planner for local answerable intents, and update the gateway prompt to use `web.search` for time-sensitive questions.
- Modify `desktop/src/main/agent/prompts/index.ts`: teach built-in agents the chat/search/planning/canvas-operation routing contract.
- Modify `desktop/src/main/agent/registry.ts`: allow the general-purpose agent to use `web.search` with `network` permission.
- Create `desktop/src/main/tools/web-search.ts`: implement the built-in read-only network search tool using injectable `fetch` for tests.
- Modify `desktop/src/main/runtime.ts`: register `createWebSearchTools()` in the shared ToolRuntime.
- Modify `desktop/src/renderer/src/chat/ChatPanel.tsx`: subscribe to `job.failed` for pending Agent jobs and show a visible assistant error.
- Modify `desktop/src/renderer/src/canvas/components/CanvasChatBox.tsx`: same failure visibility for the floating canvas chat.
- Test `tests/agent-intent-analysis.test.ts`: cover the new intent taxonomy.
- Test `tests/orchestrator-runtime.test.ts`: cover `hi/你好`, search fallback, and requirement-planning responses.
- Test `tests/gateway-agent-loop-model.test.ts`: cover no-model greeting fallback and prompt search guidance.
- Test `tests/web-search-tool.test.ts`: cover the web search tool with mocked `fetch`.
- Test `tests/agent-settings-ipc.test.ts`: cover built-in general-purpose web search permission.
- Test `tests/chat-ui.test.tsx` and `tests/canvas-chatbox.test.tsx`: cover visible Agent job failure messages.

---

### Task 1: Intent Taxonomy

**Files:**
- Modify: `desktop/src/main/agent/intent-analysis.ts`
- Test: `tests/agent-intent-analysis.test.ts`

- [ ] **Step 1: Write failing tests for the six-route taxonomy**

Replace the relevant expectations in `tests/agent-intent-analysis.test.ts` with:

```ts
it('classifies greetings as answerable small talk', () => {
  expect(analyzeAgentIntent('hi')).toMatchObject({
    kind: 'smallTalk',
    executionMode: 'direct',
    complexity: 'low',
    recommendedAgentId: 'general-purpose',
    requirements: ['Answer the greeting conversationally.'],
    missing: []
  })
})

it('classifies vague requests as clarify instead of planning', () => {
  expect(analyzeAgentIntent('帮我弄一下')).toMatchObject({
    kind: 'clarify',
    executionMode: 'clarify',
    complexity: 'medium',
    recommendedAgentId: 'general-purpose',
    requirements: ['帮我弄一下'],
    missing: ['任务类型', '目标节点或产物', '素材/模型/风格约束']
  })
})

it('routes ordinary knowledge questions to general chat', () => {
  expect(analyzeAgentIntent('Java 是什么')).toMatchObject({
    kind: 'generalChat',
    executionMode: 'direct',
    complexity: 'low',
    recommendedAgentId: 'general-purpose',
    requirements: ['Answer the user conversationally.'],
    missing: []
  })
})

it('routes time-sensitive lookup requests to search summary', () => {
  expect(analyzeAgentIntent('搜索一下今天 OpenAI 最新新闻')).toMatchObject({
    kind: 'searchSummary',
    executionMode: 'direct',
    complexity: 'medium',
    recommendedAgentId: 'general-purpose',
    requirements: ['Search the internet and summarize current information.'],
    localCapabilities: ['web.search', '通用问答', '来源总结']
  })
})

it('routes system design requests to requirement planning', () => {
  expect(analyzeAgentIntent('帮我设计当前系统的 Agent 能力')).toMatchObject({
    kind: 'requirementPlanning',
    executionMode: 'clarify',
    complexity: 'high',
    recommendedAgentId: 'general-purpose',
    requirements: ['Analyze the requested system capability and produce an implementation plan.']
  })
})

it('routes simple canvas node creation to direct canvas operation', () => {
  expect(analyzeAgentIntent('创建一个文本节点')).toMatchObject({
    kind: 'canvasOperation',
    executionMode: 'direct',
    complexity: 'low',
    recommendedAgentId: 'canvas-orchestrator',
    requirements: ['创建一个文本节点']
  })
})
```

- [ ] **Step 2: Run the intent tests and verify RED**

Run:

```bash
bun scripts/run-vitest.mjs run tests/agent-intent-analysis.test.ts
```

Expected: FAIL because the production union still returns `ambiguous`, `general`, and `canvasPlan`.

- [ ] **Step 3: Implement the new taxonomy**

In `desktop/src/main/agent/intent-analysis.ts`, replace the old type and route patterns with:

```ts
export type AgentIntentKind = 'smallTalk' | 'generalChat' | 'searchSummary' | 'requirementPlanning' | 'canvasOperation' | 'clarify'
export type AgentExecutionMode = 'clarify' | 'plan' | 'direct'
```

Add these patterns near the existing patterns:

```ts
const searchSummaryPattern = /最新|今天|刚刚|目前|现在|查一下|搜索|联网|新闻|价格|行情|排名|发布|更新|latest|today|current|search|look\s*up|news|price/iu
const requirementPlanningPattern = /设计当前系统|设计.*能力|规划.*能力|实现方案|实施计划|需求分析|产品方案|系统设计|架构方案|roadmap|requirements|implementation plan|system design/iu
```

Update `analyzeAgentIntent` so the top-level route order is:

```ts
if (!trimmed || greetingPattern.test(normalized)) {
  return {
    kind: 'smallTalk',
    summary: '用户只是打招呼或进行低负担寒暄。',
    requirements: ['Answer the greeting conversationally.'],
    missing: [],
    localCapabilities: ['通用聊天', '能力说明', '画布任务入口'],
    recommendedAgentId: 'general-purpose',
    executionMode: 'direct',
    complexity: 'low'
  }
}

if (vagueRequestPattern.test(normalized)) {
  return {
    kind: 'clarify',
    summary: '用户意图不足，不能安全推断是否要聊天、搜索、规划或操作画布。',
    requirements: [trimmed],
    missing: ['任务类型', '目标节点或产物', '素材/模型/风格约束'],
    localCapabilities: ['需求澄清', '本地能力检查', '任务拆解'],
    recommendedAgentId: 'general-purpose',
    executionMode: 'clarify',
    complexity: 'medium'
  }
}

if (requirementPlanningPattern.test(trimmed)) {
  return {
    kind: 'requirementPlanning',
    summary: '用户提出了系统能力或产品方案设计请求。',
    requirements: ['Analyze the requested system capability and produce an implementation plan.'],
    missing: ['成功标准', '执行边界', '是否允许改代码'],
    localCapabilities: ['需求分析', '方案设计', '实施计划', '画布任务委派'],
    recommendedAgentId: 'general-purpose',
    executionMode: 'clarify',
    complexity: 'high'
  }
}

if (searchSummaryPattern.test(trimmed) && !canvasIntentPattern.test(trimmed)) {
  return {
    kind: 'searchSummary',
    summary: '用户提出了依赖当前互联网信息的问题。',
    requirements: ['Search the internet and summarize current information.'],
    missing: [],
    localCapabilities: ['web.search', '通用问答', '来源总结'],
    recommendedAgentId: 'general-purpose',
    executionMode: 'direct',
    complexity: 'medium'
  }
}

if (!canvasIntentPattern.test(trimmed)) {
  return {
    kind: 'generalChat',
    summary: '用户提出了普通聊天或非画布问题。',
    requirements: ['Answer the user conversationally.'],
    missing: [],
    localCapabilities: ['通用问答', '代码协助', '联网搜索', '本地工具调用', '画布任务委派'],
    recommendedAgentId: 'general-purpose',
    executionMode: 'direct',
    complexity: 'low'
  }
}
```

Return `kind: 'canvasOperation'` in the final canvas branch.

- [ ] **Step 4: Update progress formatting**

In `formatIntentProgress`, replace the `canvasPlan` check with:

```ts
if (analysis.kind === 'canvasOperation') {
  const mode = analysis.executionMode === 'direct' ? '直接产出简单画布计划' : '先提供任务计划'
  return `理解输入：${analysis.summary}；复杂度=${analysis.complexity}；${mode}；将交给 ${analysis.recommendedAgentId}。`
}

if (analysis.kind === 'searchSummary') {
  return `理解输入：${analysis.summary}；复杂度=${analysis.complexity}；将尝试联网搜索并总结来源。`
}

if (analysis.kind === 'requirementPlanning') {
  return `理解输入：${analysis.summary}；复杂度=${analysis.complexity}；先分析需求并确认计划。`
}

if (analysis.missing.length > 0) {
  return `理解输入：${analysis.summary}；复杂度=${analysis.complexity}；需要先澄清：${analysis.missing.join('、')}。`
}

return `理解输入：${analysis.summary}；复杂度=${analysis.complexity}；直接回复用户。`
```

- [ ] **Step 5: Run intent tests and verify GREEN**

Run:

```bash
bun scripts/run-vitest.mjs run tests/agent-intent-analysis.test.ts
```

Expected: PASS.

---

### Task 2: Local Replies and No-Model Fallback

**Files:**
- Modify: `desktop/src/main/agent/orchestrator.ts`
- Modify: `desktop/src/main/agent/gateway-loop-model.ts`
- Test: `tests/orchestrator-runtime.test.ts`
- Test: `tests/gateway-agent-loop-model.test.ts`

- [ ] **Step 1: Write failing orchestrator tests**

In `tests/orchestrator-runtime.test.ts`, replace the greeting clarification test with:

```ts
it('answers low-signal greetings without creating canvas nodes', () => {
  const response = createDefaultOrchestratorPlanner().proposePlan({
    runId: 'run-greeting',
    messageId: 'message-greeting',
    message: '你好',
    agentId: 'general-purpose',
  }) as AgentResponse

  expect(response).toMatchObject({
    type: 'answer',
    summary: '用户只是打招呼或进行低负担寒暄。',
    dropped: []
  })
  expect(response.type).toBe('answer')
  if (response.type !== 'answer') throw new Error('expected_answer_response')
  expect(response.text).toContain('你好')
  expect(response.text).toContain('画布')
})
```

Add:

```ts
it('returns a visible search capability gap when no web search tool has run', () => {
  const response = createDefaultOrchestratorPlanner().proposePlan({
    runId: 'run-search',
    messageId: 'message-search',
    message: '搜索一下今天 OpenAI 最新新闻',
    agentId: 'general-purpose',
  }) as AgentResponse

  expect(response).toMatchObject({
    type: 'answer',
    summary: '用户提出了依赖当前互联网信息的问题。',
    dropped: ['web.search:not_configured']
  })
  expect(response.type).toBe('answer')
  if (response.type !== 'answer') throw new Error('expected_search_gap_answer')
  expect(response.text).toContain('联网搜索')
  expect(response.text).toContain('没有接入')
})

it('asks one key question for system capability design requests', () => {
  const response = createDefaultOrchestratorPlanner().proposePlan({
    runId: 'run-planning',
    messageId: 'message-planning',
    message: '帮我设计当前系统的 Agent 能力',
    agentId: 'general-purpose',
  }) as AgentResponse

  expect(response).toMatchObject({
    type: 'clarification',
    summary: '用户提出了系统能力或产品方案设计请求。',
    missing: ['成功标准', '执行边界', '是否允许改代码']
  })
  expect(response.type).toBe('clarification')
  if (response.type !== 'clarification') throw new Error('expected_requirement_planning_clarification')
  expect(response.question).toContain('优先')
})
```

- [ ] **Step 2: Write failing gateway no-model test**

In `tests/gateway-agent-loop-model.test.ts`, add:

```ts
it('answers greetings locally when no text model is configured', async () => {
  const planner = createGatewayAgentPlanner({
    gateways: {
      async invoke() {
        throw new Error('gateway_should_not_be_called_for_greeting')
      }
    },
    tools: createToolRuntime(),
    listTools: () => [queryGraphDescriptor],
    resolveDefaultModel: () => null
  })
  const stream = planner.proposePlan({
    runId: 'run-no-model-hi',
    messageId: 'message-no-model-hi',
    message: 'hi',
    agentId: 'general-purpose',
    agent: agent({
      id: 'general-purpose',
      name: 'General Purpose',
      instructions: 'Answer ordinary messages.',
      allowedTools: ['canvas.queryGraph'],
      permissionPolicy: { allowedPermissionKinds: ['canvas.read'], requireAskForDestructive: true },
    }),
    trigger: 'canvasChat'
  })

  if (!(typeof stream === 'object' && stream !== null && Symbol.asyncIterator in stream)) {
    throw new Error('expected_async_gateway_planner')
  }

  let next = await stream.next()
  while (!next.done) next = await stream.next()

  const response = expectAgentResponse(next.value)
  expect(response.type).toBe('answer')
  if (response.type !== 'answer') throw new Error('expected_answer_response')
  expect(response.text).toContain('你好')
  expect(response.text).toContain('画布')
})
```

- [ ] **Step 3: Run tests and verify RED**

Run:

```bash
bun scripts/run-vitest.mjs run tests/orchestrator-runtime.test.ts tests/gateway-agent-loop-model.test.ts
```

Expected: FAIL because greetings still return clarification and gateway no-model returns `noTextModelClarification`.

- [ ] **Step 4: Implement local response helpers in orchestrator**

In `desktop/src/main/agent/orchestrator.ts`, add helper functions near `generalQuestionResponse`:

```ts
function smallTalkResponse(): AgentResponse {
  return {
    type: 'answer',
    summary: '用户只是打招呼或进行低负担寒暄。',
    text: '你好，我在。你可以直接和我聊天，也可以让我总结资料、分析需求，或者帮你创建、连接和运行当前画布里的节点。',
    dropped: []
  }
}

function searchUnavailableResponse(): AgentResponse {
  return {
    type: 'answer',
    summary: '用户提出了依赖当前互联网信息的问题。',
    text: '这个问题需要联网搜索后再总结来源，但当前运行时还没有完成一次受控 web.search 工具调用。我不会假装已经搜索过；你可以先配置可用的联网搜索工具，或让我基于已有上下文先做非实时分析。',
    dropped: ['web.search:not_configured']
  }
}

function requirementPlanningResponse(): AgentResponse {
  return {
    type: 'clarification',
    summary: '用户提出了系统能力或产品方案设计请求。',
    question: '我可以先做需求分析并制定实施计划。你希望我优先保证哪一个结果：自然聊天体验、联网搜索总结、还是当前画布的自动编排执行？',
    missing: ['成功标准', '执行边界', '是否允许改代码'],
    dropped: []
  }
}
```

Update `createDefaultOrchestratorPlanner().proposePlan` route handling to:

```ts
if (analysis.kind === 'smallTalk') {
  return smallTalkResponse()
}

if (analysis.kind === 'generalChat') {
  return generalQuestionResponse(message)
}

if (analysis.kind === 'searchSummary') {
  return searchUnavailableResponse()
}

if (analysis.kind === 'requirementPlanning') {
  return requirementPlanningResponse()
}

if (analysis.kind !== 'canvasOperation') {
  return clarificationResponse(
    analysis.summary,
    '请补充你希望我完成的任务类型：聊天、联网总结、需求分析，或操作当前画布。',
    analysis.missing,
    []
  )
}
```

Replace old `analysis.kind === 'general'` and `analysis.kind !== 'canvasPlan'` checks.

- [ ] **Step 5: Implement gateway no-model local fallback**

In `desktop/src/main/agent/gateway-loop-model.ts`, import:

```ts
import { createDefaultOrchestratorPlanner } from './orchestrator'
import type { CanvasPlan } from '../../../../shared/plan'
```

Add a helper near `noTextModelClarification`:

```ts
async function localFallbackResponse(input: Parameters<OrchestratorPlanner['proposePlan']>[0]): Promise<AgentResponse> {
  const local = createDefaultOrchestratorPlanner().proposePlan(input)
  const value = await Promise.resolve(local as AgentResponse | CanvasPlan)
  return 'type' in value ? value : { type: 'canvasPlan', plan: sanitizePlan(value) }
}
```

Then replace the no-model branch in `proposePlan` with:

```ts
if (options.resolveDefaultModel && resolvedDefault === null && !input.agent.gatewayPolicy.gatewayId) {
  yield { type: 'progress', message: '未检测到可用的文本模型，尝试本地确定性回复', progress: 10 }
  return localFallbackResponse(input)
}
```

- [ ] **Step 6: Run focused tests and verify GREEN**

Run:

```bash
bun scripts/run-vitest.mjs run tests/orchestrator-runtime.test.ts tests/gateway-agent-loop-model.test.ts
```

Expected: PASS for the new tests and existing orchestrator/gateway tests.

---

### Task 3: Built-In Web Search Tool

**Files:**
- Create: `desktop/src/main/tools/web-search.ts`
- Test: `tests/web-search-tool.test.ts`
- Modify: `desktop/src/main/runtime.ts`

- [ ] **Step 1: Write failing web search tool tests**

Create `tests/web-search-tool.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'

import { createToolRuntime } from '../desktop/src/main/tools/runtime'
import { createWebSearchTools } from '../desktop/src/main/tools/web-search'

const actor = { type: 'agent' as const, id: 'general-purpose' }

describe('web.search tool', () => {
  it('lists a builtin readonly network search descriptor', () => {
    const [tool] = createWebSearchTools({ fetch: vi.fn() as unknown as typeof fetch })

    expect(tool.descriptor).toMatchObject({
      id: 'web.search',
      name: 'Search Web',
      category: 'web',
      owner: { kind: 'builtin', id: 'core' },
      permissions: [{ kind: 'network', reason: 'Queries the public web for current information.' }],
      concurrency: 'readonly',
      enabled: true
    })
  })

  it('searches through the injected fetch and returns compact source results', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => [
        '[OpenAI News](https://openai.com/news)',
        'Official OpenAI news page.',
        '',
        '[OpenAI Docs](https://platform.openai.com/docs)',
        'Official documentation.'
      ].join('\n')
    })
    const runtime = createToolRuntime({
      idFactory: () => 'invoke-web-search',
      clock: () => 1_783_382_400_000,
      tools: createWebSearchTools({ fetch: fetchMock as unknown as typeof fetch })
    })

    const result = await runtime.invoke({
      toolId: 'web.search',
      input: { query: 'OpenAI latest news', limit: 2 },
      actor,
      traceId: 'trace-web-search'
    })

    expect(result.error).toBeUndefined()
    expect(fetchMock).toHaveBeenCalledWith(
      'https://s.jina.ai/OpenAI%20latest%20news',
      expect.objectContaining({ headers: expect.objectContaining({ Accept: 'text/plain' }) })
    )
    expect(result.output).toEqual({
      query: 'OpenAI latest news',
      searchedAt: '2026-07-07T00:00:00.000Z',
      results: [
        { title: 'OpenAI News', url: 'https://openai.com/news', snippet: 'Official OpenAI news page.' },
        { title: 'OpenAI Docs', url: 'https://platform.openai.com/docs', snippet: 'Official documentation.' }
      ],
      truncated: false
    })
  })

  it('returns a structured tool error when the search endpoint fails', async () => {
    const runtime = createToolRuntime({
      tools: createWebSearchTools({
        fetch: vi.fn().mockResolvedValue({ ok: false, status: 503, text: async () => '' }) as unknown as typeof fetch
      })
    })

    const result = await runtime.invoke({
      toolId: 'web.search',
      input: { query: 'OpenAI latest news' },
      actor,
      traceId: 'trace-web-search-fail'
    })

    expect(result.error).toMatchObject({
      errorClass: 'tool_execution_failed',
      code: 'web_search_failed',
      retryable: true
    })
  })
})
```

- [ ] **Step 2: Run web search tests and verify RED**

Run:

```bash
bun scripts/run-vitest.mjs run tests/web-search-tool.test.ts
```

Expected: FAIL because `desktop/src/main/tools/web-search.ts` does not exist.

- [ ] **Step 3: Implement the tool**

Create `desktop/src/main/tools/web-search.ts`:

```ts
/**
 * Built-in controlled web search tool for Agent current-information summaries.
 * @see docs/api-contracts/tools-plugins.md
 */

import { z } from 'zod'

import type { ToolDescriptor, ToolPermission } from '../../../../shared/tools'
import { defineTool, ToolExecutionError, type ToolDefinition } from './runtime'

export interface WebSearchToolsOptions {
  fetch?: typeof fetch
  endpoint?: string
  clock?: () => number
}

const networkPermission: ToolPermission = { kind: 'network', reason: 'Queries the public web for current information.' }
const DEFAULT_ENDPOINT = 'https://s.jina.ai/'

const searchInputSchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().positive().max(5).optional()
})

const searchResultSchema = z.object({
  title: z.string(),
  url: z.string(),
  snippet: z.string()
})

const searchOutputSchema = z.object({
  query: z.string(),
  searchedAt: z.string(),
  results: z.array(searchResultSchema),
  truncated: z.boolean()
})

function descriptor(): ToolDescriptor {
  return {
    id: 'web.search',
    name: 'Search Web',
    description: 'Searches the public web for current information and returns compact source results.',
    category: 'web',
    owner: { kind: 'builtin', id: 'core' },
    inputSchemaRef: 'web.search.input',
    outputSchemaRef: 'web.search.output',
    permissions: [networkPermission],
    concurrency: 'readonly',
    enabled: true
  }
}

function parseMarkdownResults(markdown: string, limit: number): { results: Array<{ title: string; url: string; snippet: string }>; truncated: boolean } {
  const matches = Array.from(markdown.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)\s*\n?([^\n[]*)/gu))
  const results = matches.slice(0, limit).map((match) => ({
    title: (match[1] ?? '').trim(),
    url: (match[2] ?? '').trim(),
    snippet: (match[3] ?? '').trim()
  })).filter((result) => result.title.length > 0 && result.url.length > 0)

  return { results, truncated: matches.length > results.length }
}

/**
 * Creates the controlled web search tool for Agent runs.
 * @param options - Optional fetch, endpoint, and clock overrides for tests.
 * @returns Tool definition list containing web.search.
 */
export function createWebSearchTools(options: WebSearchToolsOptions = {}): ToolDefinition<unknown, unknown>[] {
  const fetchImpl = options.fetch ?? fetch
  const endpoint = options.endpoint ?? DEFAULT_ENDPOINT
  const clock = options.clock ?? Date.now

  return [
    defineTool({
      descriptor: descriptor(),
      inputSchema: searchInputSchema,
      outputSchema: searchOutputSchema,
      renderToolUseMessage: (input) => `Search web: ${input.query}`,
      async call(input) {
        const limit = input.limit ?? 5
        const url = `${endpoint}${encodeURIComponent(input.query)}`
        const response = await fetchImpl(url, { headers: { Accept: 'text/plain' } })

        if (!response.ok) {
          throw new ToolExecutionError({
            code: 'web_search_failed',
            message: `Web search request failed with status ${response.status}.`,
            retryable: true,
            details: { status: response.status }
          })
        }

        const markdown = await response.text()
        const parsed = parseMarkdownResults(markdown, limit)

        return {
          query: input.query,
          searchedAt: new Date(clock()).toISOString(),
          results: parsed.results,
          truncated: parsed.truncated
        }
      }
    })
  ]
}
```

- [ ] **Step 4: Register web.search in runtime**

In `desktop/src/main/runtime.ts`, import:

```ts
import { createWebSearchTools } from './tools/web-search'
```

Add the tool before filesystem tools in the `createToolRuntime` tool list:

```ts
      ...createWebSearchTools(),
      ...createFsTools({
        workspaceRoot: options.workspaceRoot ?? process.cwd()
      })
```

- [ ] **Step 5: Run web search tests and verify GREEN**

Run:

```bash
bun scripts/run-vitest.mjs run tests/web-search-tool.test.ts
```

Expected: PASS.

---

### Task 4: Agent Policy and Prompt Routing

**Files:**
- Modify: `desktop/src/main/agent/registry.ts`
- Modify: `desktop/src/main/agent/prompts/index.ts`
- Modify: `desktop/src/main/agent/gateway-loop-model.ts`
- Test: `tests/agent-settings-ipc.test.ts`
- Test: `tests/gateway-agent-loop-model.test.ts`

- [ ] **Step 1: Write failing agent policy test**

In `tests/agent-settings-ipc.test.ts`, extend the default general-purpose assertion:

```ts
expect(general?.allowedTools).toEqual(['canvas.queryGraph', 'fs.read', 'fs.glob', 'fs.grep', 'web.search'])
expect(general?.permissionPolicy.allowedPermissionKinds).toEqual(['canvas.read', 'file.read', 'diagnostics', 'network'])
expect(general?.instructions).toContain('web.search')
```

- [ ] **Step 2: Write failing gateway prompt test**

In `tests/gateway-agent-loop-model.test.ts`, add after a prompt-capturing test or inside the existing prompt assertions:

```ts
expect(prompts[0]).toContain('Use web.search before answering current, latest, price, news, or time-sensitive questions')
expect(prompts[0]).toContain('If web.search is unavailable or denied, say that clearly')
```

- [ ] **Step 3: Run policy/prompt tests and verify RED**

Run:

```bash
bun scripts/run-vitest.mjs run tests/agent-settings-ipc.test.ts tests/gateway-agent-loop-model.test.ts
```

Expected: FAIL because `web.search` is not allowed and prompts do not mention search routing.

- [ ] **Step 4: Update built-in general-purpose agent policy**

In `desktop/src/main/agent/registry.ts`, change the general-purpose built-in policy:

```ts
allowedTools: ['canvas.queryGraph', 'fs.read', 'fs.glob', 'fs.grep', 'web.search'],
permissionPolicy: { allowedPermissionKinds: ['canvas.read', 'file.read', 'diagnostics', 'network'], requireAskForDestructive: true },
```

Make the same allowed tool and permission change in `fallbackOrchestratorAgent` for `DEFAULT_CHAT_AGENT_ID` in `desktop/src/main/agent/orchestrator.ts`.

- [ ] **Step 5: Update built-in prompts**

In `desktop/src/main/agent/prompts/index.ts`, update `GENERAL_PURPOSE_PROMPT` capabilities:

```ts
'- Search the web for current information with web.search when the user asks for latest/current/news/prices or explicitly asks to search.',
```

Add rules:

```ts
'- For pure greetings, reply naturally and briefly mention you can chat, search/summarize, analyze requirements, or operate the current canvas.',
'- For latest/current/news/price questions, call web.search before answering when the tool is available.',
'- If web.search is unavailable or denied, say that clearly. Never pretend to have searched.',
'- For system capability design requests, analyze requirements first, ask one key question if needed, and only then produce a plan.',
```

- [ ] **Step 6: Update gateway prompt hard rules**

In `desktop/src/main/agent/gateway-loop-model.ts`, add these strings to both `buildPrompt` and `buildNativeSystemPrompt` hard rules:

```ts
'- Use web.search before answering current, latest, price, news, or time-sensitive questions when that tool is available.',
'- If web.search is unavailable or denied, say that clearly. Never pretend to have searched.',
'- For pure greetings, return type=answer with a natural greeting and mention chat/search/planning/canvas help briefly.',
'- For system capability design requests, analyze requirements first and ask one key question before implementation or canvas mutations.',
```

- [ ] **Step 7: Run policy/prompt tests and verify GREEN**

Run:

```bash
bun scripts/run-vitest.mjs run tests/agent-settings-ipc.test.ts tests/gateway-agent-loop-model.test.ts
```

Expected: PASS.

---

### Task 5: Visible Agent Job Failures in Chat UI

**Files:**
- Modify: `desktop/src/renderer/src/chat/ChatPanel.tsx`
- Modify: `desktop/src/renderer/src/canvas/components/CanvasChatBox.tsx`
- Test: `tests/chat-ui.test.tsx`
- Test: `tests/canvas-chatbox.test.tsx`

- [ ] **Step 1: Write failing ChatPanel job failure test**

In `tests/chat-ui.test.tsx`, extend `ChatPanelApi` mocks to include `onJobFailed`. Add:

```ts
it('shows a visible assistant error when the pending Agent job fails', async () => {
  const failedHandlers: Array<(event: { channel: 'job.failed'; jobId: string; error: { errorClass: string; message: string; retryable: boolean }; emittedAt: number }) => void> = []
  const api = createApi({
    onCanvasPlanReady: vi.fn().mockReturnValue(vi.fn()),
    onAgentResponseReady: vi.fn().mockReturnValue(vi.fn()),
    onJobFailed: vi.fn((handler) => {
      failedHandlers.push(handler)
      return vi.fn()
    })
  } as Partial<ChatPanelApi>)

  render(<ChatPanel api={api} onApplyPlan={vi.fn()} />)

  fireEvent.change(screen.getByRole('textbox', { name: 'Canvas agent message' }), { target: { value: '你好' } })
  fireEvent.click(screen.getByRole('button', { name: '发送画布消息' }))

  await waitFor(() => expect(api.sendCanvasChat).toHaveBeenCalled())
  const handler = failedHandlers[0]
  if (!handler) throw new Error('expected_job_failed_subscription')

  handler({
    channel: 'job.failed',
    jobId: 'job-agent-1',
    error: { errorClass: 'agent_run_failed', message: 'Agent runtime failed.', retryable: false },
    emittedAt: 1
  })

  expect(await screen.findByText('Agent 执行失败：Agent runtime failed.')).toBeInTheDocument()
})
```

- [ ] **Step 2: Write failing CanvasChatBox job failure test**

In `tests/canvas-chatbox.test.tsx`, add:

```ts
it('shows a visible assistant error when the floating chat Agent job fails', async () => {
  const failedHandlers: Array<(event: { channel: 'job.failed'; jobId: string; error: { errorClass: string; message: string; retryable: boolean }; emittedAt: number }) => void> = []
  window.comicCanvas = {
    listAgents: vi.fn().mockResolvedValue([generalAgent]),
    sendCanvasChat: vi.fn().mockResolvedValue({ runId: 'run-agent-1', jobId: 'job-agent-1', messageId: 'message-1', status: 'pending' }),
    getAgentRun: vi.fn().mockResolvedValue({ runId: 'run-agent-1', status: 'pending', trace: {} }),
    getCanvasPlan: vi.fn(),
    onCanvasPlanReady: vi.fn().mockReturnValue(vi.fn()),
    onAgentResponseReady: vi.fn().mockReturnValue(vi.fn()),
    onJobProgress: vi.fn().mockReturnValue(vi.fn()),
    onJobFailed: vi.fn((handler) => {
      failedHandlers.push(handler)
      return vi.fn()
    }),
  } as unknown as Window['comicCanvas']

  render(<CanvasChatBox open onToggle={vi.fn()} onApplyPlan={vi.fn()} />)

  const textbox = await screen.findByRole('textbox', { name: 'Canvas floating agent message' })
  fireEvent.change(textbox, { target: { value: '你好' } })
  fireEvent.keyDown(textbox, { key: 'Enter' })

  await waitFor(() => expect(window.comicCanvas.sendCanvasChat).toHaveBeenCalled())
  const handler = failedHandlers[0]
  if (!handler) throw new Error('expected_job_failed_subscription')

  handler({
    channel: 'job.failed',
    jobId: 'job-agent-1',
    error: { errorClass: 'agent_run_failed', message: 'Agent runtime failed.', retryable: false },
    emittedAt: 1
  })

  expect(await screen.findByText('Agent 执行失败：Agent runtime failed.')).toBeInTheDocument()
})
```

- [ ] **Step 3: Run UI tests and verify RED**

Run:

```bash
bun scripts/run-vitest.mjs run tests/chat-ui.test.tsx tests/canvas-chatbox.test.tsx
```

Expected: FAIL because neither chat component subscribes to `onJobFailed` for pending Agent jobs.

- [ ] **Step 4: Add `onJobFailed` to ChatPanel API**

In `desktop/src/renderer/src/chat/ChatPanel.tsx`, add to `ChatPanelApi`:

```ts
/** @see docs/api-contracts/jobs.md */
onJobFailed?: (handler: (event: IpcEventMap['job.failed']) => void) => () => void
```

Add an effect after the job progress effect:

```ts
useEffect(() => {
  if (!api.onJobFailed) return undefined

  return api.onJobFailed((event) => {
    if (!pendingJobIdRef.current || event.jobId !== pendingJobIdRef.current) {
      return
    }

    setMessages((items) => [
      ...items,
      { id: `assistant-job-failed-${event.jobId}`, role: 'assistant', content: `Agent 执行失败：${event.error.message}` }
    ])
    setBusy(false)
    setPendingMessageId(null)
    pendingMessageIdRef.current = null
    pendingJobIdRef.current = null
    pendingRunIdRef.current = null
    setPermissionRequest(null)
  })
}, [api])
```

- [ ] **Step 5: Add floating chat failure subscription**

In `desktop/src/renderer/src/canvas/components/CanvasChatBox.tsx`, add:

```ts
useEffect(() => {
  const api = window.comicCanvas
  if (!api?.onJobFailed) return undefined

  return api.onJobFailed((event) => {
    if (!pendingJobIdRef.current || event.jobId !== pendingJobIdRef.current) return

    setMessages((prev) => [
      ...prev,
      { id: `assistant-job-failed-${event.jobId}`, role: 'assistant', content: `Agent 执行失败：${event.error.message}` }
    ])
    setBusy(false)
    pendingMessageIdRef.current = null
    pendingJobIdRef.current = null
    pendingRunIdRef.current = null
    setPermissionRequest(null)
  })
}, [])
```

- [ ] **Step 6: Run UI tests and verify GREEN**

Run:

```bash
bun scripts/run-vitest.mjs run tests/chat-ui.test.tsx tests/canvas-chatbox.test.tsx
```

Expected: PASS.

---

### Task 6: Integrated Verification

**Files:**
- Read: `docs/superpowers/specs/2026-07-07-canvas-general-agent-assistant-design.md`
- Verify: all changed tests plus typecheck

- [ ] **Step 1: Run focused test suite**

Run:

```bash
bun scripts/run-vitest.mjs run tests/agent-intent-analysis.test.ts tests/orchestrator-runtime.test.ts tests/gateway-agent-loop-model.test.ts tests/web-search-tool.test.ts tests/agent-settings-ipc.test.ts tests/chat-ui.test.tsx tests/canvas-chatbox.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run:

```bash
bun run typecheck
```

Expected: PASS with no TypeScript errors.

- [ ] **Step 3: Run full test suite if focused verification is clean**

Run:

```bash
bun run test
```

Expected: PASS. If unrelated pre-existing tests fail, record the exact failing test names and rerun the focused suite to prove this feature is green.

- [ ] **Step 4: Review spec coverage**

Confirm these mappings:

```text
Small talk visible answer -> Task 2
General chat route -> Task 1 and Task 2
Search summary controlled tool -> Task 3 and Task 4
Requirement planning route -> Task 1 and Task 2
Canvas operation preserved through CanvasPlan -> Task 1 and existing CanvasPlan tests
Visible failures -> Task 5
```
