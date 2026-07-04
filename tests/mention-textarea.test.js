import { jsx as _jsx } from "react/jsx-runtime";
// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MentionTextarea, { extractMentionTokens, removeMentionToken } from '../desktop/src/renderer/src/canvas/components/MentionTextarea';
const targets = [
    { id: 'character-1', name: 'Mika', type: 'character' },
    { id: 'image-1', name: 'Rain Alley', type: 'image' }
];
afterEach(() => {
    vi.restoreAllMocks();
    cleanup();
});
describe('Task 41 MentionTextarea parity', () => {
    it('preserves storage tokens, shows chips, opens the caret dropdown, and selects mentions', async () => {
        const onChange = vi.fn();
        const onMentionSelect = vi.fn();
        const onMentionsChange = vi.fn();
        function ControlledMentionTextarea() {
            const [value, setValue] = useState('Use [character-1|Mika] as lead');
            return (_jsx(MentionTextarea, { value: value, onChange: (nextValue) => {
                    setValue(nextValue);
                    onChange(nextValue);
                }, ariaLabel: "\u63D0\u793A\u8BCD\u8F93\u5165", mentionTargets: targets, sourceNodeId: "image-2", onMentionSelect: onMentionSelect, onMentionsChange: onMentionsChange }));
        }
        render(_jsx(ControlledMentionTextarea, {}));
        expect(screen.getByText('@Mika')).toBeInTheDocument();
        expect(onMentionsChange).toHaveBeenCalledWith(['character-1'], 'image-2');
        const input = screen.getByRole('textbox', { name: '提示词输入' });
        fireEvent.change(input, { target: { value: 'Add @Ra', selectionStart: 7 } });
        expect(await screen.findByRole('listbox', { name: '提及候选' })).toBeInTheDocument();
        fireEvent.mouseDown(screen.getByRole('option', { name: 'Rain Alley image' }));
        expect(onChange).toHaveBeenLastCalledWith('Add [image-1|Rain Alley] ');
        expect(onMentionSelect).toHaveBeenCalledWith('image-1', 'image-2');
    });
    it('keeps IME composition from opening candidates and deletes mention tokens atomically', () => {
        expect(extractMentionTokens('A [character-1|Mika] and [image-1|Rain Alley]')).toEqual([
            { id: 'character-1', name: 'Mika' },
            { id: 'image-1', name: 'Rain Alley' }
        ]);
        expect(removeMentionToken('A [character-1|Mika] enters', 'character-1')).toBe('A enters');
        const onChange = vi.fn();
        render(_jsx(MentionTextarea, { value: "", onChange: onChange, ariaLabel: "IME \u63D0\u793A\u8BCD", mentionTargets: targets }));
        const input = screen.getByRole('textbox', { name: 'IME 提示词' });
        fireEvent.compositionStart(input);
        fireEvent.change(input, { target: { value: '@Mi', selectionStart: 3 } });
        expect(screen.queryByRole('listbox', { name: '提及候选' })).not.toBeInTheDocument();
        fireEvent.compositionEnd(input);
        fireEvent.change(input, { target: { value: '@Mi', selectionStart: 3 } });
        expect(screen.getByRole('listbox', { name: '提及候选' })).toBeInTheDocument();
    });
    it('is wired into at least six prompt or description usage points', () => {
        const files = [
            'desktop/src/renderer/src/canvas/nodes/TextNode.tsx',
            'desktop/src/renderer/src/canvas/nodes/ImageNode.tsx',
            'desktop/src/renderer/src/canvas/nodes/VideoNode.tsx',
            'desktop/src/renderer/src/canvas/nodes/CharacterNode.tsx',
            'desktop/src/renderer/src/canvas/nodes/SceneNode.tsx',
            'desktop/src/renderer/src/canvas/nodes/ImageConfigV2Node.tsx',
            'desktop/src/renderer/src/canvas/nodes/VideoConfigV2Node.tsx'
        ];
        const usageCount = files.filter((file) => readFileSync(file, 'utf8').includes('<MentionTextarea')).length;
        expect(usageCount).toBeGreaterThanOrEqual(6);
    });
});
