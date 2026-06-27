# Requirements - hjwall Assets + Workflows 100% Migration

## Introduction

This spec replaces the earlier broad canvas migration plan with a stricter
sequence:

1. Migrate hjwall `assets` and `workflows/workflow-canvas` user capabilities
   into ComicCanvas with UI parity and local-first Electron architecture.
2. Add Agent orchestration only after the asset/workflow product surface is
   complete.
3. Evolve the completed workflow editor into an infinite canvas foundation.

Reference code is read-only. Do not copy hjwall source files into ComicCanvas.
Re-implement the capabilities using ComicCanvas contracts, SQLite repositories,
IPC, local jobs, storage providers, and React/Tailwind UI.

Canvas behavior must be tool-first: every durable manual canvas capability that
an Agent will later need SHALL be backed by a shared service/tool contract, with
the renderer acting as one caller of the same semantics instead of the only
implementation path.

## Scope

- hjwall C-side asset module:
  - `hjwall/pc-client/src/modules/asset/**`
  - `hjwall/backend/src/modules/asset/**`
- hjwall C-side workflow module:
  - `hjwall/pc-client/src/modules/workflow-canvas/**`
  - `hjwall/backend/src/modules/workflow/**`
- hjwall task references for feature behavior and acceptance style:
  - `hjwall/task/REQ-007`, `REQ-071`, `REQ-081`, `REQ-099`
  - `hjwall/task/REQ-072`, `REQ-0761`, `REQ-077`, `REQ-078`, `REQ-079`
  - `hjwall/task/REQ-080`, `REQ-082`, `REQ-083`, `REQ-088`, `REQ-089`
  - `hjwall/task/REQ-096`, `REQ-097`, `REQ-098`, `REQ-100` through `REQ-105`
  - `hjwall/task/REQ-110`, `REQ-112`

## Non-Goals

- Do not migrate hjwall CMS/admin workflow template pages in this phase unless
  required by C-side template listing/copying.
- Do not add Agent-first behavior before asset/workflow parity is complete.
- Do not replace ComicCanvas local SQLite/jobs/IPC with hjwall's NestJS/COS
  runtime model.
- Do not implement real third-party gateway details beyond existing provider
  abstractions and stub/test adapters.
- Do not implement Seedance or any real-person/liveness-auth asset system in the
  local version. Related hjwall UI/backend flows are reference-only and ignored
  for Phase A.
- Do not accept renderer-only graph behavior for durable canvas operations that
  Agents will later need to query, plan, mutate, run, or recover.

## Glossary

- **Asset Library**: The user-facing library for uploads, generated assets,
  user-defined image categories, folders, preview, search, filters, and canvas
  insertion. hjwall's role/scene/prop/creature concepts are adapted as image
  asset categories/tags, not separate semantic resource entities.
- **Workflow Project**: A named canvas workspace with graph versions, cover,
  node/edge counts, latest run state, default style, and chat/run history.
- **Workflow Template**: A public or copied workflow graph that can be listed,
  previewed, copied, imported, exported, and used as a starting point.
- **Canvas Graph**: The persisted node/edge/viewport snapshot.
- **Production Node Set**: `text`, `image`, `video`, `character`, `scene`,
  `audio`, `imageConfig`, `imageConfigV2`, `videoConfig`, `videoConfigV2`,
  `videoCompose`, `superResolution`, and `muxAudioVideo`. `mjImage` remains a
  legacy graph-compatible type only and is not implemented or reviewed in local
  Phase A.
- **Human Desktop Review**: Human approval of visible desktop UI flows. Codex
  prepares implementation, automated evidence, and review checklists.

## Current ComicCanvas Gap Summary

Current ComicCanvas has foundations for local assets, folders, graph save/load,
workflow list/create/rename/delete/import/export, snippets, V2 image/video nodes,
style presets, migrated node contracts, and partial plan/run wiring.

Compared with hjwall, it is still missing or partial in these areas:

- Asset UI does not yet match hjwall's asset page details: upload progress,
  URL query-synced tabs, date filters, batch mode, rename/delete UX, preview
  modal parity, custom category management, and category-based insertion flows.
- Asset backend lacks full image category/tag records, category-scoped listing,
  category CRUD, and complete node/job reference wiring.
- Workflow project list is simpler than hjwall: no public template tab parity,
  cover behavior parity, run status/card metadata parity, copy-template flow
  parity, or import/copy error details parity.
- Workflow canvas UI is partial and has mojibake comments, simplified panels,
  missing hjwall edge components, incomplete toolbar/menu visual parity,
  missing image edit/inpaint modals, incomplete character/style/asset library
  side panels, and incomplete bottom input/run panels.
- Production node set exists in shared contracts but many nodes are generic
  `MigratedNode` placeholders rather than hjwall-level node UI and behavior.
- Workflow runtime is missing hjwall parity for graph compiler/validator,
  lenient draft save vs strict run validation, node definitions, generation
  task recovery, polish task recovery, URL resigning, workflow run history,
  snippet template detail/delete parity, and template admin-like lifecycle where
  needed for public templates.
- Agent orchestration exists but must be frozen behind the migration. It should
  consume the completed asset/workflow vocabulary later, not drive the first
  migration phase.
- Infinite canvas is not yet a separate architectural target: viewport,
  virtualization, state ownership, minimap, interaction performance, and large
  graph persistence must be designed after hjwall parity.

## Requirements

### Requirement 1: Evidence-Based Module Inventory

**User Story:** As a product owner, I want a complete capability inventory for
hjwall assets and workflows, so that "100% migration" is measurable.

#### Acceptance Criteria

1. WHEN migration starts THE spec SHALL map every accepted hjwall asset/workflow
   capability to a ComicCanvas requirement and implementation owner.
2. WHEN a hjwall task document describes behavior THE migration task SHALL cite
   the corresponding `hjwall/task/REQ-*` reference.
3. IF a hjwall behavior conflicts with ComicCanvas local-first rules THEN THE
   task SHALL record the adapted behavior and reason.
4. FOR ALL completed requirements THE evidence SHALL include implementation
   files, automated tests, and human desktop review status.

### Requirement 2: Asset Page UI Parity

**User Story:** As a creator, I want the ComicCanvas asset page to match hjwall's
asset library interactions, so that uploaded and generated materials are easy
to browse, preview, manage, and reuse.

#### Acceptance Criteria

1. WHEN the user opens `/assets` THE renderer SHALL show hjwall-equivalent type
   tabs for all, image, video, audio, and character with counts.
2. WHEN the type tab changes THE URL query parameter SHALL reflect the selected
   tab and invalid values SHALL fall back to all.
3. WHEN the user searches, sorts, filters by date, or scrolls THE asset grid
   SHALL preserve responsive layout, loading states, empty states, error states,
   and infinite/page loading behavior.
4. WHEN files are uploaded THE UI SHALL show multi-file progress, per-file
   names, busy states, success refresh, and readable errors.
5. WHEN batch mode is enabled THE UI SHALL support multi-select, select toggle,
   batch delete confirmation, and state reset after mode exit.
6. WHEN a user opens an asset THE system SHALL show a preview modal matching
   media type, metadata, rename/delete actions, and safe URL rendering.

### Requirement 3: Custom Image Asset Categories

**User Story:** As a creator, I want role, scene, prop, creature, and any other
asset group to be custom image categories, so that I can organize visual
references without maintaining separate semantic entity systems.

#### Acceptance Criteria

1. WHEN the user opens asset categories THE UI SHALL show built-in starter
   categories for role, scene, prop, and creature, plus user-created categories.
2. WHEN the user creates or edits a category THE system SHALL persist category
   name, optional description, color/icon, ordering, and enabled/deleted state.
3. WHEN an image asset is assigned to one or more categories THE system SHALL
   preserve it as an ordinary image asset with category/tag metadata.
4. WHEN filtering assets THE UI SHALL support category, tag, keyword, sort, and
   media-type filters without requiring separate role/scene/prop/creature tables.
5. WHEN a categorized image is inserted into the canvas THE user SHALL choose
   whether it becomes an image node, character node, scene node, or reference
   input based on canvas context.
6. IF a categorized image is referenced by a canvas node THEN safe delete SHALL
   block or tombstone according to the asset reference policy.

### Requirement 4: Asset Backend and Reference Integrity

**User Story:** As a creator, I want asset data to remain safe and reusable, so
that generated and imported media can survive save/reopen, cloud sync, and node
references.

#### Acceptance Criteria

1. WHEN an asset is imported THE system SHALL persist media type, mime, size,
   hash, dimensions, orientation, duration when available, safe local path, and
   optional cloud URL/key.
2. WHEN a generated node finishes THE system SHALL create or update asset
   records and asset references in one recoverable workflow.
3. WHEN a node selects an asset THE repository SHALL record a node reference.
4. WHEN an asset is moved, trashed, or force-tombstoned THE UI and repository
   SHALL enforce reference integrity.
5. FOR ALL renderer-visible asset URLs THE value SHALL be `cc-asset://` or an
   approved normalized cloud URL, never an absolute local path.

### Requirement 5: Workflow Project List and Template Parity

**User Story:** As a creator, I want a hjwall-like workflow project home, so
that I can create, open, delete, import, export, and copy templates before
entering the canvas.

#### Acceptance Criteria

1. WHEN the user opens `/projects` or the workflow home THE UI SHALL show "my
   projects" and public/template tabs with hjwall-equivalent cards.
2. WHEN a project card is shown THE card SHALL include cover, name, node count,
   edge count, latest run status, updated time where available, and delete
   affordance.
3. WHEN creating a project THE system SHALL create a workflow row and initial
   graph version in a transaction.
4. WHEN importing JSON THE system SHALL parse, sanitize, reject absolute asset
   paths/secrets, report dropped items, and open the imported project.
5. WHEN copying a public template THE system SHALL create a private draft and
   open it.
6. WHEN deleting a project THE UI SHALL require confirmation and perform a soft
   delete without losing historical references unexpectedly.

### Requirement 6: Workflow Persistence, Versions, and Validation

**User Story:** As a creator, I want workflow drafts to save reliably while
runtime validation remains strict, so that editing never loses work but running
still catches invalid configuration.

#### Acceptance Criteria

1. WHEN saving a graph THE system SHALL create immutable graph versions and
   update workflow summary metadata.
2. WHEN draft saving encounters unavailable model/style/asset references THE
   save SHALL downgrade recoverable issues to warnings.
3. WHEN running, exporting as template, or explicitly validating THE system
   SHALL use strict validation.
4. WHEN loading a graph THE serializer SHALL drop invalid edges through
   `shared/connection-matrix.ts` and report warnings.
5. WHEN workflow versions are listed THE UI or service SHALL expose recent
   version metadata sufficient for restore/debug.

### Requirement 7: Canvas Shell and Interaction UI Parity

**User Story:** As a creator, I want the canvas shell to match hjwall's workflow
editor, so that node creation, navigation, shortcuts, and panels feel complete.

#### Acceptance Criteria

1. WHEN the canvas opens THE UI SHALL show top bar, back/save/import/export,
   theme toggle, balance/task controls where applicable, left quick toolbar,
   panels, minimap, controls, and background behavior.
2. WHEN adding nodes THE canvas SHALL support quick toolbar, plus-menu,
   context-menu add-at-cursor, command palette, and connect-to-create.
3. WHEN using shortcuts THE canvas SHALL support undo, redo, save, duplicate,
   delete, fit view, pan/select mode, and command palette without interfering
   with editable fields.
4. WHEN files are dropped onto the canvas THE system SHALL import supported
   image/video/audio files and create matching nodes at the drop point.
5. WHEN selection changes THE UI SHALL support multi-node duplicate/delete,
   snippet save, related-node highlight, and clean feedback.
6. WHILE the canvas is open THE renderer SHALL not use interval polling for
   generated asset status; recovery is event-driven or one-shot.

### Requirement 8: Edge Types and Connection Semantics

**User Story:** As a creator, I want all graph connections to carry the same
meaning as hjwall, so that prompt order, image order, frame role, output links,
and references are deterministic.

#### Acceptance Criteria

1. FOR ALL edge creation paths THE renderer and main process SHALL use the same
   shared connection matrix.
2. WHEN text connects to generation nodes THE edge SHALL support prompt order.
3. WHEN images connect to image generation nodes THE edge SHALL support image
   order. MJ-specific image ordering is out of scope for local Phase A.
4. WHEN images or visual semantic nodes connect to video generation THE edge
   SHALL support first-frame, last-frame, and input-reference roles where
   applicable.
5. WHEN output nodes connect to asset/output nodes THE edge SHALL use output
   link semantics.
6. WHEN semantic references connect THE edge SHALL use reference semantics.
7. IF a connection is invalid or duplicated THE UI SHALL reject it with Chinese
   feedback within 200ms.

### Requirement 9: Production Node UI Parity

**User Story:** As a creator, I want every hjwall workflow node to exist as a
production ComicCanvas node, so that the workflow surface is not a placeholder.

#### Acceptance Criteria

1. FOR ALL production node types THE implementation SHALL include shared data,
   renderer component, serializer support, connection behavior, run support or
   explicit unavailable state, and tests.
2. WHEN editing text nodes THE UI SHALL include inline content, focus modal,
   rich text/polish controls, mention chips, and prompt contribution preview.
3. WHEN editing image/video/config nodes THE UI SHALL include prompt, model,
   style, ratio, references, media pickers, result/status area, and run buttons.
4. WHEN editing character/scene nodes THE UI SHALL include structured fields,
   views/assets, library insertion hooks, and prompt contribution behavior.
5. WHEN editing audio/videoCompose/superResolution/muxAudioVideo nodes THE UI
   SHALL include parameters, inputs, outputs, run state, and asset writeback.
   MJ node/component implementation is out of scope for local Phase A.
6. IF a node is visible in add menus THEN its runtime support SHALL be real or
   the node SHALL be visibly marked unavailable.

### Requirement 10: Image Editing, Inpaint, Media Picking, and Prompt Panels

**User Story:** As a creator, I want hjwall's detailed media editing controls,
so that I can refine assets and prompts without leaving the workflow.

#### Acceptance Criteria

1. WHEN an image is selected THE UI SHALL support editor modal behavior for crop,
   rotate, orientation/aspect preview, and apply.
2. WHEN inpaint is supported THE UI SHALL show image inpaint modal behavior or
   mark it unavailable with clear explanation.
3. WHEN a node needs media THE UI SHALL provide node asset picker modal and
   media input controls for images/videos/audio.
4. WHEN connected inputs are displayed THE panel SHALL show compact chips,
   deterministic prompt preview, reference assets, and convergence behavior.
5. WHEN writing prompts THE mention textarea SHALL show character/image chips,
   preserve storage format, support IME, and keep dropdown near the caret.

### Requirement 11: Workflow Runtime and Async Task Parity

**User Story:** As a creator, I want all generation-like workflow actions to be
asynchronous and recoverable, so that long work does not freeze or disappear.

#### Acceptance Criteria

1. WHEN any node run is triggered THE IPC handler SHALL enqueue and return a
   ticket without waiting for generated bytes.
2. WHEN image/video/scene/character-view/compose/mux/super-resolution/polish
   jobs complete THE system SHALL persist terminal state and update graph nodes.
3. WHEN the app reopens THE canvas SHALL reconcile missed terminal tasks once.
4. WHEN a URL can expire THE system SHALL support safe re-sign or safe URL
   refresh through local storage/provider policy.
5. WHEN run history is opened THE UI SHALL show workflow run details, per-node
   status, errors, outputs, and recovery states.

### Requirement 12: Snippets, Templates, Import/Export

**User Story:** As a creator, I want reusable workflow fragments and templates,
so that I can build complex workflows from saved pieces.

#### Acceptance Criteria

1. WHEN multiple nodes are selected THE user SHALL be able to save the internal
   subgraph as a private snippet/template with normalized coordinates.
2. WHEN inserting a snippet THE system SHALL remap node/edge IDs, preserve
   relative layout, validate edges, and create one undo snapshot.
3. WHEN snippets are listed THE UI SHALL show public/my scopes, names,
   thumbnails/metadata where available, and delete for owned snippets.
4. WHEN importing/exporting workflows THE JSON SHALL preserve supported
   workflow details without absolute paths or secrets.
5. WHEN copying public templates THE system SHALL create editable private
   drafts.

### Requirement 13: Style, Model, and Feature Flag Parity

**User Story:** As a creator, I want workflow nodes to use model/style choices
consistently, so that generated output follows project and node settings.

#### Acceptance Criteria

1. WHEN the canvas loads THE system SHALL load text/image/video/tool model lists
   and style presets for node controls.
2. WHEN a project default style is selected THE project SHALL persist it and
   nodes without overrides SHALL inherit it at runtime.
3. WHEN a node style override exists THE node SHALL use it over the project
   default.
4. WHEN node feature flags disable a type THE add menus and Agent/apply flows
   SHALL filter or mark the node unavailable.
5. WHEN prompt composition runs THE output SHALL be deterministic across preview
   and runtime payload generation.

### Requirement 14: Agent-After-Migration Boundary

**User Story:** As a creator, I want Agent orchestration added after workflow
and asset parity, so that the Agent operates on a stable product vocabulary.

#### Acceptance Criteria

1. UNTIL Requirements 2 through 13 are engineering-complete THE Agent migration
   SHALL remain in planning or guarded mode.
2. WHEN Agent work resumes THE CanvasPlan vocabulary SHALL match the completed
   production node and edge set.
3. WHEN Agent applies plans THE system SHALL use the same validation, snippet,
   layout, style, asset, and run semantics as manual UI flows.
4. IF a user asks for an unsupported workflow THEN the Agent SHALL clarify
   rather than fabricate nodes or hidden assumptions.

### Requirement 15: Tool-First Canvas Capability Layer

**User Story:** As an Agent/runtime developer, I want current and migrated
canvas actions exposed as typed tools, so that future Agent orchestration can
call the same capabilities that manual UI uses.

#### Acceptance Criteria

1. WHEN a manual canvas action mutates durable graph state THE system SHALL
   expose an equivalent typed tool or shared service operation for Agent use.
2. WHEN tools create/update/delete nodes or edges THE system SHALL reuse the
   same shared validation, connection matrix, default data, layout, asset,
   snippet, and style semantics as the renderer UI.
3. WHEN a tool runs generation, polish, compose, mux, or super-resolution work
   THE response SHALL be ticket-only and recovery SHALL follow the same job
   terminal writeback path as manual runs.
4. WHEN a tool could delete, overwrite, spend provider credits, or affect files
   THE descriptor SHALL declare permissions such as `destructive`,
   `provider.spend`, `canvas.write`, or `file.write`.
5. WHEN tools fail THE output SHALL use structured, recoverable error codes
   that the renderer and Agent can present or branch on.
6. WHEN an Agent discovers canvas capability THE ToolRuntime SHALL provide
   descriptors and schemas for graph, node, edge, selection, layout, snippet,
   asset, workflow, style, job, and media-edit operations that have shipped in
   manual UI.

### Requirement 16: Infinite Canvas Evolution

**User Story:** As a creator, I want the completed workflow editor to become an
infinite canvas, so that very large productions remain smooth and navigable.

#### Acceptance Criteria

1. AFTER asset/workflow parity THE design SHALL define graph state ownership,
   viewport model, virtualization, selection model, minimap, and persistence
   invariants for infinite canvas.
2. WHEN graph size grows THE renderer SHALL keep interactions responsive for
   large node counts using visible-only rendering and stable selectors.
3. WHEN panning/zooming THE canvas SHALL preserve precise cursor positioning,
   drop positioning, context-menu positioning, and connect-to-create behavior.
4. WHEN saving large graphs THE repository SHALL avoid blocking UI and SHALL
   preserve graph integrity.

## Correctness Properties

### INV-1: No Source Copying

For any migrated feature, ComicCanvas SHALL re-implement behavior without
copying hjwall source files.

### INV-2: Shared Graph Truth

For any edge or node persisted, applied, imported, copied, or generated, shared
contracts SHALL validate type and connection semantics.

### INV-3: Asset Safety

For any renderer-visible asset, persistence SHALL use safe relative/cloud fields
and renderer URLs SHALL be `cc-asset://` or approved normalized cloud URLs.

### INV-4: Draft Save vs Strict Run

For any workflow graph, draft save MAY preserve recoverable invalid references
as warnings, but run/template publish/explicit validate SHALL fail strictly.

### INV-5: Async-Only Generation

For any generation, polish, compose, mux, or super-resolution action, the
synchronous response SHALL contain only a ticket/status and no generated bytes.

### INV-6: UI Parity Gate

For any requirement marked accepted, human desktop review SHALL confirm the
visible UI flow, not only unit tests.

### INV-7: Agent Boundary

For any Agent plan, the plan SHALL only use asset/workflow capabilities already
available through manual UI and shared contracts.

### INV-8: Tool/UI Equivalence

For any durable canvas behavior, manual UI, IPC handlers, and Agent tools SHALL
delegate to shared service/tool semantics so validation and persistence do not
diverge.
