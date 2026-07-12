# Adaptive Media Canvas Node System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild all 13 canvas node renderers as media-first adaptive objects with stable overlays, shared 360px task panels, input-signal carousels, and responsive behavior at approximately 2,000 nodes.

**Architecture:** Keep React Flow node bodies small and geometry-stable, and move the selected node's toolbar and task panel into one canvas-level overlay host. Pure sizing and signal-model helpers drive adaptive media geometry and remain independently testable; node groups then consume shared primitives without changing IPC or provider contracts.

**Tech Stack:** Bun 1.3.14, React 18, TypeScript strict, @xyflow/react, Zustand, lucide-react, Vitest, Testing Library, CSS

---

## File Structure

**Create**

- `desktop/src/renderer/src/canvas/lib/adaptive-node-geometry.ts` - pure ratio normalization and equal-visible-area dimensions.
- `desktop/src/renderer/src/canvas/lib/node-signal-model.ts` - pure image/video signal derivation and display policy.
- `desktop/src/renderer/src/canvas/components/NodeOverlayHost.tsx` - the single selected-node toolbar/task-panel portal.
- `desktop/src/renderer/src/canvas/components/NodeSignalCarousel.tsx` - compact and expanded input-signal presentation.
- `tests/adaptive-node-geometry.test.ts` - geometry contract tests.
- `tests/node-signal-model.test.ts` - signal derivation tests.
- `tests/canvas-node-overlay-host.test.tsx` - single-overlay lifecycle and accessibility tests.
- `tests/adaptive-media-node-states.test.tsx` - core Character/Image/Video visual-state contracts.

**Modify**

- `desktop/src/renderer/src/canvas/components/NodeEditorContext.tsx` - publish selected-node overlay descriptors instead of mounting editors inside nodes.
- `desktop/src/renderer/src/canvas/components/NodePrimitives.tsx` - add external title, stable body, hover ports, toolbar descriptor, and task-panel primitives.
- `desktop/src/renderer/src/canvas/CanvasPage.tsx` - mount the one overlay host beside React Flow.
- `desktop/src/renderer/src/canvas/lib/node-sizing.ts` - replace fixed-orientation preview helpers with adaptive dimension tokens.
- `desktop/src/renderer/src/canvas/canvas.css` - implement the approved light-theme geometry and zoom degradation.
- `shared/nodes.ts` - add optional media ratio metadata and typed signal-source fields without breaking persisted graphs.
- `desktop/src/renderer/src/canvas/nodes/{Text,Character,Scene,Audio,Image,Video,MjImage,ImageConfigV2,VideoConfigV2,VideoCompose,SuperResolution,MuxAudioVideo,MigratedNode}.tsx` - migrate all existing node renderers.
- Existing node tests under `tests/` - preserve behavior while asserting the new presentation contracts.
- `tests/large-graph-performance-gates.test.ts` - guard against per-node overlay and timer regressions.
- `docs/progress/adaptive-media-canvas-node-test-report.md` - record final automated and visual verification.

### Task 1: Adaptive Media Geometry

**Files:**
- Create: `desktop/src/renderer/src/canvas/lib/adaptive-node-geometry.ts`
- Create: `tests/adaptive-node-geometry.test.ts`
- Modify: `desktop/src/renderer/src/canvas/lib/node-sizing.ts`
- Modify: `shared/nodes.ts`

- [ ] **Step 1: Write failing equal-visible-area tests**

```ts
import { describe, expect, it } from 'vitest'
import { getAdaptiveMediaSize, normalizeMediaRatio } from '../desktop/src/renderer/src/canvas/lib/adaptive-node-geometry'

describe('adaptive media geometry', () => {
  it.each(['16:9', '21:9', '9:16', '4:3', '3:4', '1:1'] as const)('keeps %s near the target area', (ratio) => {
    const size = getAdaptiveMediaSize(ratio)
    expect(size.width * size.height).toBeGreaterThanOrEqual(31_000)
    expect(size.width * size.height).toBeLessThanOrEqual(37_000)
  })

  it('normalizes intrinsic dimensions and invalid metadata', () => {
    expect(normalizeMediaRatio({ width: 1920, height: 1080 })).toBe('16:9')
    expect(normalizeMediaRatio({ width: 0, height: 0 }, '1:1')).toBe('1:1')
  })
})
```

- [ ] **Step 2: Run the focused test and verify failure**

Run: `bun scripts/run-vitest.mjs run tests/adaptive-node-geometry.test.ts`  
Expected: FAIL because `adaptive-node-geometry.ts` does not exist.

- [ ] **Step 3: Implement discrete ratio geometry and compatible optional metadata**

```ts
export type AdaptiveMediaRatio = '16:9' | '21:9' | '9:16' | '4:3' | '3:4' | '1:1'

const RATIOS: Record<AdaptiveMediaRatio, number> = {
  '16:9': 16 / 9, '21:9': 21 / 9, '9:16': 9 / 16,
  '4:3': 4 / 3, '3:4': 3 / 4, '1:1': 1
}

export function getAdaptiveMediaSize(ratio: AdaptiveMediaRatio, targetArea = 34_000) {
  const value = RATIOS[ratio]
  const width = Math.round(Math.sqrt(targetArea * value))
  return { width, height: Math.round(width / value), aspectRatio: ratio.replace(':', ' / ') }
}
```

Add optional `intrinsicWidth`, `intrinsicHeight`, and selected ratio fields to existing image/video data contracts so old persisted nodes remain valid.

- [ ] **Step 4: Run geometry and contract tests**

Run: `bun scripts/run-vitest.mjs run tests/adaptive-node-geometry.test.ts tests/node-contracts.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit geometry**

```bash
git add shared/nodes.ts desktop/src/renderer/src/canvas/lib/adaptive-node-geometry.ts desktop/src/renderer/src/canvas/lib/node-sizing.ts tests/adaptive-node-geometry.test.ts
git commit -m "feat(canvas): add adaptive media geometry"
```

### Task 2: Single Selected-Node Overlay Host

**Files:**
- Create: `desktop/src/renderer/src/canvas/components/NodeOverlayHost.tsx`
- Create: `tests/canvas-node-overlay-host.test.tsx`
- Modify: `desktop/src/renderer/src/canvas/components/NodeEditorContext.tsx`
- Modify: `desktop/src/renderer/src/canvas/CanvasPage.tsx`

- [ ] **Step 1: Write failing lifecycle tests**

```tsx
it('mounts one toolbar and one 360px task panel for one selected node', () => {
  render(<OverlayHarness selectedNodeIds={['image-1']} />)
  expect(screen.getAllByTestId('node-floating-toolbar')).toHaveLength(1)
  expect(screen.getAllByTestId('node-task-panel')).toHaveLength(1)
  expect(screen.getByTestId('node-task-panel')).toHaveStyle({ width: '360px' })
})

it('mounts no overlays for zero or multiple selected nodes', () => {
  const { rerender } = render(<OverlayHarness selectedNodeIds={[]} />)
  expect(screen.queryByTestId('node-task-panel')).not.toBeInTheDocument()
  rerender(<OverlayHarness selectedNodeIds={['a', 'b']} />)
  expect(screen.queryByTestId('node-task-panel')).not.toBeInTheDocument()
})
```

- [ ] **Step 2: Run the overlay test and verify failure**

Run: `bun scripts/run-vitest.mjs run tests/canvas-node-overlay-host.test.tsx`  
Expected: FAIL because the overlay host and registration API do not exist.

- [ ] **Step 3: Implement descriptor registration and overlay rendering**

```ts
export interface NodeOverlayDescriptor {
  nodeId: string
  toolbar: ReactNode
  panel: ReactNode
}

export interface NodeEditorContextValue {
  activeNodeId: string | null
  registerOverlay: (descriptor: NodeOverlayDescriptor) => () => void
}
```

`NodeOverlayHost` reads the active descriptor, positions it from the selected node's screen-space bounds, clamps the panel to the viewport, and renders only one toolbar and one task panel. `CanvasPage` mounts one host adjacent to the React Flow viewport.

- [ ] **Step 4: Run overlay and editor lifecycle tests**

Run: `bun scripts/run-vitest.mjs run tests/canvas-node-overlay-host.test.tsx tests/canvas-node-editor-lifecycle.test.tsx`  
Expected: PASS with one overlay owner and no multi-selection editor.

- [ ] **Step 5: Commit overlay infrastructure**

```bash
git add desktop/src/renderer/src/canvas/components/NodeOverlayHost.tsx desktop/src/renderer/src/canvas/components/NodeEditorContext.tsx desktop/src/renderer/src/canvas/CanvasPage.tsx tests/canvas-node-overlay-host.test.tsx tests/canvas-node-editor-lifecycle.test.tsx
git commit -m "feat(canvas): add selected node overlay host"
```

### Task 3: Media-First Node Primitives and Theme

**Files:**
- Modify: `desktop/src/renderer/src/canvas/components/NodePrimitives.tsx`
- Modify: `desktop/src/renderer/src/canvas/canvas.css`
- Modify: `tests/canvas-node-primitives.test.tsx`

- [ ] **Step 1: Add failing primitive-state assertions**

```tsx
it('keeps title external and ports hidden until hover or selection', () => {
  render(<AdaptiveNodeShell title="图片" selected={false}><div>preview</div></AdaptiveNodeShell>)
  expect(screen.getByTestId('node-external-title')).toBeInTheDocument()
  expect(screen.getByTestId('adaptive-node-body')).toHaveAttribute('data-selected', 'false')
  expect(screen.getByTestId('adaptive-node-body')).not.toContainElement(screen.queryByTestId('node-task-panel'))
})
```

- [ ] **Step 2: Run the primitive test and verify failure**

Run: `bun scripts/run-vitest.mjs run tests/canvas-node-primitives.test.tsx`  
Expected: FAIL because `AdaptiveNodeShell` is not exported.

- [ ] **Step 3: Implement stable body primitives and CSS states**

```tsx
export function AdaptiveNodeShell({ title, selected, children }: AdaptiveNodeShellProps): JSX.Element {
  return <article className="cc-adaptive-node" data-selected={String(selected)}>
    <div data-testid="node-external-title" className="cc-node-external-title">{title}</div>
    <div data-testid="adaptive-node-body" className="cc-adaptive-node-body">{children}</div>
  </article>
}
```

CSS must use `border-radius` at 8-12px by node family, neutral shadows, opacity/transform transitions only, hover-revealed `.cc-handle`, and zoom-level classes that hide metadata without resizing the body.

- [ ] **Step 4: Run primitive and shell tests**

Run: `bun scripts/run-vitest.mjs run tests/canvas-node-primitives.test.tsx tests/canvas-shell-parity.test.ts`  
Expected: PASS.

- [ ] **Step 5: Commit shared visual language**

```bash
git add desktop/src/renderer/src/canvas/components/NodePrimitives.tsx desktop/src/renderer/src/canvas/canvas.css tests/canvas-node-primitives.test.tsx
git commit -m "feat(canvas): add media first node primitives"
```

### Task 4: Input Signal Model and Carousel

**Files:**
- Create: `desktop/src/renderer/src/canvas/lib/node-signal-model.ts`
- Create: `desktop/src/renderer/src/canvas/components/NodeSignalCarousel.tsx`
- Create: `tests/node-signal-model.test.ts`
- Modify: `shared/nodes.ts`

- [ ] **Step 1: Write failing signal derivation tests**

```ts
it('derives image and video input signals in stable order', () => {
  expect(getImageSignals({ prompt: 'castle', referenceAssetIds: ['a'] }).map((x) => x.kind))
    .toEqual(['prompt', 'reference-image'])
  expect(getVideoSignals({ prompt: 'run', firstFrameAssetId: 'f', lastFrameAssetId: 'l' }).map((x) => x.kind))
    .toEqual(['prompt', 'reference-image', 'first-frame', 'last-frame', 'reference-video'])
})
```

- [ ] **Step 2: Run signal tests and verify failure**

Run: `bun scripts/run-vitest.mjs run tests/node-signal-model.test.ts`  
Expected: FAIL because signal helpers do not exist.

- [ ] **Step 3: Implement typed signals and compact/expanded carousel**

```ts
export type NodeSignalKind = 'prompt' | 'reference-image' | 'first-frame' | 'last-frame' | 'reference-video'
export interface NodeSignalItem { kind: NodeSignalKind; label: string; count: number; active: boolean; thumbnailUrls: readonly string[] }
```

`NodeSignalCarousel` renders icons and counts by default, labels and thumbnails when selected, roving-tabindex keyboard navigation, and an `onActivate(kind)` callback that switches task-panel content. It must not use timers or automatic animation.

- [ ] **Step 4: Run signal and accessibility tests**

Run: `bun scripts/run-vitest.mjs run tests/node-signal-model.test.ts tests/adaptive-media-node-states.test.tsx`  
Expected: PASS for empty, single, multi-asset, and failed-thumbnail cases.

- [ ] **Step 5: Commit signal carousel**

```bash
git add shared/nodes.ts desktop/src/renderer/src/canvas/lib/node-signal-model.ts desktop/src/renderer/src/canvas/components/NodeSignalCarousel.tsx tests/node-signal-model.test.ts tests/adaptive-media-node-states.test.tsx
git commit -m "feat(canvas): add media input signal carousel"
```

### Task 5: Character, Image, and Video Nodes

**Files:**
- Modify: `desktop/src/renderer/src/canvas/nodes/CharacterNode.tsx`
- Modify: `desktop/src/renderer/src/canvas/nodes/ImageNode.tsx`
- Modify: `desktop/src/renderer/src/canvas/nodes/VideoNode.tsx`
- Modify: `tests/character-scene-node-parity.test.tsx`
- Modify: `tests/image-node.test.tsx`
- Modify: `tests/video-node.test.tsx`
- Modify: `tests/adaptive-media-node-states.test.tsx`

- [ ] **Step 1: Write failing core-node state tests**

Assert that Character retains its lower identity strip, Image and Video use adaptive `width`/`height`, all three register a `360px` task panel, signal carousels expose the approved inputs, and no editor is nested inside the node body.

```tsx
expect(screen.getByTestId('character-identity-strip')).toBeInTheDocument()
expect(screen.getByTestId('image-node-body')).toHaveStyle({ aspectRatio: '21 / 9' })
expect(screen.getByRole('button', { name: '首帧信号' })).toBeInTheDocument()
expect(screen.queryByTestId('image-node-body')?.querySelector('[data-node-editor]')).toBeNull()
```

- [ ] **Step 2: Run core-node tests and verify failure**

Run: `bun scripts/run-vitest.mjs run tests/adaptive-media-node-states.test.tsx tests/image-node.test.tsx tests/video-node.test.tsx tests/character-scene-node-parity.test.tsx`  
Expected: FAIL against the current card-based renderers.

- [ ] **Step 3: Migrate the three renderers**

Use `AdaptiveNodeShell`, adaptive media dimensions, hover-only handles, capability-specific toolbar descriptors, `NodeSignalCarousel`, and overlay task-panel registration. Keep existing asset selection, editing, clearing, prompt, video copy, and callback behavior intact.

- [ ] **Step 4: Run core-node regression tests**

Run: `bun scripts/run-vitest.mjs run tests/adaptive-media-node-states.test.tsx tests/image-node.test.tsx tests/video-node.test.tsx tests/character-scene-node-parity.test.tsx tests/context-node-selection-editors.test.tsx`  
Expected: PASS.

- [ ] **Step 5: Commit core nodes**

```bash
git add desktop/src/renderer/src/canvas/nodes/CharacterNode.tsx desktop/src/renderer/src/canvas/nodes/ImageNode.tsx desktop/src/renderer/src/canvas/nodes/VideoNode.tsx tests/adaptive-media-node-states.test.tsx tests/image-node.test.tsx tests/video-node.test.tsx tests/character-scene-node-parity.test.tsx
git commit -m "feat(canvas): rebuild core adaptive media nodes"
```

### Task 6: Remaining Content and Media Nodes

**Files:**
- Modify: `desktop/src/renderer/src/canvas/nodes/TextNode.tsx`
- Modify: `desktop/src/renderer/src/canvas/nodes/SceneNode.tsx`
- Modify: `desktop/src/renderer/src/canvas/nodes/AudioNode.tsx`
- Modify: `desktop/src/renderer/src/canvas/nodes/MjImageNode.tsx`
- Modify: `tests/text-node.test.tsx`
- Modify: `tests/audio-node-parity.test.tsx`
- Modify: `tests/character-scene-node-parity.test.tsx`
- Modify: `tests/mj-migrated-node-selection-editors.test.tsx`

- [ ] **Step 1: Add failing family-specific assertions**

Assert compact text truncation, Scene landscape preview/placeholder, Audio stable waveform/duration, and MjImage reuse of adaptive image geometry with provider-specific actions.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `bun scripts/run-vitest.mjs run tests/text-node.test.tsx tests/audio-node-parity.test.tsx tests/character-scene-node-parity.test.tsx tests/mj-migrated-node-selection-editors.test.tsx`  
Expected: FAIL on the new media-first state contracts.

- [ ] **Step 3: Migrate Text, Scene, Audio, and MjImage**

Each renderer uses the shared shell and overlay API while retaining its existing callbacks. Only MjImage consumes adaptive image geometry; Text, Scene, and Audio keep content-appropriate stable dimensions.

- [ ] **Step 4: Run content/media family tests**

Run: `bun scripts/run-vitest.mjs run tests/text-node.test.tsx tests/audio-node-parity.test.tsx tests/audio-node-selection-editor.test.tsx tests/character-scene-node-parity.test.tsx tests/mj-migrated-node-selection-editors.test.tsx`  
Expected: PASS.

- [ ] **Step 5: Commit content/media migration**

```bash
git add desktop/src/renderer/src/canvas/nodes/TextNode.tsx desktop/src/renderer/src/canvas/nodes/SceneNode.tsx desktop/src/renderer/src/canvas/nodes/AudioNode.tsx desktop/src/renderer/src/canvas/nodes/MjImageNode.tsx tests/text-node.test.tsx tests/audio-node-parity.test.tsx tests/character-scene-node-parity.test.tsx tests/mj-migrated-node-selection-editors.test.tsx
git commit -m "feat(canvas): migrate content and provider media nodes"
```

### Task 7: Configuration, Processing, and Compatibility Nodes

**Files:**
- Modify: `desktop/src/renderer/src/canvas/nodes/ImageConfigV2Node.tsx`
- Modify: `desktop/src/renderer/src/canvas/nodes/VideoConfigV2Node.tsx`
- Modify: `desktop/src/renderer/src/canvas/nodes/VideoComposeNode.tsx`
- Modify: `desktop/src/renderer/src/canvas/nodes/SuperResolutionNode.tsx`
- Modify: `desktop/src/renderer/src/canvas/nodes/MuxAudioVideoNode.tsx`
- Modify: `desktop/src/renderer/src/canvas/nodes/MigratedNode.tsx`
- Modify: `tests/image-config-v2-parity.test.tsx`
- Modify: `tests/video-config-v2-parity.test.tsx`
- Modify: `tests/post-production-node-selection-editors.test.tsx`
- Modify: `tests/migrated-node.test.tsx`

- [ ] **Step 1: Add failing grouped-state assertions**

Assert concise configuration summaries, stable processing progress strips, output previews, and an explicit unsupported-state label plus migration/removal actions for MigratedNode.

- [ ] **Step 2: Run grouped tests and verify failure**

Run: `bun scripts/run-vitest.mjs run tests/image-config-v2-parity.test.tsx tests/video-config-v2-parity.test.tsx tests/post-production-node-selection-editors.test.tsx tests/migrated-node.test.tsx`  
Expected: FAIL on the new default-state and overlay contracts.

- [ ] **Step 3: Migrate the six renderers**

Move full parameter controls to overlay panels, keep only identity/readiness in configuration bodies, keep input/progress/output in processing bodies, and prevent MigratedNode from presenting a runnable appearance.

- [ ] **Step 4: Run grouped and dispatch regressions**

Run: `bun scripts/run-vitest.mjs run tests/image-config-v2-parity.test.tsx tests/video-config-v2-parity.test.tsx tests/post-production-node-selection-editors.test.tsx tests/post-production-node-parity.test.tsx tests/super-resolution-node-parity.test.tsx tests/migrated-node.test.tsx tests/task16-post-production-run-dispatch.test.ts`  
Expected: PASS with existing run callbacks intact.

- [ ] **Step 5: Commit remaining node migration**

```bash
git add desktop/src/renderer/src/canvas/nodes/ImageConfigV2Node.tsx desktop/src/renderer/src/canvas/nodes/VideoConfigV2Node.tsx desktop/src/renderer/src/canvas/nodes/VideoComposeNode.tsx desktop/src/renderer/src/canvas/nodes/SuperResolutionNode.tsx desktop/src/renderer/src/canvas/nodes/MuxAudioVideoNode.tsx desktop/src/renderer/src/canvas/nodes/MigratedNode.tsx tests/image-config-v2-parity.test.tsx tests/video-config-v2-parity.test.tsx tests/post-production-node-selection-editors.test.tsx tests/migrated-node.test.tsx
git commit -m "feat(canvas): migrate config and processing nodes"
```

### Task 8: Performance, Accessibility, Visual Verification, and Report

**Files:**
- Modify: `tests/large-graph-performance-gates.test.ts`
- Create: `docs/progress/adaptive-media-canvas-node-test-report.md`
- Modify: `desktop/src/renderer/src/canvas/canvas.css` only if verification exposes a documented visual defect

- [ ] **Step 1: Add performance guard assertions**

```ts
it('uses one overlay host and no per-node carousel timers', () => {
  expect(canvasPageSource.match(/<NodeOverlayHost/g)).toHaveLength(1)
  for (const source of nodeSources) {
    expect(source).not.toContain('setInterval(')
    expect(source).not.toContain('<NodeSelectionEditor')
  }
})
```

- [ ] **Step 2: Run performance gates and full typecheck**

Run: `bun scripts/run-vitest.mjs run tests/large-graph-performance-gates.test.ts tests/canvas-store-selector-stability.test.ts tests/node-resizer-integration.test.ts && bun run typecheck`  
Expected: PASS with no per-node overlay/timer regressions and no TypeScript errors.

- [ ] **Step 3: Run the complete automated suite**

Run: `bun run test`  
Expected: PASS. Record the exact test-file and test counts in the report.

- [ ] **Step 4: Run the app and verify desktop/mobile-sized browser views**

Run: `bun run dev`  
Verify with browser screenshots at a wide desktop viewport and a narrow application viewport:

- Character, Image, and Video default/hover/selected states.
- 21:9, 16:9, 1:1, and 9:16 media bodies.
- Equal-width 360px task panels under narrow and wide nodes.
- Image and video signal carousel states.
- No overlap between toolbar, node, task panel, and nearby nodes.
- Drag and wheel interactions on the large-graph fixture.

- [ ] **Step 5: Run repository verification and write the report**

Run: `bun run lint && bun run typecheck && bun run verify:repo`  
Expected: PASS. Write commands, counts, screenshots, known residual risks, and the manual 2,000-node observation to `docs/progress/adaptive-media-canvas-node-test-report.md`.

- [ ] **Step 6: Commit verification evidence**

```bash
git add tests/large-graph-performance-gates.test.ts docs/progress/adaptive-media-canvas-node-test-report.md desktop/src/renderer/src/canvas/canvas.css
git commit -m "test(canvas): verify adaptive node system"
```

## Completion Criteria

- All 13 existing node renderers use the approved adaptive visual language.
- Image and Video nodes support approved aspect ratios with near-equal visible area.
- Image and Video signal carousels expose every approved input kind.
- Only one selected-node overlay toolbar and one 360px task panel can be mounted.
- Default, hover, selection, loading, failed, running, completed, and migrated states are stable.
- Existing node actions, generation dispatch, asset binding, and connection behavior remain intact.
- Focused tests, full tests, lint, typecheck, and repository verification pass.
- Visual and large-graph verification are recorded in the final report.
