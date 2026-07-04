import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const CANVAS_PAGE = 'desktop/src/renderer/src/canvas/CanvasPage.tsx';
const COMMAND_PALETTE = 'desktop/src/renderer/src/canvas/components/CanvasCommandPalette.tsx';
function userVisibleLines(source) {
    return source
        .split(/\r?\n/)
        .filter((line) => (line.includes('label:')
        || line.includes('title=')
        || line.includes('aria-label=')
        || line.includes('placeholder=')
        || line.includes('<option')
        || line.includes('setSnippetFeedback(')
        || line.includes('Link ')));
}
describe('REQ-092 canvas visible copy quality', () => {
    it('keeps key CanvasPage user-facing labels readable', () => {
        const source = readFileSync(CANVAS_PAGE, 'utf8');
        expect(source).toContain('Image Generation');
        expect(source).toContain('Video Generation');
        expect(source).toContain('Video Compose');
        expect(source).toContain('Super Resolution');
        expect(source).toContain('Mux Audio Video');
        expect(source).toContain('Add node');
        expect(source).toContain('Node actions');
        expect(source).toContain('Duplicate node');
        expect(source).toContain('Delete node');
        expect(source).toContain('保存片段');
        expect(source).toContain('片段库');
        expect(source).toContain('插入片段');
        expect(source).toContain('暂无片段');
    });
    it('keeps command palette search and empty states readable', () => {
        const source = readFileSync(COMMAND_PALETTE, 'utf8');
        expect(source).toContain('Search canvas commands');
        expect(source).toContain('No matching commands');
    });
    it('does not expose mojibake in visible canvas copy lines', () => {
        const source = [
            readFileSync(CANVAS_PAGE, 'utf8'),
            readFileSync(COMMAND_PALETTE, 'utf8'),
        ].join('\n');
        const visibleCopy = userVisibleLines(source).join('\n');
        expect(visibleCopy).not.toMatch(/閻㈢喎娴|閻㈢喕顫|鐟欏棝|鐡掑懎|闂婂磭|鐠囩兘|濞ｈ|婢跺秴|閸掔娀|鎼滅储|娌℃湁/u);
    });
    it('keeps CanvasPage comments and state ownership notes readable', () => {
        const source = readFileSync(CANVAS_PAGE, 'utf8');
        expect(source).toContain('Canvas state ownership model');
        expect(source).toContain('React Flow owns transient interaction state');
        expect(source).toContain('Zustand owns the durable graph snapshot');
        expect(source).toContain('syncReactFlowFromStore');
        expect(source).toContain('skipNextPersistRef.current = true');
        expect(source).toMatch(/const syncReactFlowFromStore[\s\S]*skipNextPersistRef\.current = true/u);
        expect(source).not.toMatch(/[閳閸閹鐏鐎娣濞婢鎼]/u);
    });
});
