# Cloud Paper Canvas Node System Design

## Objective

Rebuild all 13 ComicCanvas node families as one coherent light production
system inspired by the supplied Xiaoyunque canvas reference. Nodes remain quiet
and media-first when idle. Selecting a node reveals its editing controls in a
separate rounded editor anchored beneath the node.

The redesign is renderer-only. Node data, graph persistence, connection rules,
Agent plans, jobs, assets, and IPC contracts remain unchanged.

## Approved Direction

- Visual family: compact production unit.
- Light palette: cloud paper white.
- Geometry: clear balanced spacing.
- Interaction: collapsed node plus selection-triggered editor.
- Scope: all 13 registered node types.

## Visual System

### Palette

| Role | Value | Usage |
| :--- | :--- | :--- |
| Canvas | `#F3F5F6` | Cool paper-gray infinite workspace. |
| Node | `#FFFFFF` | Primary node and editor surface. |
| Border | `#D9DEE2` | Node, editor, and compact control borders. |
| Divider | `#EAEDEF` | Internal rows and section separation. |
| Text | `#202428` | Titles, values, and primary controls. |
| Muted | `#727981` | Metadata, labels, and placeholders. |
| Success | `#28723D` | Completed state on `#E6F4EA`. |
| Action | `#25292D` | Primary action and connection ports. |

No gradient is used for structural UI. Media may retain its own color. Error,
warning, and running colors remain semantic accents rather than theme colors.

### Geometry And Elevation

- Node outer radius: `8px`.
- Preview and internal surface radius: `6px`.
- Selected editor radius: `24px` desktop, `18px` on constrained viewports.
- Header height: `40px`.
- Parameter row height: `30px`.
- Node horizontal padding: `10-12px`.
- Editor padding: `16-18px` with a `48px` action footer.
- Idle node shadow: none.
- Hover node shadow: `0 10px 26px rgba(32, 36, 40, 0.07)`.
- Selected node: two-pixel non-layout-shifting outline.
- Editor shadow: `0 18px 46px rgba(32, 36, 40, 0.08)`.

Typography uses Inter with the existing Chinese fallback stack. Titles are
`13px/600-650`, metadata and compact labels are `10-11px`, and editor input is
`13px`. Letter spacing remains zero.

## Node Anatomy

Every node uses the same structural order:

1. Compact header: type icon, title, metadata, status, overflow action.
2. Primary content: media preview, text summary, waveform, or processing input.
3. Optional summary rows: only the two or three values needed to scan the graph.
4. Source and target ports.
5. Selection-only editor anchored outside the persisted node dimensions.

The node body must not contain nested decorative cards. Information groups use
dividers, compact rows, and one primary preview surface.

## Selection Editor Pattern

### Lifecycle

1. Idle nodes show content and summary only.
2. Hover reveals nonessential icon actions without opening configuration.
3. Clicking a node selects it and mounts its editor beneath the node.
4. The editor is horizontally centered on the node, may be wider than the node,
   and is constrained to `min(760px, viewport - safe margins)`.
5. Clicking blank canvas, pressing Escape, deleting the node, or selecting a
   different node closes the editor.
6. Only one node editor can be open at a time.

The editor is renderer-local transient state. It is excluded from graph
snapshots, undo history, Agent context, and autosave.

### Editor Structure

- Optional top asset bar: upload, choose from asset library, or bind input.
- Main field: prompt, description, script, or processing summary.
- Footer controls: type-specific configuration options arranged as compact
  icon-plus-label controls.
- Footer end: status/cost indicator and one circular or compact primary action.
- Individual menus use existing popover behavior and remain keyboard accessible.

The editor is `nodrag` and `nowheel`; its internal text areas can scroll without
moving the canvas. The editor must not cover unrelated canvas regions when
closed.

## Node Family Adaptation

| Family | Collapsed node | Selection editor |
| :--- | :--- | :--- |
| Text | Title and text excerpt. | Full text, polish action, references. |
| Image | Media preview and source label. | Asset binding, crop/edit actions, references. |
| Video | Video poster and duration. | Asset binding, preview/download, metadata. |
| Image generation V2 | Result preview, model and ratio summary. | Prompt, references, model, style, ratio, resolution, generate. |
| Video generation V2 | Poster, duration and resolution summary. | Prompt, frames, references, model, style, ratio, duration, resolution, generate. |
| Character | Portrait, name and identity summary. | Description, tags, portrait asset and references. |
| Scene | Scene preview, category and location summary. | Description, category, asset and references. |
| Audio | Waveform/asset summary and duration. | Asset binding, generation settings and playback. |
| Video compose | Ordered input summary and output status. | Input ordering, transition and compose action. |
| Super resolution | Source poster and target resolution. | Source selection, scene, resolution, FPS and run action. |
| Audio/video mux | Video/audio input summary. | Input binding, model and mux action. |
| MJ image | Result preview and selected result. | Prompt, model settings, result selection and writeback. |
| Migrated semantic nodes | Type-specific summary. | Registry-driven fields and supported actions. |

## Interaction And Motion

- Editor enters with `opacity` and a maximum `4px` vertical translation over
  `140-180ms`; no spring scaling.
- Hover elevation is applied only to the hovered node.
- Status changes do not resize the node.
- Icon-only controls have an accessible name and tooltip.
- Reduced-motion users receive no translation or animated shadow.
- Connection handles animate only during an active connection gesture.

## Architecture

The renderer introduces shared compositional primitives rather than styling
every node independently:

- `NodeFrame`: white surface, border, selection and hover states.
- `NodeHeader`: type identity, title, metadata, status, actions.
- `NodePreview`: stable media/text content frame.
- `NodeSummaryRows`: compact scan values.
- `NodeSelectionEditor`: anchored selection-only editor shell.
- `NodeEditorFooter`: shared configuration and action footer.

Existing node components retain ownership of their callbacks and node-specific
fields. The shared primitives own presentation and editor lifecycle only.

## Performance Constraints

- No per-frame React state updates during pan, zoom, or drag.
- No node-wide store subscription for editor open state.
- Editor content mounts only for the selected node.
- Unchanged node object identities remain stable during drag.
- Closed editors produce no pointer-intercepting DOM overlay.
- Media uses lazy loading and stable dimensions.
- The 2,000-node acceptance case retains visible-only rendering.

## Verification

1. Component tests cover collapsed and selected states for every node family.
2. Existing run, asset, update, delete, and writeback callbacks retain their
   arguments and behavior.
3. Canvas interaction tests cover wheel zoom, drag, selection switching, Escape,
   blank-canvas close, and editor pointer isolation.
4. A populated desktop canvas screenshot verifies all node families together.
5. A constrained viewport screenshot verifies editor width and no overlap.
6. The focused 2,000-node performance gate remains green.

## Non-Goals

- No changes to shared node schemas or connection matrix.
- No new model settings or job types.
- No replacement of React Flow.
- No enterprise-team or collaboration features.
