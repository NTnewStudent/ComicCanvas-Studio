import { jsx as _jsx } from "react/jsx-runtime";
// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AgentForm } from '../desktop/src/renderer/src/settings/AgentForm';
import { AgentList } from '../desktop/src/renderer/src/settings/AgentList';
const builtinAgent = {
    id: 'orchestrator',
    source: 'builtin',
    name: 'Orchestrator',
    description: 'Plans canvas workflows.',
    instructions: 'Create safe CanvasPlan JSON.',
    allowedTools: '*',
    allowedSkills: '*',
    gatewayPolicy: { allowedChannels: ['text', 'image', 'video'] },
    contextPolicy: {
        includeCanvasGraph: true,
        includeSelectedAssets: true,
        includeRecentMessages: true,
        includeKnowledge: false,
        maxContextTokens: 8000
    },
    permissionPolicy: { allowedPermissionKinds: ['canvas.read', 'canvas.write'], requireAskForDestructive: true },
    triggerPolicy: { allowedTriggers: ['manual', 'mention', 'canvasChat'], defaultTrigger: 'canvasChat', autoRun: false },
    maxTurns: 8,
    effort: 'high',
    enabled: true
};
const customAgent = {
    id: 'agent-storyboard',
    source: 'user',
    name: 'Storyboard agent',
    description: 'Breaks prompts into panels.',
    instructions: 'Create concise storyboards.',
    allowedTools: ['canvas.queryGraph'],
    allowedSkills: ['storyboard'],
    gatewayPolicy: { allowedChannels: ['text'], modelId: 'stub-text' },
    contextPolicy: {
        includeCanvasGraph: true,
        includeSelectedAssets: false,
        includeRecentMessages: true,
        includeKnowledge: false,
        maxContextTokens: 4000
    },
    permissionPolicy: { allowedPermissionKinds: ['canvas.read'], requireAskForDestructive: true },
    triggerPolicy: { allowedTriggers: ['manual', 'mention'], defaultTrigger: 'manual', autoRun: false },
    maxTurns: 4,
    effort: 'medium',
    enabled: true
};
function createApi(overrides = {}) {
    return {
        listAgents: vi.fn().mockResolvedValue([builtinAgent, customAgent]),
        saveAgent: vi.fn().mockImplementation((input) => Promise.resolve(input)),
        deleteAgent: vi.fn().mockResolvedValue({ agentId: 'agent-storyboard', deleted: true }),
        ...overrides
    };
}
function mockOf(fn) {
    return fn;
}
afterEach(() => {
    cleanup();
});
describe('M5 custom Agent settings UI', () => {
    it('renders editable built-in agents while keeping delete protection', async () => {
        render(_jsx(AgentList, { api: createApi() }));
        expect(await screen.findByText('Orchestrator')).toBeInTheDocument();
        expect(screen.getByText('Storyboard agent')).toBeInTheDocument();
        expect(screen.getByText('builtin')).toBeInTheDocument();
        expect(screen.getByText('user')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '编辑 Orchestrator' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: '删除 Orchestrator' })).not.toBeInTheDocument();
        expect(screen.getByRole('button', { name: '编辑 Storyboard agent' })).toBeInTheDocument();
    });
    it('saves a new custom agent with selected tools and skills', async () => {
        const api = createApi({ listAgents: vi.fn().mockResolvedValue([builtinAgent]) });
        render(_jsx(AgentList, { api: api }));
        fireEvent.click(await screen.findByRole('button', { name: '添加 Agent' }));
        fireEvent.change(screen.getByRole('textbox', { name: 'Agent 名称' }), { target: { value: 'Panel planner' } });
        fireEvent.change(screen.getByRole('textbox', { name: '描述' }), { target: { value: 'Plans panel beats.' } });
        fireEvent.change(screen.getByRole('textbox', { name: '指令' }), { target: { value: 'Plan text-image-video panels.' } });
        fireEvent.click(screen.getByRole('checkbox', { name: 'canvas.queryGraph' }));
        fireEvent.change(screen.getByRole('textbox', { name: '允许的技能' }), { target: { value: 'storyboard, shot-list' } });
        fireEvent.click(screen.getByRole('checkbox', { name: '工作流事件' }));
        fireEvent.change(screen.getByRole('combobox', { name: '默认入口' }), { target: { value: 'workflowEvent' } });
        fireEvent.click(screen.getByRole('checkbox', { name: '触发后自动运行' }));
        fireEvent.click(screen.getByRole('checkbox', { name: '画布写入' }));
        fireEvent.click(screen.getByRole('checkbox', { name: '文件读取' }));
        fireEvent.click(screen.getByRole('checkbox', { name: '网络访问' }));
        fireEvent.click(screen.getByRole('checkbox', { name: '供应商消费' }));
        fireEvent.click(screen.getByRole('checkbox', { name: '破坏性操作前需确认' }));
        fireEvent.change(screen.getByRole('spinbutton', { name: '最大轮次' }), { target: { value: '7' } });
        fireEvent.click(screen.getByRole('button', { name: '保存 Agent' }));
        const saveAgent = mockOf(api.saveAgent);
        await waitFor(() => expect(saveAgent).toHaveBeenCalledTimes(1));
        expect(saveAgent).toHaveBeenCalledWith(expect.objectContaining({
            id: 'agent-panel-planner',
            source: 'user',
            name: 'Panel planner',
            description: 'Plans panel beats.',
            instructions: 'Plan text-image-video panels.',
            allowedTools: ['canvas.queryGraph'],
            allowedSkills: ['storyboard', 'shot-list'],
            permissionPolicy: { allowedPermissionKinds: ['canvas.read', 'canvas.write', 'file.read', 'network', 'provider.spend'], requireAskForDestructive: false },
            triggerPolicy: { allowedTriggers: ['manual', 'mention', 'workflowEvent'], defaultTrigger: 'workflowEvent', autoRun: true },
            maxTurns: 7,
            effort: 'medium',
            enabled: true
        }));
    });
    it('preserves wildcard tool access when editing built-in agents', async () => {
        const api = createApi();
        render(_jsx(AgentList, { api: api }));
        await screen.findByText('Orchestrator');
        fireEvent.click(screen.getByRole('button', { name: '编辑 Orchestrator' }));
        expect(screen.getByRole('checkbox', { name: '允许所有工具' })).toBeChecked();
        expect(screen.getByRole('checkbox', { name: 'canvas.queryGraph' })).toBeDisabled();
        fireEvent.change(screen.getByRole('textbox', { name: 'Agent 名称' }), { target: { value: 'Orchestrator tuned' } });
        fireEvent.click(screen.getByRole('button', { name: '保存 Agent' }));
        await waitFor(() => expect(mockOf(api.saveAgent)).toHaveBeenCalledWith(expect.objectContaining({
            id: 'orchestrator',
            source: 'builtin',
            name: 'Orchestrator tuned',
            allowedTools: '*'
        })));
    });
    it('edits and deletes user agents through typed API actions', async () => {
        const api = createApi();
        render(_jsx(AgentList, { api: api }));
        await screen.findByText('Storyboard agent');
        fireEvent.click(screen.getByRole('button', { name: '编辑 Storyboard agent' }));
        fireEvent.change(screen.getByRole('textbox', { name: 'Agent 名称' }), { target: { value: 'Storyboard director' } });
        fireEvent.click(screen.getByRole('button', { name: '保存 Agent' }));
        await waitFor(() => expect(mockOf(api.saveAgent)).toHaveBeenCalledWith(expect.objectContaining({ id: 'agent-storyboard', name: 'Storyboard director' })));
        fireEvent.click(screen.getByRole('button', { name: '删除 Storyboard director' }));
        fireEvent.click(screen.getByRole('button', { name: '确认删除' }));
        await waitFor(() => expect(mockOf(api.deleteAgent)).toHaveBeenCalledWith({ agentId: 'agent-storyboard' }));
    });
    it('validates required custom agent fields before submit', () => {
        const onSubmit = vi.fn();
        render(_jsx(AgentForm, { onSubmit: onSubmit, onCancel: vi.fn() }));
        fireEvent.click(screen.getByRole('button', { name: '保存 Agent' }));
        expect(screen.getByText('名称和指令为必填项。')).toBeInTheDocument();
        expect(onSubmit).not.toHaveBeenCalled();
    });
});
