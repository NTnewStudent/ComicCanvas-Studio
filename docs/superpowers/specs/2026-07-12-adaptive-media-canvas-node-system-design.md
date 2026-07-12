# Adaptive Media Canvas Node System Design

**Date:** 2026-07-12  
**Status:** Approved for implementation planning  
**Scope:** Renderer-side visual and interaction redesign for the 13 existing canvas node types

## 1. Objective

Redesign the ComicCanvas node system around media-first canvas objects while preserving the professional controls required for comic-drama production. The result should visually approach the quiet, spatial interaction language demonstrated by the approved references without copying external source code or making every node share one card layout.

The system must remain responsive at approximately 2,000 nodes. Configuration controls, floating toolbars, and editors therefore cannot be mounted as permanent content inside every React Flow node.

## 2. Confirmed Direction

The approved direction is **adaptive professional canvas**:

- Each node type keeps a shape appropriate to its content.
- Titles sit outside and above the node body.
- The default state shows only the primary content and essential status.
- Hover reveals connection affordances and a light outline.
- Selection reveals a type-specific floating toolbar above the node and a shared-width task panel below it.
- The floating toolbar and task panel are overlays. They do not change the measured node body or trigger edge-layout movement.
- Light theme surfaces use restrained white and neutral-gray values, compact shadows, and clear but limited accent color.

## 3. Core Interaction States

### 3.1 Default

- Show the external title, primary content, and essential production status only.
- Hide connection ports, toolbars, full parameter summaries, and task panels.
- Preserve a stable node bounding box.

### 3.2 Hover

- Reveal valid input and output ports.
- Add a light focus outline without changing border width or node dimensions.
- Do not open a toolbar or task panel.

### 3.3 Selected

- Use an accent focus outline.
- Show a type-specific toolbar centered above the node.
- Show a task panel centered below the node.
- Keep ports visible.
- Keep node measurement unchanged.

Only the currently selected node owns the active toolbar and task panel. Both are rendered through a shared overlay or portal layer.

## 4. Adaptive Aspect-Ratio Geometry

Image and video nodes preserve **approximately equal visible area**, not a fixed long edge. Their width and height change together according to the selected or detected aspect ratio.

Supported image ratios:

- Automatic
- 16:9
- 21:9
- 9:16
- 4:3
- 3:4
- 1:1

Automatic behavior:

- Existing media uses its decoded intrinsic ratio.
- A new generation node uses the model default until the user selects a ratio.
- Unknown or invalid media metadata falls back to 1:1 for image and the configured generation default for video.

The renderer maps ratios to precomputed dimension classes around a target visible area. It does not scale nodes from source pixel dimensions. Ratio changes must update the node body and edge anchors in one committed state change without transitional layout jitter.

## 5. Shared Task Panel

The task panel uses a common `360px` canvas-coordinate baseline width for Character, Image, and Video nodes and the same width calculation for other editable node types.

- The panel width does not follow the node body width.
- Narrow application viewports may clamp the panel to available screen space.
- Panel content can vary by node type, but its outer geometry, spacing, radius, and elevation remain shared.
- High-frequency settings remain in the primary row. Less common settings use menus or expandable sections.
- Opening, switching, or closing panel content must not change the node body's measured dimensions.

## 6. Input Signal Carousel

Image and video nodes expose the active generation inputs through a compact signal carousel.

### 6.1 Image Signals

- Text-to-image prompt
- Reference image

### 6.2 Video Signals

- Prompt
- Reference image
- First frame
- Last frame
- Reference video

Behavior:

- In default state, show compact signal icons and connected-item counts only.
- In selected state, expand labels and relevant thumbnails.
- Active signals are emphasized; available but empty signals remain visually quiet.
- Multiple assets within one signal slot can be traversed horizontally without changing node size.
- Clicking a signal switches the shared task panel to the corresponding editor.
- Thumbnail decoding and carousel content are loaded only for visible or selected nodes.

The signal carousel describes inputs; it does not duplicate the output media preview.

## 7. Node-Type Mapping

### 7.1 Content Nodes

**Text**

- Compact readable text body with truncation at lower zoom levels.
- Selection opens the shared panel for text editing and polishing controls.

**Character**

- Portrait-oriented identity body.
- Persistent lower strip contains essential character status such as base appearance and episode usage.
- Selection toolbar contains upload, asset-library, and character-specific actions.

**Scene**

- Landscape visual body when a scene image exists; restrained placeholder otherwise.
- Essential location or continuity status may appear in a compact lower strip.

**Audio**

- Waveform or stable waveform placeholder with duration and playback status.
- Playback controls appear on hover or selection, not as permanent full-size buttons.

### 7.2 Media Nodes

**Image**

- Adaptive body derived from the detected or selected image ratio.
- Image signal carousel supports prompt and reference-image inputs.
- Selection panel exposes prompt, model, clarity, ratio, style, and reference controls.

**Video**

- Adaptive body derived from detected or selected video ratio, including portrait formats.
- Video signal carousel supports prompt, reference image, first frame, last frame, and reference video.
- Selection panel exposes model, ratio, duration, resolution, style, motion, and reference controls.

**MjImage**

- Uses the Image visual body and aspect-ratio system.
- Retains provider-specific actions and status in its toolbar and task-panel content.

### 7.3 Configuration Nodes

**ImageConfigV2** and **VideoConfigV2**

- Default body shows a concise configuration identity, model, and readiness state.
- Full parameter editing exists only in the shared task panel.
- Configuration nodes do not imitate generated media when no media output exists.

### 7.4 Processing Nodes

**VideoCompose**, **SuperResolution**, and **MuxAudioVideo**

- Body focuses on input readiness, processing state, and output preview.
- Progress occupies a stable overlay strip and never expands node height.
- Input-slot details and execution controls open in the shared task panel.

### 7.5 Compatibility Node

**MigratedNode**

- Neutral placeholder appearance with the original type identifier.
- Clear migration, inspection, and removal actions.
- Must not visually imply that the node is executable when its contract is unsupported.

## 8. Toolbar Rules

- Toolbar contents are derived from node capabilities rather than one global action list.
- High-frequency actions remain visible; low-frequency actions move into a more menu.
- Image actions may include framing, lighting, lens, enhancement, crop, rotate, and export where supported.
- Video actions may include preview, crop, frame extraction, enhancement, and export where supported.
- Character actions may include upload, asset selection, appearance generation, and more actions.
- Toolbars use icons with tooltips and stable button dimensions.

## 9. Zoom-Level Degradation

The canvas progressively removes detail without changing node geometry:

- High zoom: full title, essential metadata, signal labels, and selected overlays.
- Medium zoom: shortened title, signal icons and counts, simplified status.
- Low zoom: media silhouette or color-coded body, essential state marker, and selected outline only.

Task panels and toolbars remain screen-readable while active and are positioned from the selected node's screen-space bounds.

## 10. Performance Architecture

- Keep node components memoized around stable, minimal selectors.
- Mount one shared toolbar and one shared task-panel host for the current selection.
- Avoid per-node observers, timers, animated carousels, and permanently decoded thumbnails.
- Use visibility-aware media loading and existing canvas virtualization/culling mechanisms.
- Precompute aspect-ratio dimension classes.
- Keep hover state local to the interaction layer where possible to avoid graph-wide store updates.
- Animate opacity and transform only; do not animate node width, height, or layout properties during interaction.
- Respect reduced-motion preferences.

## 11. Accessibility and Input

- Every toolbar and signal action must be keyboard reachable when its node is selected.
- Focus order moves from node body to toolbar, signal carousel, and task panel.
- Icons require accessible names and hover tooltips.
- Selected, running, completed, and failed states cannot depend on color alone.
- Task-panel controls retain usable touch targets without using oversized decorative controls.

## 12. Error and Loading States

- Media loading uses a stable skeleton with the final aspect-ratio dimensions.
- Missing local assets show a recoverable empty state without collapsing the node.
- Failed generation shows a compact failure marker and retry action; full error details appear in the task panel.
- Unsupported migrated nodes expose their limitation explicitly.
- Signal thumbnails that fail to decode fall back to a typed placeholder while preserving the signal count.

## 13. Verification

Implementation verification must cover:

- Visual snapshots for Character, Image, and Video in default, hover, and selected states.
- All supported image ratios and representative video ratios.
- Shared task-panel width and positioning for narrow and wide node bodies.
- Signal carousel empty, single-input, multi-input, and failed-thumbnail states.
- Toolbar capability mapping for all 13 node types.
- No node-body size change when overlays open or close.
- Interaction and drag responsiveness on a representative graph approaching 2,000 nodes.
- Keyboard access, reduced motion, and light-theme contrast.

## 14. Out of Scope

- Changes to model-provider request contracts.
- New node types or connection-matrix behavior.
- Direct reuse of external application source code or assets.
- Enterprise team or collaboration features.
- A redesign of non-canvas application pages.
