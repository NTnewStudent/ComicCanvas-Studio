import { jsx as _jsx } from "react/jsx-runtime";
// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { ReactFlowProvider } from '@xyflow/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TextNode } from '../desktop/src/renderer/src/canvas/nodes/TextNode';
function renderTextNode(overrides = {}) {
    const data = {
        label: 'Text 1',
        content: 'hello canvas'
    };
    const onChange = vi.fn();
    const onRename = vi.fn();
    const onPolish = vi.fn();
    render(_jsx(ReactFlowProvider, { children: _jsx(TextNode, { id: "text-1", data: data, onChange: onChange, onRename: onRename, onPolish: onPolish, ...overrides }) }));
    return { onChange, onRename, onPolish };
}
afterEach(() => {
    cleanup();
});
describe('M2 TextNode', () => {
    it('renders collapsed label and content preview by default', () => {
        renderTextNode();
        expect(screen.getByRole('button', { name: 'Text 1' })).toBeInTheDocument();
        expect(screen.getByText('hello canvas')).toBeInTheDocument();
        expect(screen.queryByRole('textbox', { name: '文本内容' })).not.toBeInTheDocument();
    });
    it('expands to a textarea on click, edits content, and collapses on blur', () => {
        const { onChange } = renderTextNode();
        fireEvent.click(screen.getByRole('button', { name: 'Text 1' }));
        const textbox = screen.getByRole('textbox', { name: '文本内容' });
        fireEvent.change(textbox, { target: { value: 'new script beat' } });
        expect(onChange).toHaveBeenLastCalledWith('text-1', { content: 'new script beat' });
        fireEvent.blur(textbox);
        expect(screen.queryByRole('textbox', { name: '文本内容' })).not.toBeInTheDocument();
        expect(screen.getByText('new script beat')).toBeInTheDocument();
    });
    it('collapses expanded editing when the user clicks outside the node', () => {
        renderTextNode();
        fireEvent.click(screen.getByRole('button', { name: 'Text 1' }));
        expect(screen.getByRole('textbox', { name: '文本内容' })).toBeInTheDocument();
        fireEvent.mouseDown(document.body);
        expect(screen.queryByRole('textbox', { name: '文本内容' })).not.toBeInTheDocument();
        expect(screen.getByText('hello canvas')).toBeInTheDocument();
    });
    it('supports inline rename with Enter save, Escape cancel, and empty rejection', () => {
        const { onRename } = renderTextNode();
        fireEvent.doubleClick(screen.getByRole('button', { name: 'Text 1' }));
        const renameInput = screen.getByRole('textbox', { name: '重命名文本节点' });
        fireEvent.change(renameInput, { target: { value: 'Opening beat' } });
        fireEvent.keyDown(renameInput, { key: 'Enter' });
        expect(onRename).toHaveBeenLastCalledWith('text-1', 'Opening beat');
        fireEvent.doubleClick(screen.getByRole('button', { name: 'Opening beat' }));
        const secondInput = screen.getByRole('textbox', { name: '重命名文本节点' });
        fireEvent.change(secondInput, { target: { value: '' } });
        fireEvent.keyDown(secondInput, { key: 'Enter' });
        expect(onRename).toHaveBeenCalledTimes(1);
        fireEvent.change(secondInput, { target: { value: 'Discard me' } });
        fireEvent.keyDown(secondInput, { key: 'Escape' });
        expect(screen.getByRole('button', { name: 'Opening beat' })).toBeInTheDocument();
    });
    it('shows selected rich-text controls, polish status, mention chips, and prompt contribution preview', () => {
        renderTextNode({
            selected: true,
            data: {
                label: 'Beat',
                content: 'Open on [character-1|Mika] entering the alley',
                html: '<p>Open on <strong>Mika</strong> entering the alley</p>',
                polishStatus: 'running',
                polishModelId: 'text-polish-local'
            }
        });
        expect(screen.getByRole('toolbar', { name: '文本富文本工具栏' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '加粗' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: '打开专注编辑' })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'AI 润色' })).toBeDisabled();
        expect(screen.getByText('润色中')).toBeInTheDocument();
        expect(screen.getByText('@Mika')).toBeInTheDocument();
        expect(screen.getByLabelText('Prompt 贡献预览')).toHaveTextContent('Open on [character-1|Mika] entering the alley');
    });
    it('opens a focus modal and saves edited content back to the node', () => {
        const { onChange } = renderTextNode();
        fireEvent.click(screen.getByRole('button', { name: 'Text 1' }));
        fireEvent.click(screen.getByRole('button', { name: '打开专注编辑' }));
        const modalEditor = screen.getByRole('textbox', { name: '专注编辑文本内容' });
        fireEvent.change(modalEditor, { target: { value: 'expanded rewrite with stronger hook' } });
        fireEvent.click(screen.getByRole('button', { name: '保存专注编辑' }));
        expect(onChange).toHaveBeenLastCalledWith('text-1', {
            content: 'expanded rewrite with stronger hook',
            html: '<p>expanded rewrite with stronger hook</p>'
        });
        expect(screen.queryByRole('dialog', { name: '专注编辑文本节点' })).not.toBeInTheDocument();
    });
    it('requests async AI polish from the selected toolbar and marks the node pending', () => {
        const { onChange, onPolish } = renderTextNode({ selected: true });
        fireEvent.click(screen.getByRole('button', { name: 'AI 润色' }));
        expect(onChange).toHaveBeenCalledWith('text-1', { polishStatus: 'pending' });
        expect(onPolish).toHaveBeenCalledWith('text-1');
    });
});
