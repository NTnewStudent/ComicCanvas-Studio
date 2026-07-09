import { describe, expect, it } from 'vitest';
import { estimateCostUsd, emptyUsage, addUsage, formatUsage } from '../desktop/src/main/agent/cost';
describe('agent cost accounting', () => {
    it('estimates zero cost for unknown models', () => {
        expect(estimateCostUsd('unknown-model-xyz', 10000, 500)).toBe(0);
    });
    it('estimates a non-zero cost for deepseek-chat', () => {
        const cost = estimateCostUsd('deepseek-chat', 1_000_000, 1_000_000);
        expect(cost).toBeGreaterThan(0);
        // 0.27 + 1.10 = 1.37 USD for 1M in + 1M out
        expect(cost).toBeCloseTo(1.37, 2);
    });
    it('estimates zero cost when token counts are 0', () => {
        expect(estimateCostUsd('gpt-4o', 0, 0)).toBe(0);
    });
    it('addUsage accumulates across multiple calls', () => {
        let acc = emptyUsage();
        acc = addUsage(acc, { inputTokens: 100, outputTokens: 50, costUsd: 0.001 });
        acc = addUsage(acc, { inputTokens: 200, outputTokens: 80, costUsd: 0.002 });
        expect(acc.inputTokens).toBe(300);
        expect(acc.outputTokens).toBe(130);
        expect(acc.costUsd).toBeCloseTo(0.003, 5);
    });
    it('formatUsage produces a compact human-readable string', () => {
        const line = formatUsage({ inputTokens: 1200, outputTokens: 340, costUsd: 0.0012 });
        expect(line).toContain('1.2k');
        expect(line).toContain('340');
        expect(line).toContain('$0.0012');
    });
    it('formatUsage omits cost section when costUsd is 0', () => {
        const line = formatUsage({ inputTokens: 500, outputTokens: 100, costUsd: 0 });
        expect(line).not.toContain('$');
        expect(line).toContain('500');
        expect(line).toContain('100');
    });
});
