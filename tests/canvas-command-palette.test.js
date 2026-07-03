import { jsx as _jsx } from "react/jsx-runtime";
// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { CanvasCommandPalette } from '../desktop/src/renderer/src/canvas/components/CanvasCommandPalette';
afterEach(() => {
    cleanup();
});
describe('REQ-092 CanvasCommandPalette', () => {
    it('filters commands and executes the selected canvas command', () => {
        const fitView = vi.fn();
        const deleteSelection = vi.fn();
        render(_jsx(CanvasCommandPalette, { open: true, onClose: vi.fn(), commands: [
                {
                    id: 'fit-view',
                    label: 'Fit view',
                    keywords: ['fit', 'zoom'],
                    run: fitView,
                },
                {
                    id: 'delete-selection',
                    label: 'Delete selected nodes',
                    keywords: ['delete'],
                    run: deleteSelection,
                },
            ] }));
        fireEvent.change(screen.getByRole('searchbox', { name: 'Search canvas commands' }), {
            target: { value: 'fit' },
        });
        expect(screen.getByRole('button', { name: 'Fit view' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Delete selected nodes' })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Fit view' }));
        expect(fitView).toHaveBeenCalledTimes(1);
        expect(deleteSelection).not.toHaveBeenCalled();
    });
    it('wires command palette, fit view, and select/pan modes into CanvasPage', () => {
        const source = readFileSync('desktop/src/renderer/src/canvas/CanvasPage.tsx', 'utf8');
        expect(source).toContain('CanvasCommandPalette');
        expect(source).toContain('setShowCommandPalette');
        expect(source).toContain("key === 'k'");
        expect(source).toContain('fitView({ padding: 0.18');
        expect(source).toContain("interactionMode === 'pan'");
        expect(source).toContain('selectionOnDrag={interactionMode ===');
        expect(source).toContain('panOnDrag={interactionMode ===');
    });
});
