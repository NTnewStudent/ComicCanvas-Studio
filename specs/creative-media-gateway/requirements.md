# Requirements - Creative Media Gateway

## Introduction

ComicCanvas SHALL provide a system-built-in `creative_media` gateway for the
locally installed canvas. It provides OpenAI-format text chat, image generation,
and video generation through renderer- and Agent-safe `GatewayRequest` values.
Vendor-specific paths, payload fields, and task protocols remain in the main
process.

First-party profiles in scope are `openai_chat`, `nano_banana`, `seedream`,
`seedance`, and `kling`. A future `newapi` template is explicitly out of scope:
it will be a distinct gateway type with independent contracts.

## Glossary

- **Creative Media Gateway**: The built-in `creative_media` gateway type.
- **Model route**: A configured channel, model key, and protocol profile.
- **Protocol profile**: An allowlisted request/result translator, such as
  `seedance` or `kling`.
- **Normalized request**: `GatewayRequest`, including prompt, references,
  parameters, model key, and idempotency key.
- **Reference**: A resolved asset URL tagged as general, style, first-frame, or
  last-frame input.

## Requirements

### Requirement 1: Built-in Gateway Identity And Configuration

**User Story:** As a creator, I want one system-built-in media gateway that I
can configure with an endpoint, key, and model routes, so that canvas nodes use
text, image, and video models without vendor-specific controls.

#### Acceptance Criteria

1. WHEN gateway settings are first initialized THE system SHALL expose one
   disabled `creative_media` configuration named `Creative Media Gateway`.
2. WHEN the user saves this configuration THE system SHALL retain its base URL,
   enabled state, safe key reference, and model routes without returning the
   secret to the renderer.
3. WHEN a route is saved THE system SHALL require a unique `(channel, modelKey)`
   pair and a profile compatible with that channel.
4. IF a configuration is disabled, its secret is unavailable, or no matching
   route exists THEN THE system SHALL reject the request before a remote call.
5. WHEN this configuration changes THE system SHALL hot-reload future jobs while
   allowing in-flight jobs to retain their original provider instance.

### Requirement 2: Unified Model Routing

**User Story:** As a creator, I want several text, image, and video models in
one built-in gateway, so that each node selects a model with a known protocol.

#### Acceptance Criteria

1. WHEN the renderer requests the model catalog THE system SHALL expose every
   enabled route as a renderer-safe model option with its channel capabilities.
2. WHEN a job selects a model key THE registry SHALL resolve the matching route
   and SHALL invoke that route's profile instead of guessing from model text.
3. IF a model key is not configured for the requested channel THEN THE system
   SHALL return `capability_unsupported` without a provider request.
4. FOR ALL configured routes, the renderer catalog SHALL NOT include keys,
   authorization headers, internal paths, or raw profile payloads.

### Requirement 3: OpenAI-Format Text

**User Story:** As a creator or Agent, I want built-in text models to use the
OpenAI chat format, so that normal chat, streaming, and native tool calls work.

#### Acceptance Criteria

1. WHEN an `openai_chat` route receives text THE system SHALL submit
   `POST /v1/chat/completions` with normalized messages, model, and only
   allowlisted text parameters.
2. WHEN streaming is requested without native tools THE system SHALL forward
   ordered deltas through the worker context and return the assembled text.
3. WHEN native tool definitions are present THE system SHALL preserve valid
   OpenAI tool calls and SHALL not synthesize a tool response.
4. IF a response has neither text nor valid tool calls THEN THE system SHALL
   return `provider_payload_invalid`.

### Requirement 4: Image Protocol Adapters

**User Story:** As a creator, I want image nodes to use prompt, size,
resolution, and references, so that Nano Banana and Seedream need no private UI.

#### Acceptance Criteria

1. WHEN an image request targets `nano_banana` THE system SHALL construct only
   its allowlisted payload, including model, prompt, one output, normalized
   size, and `images` only when references exist.
2. WHEN an image request targets `seedream` THE system SHALL construct only its
   allowlisted payload, including model, prompt, profile-defined size or
   resolution, response format, and its accepted reference-image shape.
3. WHEN a request includes references THE adapter SHALL use only non-empty image
   URLs whose roles are valid for image conditioning.
4. IF size or resolution is invalid for a profile THEN the adapter SHALL use its
   documented safe default and SHALL not pass the value upstream.
5. FOR ALL image profiles, arbitrary `GatewayRequest.parameters` keys SHALL be
   dropped unless explicitly allowlisted by that profile.

### Requirement 5: Seedance And Kling Video Protocols

**User Story:** As a creator, I want one video node interface for Seedance and
Kling, so that text/reference/frame video work as durable local jobs.

#### Acceptance Criteria

1. WHEN a `seedance` route receives video THE system SHALL map prompt, duration,
   ratio, resolution, and references to its allowlisted metadata content shape.
2. WHEN a `kling` route receives video THE system SHALL choose text-to-video or
   image-to-video from normalized references and SHALL map only supported
   duration, aspect ratio, and optional tail-frame inputs.
3. WHEN either profile accepts a remote task THE worker SHALL poll its status
   endpoint with backoff, cancellation checks, and progress updates until a
   terminal result or timeout.
4. WHEN a video task completes THE provider SHALL fetch media bytes and SHALL
   return normalized `assetBytes`; the job pipeline SHALL store the local asset
   and emit its existing terminal IPC event.
5. IF a remote task fails, has an unknown terminal shape, or times out THEN THE
   system SHALL report a classified failure and SHALL finish the local job.

### Requirement 6: Safety And Boundaries

**User Story:** As an operator, I want media integrations to be observable
without leaking credentials or making the Agent provider-specific.

#### Acceptance Criteria

1. WHEN profiles submit or poll THE system SHALL redact credentials from errors,
   logs, and persisted diagnostics.
2. WHEN diagnostics retain a request snapshot THE system SHALL store only a
   redacted allowlisted snapshot, never authorization headers or plaintext keys.
3. FOR ALL CanvasPlan, IPC, and renderer contracts, THE system SHALL NOT expose
   raw vendor bodies, arbitrary endpoint overrides, executable mapping code, or
   provider credentials.
4. WHERE a future NewAPI template is added, THE system SHALL implement it as a
   distinct gateway type with separate contracts and tests.

## Correctness Properties

### INV-1: Route-Profile Compatibility

*For every* configured creative-media route, THE system SHALL invoke exactly
one profile compatible with its configured channel.

**Validates:** Requirements 1.3, 2.2, 2.3.

### INV-2: Renderer-Safe Boundary

*For all* gateway views, catalogs, IPC responses, and Agent plans, THE system
SHALL exclude plaintext secrets, authorization headers, and raw vendor payloads.

**Validates:** Requirements 1.2, 2.4, 6.1-6.3.

### INV-3: Declarative Media Inputs

*For all* image and video runs, THE provider payload SHALL be derived solely
from normalized prompt, references, allowlisted parameters, and its route.

**Validates:** Requirements 4.1-4.5, 5.1-5.2, 6.3.

### INV-4: Asynchronous Video Completion

*For every* Seedance or Kling video generation, THE renderer-facing enqueue
operation SHALL return before remote completion and final media SHALL arrive
only through the existing local job terminal lifecycle.

**Validates:** Requirements 5.3-5.5.
