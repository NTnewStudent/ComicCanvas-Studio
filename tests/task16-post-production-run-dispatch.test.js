import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
const CANVAS_PAGE = 'desktop/src/renderer/src/canvas/CanvasPage.tsx';
/**
 * Task 16 regression test.
 *
 * Before this fix, `videoCompose` / `superResolution` / `muxAudioVideo` were
 * registered in `nodeTypes` as bare components with no CanvasPage wrapper.
 * Each of these components' local `handleRun` does:
 *   update({ status: 'running', url: '' }); onRun?.(id)
 * Since `onRun` was never injected, clicking "运行" flipped the node to
 * `status: 'running'` and then did nothing -- the run button disables itself
 * while running, so the node was stuck forever with no recovery path and no
 * job was ever enqueued.
 *
 * This test asserts (a) `nodeTypes` points at wrapper functions rather than
 * the bare components, and (b) each wrapper's body actually wires a real
 * `onRun` callback through `useCanvasRunContext()`. It is a source-level
 * check (matching the existing precedent in
 * `tests/production-node-components-parity.test.tsx`) rather than a full
 * render/click test, because CanvasPage's wrapper functions are internal and
 * not exported, and no test harness currently mounts the full CanvasPage
 * component tree.
 */
describe('Task 16 post-production node run dispatch wiring', () => {
    const source = readFileSync(CANVAS_PAGE, 'utf8');
    function extractFunctionBody(fnName) {
        const marker = `function ${fnName}(`;
        const start = source.indexOf(marker);
        expect(start, `expected to find function ${fnName} in CanvasPage.tsx`).toBeGreaterThan(-1);
        const braceStart = source.indexOf('{', start);
        let depth = 0;
        let i = braceStart;
        for (; i < source.length; i += 1) {
            if (source[i] === '{')
                depth += 1;
            if (source[i] === '}') {
                depth -= 1;
                if (depth === 0)
                    break;
            }
        }
        return source.slice(braceStart, i + 1);
    }
    it('registers wrapper components (not the bare components) for videoCompose/superResolution/muxAudioVideo', () => {
        expect(source).toContain('videoCompose: VideoComposeNodeWrapper');
        expect(source).toContain('superResolution: SuperResolutionNodeWrapper');
        expect(source).toContain('muxAudioVideo: MuxAudioVideoNodeWrapper');
    });
    it('wires a real onRun callback into VideoComposeNodeWrapper so "运行" dispatches canvas.composeVideo', () => {
        const body = extractFunctionBody('VideoComposeNodeWrapper');
        expect(body).toContain('useCanvasRunContext()');
        expect(body).toContain('onRun={(nodeId: string) => runContext?.runNode(nodeId)}');
    });
    it('wires a real onRun callback into SuperResolutionNodeWrapper so "运行" dispatches canvas.upscaleVideo', () => {
        const body = extractFunctionBody('SuperResolutionNodeWrapper');
        expect(body).toContain('useCanvasRunContext()');
        expect(body).toContain('onRun={(nodeId: string) => runContext?.runNode(nodeId)}');
    });
    it('wires a real onRun callback into MuxAudioVideoNodeWrapper so "运行" dispatches canvas.muxAudioVideo', () => {
        const body = extractFunctionBody('MuxAudioVideoNodeWrapper');
        expect(body).toContain('useCanvasRunContext()');
        expect(body).toContain('onRun={(nodeId: string) => runContext?.runNode(nodeId)}');
    });
    it('maps each post-production node type to its stub job type (jobTypeForNodeType)', () => {
        expect(source).toContain("if (type === 'videoCompose') return 'canvas.composeVideo'");
        expect(source).toContain("if (type === 'superResolution') return 'canvas.upscaleVideo'");
        expect(source).toContain("if (type === 'muxAudioVideo') return 'canvas.muxAudioVideo'");
    });
});
