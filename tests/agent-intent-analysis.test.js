import { describe, expect, it } from 'vitest';
import { analyzeAgentIntent } from '../desktop/src/main/agent/intent-analysis';
describe('Agent intent analysis', () => {
    it('classifies greetings as answerable small talk', () => {
        expect(analyzeAgentIntent('hi')).toMatchObject({
            kind: 'smallTalk',
            executionMode: 'direct',
            complexity: 'low',
            recommendedAgentId: 'general-purpose',
            requirements: ['Answer the greeting conversationally.'],
            missing: []
        });
    });
    it('classifies empty input as clarify instead of answerable small talk', () => {
        expect(analyzeAgentIntent('   ')).toMatchObject({
            kind: 'clarify',
            executionMode: 'clarify',
            complexity: 'medium',
            recommendedAgentId: 'general-purpose',
            missing: ['任务类型', '目标节点或产物', '素材/模型/风格约束']
        });
    });
    it('classifies vague requests as clarify instead of planning', () => {
        expect(analyzeAgentIntent('帮我弄一下')).toMatchObject({
            kind: 'clarify',
            executionMode: 'clarify',
            complexity: 'medium',
            recommendedAgentId: 'general-purpose',
            requirements: ['帮我弄一下'],
            missing: ['任务类型', '目标节点或产物', '素材/模型/风格约束']
        });
    });
    it('classifies English vague requests as clarify despite whitespace normalization', () => {
        for (const message of ['make something', 'do something']) {
            expect(analyzeAgentIntent(message)).toMatchObject({
                kind: 'clarify',
                executionMode: 'clarify',
                missing: ['任务类型', '目标节点或产物', '素材/模型/风格约束']
            });
        }
    });
    it('routes ordinary knowledge questions to general chat', () => {
        expect(analyzeAgentIntent('Java 是什么')).toMatchObject({
            kind: 'generalChat',
            executionMode: 'direct',
            complexity: 'low',
            recommendedAgentId: 'general-purpose',
            requirements: ['Answer the user conversationally.'],
            missing: []
        });
    });
    it('keeps ordinary sentences with generic time or update words in general chat', () => {
        for (const message of ['今天我想聊聊 Java', '现在我们随便聊聊', '这个功能更新后怎么理解']) {
            expect(analyzeAgentIntent(message)).toMatchObject({
                kind: 'generalChat',
                executionMode: 'direct',
                complexity: 'low',
                requirements: ['Answer the user conversationally.']
            });
        }
    });
    it('routes time-sensitive lookup requests to search summary', () => {
        expect(analyzeAgentIntent('搜索一下今天 OpenAI 最新新闻')).toMatchObject({
            kind: 'searchSummary',
            executionMode: 'direct',
            complexity: 'medium',
            recommendedAgentId: 'general-purpose',
            requirements: ['Search the internet and summarize current information.'],
            localCapabilities: ['web.search', '通用问答', '来源总结']
        });
    });
    it('routes explicit search requests with media generation terms to search summary', () => {
        for (const message of ['搜索一下图片生成模型最新价格', '搜索一下视频生成模型最新新闻', '搜索一下 canvas API 最新文档']) {
            expect(analyzeAgentIntent(message)).toMatchObject({
                kind: 'searchSummary',
                executionMode: 'direct',
                complexity: 'medium',
                recommendedAgentId: 'general-purpose',
                requirements: ['Search the internet and summarize current information.']
            });
        }
    });
    it('keeps generic planning and design requests out of canvas operations', () => {
        for (const message of ['帮我规划明天的工作安排', '设计一个学习计划']) {
            expect(analyzeAgentIntent(message)).toMatchObject({
                kind: 'generalChat',
                executionMode: 'direct',
                complexity: 'low',
                recommendedAgentId: 'general-purpose',
                requirements: ['Answer the user conversationally.']
            });
        }
    });
    it('keeps ordinary comic and canvas concept questions in general chat', () => {
        for (const message of ['漫画是什么', '这部漫画好看吗', '画布是什么']) {
            expect(analyzeAgentIntent(message)).toMatchObject({
                kind: 'generalChat',
                executionMode: 'direct',
                complexity: 'low',
                recommendedAgentId: 'general-purpose',
                requirements: ['Answer the user conversationally.']
            });
        }
    });
    it('routes current canvas query requests to canvas operation instead of web search', () => {
        expect(analyzeAgentIntent('查一下当前画布有哪些节点')).toMatchObject({
            kind: 'canvasOperation',
            executionMode: 'plan',
            recommendedAgentId: 'canvas-orchestrator',
            localCapabilities: ['canvas.queryGraph', 'canvas.proposePlan', 'canvas.createNode', 'canvas.connectNodes', 'canvas.runNode']
        });
    });
    it('keeps conceptual lookup questions about canvas terms out of canvas operations', () => {
        for (const message of ['查一下画布是什么', '查一下节点是什么']) {
            expect(analyzeAgentIntent(message)).toMatchObject({
                kind: 'searchSummary',
                executionMode: 'direct',
                complexity: 'medium',
                recommendedAgentId: 'general-purpose',
                requirements: ['Search the internet and summarize current information.']
            });
        }
    });
    it('keeps conceptual view questions without current-canvas context in general chat', () => {
        expect(analyzeAgentIntent('查看工作流是什么')).toMatchObject({
            kind: 'generalChat',
            executionMode: 'direct',
            complexity: 'low',
            recommendedAgentId: 'general-purpose',
            requirements: ['Answer the user conversationally.']
        });
    });
    it('keeps creative generation with recency-style descriptors as canvas operations', () => {
        expect(analyzeAgentIntent('生成一张最新赛博朋克风格的图片')).toMatchObject({
            kind: 'canvasOperation',
            executionMode: 'plan',
            complexity: 'high',
            recommendedAgentId: 'canvas-orchestrator',
            requirements: ['Generate image configuration nodes.']
        });
    });
    it('keeps creative character design with ability wording as canvas operations', () => {
        expect(analyzeAgentIntent('帮我设计一个拥有治愈能力的漫画角色')).toMatchObject({
            kind: 'canvasOperation',
            executionMode: 'plan',
            complexity: 'high',
            recommendedAgentId: 'canvas-orchestrator',
            requirements: ['Create a comic-drama workflow.', 'Define character references.']
        });
    });
    it('keeps creative canvas requests with planning vocabulary in canvas operations', () => {
        expect(analyzeAgentIntent('帮我制作一个漫画角色产品方案图片')).toMatchObject({
            kind: 'canvasOperation',
            executionMode: 'plan',
            complexity: 'high',
            recommendedAgentId: 'canvas-orchestrator',
            requirements: ['Create a comic-drama workflow.', 'Define character references.', 'Generate image configuration nodes.']
        });
    });
    it('routes English time-sensitive questions to search summary', () => {
        for (const message of ['what time is it', 'what date is it']) {
            expect(analyzeAgentIntent(message)).toMatchObject({
                kind: 'searchSummary',
                executionMode: 'direct',
                complexity: 'medium',
                requirements: ['Search the internet and summarize current information.'],
                localCapabilities: ['web.search', '通用问答', '来源总结']
            });
        }
    });
    it('routes system design requests to requirement planning', () => {
        expect(analyzeAgentIntent('帮我设计当前系统的 Agent 能力')).toMatchObject({
            kind: 'requirementPlanning',
            executionMode: 'clarify',
            complexity: 'high',
            recommendedAgentId: 'general-purpose',
            requirements: ['Analyze the requested system capability and produce an implementation plan.']
        });
    });
    it('routes simple canvas node creation to direct canvas operation', () => {
        expect(analyzeAgentIntent('创建一个文本节点')).toMatchObject({
            kind: 'canvasOperation',
            executionMode: 'direct',
            complexity: 'low',
            recommendedAgentId: 'canvas-orchestrator',
            requirements: ['创建一个文本节点']
        });
    });
    it('routes generation requests to planned orchestration instead of direct reference-node creation', () => {
        for (const message of ['生成图片', '生成视频', '生成一张宇宙飞船图片']) {
            expect(analyzeAgentIntent(message)).toMatchObject({
                kind: 'canvasOperation',
                executionMode: 'plan',
                complexity: 'high',
                recommendedAgentId: 'canvas-orchestrator'
            });
        }
    });
    it('routes multi-step comic generation to planned canvas orchestration', () => {
        expect(analyzeAgentIntent('做一个雨夜侦探漫画短剧，包含角色、场景、图片和视频')).toMatchObject({
            kind: 'canvasOperation',
            executionMode: 'plan',
            complexity: 'high',
            recommendedAgentId: 'canvas-orchestrator',
            requirements: [
                'Create a comic-drama workflow.',
                'Define character references.',
                'Define scene references.',
                'Generate image configuration nodes.',
                'Generate video configuration nodes.'
            ]
        });
    });
    it('decomposes rich workflow requests into capability-aligned requirements', () => {
        expect(analyzeAgentIntent('做一个雨夜侦探漫画短剧，包含角色、场景、图片、配音、视频合成和音视频合成')).toMatchObject({
            kind: 'canvasOperation',
            requirements: [
                'Create a comic-drama workflow.',
                'Define character references.',
                'Define scene references.',
                'Generate image configuration nodes.',
                'Generate or attach audio assets.',
                'Generate video configuration nodes.',
                'Compose video clips.',
                'Mux audio and video.'
            ],
            localCapabilities: [
                'canvas.queryGraph',
                'canvas.proposePlan',
                'canvas.createNode',
                'canvas.connectNodes',
                'canvas.runNode',
                'canvas.composeVideo',
                'canvas.muxAudioVideo'
            ]
        });
    });
});
