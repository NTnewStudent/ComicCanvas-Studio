import { jsx as _jsx } from "react/jsx-runtime";
// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useInlineRename } from '../desktop/src/renderer/src/canvas/hooks/use-inline-rename';
afterEach(() => {
    cleanup();
});
describe('useInlineRename', () => {
    it('saves non-empty labels with Enter, rejects empty labels, and cancels with Escape', () => {
        const onCommit = vi.fn();
        function Harness() {
            const rename = useInlineRename({ value: 'Scene label', onCommit });
            return rename.isRenaming ? (_jsx("input", { "aria-label": "Rename field", value: rename.draft, onChange: (event) => rename.setDraft(event.target.value), onBlur: rename.cancel, onKeyDown: rename.handleKeyDown })) : (_jsx("button", { type: "button", onDoubleClick: rename.start, "aria-label": rename.value, children: rename.value }));
        }
        render(_jsx(Harness, {}));
        fireEvent.doubleClick(screen.getByRole('button', { name: 'Scene label' }));
        fireEvent.change(screen.getByRole('textbox', { name: 'Rename field' }), { target: { value: 'New scene' } });
        fireEvent.keyDown(screen.getByRole('textbox', { name: 'Rename field' }), { key: 'Enter' });
        expect(onCommit).toHaveBeenLastCalledWith('New scene');
        fireEvent.doubleClick(screen.getByRole('button', { name: 'New scene' }));
        fireEvent.change(screen.getByRole('textbox', { name: 'Rename field' }), { target: { value: '   ' } });
        fireEvent.keyDown(screen.getByRole('textbox', { name: 'Rename field' }), { key: 'Enter' });
        expect(onCommit).toHaveBeenCalledTimes(1);
        expect(screen.getByRole('button', { name: 'New scene' })).toBeInTheDocument();
        fireEvent.doubleClick(screen.getByRole('button', { name: 'New scene' }));
        fireEvent.change(screen.getByRole('textbox', { name: 'Rename field' }), { target: { value: 'Discarded' } });
        fireEvent.keyDown(screen.getByRole('textbox', { name: 'Rename field' }), { key: 'Escape' });
        expect(screen.getByRole('button', { name: 'New scene' })).toBeInTheDocument();
    });
});
