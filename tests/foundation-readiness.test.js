import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
describe('core platform implementation readiness', () => {
    it('documents the remaining M0 foundation contracts before M1 starts', () => {
        expect(existsSync('docs/architecture/core-platform-implementation-readiness.md')).toBe(true);
        const readiness = readFileSync('docs/architecture/core-platform-implementation-readiness.md', 'utf8');
        for (const heading of [
            '## DB Schema 草案',
            '## 仓储层归属边界',
            '## 迁移策略',
            '## 运行时骨架规划',
            '## 设置与管理面',
            '## 初始内置工具',
            '## 初始内置 Skill',
            '## 默认 Agent 阵容与交接规则'
        ]) {
            expect(readiness).toContain(heading);
        }
    });
    it('records the no-demo acceptance review and M0 verification gates', () => {
        expect(existsSync('docs/progress/no-demo-acceptance-review.md')).toBe(true);
        const review = readFileSync('docs/progress/no-demo-acceptance-review.md', 'utf8');
        for (const phrase of [
            '占位符扫描',
            'No-Demo Acceptance Review',
            'M0 退出决策',
            'M1 即可开始'
        ]) {
            expect(review).toContain(phrase);
        }
    });
});
