/**
 * Deterministic user-intent analysis before CanvasPlan generation.
 * @see docs/api-contracts/agents.md
 */

export type AgentIntentKind =
  | 'smallTalk'
  | 'generalChat'
  | 'searchSummary'
  | 'requirementPlanning'
  | 'canvasOperation'
  | 'clarify'
export type AgentExecutionMode = 'clarify' | 'plan' | 'direct'

export interface AgentIntentAnalysis {
  kind: AgentIntentKind
  summary: string
  requirements: string[]
  missing: string[]
  localCapabilities: string[]
  recommendedAgentId: 'general-purpose' | 'canvas-orchestrator' | 'canvas-operator'
  executionMode: AgentExecutionMode
  complexity: 'low' | 'medium' | 'high'
}

const canvasObjectPattern = /文本节点|节点|画布|工作流|图片|图像|首帧|视频|短剧|漫画|角色|人物|场景|分镜|配音|音频|声音|合成|text\s*node|image|video|canvas|workflow|node|storyboard|comic|drama|character|scene|audio|voice/iu
const canvasActionPattern = /生成|创建|新建|添加|绘制|画一张|画一个|画个|画出|画成|帮我画|制作|做一个|做一张|做个|帮我做|设计|编排|运行|执行|连接|连线|转换|转成|create|generate|draw|make|design|run|execute|connect|compose|convert/iu
const currentCanvasObjectPattern = /当前画布|这个画布|本画布|当前工作流|这个工作流|本工作流|当前节点|这个节点|选中节点|当前连线|这个连线|current\s*canvas|current\s*workflow|selected\s*node|current\s*node/iu
const currentCanvasActionPattern = /查一下|查询|查看|看看|列出|读取|创建|新建|添加|生成|运行|执行|连接|连线|修改|更新|删除|移除|编排|query|inspect|list|read|create|add|generate|run|execute|connect|update|delete|remove/iu
const currentCanvasTopologyQueryPattern = /(查一下|查询|查看|看看|列出|读取).*(节点|连线|工作流).*(有哪些|多少|列表|数量|状态|关系)|(?:list|query|inspect|read).*(nodes|edges|workflow|graph)/iu
const existingCanvasNodePattern = /(?:当前|这个|本|选中).{0,8}(?:角色|人物|场景|文本|图片|图像|视频|音频)?节点|(?:角色|人物|场景|文本|图片|图像|视频|音频)节点.{0,48}(?:改为|改成|修改|更新|填写|补充|完善|设置)|(?:update|edit|rename).{0,32}(?:current|selected|character|scene|node)/iu
const existingCanvasMutationActionPattern = /改为|改成|修改|更新|填写|补充|完善|设置|替换|update|edit|rename|set/iu
const vagueRequestPattern = /^(帮我弄一下|帮我做一下|处理一下|搞一下|随便做点|做点东西|弄个东西|make\s*something|do\s*something)$/iu
const greetingPattern = /^(hi|hello|hey|哈喽|你好|您好|嗨|在吗|在不在|早|早上好|晚上好|下午好)$/iu
/** 口语化寒暄变体（如「你好啊」「嗨呀」），normalize 后匹配。 */
const casualGreetingPattern = /^(你好|您好|嗨|哈喽|hello|hi|hey|在吗|在不在)(啊|呀|哦|呢|嘛|哈)?$/iu
const assistantIdentityPattern = /^(你是谁|你是.*谁|你叫什么|介绍一下自己|自我介绍|你能做什么|你可以做什么|who\s*are\s*you|what\s*can\s*you\s*do)$/iu
const explicitLookupPattern = /查一下|搜索|联网|search|look\s*up/iu
const currentInfoSignalPattern = /最新|刚刚|新闻|价格|行情|排名|latest|news|price/iu
const currentTimeQuestionPattern = /^(what\s*time\s*is\s*it|what\s*date\s*is\s*it)$/iu
const strongRequirementPlanningPattern = /设计当前系统|当前系统.*能力|系统.*能力|实现方案|实施计划|需求分析|产品方案|系统设计|架构方案|roadmap|requirements|implementation plan|system design/iu
const capabilityPlanningPattern = /设计.*能力|规划.*能力/iu
const baseCanvasCapabilities = ['canvas.queryGraph', 'canvas.proposePlan', 'canvas.createNode', 'canvas.connectNodes', 'canvas.runNode']

function normalizeMessage(message: string): string {
  return message.trim().toLowerCase().replace(/[!！。,.，?？\s]+/gu, '')
}

function hasAny(message: string, pattern: RegExp): boolean {
  return pattern.test(message)
}

function hasCanvasOperationIntent(message: string): boolean {
  return hasCurrentCanvasOperationIntent(message) || (canvasObjectPattern.test(message) && canvasActionPattern.test(message))
}

function hasCurrentCanvasOperationIntent(message: string): boolean {
  return (currentCanvasObjectPattern.test(message) && currentCanvasActionPattern.test(message)) || currentCanvasTopologyQueryPattern.test(message)
}

function hasExistingCanvasNodeMutationIntent(message: string): boolean {
  return existingCanvasNodePattern.test(message) && existingCanvasMutationActionPattern.test(message)
}

function unique(values: string[]): string[] {
  return [...new Set(values)]
}

function decomposeCanvasRequirements(message: string): string[] {
  const requirements: string[] = []

  if (hasAny(message, /漫画|短剧|comic|drama|storyboard|episode/iu)) {
    requirements.push('Create a comic-drama workflow.')
  }

  if (hasAny(message, /角色|人物|character/iu)) {
    requirements.push('Define character references.')
  }

  if (hasAny(message, /场景|环境|scene|setting/iu)) {
    requirements.push('Define scene references.')
  }

  if (hasAny(message, /图片|图像|首帧|image|first\s*frame/iu)) {
    requirements.push('Generate image configuration nodes.')
  }

  if (hasAny(message, /配音|音频|声音|audio|voice|sound/iu)) {
    requirements.push('Generate or attach audio assets.')
  }

  if (hasAny(message, /视频|video/iu)) {
    requirements.push('Generate video configuration nodes.')
  }

  if (hasAny(message, /视频合成|compose|composition/iu)) {
    requirements.push('Compose video clips.')
  }

  if (hasAny(message, /音视频合成|mux|混音|合成音视频/iu)) {
    requirements.push('Mux audio and video.')
  }

  return requirements.length > 0 ? unique(requirements) : [message]
}

function canvasCapabilitiesForRequirements(requirements: string[]): string[] {
  const capabilities = [...baseCanvasCapabilities]

  if (requirements.includes('Compose video clips.')) {
    capabilities.push('canvas.composeVideo')
  }

  if (requirements.includes('Mux audio and video.')) {
    capabilities.push('canvas.muxAudioVideo')
  }

  return capabilities
}

/**
 * Analyzes the user message before any graph mutation or plan emission.
 * @param message - Raw user message from chat or agent.run.
 * @returns Intent classification, requirement slices, missing info, and the local capability route.
 * @throws Error never intentionally; empty input becomes clarify.
 * @see docs/api-contracts/agents.md
 */
export function analyzeAgentIntent(message: string): AgentIntentAnalysis {
  const trimmed = message.trim()
  const normalized = normalizeMessage(trimmed)

  if (!trimmed) {
    return {
      kind: 'clarify',
      summary: '用户未提供可执行或可回答的内容。',
      requirements: [],
      missing: ['任务类型', '目标节点或产物', '素材/模型/风格约束'],
      localCapabilities: ['需求澄清', '本地能力检查', '任务拆解'],
      recommendedAgentId: 'general-purpose',
      executionMode: 'clarify',
      complexity: 'medium'
    }
  }

  if (greetingPattern.test(normalized) || casualGreetingPattern.test(normalized)) {
    return {
      kind: 'smallTalk',
      summary: '用户只是打招呼或尚未提出任务目标。',
      requirements: ['Answer the greeting conversationally.'],
      missing: [],
      localCapabilities: ['通用问答'],
      recommendedAgentId: 'general-purpose',
      executionMode: 'direct',
      complexity: 'low'
    }
  }

  if (assistantIdentityPattern.test(normalized)) {
    return {
      kind: 'smallTalk',
      summary: '用户询问助手身份或能力边界。',
      requirements: ['Answer the assistant identity question conversationally.'],
      missing: [],
      localCapabilities: ['通用问答', '能力介绍', '画布任务委派'],
      recommendedAgentId: 'general-purpose',
      executionMode: 'direct',
      complexity: 'low'
    }
  }

  if (vagueRequestPattern.test(normalized)) {
    return {
      kind: 'clarify',
      summary: '用户意图不足，不能安全推断是否要创建画布节点。',
      requirements: [trimmed],
      missing: ['任务类型', '目标节点或产物', '素材/模型/风格约束'],
      localCapabilities: ['需求澄清', '本地能力检查', '任务拆解'],
      recommendedAgentId: 'general-purpose',
      executionMode: 'clarify',
      complexity: 'medium'
    }
  }

  const hasCanvasIntent = hasCanvasOperationIntent(trimmed)
  const hasCurrentCanvasIntent = hasCurrentCanvasOperationIntent(trimmed)

  if (hasExistingCanvasNodeMutationIntent(trimmed)) {
    return {
      kind: 'canvasOperation',
      summary: '用户要求更新当前画布中的既有节点属性。',
      requirements: ['Inspect the existing node and update only the requested fields.'],
      missing: [],
      localCapabilities: ['canvas.queryGraph', 'canvas.updateNodeData'],
      recommendedAgentId: 'canvas-operator',
      executionMode: 'direct',
      complexity: 'low'
    }
  }

  if ((strongRequirementPlanningPattern.test(trimmed) || capabilityPlanningPattern.test(trimmed)) && !hasCanvasIntent) {
    return {
      kind: 'requirementPlanning',
      summary: '用户请求系统能力设计或需求规划。',
      requirements: ['Analyze the requested system capability and produce an implementation plan.'],
      missing: ['成功标准', '执行边界', '是否允许改代码'],
      localCapabilities: ['需求分析', '实施计划', '任务拆解'],
      recommendedAgentId: 'general-purpose',
      executionMode: 'clarify',
      complexity: 'high'
    }
  }

  const hasSearchSummaryIntent =
    explicitLookupPattern.test(trimmed) || currentInfoSignalPattern.test(trimmed) || currentTimeQuestionPattern.test(trimmed)

  if (
    currentTimeQuestionPattern.test(trimmed) ||
    (explicitLookupPattern.test(trimmed) && !hasCurrentCanvasIntent) ||
    (hasSearchSummaryIntent && currentInfoSignalPattern.test(trimmed) && !hasCanvasIntent)
  ) {
    return {
      kind: 'searchSummary',
      summary: '用户请求联网检索并总结当前信息。',
      requirements: ['Search the internet and summarize current information.'],
      missing: [],
      localCapabilities: ['web.search', '通用问答', '来源总结'],
      recommendedAgentId: 'general-purpose',
      executionMode: 'direct',
      complexity: 'medium'
    }
  }

  if (!hasCanvasIntent) {
    return {
      kind: 'generalChat',
      summary: '用户提出了普通问题，应由通用 Agent 直接回答。',
      requirements: ['Answer the user conversationally.'],
      missing: [],
      localCapabilities: ['通用问答', '代码协助', '联网搜索', '本地工具调用', '画布任务委派'],
      recommendedAgentId: 'general-purpose',
      executionMode: 'direct',
      complexity: 'low'
    }
  }

  const simpleCanvasRequest = /^(创建|新建|添加)(一个|一段|1个)?(文本|提示词|图片|视频)(节点)?$/iu.test(normalized)

  const requirements = simpleCanvasRequest ? [trimmed] : decomposeCanvasRequirements(trimmed)

  return {
    kind: 'canvasOperation',
    summary: '用户提出了明确的画布或生成工作流需求。',
    requirements,
    missing: [],
    localCapabilities: canvasCapabilitiesForRequirements(requirements),
    recommendedAgentId: 'canvas-orchestrator',
    executionMode: simpleCanvasRequest ? 'direct' : 'plan',
    complexity: simpleCanvasRequest ? 'low' : 'high'
  }
}

/**
 * Formats a compact, user-visible progress line from deterministic intent analysis.
 * @param analysis - Intent analysis result.
 * @returns Progress text suitable for job/chat UI.
 * @throws Error never intentionally.
 */
export function formatIntentProgress(analysis: AgentIntentAnalysis): string {
  if (analysis.kind === 'canvasOperation') {
    const mode = analysis.recommendedAgentId === 'canvas-operator'
      ? '直接更新既有节点'
      : analysis.executionMode === 'direct' ? '直接产出简单画布计划' : '先提供任务计划'
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
}
