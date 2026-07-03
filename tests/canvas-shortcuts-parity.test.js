import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const CANVAS_PAGE = 'desktop/src/renderer/src/canvas/CanvasPage.tsx';
describe('Task 22 canvas shortcuts parity', () => {
    it('wires save, undo, redo, fit, select, pan, command palette, duplicate, and delete shortcuts', () => {
        const source = readFileSync(CANVAS_PAGE, 'utf8');
        expect(source).toContain('const isMacLikePlatform');
        expect(source).toContain('const deleteShortcutLabel');
        expect(source).toContain('const handleCanvasShortcut = useCallback');
        expect(source).toContain("key === 's'");
        expect(source).toContain("key === 'z'");
        expect(source).toContain('event.shiftKey');
        expect(source).toContain("key === 'y'");
        expect(source).toContain("key === '1'");
        expect(source).toContain("key === '2'");
        expect(source).toContain("key === '3'");
        expect(source).toContain("key === 'k'");
        expect(source).toContain("key === 'd'");
        expect(source).toContain("event.key === 'Delete' || (isMacLikePlatform && event.key === 'Backspace')");
    });
    it('protects editable fields before handling any canvas shortcut', () => {
        const source = readFileSync(CANVAS_PAGE, 'utf8');
        expect(source).toContain('if (isEditableKeyboardTarget(event.target)) return');
        expect(source).toContain('window.addEventListener(\'keydown\', handleCanvasShortcut)');
        expect(source).toContain('window.removeEventListener(\'keydown\', handleCanvasShortcut)');
    });
    it('keeps shortcut help aligned with the implemented shortcuts', () => {
        const source = readFileSync(CANVAS_PAGE, 'utf8');
        expect(source).toContain("['Ctrl/Cmd+Z', '撤销']");
        expect(source).toContain("['Ctrl/Cmd+Shift+Z / Ctrl+Y', '重做']");
        expect(source).toContain("['Ctrl/Cmd+1', '适配视图']");
        expect(source).toContain("['Ctrl/Cmd+2', '选择模式']");
        expect(source).toContain("['Ctrl/Cmd+3', '拖拽画布模式']");
        expect(source).toContain('[deleteShortcutLabel, \'删除选中节点\']');
    });
});
