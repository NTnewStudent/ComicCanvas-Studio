/**
 * Deterministic user-intent analysis before CanvasPlan generation.
 * @see docs/api-contracts/agents.md
 */

export type AgentIntentKind = 'smallTalk' | 'ambiguous' | 'canvasPlan' | 'general'
export type AgentExecutionMode = 'clarify' | 'plan' | 'direct'

export interface AgentIntentAnalysis {
  kind: AgentIntentKind
  summary: string
  requirements: string[]
  missing: string[]
  localCapabilities: string[]
  recommendedAgentId: 'general-purpose' | 'canvas-orchestrator'
  executionMode: AgentExecutionMode
  complexity: 'low' | 'medium' | 'high'
}

const canvasIntentPattern = /生成|创建|新建|添加|画|绘制|制作|做一个|做一张|做个|帮我做|设计|编排|拆解|规划|节点|画布|工作流|图片|图像|视频|短剧|漫画|角色|场景|配音|音频|合成|image|video|canvas|workflow|node|create|generate|draw|make|design|storyboard|comic|drama/iu
const vagueRequestPattern = /^(帮我弄一下|帮我做一下|处理一下|搞一下|随便做点|做点东西|弄个东西|make something|do something)$/iu
const greetingPattern = /^(hi|hello|hey|哈喽|你好|您好|嗨|在吗|在不在|早|早上好|晚上好|下午好)$/iu
const ordinaryQuestionPattern = /^(今天星期几|今天周几|现在几点|今天几号|今天日期|what day is it|what date is it|what time is it|who|what|when|where|why|how|谁|什么|什么时候|哪里|为什么|怎么|如何)/iu
const baseCanvasCapabilities = ['canvas.queryGraph', 'canvas.proposePlan', 'canvas.createNode', 'canvas.connectNodes', 'canvas.runNode']

function normalizeMessage(message: string): string {
  return message.trim().toLowerCase().replace(/[!！。,.，?？\s]+/gu, '')
}

function hasAny(message: string, pattern: RegExp): boolean {
  return pattern.test(message)
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
 * @throws Error never intentionally; empty input becomes ambiguous.
 * @see docs/api-contracts/agents.md
 */
export function analyzeAgentIntent(message: string): AgentIntentAnalysis {
  const trimmed = message.trim()
  const normalized = normalizeMessage(trimmed)

  if (!trimmed || greetingPattern.test(normalized)) {
    return {
      kind: 'smallTalk',
      summary: '用户只是打招呼或尚未提出任务目标。',
      requirements: [],
      missing: ['画布目标', '期望产物', '是否需要创建节点或执行工作流'],
      localCapabilities: ['需求澄清', '能力说明', '画布任务拆解'],
      recommendedAgentId: 'general-purpose',
      executionMode: 'clarify',
      complexity: 'low'
    }
  }

  if (vagueRequestPattern.test(normalized)) {
    return {
      kind: 'ambiguous',
      summary: '用户意图不足，不能安全推断是否要创建画布节点。',
      requirements: [trimmed],
      missing: ['任务类型', '目标节点或产物', '素材/模型/风格约束'],
      localCapabilities: ['需求澄清', '本地能力检查', '任务拆解'],
      recommendedAgentId: 'general-purpose',
      executionMode: 'clarify',
      complexity: 'medium'
    }
  }

  if (!canvasIntentPattern.test(trimmed)) {
    return {
      kind: ordinaryQuestionPattern.test(trimmed) ? 'general' : 'general',
      summary: '用户提出了普通问题，应由通用 Agent 直接回答。',
      requirements: ['Answer the user question conversationally.'],
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
    kind: 'canvasPlan',
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
  if (analysis.kind === 'canvasPlan') {
    const mode = analysis.executionMode === 'direct' ? '直接产出简单画布计划' : '先提供任务计划'
    return `理解输入：${analysis.summary}；复杂度=${analysis.complexity}；${mode}；将交给 ${analysis.recommendedAgentId}。`
  }

  return `理解输入：${analysis.summary}；复杂度=${analysis.complexity}；需要先澄清：${analysis.missing.join('、')}。`
}
