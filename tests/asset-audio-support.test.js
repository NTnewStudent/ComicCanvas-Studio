import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
describe('audio asset support', () => {
    it('keeps shared asset contracts and import handler aware of audio assets', () => {
        const sharedAssets = readFileSync('shared/assets.ts', 'utf8');
        const assetHandler = readFileSync('desktop/src/main/ipc/asset.handler.ts', 'utf8');
        expect(sharedAssets).toContain("'audio'");
        expect(assetHandler).toContain("'audio'");
        expect(assetHandler).toContain("'.mp3'");
        expect(assetHandler).toContain("'audio/mpeg'");
    });
    it('keeps asset panels able to display and insert audio assets', () => {
        const assetPanel = readFileSync('desktop/src/renderer/src/assets/AssetPanel.tsx', 'utf8');
        const canvasAssetPanel = readFileSync('desktop/src/renderer/src/canvas/components/CanvasAssetPanel.tsx', 'utf8');
        const canvasPage = readFileSync('desktop/src/renderer/src/canvas/CanvasPage.tsx', 'utf8');
        expect(assetPanel).toContain("{ key: 'audio'");
        expect(assetPanel).toContain("audio: '🎧'");
        expect(canvasAssetPanel).toContain("'image' | 'video' | 'audio'");
        expect(canvasAssetPanel).toContain("mediaType === 'audio'");
        expect(canvasPage).toContain("'image' | 'video' | 'audio'");
    });
});
