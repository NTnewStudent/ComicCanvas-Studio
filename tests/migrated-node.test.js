import { jsx as _jsx } from "react/jsx-runtime";
// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MigratedNode } from '../desktop/src/renderer/src/canvas/nodes/MigratedNode';
function renderMigratedNode(options = {}) {
    const onChange = vi.fn();
    const data = {
        label: 'Detective',
        description: 'calm lead character',
        assetId: null,
        tags: ['lead']
    };
    render(_jsx(ReactFlowProvider, { children: _jsx(MigratedNode, { id: options.id ?? 'character-1', type: options.type ?? 'character', data: { ...data, ...options.data }, selected: options.selected ?? false, onChange: options.onChange ?? onChange }) }));
    return { onChange };
}
afterEach(() => {
    cleanup();
});
describe('REQ-093 MigratedNode', () => {
    it('renders semantic character context and edits the description field', () => {
        const { onChange } = renderMigratedNode();
        expect(screen.getByRole('group', { name: '角色节点 Detective' })).toBeInTheDocument();
        expect(screen.getByText('角色')).toBeInTheDocument();
        expect(screen.getByText('calm lead character')).toBeInTheDocument();
        fireEvent.change(screen.getByRole('textbox', { name: '描述' }), {
            target: { value: 'older detective with graphite coat' }
        });
        expect(onChange).toHaveBeenLastCalledWith('character-1', { description: 'older detective with graphite coat' });
    });
    it('renders tool nodes with status, model, and prompt controls when relevant', () => {
        const { onChange } = renderMigratedNode({
            id: 'mj-1',
            type: 'mjImage',
            data: {
                label: 'MJ Sheet',
                prompt: 'four keyframes',
                modelId: 'stub-mj',
                ratio: '16:9',
                urls: [],
                selectedIndex: 0,
                assetId: null,
                status: 'idle'
            }
        });
        expect(screen.getByRole('group', { name: 'MJ 图片节点 MJ Sheet' })).toBeInTheDocument();
        expect(screen.getByText('MJ 图片')).toBeInTheDocument();
        expect(screen.getByText('idle')).toBeInTheDocument();
        expect(screen.getByDisplayValue('stub-mj')).toBeInTheDocument();
        fireEvent.change(screen.getByRole('textbox', { name: 'Prompt' }), {
            target: { value: 'noir storyboard options' }
        });
        expect(onChange).toHaveBeenLastCalledWith('mj-1', { prompt: 'noir storyboard options' });
    });
});
