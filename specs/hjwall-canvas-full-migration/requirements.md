# Requirements Document - hjwall Canvas Full Migration

## Introduction

This spec defines the migration of hjwall canvas product capabilities into
ComicCanvas Studio, excluding real third-party gateway request details. The
goal is not to copy hjwall source code. The goal is to re-implement the user
capabilities with ComicCanvas' local-first Electron, IPC, SQLite, job queue,
asset pipeline, and Agent orchestration contracts.

Scope:

- Canvas project and workflow management.
- Canvas interaction parity: nodes, connections, drag/drop, context menus,
  command palette, selection, snippets, undo/redo, autosave, and restore.
- Comic-drama node system: text, image, video, character, scene, audio,
  image generation, video generation, video compose, video enhance, mux, and
  multi-image generation where supported by local contracts.
- Style presets and style prompt injection.
- Asset library and in-canvas asset picking/placement.
- Agent orchestration over the canvas through declarative CanvasPlan.
- Verification from both automated tests and real desktop user flows.

Non-goals:

- Do not implement real model gateway provider requests in this spec.
- Do not copy hjwall source files into ComicCanvas.
- Do not add server-only Redis, BullMQ, WebSocket, COS-only, or browser
  assumptions that conflict with the local-first desktop architecture.
- Do not mark an area complete from backlog status alone; completion requires
  current implementation and runtime evidence.

## Glossary

- **hjwall Capability**: A user-visible behavior found in `hjwall/pc-client`
  or `hjwall/backend` that must be re-implemented, adapted, or explicitly
  rejected with rationale.
- **Canvas Project**: A named local workflow container with versions, graph
  snapshots, assets, default style, and chat history.
- **Canvas Graph**: The persisted node/edge/viewport snapshot for one workflow.
- **Semantic Node**: Character, scene, or audio node used by comic-drama
  production but not limited to text/image/video primitive nodes.
- **Generation Config Node**: A node that configures async generation and
  optionally embeds generated results, such as imageConfigV2 or videoConfigV2.
- **Style Preset**: A reusable visual style with prompt-before/prompt-after
  text, metadata, cover, ordering, enabled state, and reference assets.
- **Snippet**: A reusable selected subgraph saved from the canvas and later
  inserted with new IDs while preserving relative layout and internal edges.
- **Real Desktop Flow**: A manual or automated Electron run that verifies the
  feature in the packaged/development desktop shell, not only isolated unit
  tests.

## Requirements

### Requirement 1: Evidence-Based Migration Inventory

**User Story:** As a product owner, I want every hjwall canvas capability to be
inventoried before implementation, so that "full migration" means a concrete
set of user outcomes rather than a vague demo.

#### Acceptance Criteria

1. WHEN a migration phase starts THE PM spec SHALL list the hjwall reference
   files or modules used as design references.
2. WHEN a hjwall capability is accepted THE spec SHALL map it to a ComicCanvas
   REQ ID, target component/service, and verification evidence.
3. IF a hjwall behavior conflicts with ComicCanvas local-first rules THEN THE
   spec SHALL record the adapted behavior and the reason.
4. FOR ALL migrated capabilities THE implementation SHALL avoid direct source
   copying from `hjwall/` and SHALL preserve only independently authored code.

### Requirement 2: Workflow Project Lifecycle

**User Story:** As a creator, I want to create, rename, switch, delete, import,
export, and restore canvas projects, so that multiple comic-drama workflows can
be managed without losing work.

#### Acceptance Criteria

1. WHEN the user opens the project list THE renderer SHALL show local projects
   with name, updated time, node count, and latest status where available.
2. WHEN the user creates a project THE main process SHALL create a workflow row
   and an initial empty graph version in one repository-controlled operation.
3. WHEN the user switches projects THE current dirty graph SHALL be saved or
   explicitly discarded before loading the target graph.
4. WHEN the user renames or deletes a project THE renderer SHALL reflect the
   repository result without stale local state.
5. WHEN the user imports or exports a workflow JSON THE graph SHALL be validated
   through shared contracts and SHALL not contain absolute asset paths or API
   secrets.
6. IF a saved graph contains invalid edges THEN THE loader SHALL drop those
   edges through `shared/connection-matrix.ts` and report non-blocking warnings.

### Requirement 3: Canvas Interaction Parity

**User Story:** As a creator, I want hjwall-grade canvas interactions, so that
building and editing a workflow feels like a production tool.

#### Acceptance Criteria

1. WHEN the user adds nodes THE canvas SHALL support quick toolbar insertion,
   context-menu insertion at cursor position, and command-palette insertion.
2. WHEN the user drags a supported local media file onto the canvas THE system
   SHALL import the file through the asset pipeline and create the matching
   image, video, or audio node at the drop position.
3. WHEN the user connects compatible nodes THE canvas SHALL create the correct
   semantic edge type and data using one shared connection truth.
4. IF the connection is invalid or duplicated THEN THE canvas SHALL reject it
   and show a Chinese user-facing reason within 200ms.
5. WHEN the user selects multiple nodes THE canvas SHALL support batch delete
   and saving the selected internal subgraph as a reusable snippet.
6. WHEN the user inserts a snippet THE canvas SHALL remap node/edge IDs,
   preserve relative layout, and create one undo snapshot.
7. WHEN the user uses keyboard shortcuts THE canvas SHALL support undo, redo,
   save, duplicate, delete, fit view, pan/select mode, and command palette.
8. WHILE the canvas is open THE renderer SHALL not poll generated asset status
   with `setInterval` or fixed `refetchInterval`; job state is event-driven or
   one-shot reconciliation only.

### Requirement 4: Comic-Drama Node System

**User Story:** As a comic-drama creator, I want nodes for story text,
characters, scenes, image generation, video generation, audio, composition, and
enhancement, so that the canvas covers the real production chain.

#### Acceptance Criteria

1. THE shared node contract SHALL include every production node type supported
   by the migrated canvas and the connection matrix SHALL enumerate every
   allowed pair.
2. WHEN a text node is edited THE node SHALL support focus editing, inline
   rename, optional AI polish state, and deterministic prompt contribution.
3. WHEN image/video asset nodes display generated media THE renderer SHALL use
   safe `cc-asset://` or approved cloud URL fields and object-fit contain.
4. WHEN imageConfigV2 or videoConfigV2 runs THE node SHALL enqueue a local job
   and update its own status/result from terminal events or reconciliation.
5. WHEN a character or scene node is added THE node SHALL provide structured
   comic-drama fields, media references, and prompt contribution semantics.
6. WHEN an audio, videoCompose, superResolution, muxAudioVideo, or mjImage node
   is enabled THE graph serializer, validator, run dispatch, UI, and tests
   SHALL all support it as one vertical slice.
7. IF a node type is present in UI but not supported by runtime THEN THE node
   SHALL be visibly marked unavailable and SHALL not be advertised as complete.

### Requirement 5: Style Preset System

**User Story:** As a creator, I want project-level and node-level画风 control,
so that generated images and videos can keep a consistent comic-drama style.

#### Acceptance Criteria

1. WHEN the user opens the style library THE renderer SHALL list enabled style
   presets with name, cover, tags/category, and prompt summary.
2. WHEN the user selects a project default style THE workflow project SHALL
   persist that default and nodes without overrides SHALL inherit it at run
   time.
3. WHEN the user selects a node-level style THE node SHALL persist
   `stylePresetId` and override the project default for that run.
4. WHEN main composes a generation prompt THE style prompt-before and
   prompt-after parts SHALL be injected deterministically around the content.
5. IF a referenced style is deleted or disabled THEN save/load SHALL remain
   non-destructive, but run validation SHALL show a clear recoverable error.
6. FOR ALL style prompt composition THE same pure function SHALL be used by
   preview and main-process job payload generation.

### Requirement 6: Asset Library and Canvas Asset Use

**User Story:** As a creator, I want a local asset library that works inside
and outside the canvas, so that generated and imported materials can be reused
across workflows.

#### Acceptance Criteria

1. WHEN an asset is imported THE system SHALL copy or upload it through the
   configured asset pipeline, persist only safe relative/cloud fields, and
   classify media type.
2. WHEN an asset has width/height THE system SHALL store orientation as
   landscape, portrait, or square.
3. WHEN the user opens the asset panel THE renderer SHALL support folder tree,
   search, media-type filter, sort by time, move, trash, and insert-to-canvas.
4. WHEN an asset is referenced by a node or job THE repository SHALL preserve
   reference integrity for safe delete and force tombstone modes.
5. WHEN the user inserts an asset into the canvas THE new node SHALL carry the
   asset ID and render through the safe asset URL.
6. IF an asset exists only as an external URL THEN the runtime SHALL normalize
   it through the gateway/storage policy before treating it as reusable local
   asset evidence.

### Requirement 7: Workflow Run and Async State

**User Story:** As a creator, I want generation and composition to run
asynchronously without freezing the canvas, so that long image/video work is
recoverable and visible.

#### Acceptance Criteria

1. WHEN any node run is triggered THE IPC handler SHALL enqueue and return a
   ticket without waiting for model bytes.
2. WHEN a job completes or fails THE main process SHALL emit exactly one
   terminal event per job ID and persist the terminal result.
3. WHEN the renderer reopens a workflow THE canvas SHALL reconcile active or
   recently completed jobs once, then rely on terminal events for live updates.
4. WHEN a run step requires upstream prompts or assets THE main process SHALL
   compute the final prompt and references from a graph snapshot, not mutable
   renderer state.
5. IF a generation result lacks required metadata THEN the job SHALL fail with
   a classified recoverable error instead of producing an incomplete asset.

### Requirement 8: Agent Orchestration Over Migrated Canvas

**User Story:** As a creator, I want the built-in Agent to understand the full
migrated canvas vocabulary, so that natural language can create and run real
comic-drama workflows.

#### Acceptance Criteria

1. WHEN the user asks for a canvas workflow THE orchestrator SHALL produce a
   declarative CanvasPlan that can include supported migrated node types and
   legal edges only.
2. WHEN a CanvasPlan is received THE main process and renderer SHALL sanitize
   node types, edge types, run actions, and executable strings before applying.
3. WHEN the user applies a plan THE canvas SHALL insert the graph as one undo
   snapshot and show dropped-item warnings.
4. WHEN autoExecute is enabled THE PlanRunner SHALL execute run steps serially
   and stop on failure while leaving later steps manually runnable.
5. IF the user's request is under-specified THEN the Agent SHALL return a
   clarify plan rather than fabricating hidden assumptions.

### Requirement 9: User-Centered Completion Evidence

**User Story:** As a product owner, I want every migrated capability tested from
the user's perspective, so that the result is industrial software rather than
assembled demos.

#### Acceptance Criteria

1. FOR EACH REQ in this spec THE task file SHALL name automated tests and real
   desktop checks required before marking it complete.
2. WHEN a feature is marked complete THE evidence SHALL include current test
   output, inspected implementation files, and a user-flow result.
3. IF automated tests pass but the desktop UI is blank, inaccessible, or cannot
   complete the user flow THEN the requirement SHALL remain incomplete.
4. WHEN reference projects exist in the workspace THE repo hygiene check SHALL
   keep them out of commits.
5. FOR ALL new exported functions/classes and IPC/API handlers THE code SHALL
   include JSDoc and `@see docs/api-contracts/...` anchors.

## Correctness Properties

### INV-1: Migration Traceability

*For any* migrated hjwall capability, THE canonical specs SHALL map it to a
ComicCanvas requirement, implementation owner, and verification evidence.

**Validates:** Requirements 1 and 9.

### INV-2: Connection Truth

*For any* persisted or applied canvas edge, THE edge SHALL be accepted by the
shared connection matrix or dropped with a recorded reason.

**Validates:** Requirements 2.6, 3.3, 3.4, 4.1, 8.2.

### INV-3: Prompt Determinism

*For any* graph snapshot, THE prompt preview and main-process job payload SHALL
produce byte-equivalent text contributions and deterministic style injection.

**Validates:** Requirements 4.2, 5.4, 5.6, 7.4.

### INV-4: Async-Only Generation

*For any* image, video, polish, composition, enhancement, or mux run, THE
renderer-facing synchronous response SHALL contain only a ticket/status and no
generated bytes, absolute paths, or provider temporary URLs.

**Validates:** Requirements 4.4 and 7.

### INV-5: Asset Safety

*For any* renderer-visible asset, THE value SHALL be a safe protocol URL or an
approved normalized cloud URL, and DB persistence SHALL avoid absolute local
paths.

**Validates:** Requirements 4.3 and 6.

### INV-6: User-Flow Completeness

*For any* requirement marked complete, THE evidence SHALL prove the user can
perform the intended workflow in the desktop app, not only that a helper unit
test passes.

**Validates:** Requirement 9.
