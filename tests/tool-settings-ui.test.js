import { jsx as _jsx } from "react/jsx-runtime";
// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ToolList } from '../desktop/src/renderer/src/settings/ToolList';
const queryTool = {
    id: 'canvas.queryGraph',
    name: 'Query Canvas Graph',
    description: 'Reads the current canvas graph snapshot.',
    category: 'canvas',
    owner: { kind: 'builtin', id: 'core' },
    inputSchemaRef: 'canvas.queryGraph.input',
    outputSchemaRef: 'canvas.graph.output',
    permissions: [{ kind: 'canvas.read', reason: 'Reads the current canvas graph.' }],
    concurrency: 'readonly',
    enabled: true
};
const runTool = {
    id: 'canvas.runNode',
    name: 'Run Canvas Node',
    description: 'Enqueues generation for an image or video canvas node.',
    category: 'canvas',
    owner: { kind: 'builtin', id: 'core' },
    inputSchemaRef: 'canvas.runNode.input',
    outputSchemaRef: 'canvas.runNode.output',
    permissions: [{ kind: 'provider.spend', reason: 'May enqueue provider-backed generation jobs.' }],
    concurrency: 'serial-write',
    enabled: false
};
function createApi(overrides = {}) {
    return {
        listTools: vi.fn().mockResolvedValue([queryTool, runTool]),
        enableTool: vi.fn().mockResolvedValue({ ...runTool, enabled: true }),
        disableTool: vi.fn().mockResolvedValue({ ...queryTool, enabled: false }),
        ...overrides
    };
}
function mockOf(fn) {
    return fn;
}
afterEach(() => {
    cleanup();
});
describe('M5 Tool management UI', () => {
    it('renders tool metadata with permission and concurrency badges', async () => {
        render(_jsx(ToolList, { api: createApi() }));
        expect(await screen.findByText('Query Canvas Graph')).toBeInTheDocument();
        expect(screen.getByText('Run Canvas Node')).toBeInTheDocument();
        expect(screen.getByText('readonly')).toBeInTheDocument();
        expect(screen.getByText('serial-write')).toBeInTheDocument();
        expect(screen.getByText('canvas.read')).toBeInTheDocument();
        expect(screen.getByText('provider.spend')).toBeInTheDocument();
        expect(screen.getAllByText('builtin').length).toBeGreaterThan(0);
    });
    it('toggles tools through typed preload actions and updates the card state', async () => {
        const api = createApi();
        render(_jsx(ToolList, { api: api }));
        fireEvent.click(await screen.findByRole('switch', { name: 'Query Canvas Graph enabled' }));
        await waitFor(() => expect(mockOf(api.disableTool)).toHaveBeenCalledWith({ toolId: 'canvas.queryGraph' }));
        expect(screen.getByText('已禁用 Query Canvas Graph')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('switch', { name: 'Run Canvas Node enabled' }));
        await waitFor(() => expect(mockOf(api.enableTool)).toHaveBeenCalledWith({ toolId: 'canvas.runNode' }));
        expect(screen.getByText('已启用 Run Canvas Node')).toBeInTheDocument();
    });
});
