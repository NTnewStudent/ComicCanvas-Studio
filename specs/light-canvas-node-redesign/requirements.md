# Requirements - Light Canvas Node Redesign

## Introduction

ComicCanvas SHALL replace its dark, card-heavy canvas presentation with a light
gray production workbench. The redesign covers canvas chrome, node surfaces,
typography, handles, status feedback, and hover interactions while retaining
existing graph, Agent, job, and asset behavior.

## Glossary

- **Workbench**: Canvas background, controls, minimap, and side actions.
- **Node primitive**: Shared frame, header, status, action, and handle styling.
- **Interactive state**: Default, hover, selected, running, completed, failed.

## Requirements

### Requirement 1: Light Workbench

**User Story:** As a creator, I want a quiet light canvas workspace, so that I
can scan a dense production graph without visual noise.

#### Acceptance Criteria

1. WHEN the canvas renders THE system SHALL use a light-gray background and
   low-contrast grid without a dark full-canvas surface.
2. WHEN viewport controls, minimap, or side actions render THE system SHALL use
   compact white tool surfaces with restrained borders and familiar icons.
3. WHILE the user pans, zooms, or drags nodes THE system SHALL preserve existing
   interaction and performance behavior.

### Requirement 2: Shared Node Visual Language

**User Story:** As a creator, I want every node to share a visual language, so
that mixed text, image, video, and production nodes remain easy to scan.

#### Acceptance Criteria

1. FOR ALL canvas nodes, THE system SHALL use white surfaces, 6-8px corners,
   one-pixel low-contrast borders, and no idle elevation shadow.
2. WHEN a node is hovered THE system SHALL show restrained elevation and only
   actions relevant to that node.
3. WHEN a node is selected THE system SHALL apply a clear non-layout-shifting
   selection outline.
4. FOR ALL node titles and metadata, THE system SHALL use compact system type
   with titles at 13px and metadata at 11px.
5. FOR ALL node interiors, THE system SHALL avoid nested card styling and SHALL
   use media-first previews, dividers, and compact rows.

### Requirement 3: Interaction And State Consistency

**User Story:** As a creator, I want predictable controls and generation states,
so that I can manipulate a large graph without hunting through inconsistent UI.

#### Acceptance Criteria

1. WHEN a node is not hovered or selected THE system SHALL hide nonessential
   actions without preventing existing keyboard or contextual actions.
2. WHEN an icon-only control is visible THE system SHALL provide an accessible
   name and hover tooltip.
3. WHEN a job runs, completes, or fails THE system SHALL use shared status
   treatment and SHALL preserve current status data and callbacks.
4. FOR ALL source and target handles, THE system SHALL use compact circular
   ports and SHALL not change the shared connection matrix.

### Requirement 4: Safe Migration

**User Story:** As an operator, I want styling changes to preserve production
behavior, so that visual work does not regress Agent plans or media jobs.

#### Acceptance Criteria

1. WHEN the redesign is applied THE system SHALL NOT change node data,
   connection rules, job descriptors, IPC contracts, or Agent plan actions.
2. WHEN existing node tests run THE system SHALL preserve semantic controls and
   callback behavior.
3. WHILE the canvas contains approximately 2,000 nodes THE system SHALL avoid
   global per-frame updates, measurement loops, or effects that re-render all
   nodes during drag.

## Correctness Properties

### INV-1: Shared Surface Consistency

*For all* registered canvas node types, THE rendered root SHALL use a shared
node-frame primitive or equivalent shared node-frame class.

**Validates:** Requirements 2.1-2.4.

### INV-2: Behavioral Preservation

*For all* existing node run, asset, and graph callbacks, THE redesign SHALL
preserve input arguments and terminal-state writeback behavior.

**Validates:** Requirements 3.3, 4.1-4.2.

### INV-3: Large-Graph Safety

*For all* visual state changes, THE system SHALL use CSS state selectors or
localized React state and SHALL NOT introduce a global per-frame canvas update.

**Validates:** Requirements 1.3, 4.3.
