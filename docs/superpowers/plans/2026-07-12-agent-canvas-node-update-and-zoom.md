# Agent Canvas Node Update And Zoom Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Route existing-node edits to the isolated canvas operator, reject empty sanitized mutations, and explicitly support canvas zoom gestures.

**Architecture:** Existing-node mutation intent selects the top-level `canvas-operator`, where the existing permission gate protects persistent `canvas.updateNodeData` calls. Child operators remain draft-isolated. CanvasPlan stays creation-only, and the React Flow canvas declares its zoom behavior rather than relying on library defaults.

**Tech Stack:** TypeScript strict, Vitest, React 18, React Flow, Bun.

---

### Task 1: Route Existing Node Updates

**Files:**
- Modify: `desktop/src/main/agent/intent-analysis.ts`
- Test: `tests/agent-intent-analysis.test.ts`

- [ ] **Step 1: Write the failing intent test**

```ts
expect(analyzeAgentIntent('把当前角色节点 Character 1 改为凌霜月，并补充角色描述')).toMatchObject({
  kind: 'canvasOperation',
  executionMode: 'direct',
  recommendedAgentId: 'canvas-operator',
  localCapabilities: expect.arrayContaining(['canvas.queryGraph', 'canvas.updateNodeData'])
})
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `bun scripts/run-vitest.mjs run tests/agent-intent-analysis.test.ts`

- [ ] **Step 3: Implement the mutation intent route**

```ts
if (hasExistingCanvasMutationIntent(trimmed)) {
  return { kind: 'canvasOperation', executionMode: 'direct', recommendedAgentId: 'canvas-operator', ... }
}
```

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `bun scripts/run-vitest.mjs run tests/agent-intent-analysis.test.ts`

### Task 2: Preserve Visible Character Patch Drafts

**Files:**
- Test: `tests/sub-agent-isolation.test.ts`

- [ ] **Step 1: Write the failing isolated draft patch test**

```ts
await runtime.invoke({ toolId: 'canvas.updateNodeData', input: {
  nodeId: 'character-1', data: { label: '凌霜月', description: '银发剑客', tags: ['主角'] }
}, actor, traceId: draft.traceId })
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `bun scripts/run-vitest.mjs run tests/sub-agent-isolation.test.ts`

- [ ] **Step 3: Verify the operator tool contract passes through the draft runtime**

The test asserts the source graph remains untouched while the draft keeps the
same node ID and exposes label, description, and tags in its draft artifact.

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `bun scripts/run-vitest.mjs run tests/sub-agent-isolation.test.ts`

### Task 3: Fail Closed On Fully Dropped Model Mutations

**Files:**
- Modify: `desktop/src/main/agent/gateway-loop-model.ts`
- Modify: `desktop/src/main/agent/prompts/index.ts`
- Test: `tests/gateway-agent-loop-model.test.ts`

- [ ] **Step 1: Write the failing gateway model test**

```ts
expect(terminal).toMatchObject({
  type: 'clarification',
  dropped: expect.arrayContaining(['node[0].ref:invalid_string'])
})
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `bun scripts/run-vitest.mjs run tests/gateway-agent-loop-model.test.ts`

- [ ] **Step 3: Implement a sanitized-empty mutation clarification**

```ts
const plan = sanitizePlan(planSource)
if (requestedMutationWasDropped(planSource, plan)) return clarificationFromDroppedMutation(plan)
```

- [ ] **Step 4: Update the role prompts**

State that a CanvasPlan may only create nodes and that existing-node field edits
must use `canvas.updateNodeData` through the Canvas Operator.

- [ ] **Step 5: Run the focused test and verify it passes**

Run: `bun scripts/run-vitest.mjs run tests/gateway-agent-loop-model.test.ts`

### Task 4: Declare Canvas Zoom Interaction

**Files:**
- Modify: `desktop/src/renderer/src/canvas/CanvasPage.tsx`
- Test: `tests/canvas-shell-parity.test.ts`

- [ ] **Step 1: Write the failing shell contract test**

```ts
expect(source).toContain('zoomOnScroll')
expect(source).toContain('zoomOnPinch')
expect(source).toContain('zoomOnDoubleClick')
expect(source).toContain('panOnScroll={false}')
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `bun scripts/run-vitest.mjs run tests/canvas-shell-parity.test.ts`

- [ ] **Step 3: Add explicit React Flow zoom props**

```tsx
zoomOnScroll
zoomOnPinch
zoomOnDoubleClick
panOnScroll={false}
```

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `bun scripts/run-vitest.mjs run tests/canvas-shell-parity.test.ts`

### Task 5: Verify The Integrated Change

**Files:**
- Verify only

- [ ] **Step 1: Run focused tests**

Run: `bun scripts/run-vitest.mjs run tests/agent-intent-analysis.test.ts tests/sub-agent-isolation.test.ts tests/gateway-agent-loop-model.test.ts tests/canvas-shell-parity.test.ts`

- [ ] **Step 2: Run static verification**

Run: `bun run typecheck && git diff --check`

- [ ] **Step 3: Run full regression suite**

Run: `bun run test`

- [ ] **Step 4: Perform a manual smoke check**

In the running app, request an update to `Character 1`, apply its draft graph,
and verify the canvas node displays its name, description, and tags. Verify
wheel and pinch change the canvas zoom.
