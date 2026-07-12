# Cloud Paper Canvas Node System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild all registered canvas nodes as cloud-paper compact production units whose configuration editors mount beneath the currently selected node.

**Architecture:** Renderer-local shared primitives own node geometry, headers, previews, summary rows, asset actions, and the selection editor shell. A small context derives one active editor ID from React Flow selection, while each existing node keeps ownership of its data and callbacks. The migration changes presentation and transient interaction only; shared contracts and persistence remain untouched.

**Tech Stack:** React 18, TypeScript strict, `@xyflow/react`, Zustand, Tailwind CSS, Vitest, Testing Library, Bun.

---

### Task 1: Cloud-Paper Tokens And Shared Node Primitives

**Files:**
- Modify: `desktop/src/renderer/src/canvas/canvas.css`
- Modify: `desktop/src/renderer/src/canvas/lib/node-sizing.ts`
- Create: `desktop/src/renderer/src/canvas/components/NodePrimitives.tsx`
- Create: `tests/canvas-node-primitives.test.tsx`

- [ ] **Step 1: Write failing primitive tests**

Add component assertions that render the shared frame and editor:

```tsx
render(
  <NodeFrame selected={false} data-testid="frame">
    <NodeHeader icon={<ImageIcon />} title="首帧生成" meta="Seedream 4.0" />
    <NodeSummaryRows rows={[{ label: '画幅', value: '9:16 · 3K' }]} />
  </NodeFrame>,
)
expect(screen.getByTestId('frame')).toHaveClass('cc-node-frame')
expect(screen.getByText('首帧生成')).toHaveClass('cc-node-title')
expect(screen.getByText('9:16 · 3K')).toBeInTheDocument()

render(<NodeSelectionEditor open><div>编辑内容</div></NodeSelectionEditor>)
expect(screen.getByText('编辑内容').closest('[data-node-editor]')).toHaveClass('cc-node-editor')
```

- [ ] **Step 2: Run the test and verify RED**

Run: `bun scripts/run-vitest.mjs run tests/canvas-node-primitives.test.tsx`

Expected: FAIL because `NodePrimitives.tsx` and cloud-paper classes do not exist.

- [ ] **Step 3: Implement tokens and primitives**

Define these exports in `NodePrimitives.tsx` with typed props and succinct JSDoc:

```tsx
export function NodeFrame({ selected, className, children, ...props }: NodeFrameProps): JSX.Element
export function NodeHeader({ icon, title, meta, status, actions }: NodeHeaderProps): JSX.Element
export function NodePreview({ className, children }: NodePreviewProps): JSX.Element
export function NodeSummaryRows({ rows }: NodeSummaryRowsProps): JSX.Element
export function NodeAssetBar({ children }: PropsWithChildren): JSX.Element
export function NodeSelectionEditor({ open, children, testId }: NodeSelectionEditorProps): JSX.Element | null
export function NodeEditorFooter({ children }: PropsWithChildren): JSX.Element
```

`NodeSelectionEditor` must return `null` when closed and render this shell when open:

```tsx
if (!open) return null
return (
  <div className="nodrag nowheel cc-node-editor-anchor" data-node-editor data-testid={testId}>
    <section className="cc-node-editor">{children}</section>
  </div>
)
```

Update shared tokens to the approved values:

```css
.cc-flow {
  --cc-workbench-bg: #f3f5f6;
  --cc-node-surface: #ffffff;
  --cc-node-border: #d9dee2;
  --cc-node-divider: #eaedef;
  --cc-node-text: #202428;
  --cc-node-muted: #727981;
  --cc-node-hover-shadow: 0 10px 26px rgba(32, 36, 40, 0.07);
  --cc-editor-shadow: 0 18px 46px rgba(32, 36, 40, 0.08);
}
```

Use `8px` node radius, `6px` preview radius, `24px` editor radius, `40px` headers, and `30px` summary rows. Remove dark/glass overrides that conflict with these values. Update `NODE_UI_CLASS_NAMES` to reference the shared `cc-*` classes rather than oversized `rounded-xl` or idle shadows.

- [ ] **Step 4: Verify GREEN**

Run: `bun scripts/run-vitest.mjs run tests/canvas-node-primitives.test.tsx tests/canvas-shell-parity.test.ts && bun run typecheck`

Expected: all selected tests pass and TypeScript exits `0`.

- [ ] **Step 5: Commit the primitive layer**

```bash
git add desktop/src/renderer/src/canvas/canvas.css \
  desktop/src/renderer/src/canvas/lib/node-sizing.ts \
  desktop/src/renderer/src/canvas/components/NodePrimitives.tsx \
  tests/canvas-node-primitives.test.tsx tests/canvas-shell-parity.test.ts
git commit -m "feat(canvas): add cloud paper node primitives"
```

### Task 2: Single Active Node Editor Lifecycle

**Files:**
- Create: `desktop/src/renderer/src/canvas/components/NodeEditorContext.tsx`
- Modify: `desktop/src/renderer/src/canvas/CanvasPage.tsx`
- Create: `tests/canvas-node-editor-lifecycle.test.tsx`

- [ ] **Step 1: Write failing lifecycle tests**

Test the pure active-ID derivation and context behavior:

```tsx
expect(activeNodeEditorId([])).toBeNull()
expect(activeNodeEditorId(['node-a'])).toBe('node-a')
expect(activeNodeEditorId(['node-a', 'node-b'])).toBeNull()

render(
  <NodeEditorProvider selectedNodeIds={['node-a']}>
    <Probe nodeId="node-a" />
    <Probe nodeId="node-b" />
  </NodeEditorProvider>,
)
expect(screen.getByTestId('node-a')).toHaveTextContent('open')
expect(screen.getByTestId('node-b')).toHaveTextContent('closed')
```

Add source assertions that `CanvasPage` wraps `ReactFlow` node rendering with `NodeEditorProvider` and passes the memoized `selectedNodeIds`.

- [ ] **Step 2: Run the lifecycle test and verify RED**

Run: `bun scripts/run-vitest.mjs run tests/canvas-node-editor-lifecycle.test.tsx`

Expected: FAIL because the provider and active-ID function do not exist.

- [ ] **Step 3: Implement the lifecycle module**

Use a stable context value with no store subscription inside individual nodes:

```tsx
const NodeEditorContext = createContext<string | null>(null)

export function activeNodeEditorId(selectedNodeIds: readonly string[]): string | null {
  return selectedNodeIds.length === 1 ? selectedNodeIds[0]! : null
}

export function NodeEditorProvider({ selectedNodeIds, children }: NodeEditorProviderProps): JSX.Element {
  const activeId = useMemo(() => activeNodeEditorId(selectedNodeIds), [selectedNodeIds])
  return <NodeEditorContext.Provider value={activeId}>{children}</NodeEditorContext.Provider>
}

export function useNodeEditorOpen(nodeId: string): boolean {
  return useContext(NodeEditorContext) === nodeId
}
```

Wrap the canvas `ReactFlow` subtree with the provider. Preserve React Flow selection behavior; multi-selection intentionally closes all editors. Existing blank-pane selection clearing and Escape behavior remain React Flow-owned.

- [ ] **Step 4: Verify GREEN and canvas regressions**

Run: `bun scripts/run-vitest.mjs run tests/canvas-node-editor-lifecycle.test.tsx tests/canvas-selection-actions.test.ts tests/canvas-shortcuts-parity.test.ts`

Expected: all tests pass.

- [ ] **Step 5: Commit editor lifecycle**

```bash
git add desktop/src/renderer/src/canvas/components/NodeEditorContext.tsx \
  desktop/src/renderer/src/canvas/CanvasPage.tsx \
  tests/canvas-node-editor-lifecycle.test.tsx
git commit -m "feat(canvas): coordinate one selected node editor"
```

### Task 3: Text, Image, Video, Character, Scene, And Audio Nodes

**Files:**
- Modify: `desktop/src/renderer/src/canvas/nodes/TextNode.tsx`
- Modify: `desktop/src/renderer/src/canvas/nodes/ImageNode.tsx`
- Modify: `desktop/src/renderer/src/canvas/nodes/VideoNode.tsx`
- Modify: `desktop/src/renderer/src/canvas/nodes/CharacterNode.tsx`
- Modify: `desktop/src/renderer/src/canvas/nodes/SceneNode.tsx`
- Modify: `desktop/src/renderer/src/canvas/nodes/AudioNode.tsx`
- Modify: `tests/production-node-components-parity.test.tsx`

- [ ] **Step 1: Add failing collapsed/editor assertions**

For each node family, render once with editor context closed and once open. Assert that collapsed output contains `cc-node-frame`, no `[data-node-editor]`, and only scan summaries. Assert selected output contains exactly one editor and the existing editable control or asset callback.

Example:

```tsx
renderNode(<CharacterNode id="character-a" data={characterData} />, null)
expect(screen.queryByTestId('character-node-editor')).not.toBeInTheDocument()

renderNode(<CharacterNode id="character-a" data={characterData} />, 'character-a')
expect(screen.getByTestId('character-node-editor')).toBeInTheDocument()
expect(screen.getByRole('textbox', { name: '角色描述' })).toBeEnabled()
```

- [ ] **Step 2: Run focused tests and verify RED**

Run: `bun scripts/run-vitest.mjs run tests/production-node-components-parity.test.tsx`

Expected: FAIL because controls are still permanently mounted or old card classes remain.

- [ ] **Step 3: Migrate the six node families**

For each component:

- derive `const editorOpen = useNodeEditorOpen(id)`;
- render `NodeFrame`, `NodeHeader`, one `NodePreview`, and at most three summary rows;
- move textareas, selects, asset pickers, and nonessential action buttons into `NodeSelectionEditor`;
- preserve every existing callback and `data-testid` used by tests;
- keep handles and `NodeResizer` on the node root;
- use icon buttons with `aria-label` and `title` for preview, download, crop, delete, and asset actions.

Do not move local data into a new store and do not alter shared node interfaces.

- [ ] **Step 4: Verify family behavior**

Run: `bun scripts/run-vitest.mjs run tests/production-node-components-parity.test.tsx tests/image-node.test.tsx tests/video-node.test.tsx tests/node-resizer-integration.test.ts`

Expected: all selected tests pass.

- [ ] **Step 5: Commit content and context nodes**

```bash
git add desktop/src/renderer/src/canvas/nodes/TextNode.tsx \
  desktop/src/renderer/src/canvas/nodes/ImageNode.tsx \
  desktop/src/renderer/src/canvas/nodes/VideoNode.tsx \
  desktop/src/renderer/src/canvas/nodes/CharacterNode.tsx \
  desktop/src/renderer/src/canvas/nodes/SceneNode.tsx \
  desktop/src/renderer/src/canvas/nodes/AudioNode.tsx \
  tests/production-node-components-parity.test.tsx
git commit -m "feat(canvas): migrate core nodes to selection editors"
```

### Task 4: Image And Video Generation V2 Nodes

**Files:**
- Modify: `desktop/src/renderer/src/canvas/nodes/ImageConfigV2Node.tsx`
- Modify: `desktop/src/renderer/src/canvas/nodes/VideoConfigV2Node.tsx`
- Modify: `tests/image-config-v2-parity.test.tsx`
- Modify: `tests/video-config-v2-parity.test.tsx`

- [ ] **Step 1: Write failing V2 visual-state tests**

Keep existing generation tests and add:

```tsx
expect(screen.queryByTestId('image-config-v2-toolbar')).not.toBeInTheDocument()
rerenderInEditorContext('image-config')
expect(screen.getByTestId('image-config-v2-toolbar')).toHaveClass('cc-node-editor')

expect(screen.queryByTestId('video-config-v2-toolbar')).not.toBeInTheDocument()
rerenderInEditorContext('video-config')
expect(screen.getByTestId('video-config-v2-toolbar')).toHaveClass('cc-node-editor')
```

Assert model, ratio, style, duration, resolution, references, prompt, generate, writeback, and status controls remain reachable only in the open editor.

- [ ] **Step 2: Run V2 tests and verify RED**

Run: `bun scripts/run-vitest.mjs run tests/image-config-v2-parity.test.tsx tests/video-config-v2-parity.test.tsx`

Expected: FAIL because the legacy selected toolbars and rounded-xl preview cards remain.

- [ ] **Step 3: Recompose V2 nodes with shared primitives**

Keep existing model option arrays, callbacks, and preview-state logic. Replace the outer structure with shared primitives. Move upload and asset-library actions to `NodeAssetBar`; move `MentionTextarea`, reference thumbnails, Popover menus, status chips, writeback, and generate actions into `NodeSelectionEditor` and `NodeEditorFooter`.

The editor must remain horizontally centered, responsive, and outside persisted node dimensions. Remove `rounded-xl`, `rounded-2xl`, idle `shadow-card`, and the top pill toolbar from the collapsed node.

- [ ] **Step 4: Verify V2 callback parity**

Run: `bun scripts/run-vitest.mjs run tests/image-config-v2-parity.test.tsx tests/video-config-v2-parity.test.tsx tests/image-node.test.tsx tests/video-node.test.tsx`

Expected: all selected tests pass, including V2 result selection/writeback assertions and media-node asset behavior.

- [ ] **Step 5: Commit V2 migration**

```bash
git add desktop/src/renderer/src/canvas/nodes/ImageConfigV2Node.tsx \
  desktop/src/renderer/src/canvas/nodes/VideoConfigV2Node.tsx \
  tests/image-config-v2-parity.test.tsx tests/video-config-v2-parity.test.tsx
git commit -m "feat(canvas): rebuild generation nodes as compact editors"
```

### Task 5: Production And Registry-Driven Nodes

**Files:**
- Modify: `desktop/src/renderer/src/canvas/nodes/VideoComposeNode.tsx`
- Modify: `desktop/src/renderer/src/canvas/nodes/SuperResolutionNode.tsx`
- Modify: `desktop/src/renderer/src/canvas/nodes/MuxAudioVideoNode.tsx`
- Modify: `desktop/src/renderer/src/canvas/nodes/MjImageNode.tsx`
- Modify: `desktop/src/renderer/src/canvas/nodes/MigratedNode.tsx`
- Modify: `tests/production-node-components-parity.test.tsx`
- Modify: `tests/task16-post-production-run-dispatch.test.ts`

- [ ] **Step 1: Add failing production-node editor tests**

Assert collapsed nodes contain only ordered-input, source/target, model, and status summaries. Under matching editor context, assert existing selects and run buttons are mounted and invoke the same callbacks.

Example:

```tsx
renderNode(<SuperResolutionNode {...props} />, 'super-a')
fireEvent.click(screen.getByRole('button', { name: '运行超分' }))
expect(onRun).toHaveBeenCalledWith('super-a')
```

- [ ] **Step 2: Run production tests and verify RED**

Run: `bun scripts/run-vitest.mjs run tests/production-node-components-parity.test.tsx tests/task16-post-production-run-dispatch.test.ts`

Expected: FAIL on missing selection editors and old visual classes.

- [ ] **Step 3: Migrate production and migrated nodes**

Use the same primitive anatomy. Keep ordered inputs and terminal state visible in collapsed summaries. Move transition/model/resolution/FPS/input binding and run controls into selection editors. For `MigratedNode`, derive summary rows from existing registry metadata and render only supported controls; do not invent unsupported fields.

- [ ] **Step 4: Verify run dispatch and registry parity**

Run: `bun scripts/run-vitest.mjs run tests/production-node-components-parity.test.tsx tests/task16-post-production-run-dispatch.test.ts tests/infinite-canvas-implementation-guard.test.ts`

Expected: all selected tests pass.

- [ ] **Step 5: Commit production migration**

```bash
git add desktop/src/renderer/src/canvas/nodes/VideoComposeNode.tsx \
  desktop/src/renderer/src/canvas/nodes/SuperResolutionNode.tsx \
  desktop/src/renderer/src/canvas/nodes/MuxAudioVideoNode.tsx \
  desktop/src/renderer/src/canvas/nodes/MjImageNode.tsx \
  desktop/src/renderer/src/canvas/nodes/MigratedNode.tsx \
  tests/production-node-components-parity.test.tsx \
  tests/task16-post-production-run-dispatch.test.ts
git commit -m "feat(canvas): unify production node editors"
```

### Task 6: Integrated Visual, Interaction, And Performance Verification

**Files:**
- Modify: `tests/canvas-shell-parity.test.ts`
- Modify: `tests/canvas-chatbox.test.tsx`
- Create: `docs/progress/cloud-paper-canvas-node-system-test-report.md`

- [ ] **Step 1: Add integrated source and interaction guards**

Assert all registered node component files import at least one shared primitive and contain no idle `shadow-card`, `rounded-xl`, or `rounded-2xl` root classes. Preserve the closed chat-workbench regression so wheel events reach React Flow.

- [ ] **Step 2: Run focused regression suite**

Run:

```bash
bun scripts/run-vitest.mjs run \
  tests/canvas-node-primitives.test.tsx \
  tests/canvas-node-editor-lifecycle.test.tsx \
  tests/canvas-shell-parity.test.ts \
  tests/canvas-chatbox.test.tsx \
  tests/canvas-display-nodes.test.ts \
  tests/canvas-related-highlight-parity.test.ts \
  tests/production-node-components-parity.test.tsx \
  tests/image-config-v2-parity.test.tsx \
  tests/video-config-v2-parity.test.tsx
```

Expected: all focused tests pass.

- [ ] **Step 3: Run repository verification**

Run: `bun run typecheck && bun run lint && git diff --check`

Expected: all commands exit `0`; record pre-existing unrelated failures rather than changing unrelated files.

- [ ] **Step 4: Verify the running Electron canvas**

Start with a remote debugging port:

```bash
bun run --filter @comic-canvas/desktop dev -- --remoteDebuggingPort 9222
```

Use the existing local workflow or a disposable in-memory fixture to display all node families. Verify by CDP that a wheel event changes `.react-flow__viewport` transform, selecting one node mounts one `[data-node-editor]`, selecting another moves the editor, and clicking blank canvas removes it.

- [ ] **Step 5: Capture visual evidence**

Capture screenshots into `output/playwright/` at `1440x900` and `1024x768`. The screenshots must show cloud-paper canvas, at least one media node, one semantic node, one production node, and one open editor without overlap or clipped text.

- [ ] **Step 6: Record the report and commit**

Document exact commands, pass counts, screenshots, unresolved external smoke tests, and any pre-existing full-suite blockers in `docs/progress/cloud-paper-canvas-node-system-test-report.md`.

```bash
git add tests/canvas-shell-parity.test.ts tests/canvas-chatbox.test.tsx \
  docs/progress/cloud-paper-canvas-node-system-test-report.md
git commit -m "test(canvas): verify cloud paper node system"
```
