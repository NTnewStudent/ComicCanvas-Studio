# Requirements - Infinite Canvas + Agent + Gateway Binding Architecture

## Introduction

This spec is the global architecture roadmap for ComicCanvas as an infinite
canvas product with Agent orchestration and extensible third-party gateway
binding.

The target product evolves in three stages:

1. **Early stage:** creators manually add nodes, connect nodes, configure node
   data, and run nodes on a workflow canvas.
2. **Middle stage:** a general Agent analyzes user needs, creates a CanvasPlan,
   opens sub-agents where useful, and calls tools to create/connect/update/run
   nodes.
3. **Later stage:** nodes declare dynamic input/output ports and runtime
   bindings so custom gateways can map node data to provider payloads and map
   provider results back to node outputs without hard-coding every provider in
   node code.

This spec coordinates existing specs:

- `specs/hjwall-assets-workflows-100-migration/`
- `specs/conversation-context-engine/`
- `specs/canvas-agent-orchestration/`
- `docs/api-contracts/gateway-providers.md`
- `docs/api-contracts/tools-agents.md`
- `docs/api-contracts/canvas-plan.md`

## Scope

- Infinite canvas graph architecture.
- Manual canvas operations and Tool/UI equivalence.
- Agent planning, sub-agent execution, and tool orchestration.
- Node definition protocol: node data schema, UI schema, input ports, output
  ports, runtime actions.
- Runtime compiler from graph/node state into normalized execution requests.
- Dynamic gateway binding protocol for custom gateways.
- Output binding from gateway results back to node data, assets, and downstream
  ports.

## Non-Goals

- Do not implement Seedance/real-person/liveness-auth systems in the local
  version.
- Do not let Agent or gateway code bypass ToolRuntime, JobQueue, or repository
  boundaries.
- Do not put provider-specific payloads inside CanvasPlan.
- Do not hard-code every gateway's parameter mapping inside React node
  components.
- Do not make infinite canvas a cosmetic zoom/pan feature only; persistence,
  selection, layout, performance, and graph operations must be designed.
- Do not expose third-party gateway secrets to renderer, logs, Context Packs, or
  node data.

## Glossary

- **Infinite Canvas**: A graph workspace that supports large node counts,
  precise viewport math, stable interactions, spatial navigation, and scalable
  persistence.
- **Manual Canvas Operation**: A user-triggered durable graph change, such as
  create node, connect edge, update data, save graph, insert snippet, or run
  node.
- **Tool/UI Equivalence**: Manual UI and Agent calls use the same service/tool
  semantics for durable changes.
- **Node Definition**: Declarative metadata for a node type: data schema, UI
  schema, input ports, output ports, runtime actions, defaults, validation.
- **Node Port**: A typed input/output channel on a node, such as prompt text,
  reference image, first frame, audio, video, JSON metadata, or generated asset.
- **Runtime Binding**: Declarative mapping from node data and connected inputs
  into a normalized gateway/runtime request, and from results back to node
  outputs.
- **Gateway Adapter Manifest**: A gateway-side declaration of capabilities,
  models, parameter schema, accepted inputs, produced outputs, and mapping hooks.
- **Runtime Compiler**: Service that compiles graph state and a node action into
  a normalized execution request.

## Requirement 1: Stage-Based Architecture Roadmap

**User Story:** As the product owner, I want the architecture to evolve through
manual canvas, Agent orchestration, and dynamic gateway binding without rewrites,
so that early implementation does not block later automation.

### Acceptance Criteria

1. WHEN planning implementation THE roadmap SHALL treat manual canvas parity as
   Stage A, Agent orchestration as Stage B, and dynamic gateway/infinite canvas
   expansion as Stage C.
2. WHEN Stage A features are implemented THE system SHALL expose durable graph
   actions through shared services/tools, not renderer-only code.
3. WHEN Stage B starts THE Agent SHALL consume completed manual vocabulary,
   Context Packs, and ToolRuntime capabilities.
4. WHEN Stage C starts THE node runtime SHALL use Node Definition and Runtime
   Binding protocols instead of hard-coded per-node provider payload logic.
5. IF a later-stage feature is discovered during an earlier stage THEN the spec
   SHALL record its protocol needs without forcing premature UI implementation.

## Requirement 2: Infinite Canvas Foundation

**User Story:** As a creator, I want a canvas that can scale to large workflows,
so that complex comic/video pipelines remain navigable and responsive.

### Acceptance Criteria

1. WHEN graph size grows THE renderer SHALL keep pan, zoom, selection, drag, and
   context menu interactions responsive.
2. WHEN nodes are rendered THEir dimensions SHALL be stable so hover states,
   status changes, labels, and thumbnails do not shift graph layout.
3. WHEN the viewport changes THE system SHALL preserve precise cursor,
   drop-position, context-menu, and connect-to-create coordinates.
4. WHEN saving or loading large graphs THE workflow repository SHALL preserve
   nodes, edges, viewport, graph version, and warnings without blocking UI.
5. WHEN Agent inserts nodes or snippets THE layout service SHALL place them in
   deterministic, non-overlapping positions relative to the active viewport or
   selected anchor.
6. FOR ALL graph operations THE shared graph contracts SHALL remain the only
   source of truth for node types, edge validation, and graph sanitization.

## Requirement 3: Manual Canvas Operation Layer

**User Story:** As a creator, I want to manually add nodes, connect them,
configure them, and run them, so that the canvas is useful before Agent
automation is complete.

### Acceptance Criteria

1. WHEN a user adds a node THE operation SHALL create a valid node with default
   data derived from Node Definition defaults.
2. WHEN a user connects nodes THE operation SHALL validate edge semantics through
   shared connection rules and port compatibility.
3. WHEN a user updates node data THE operation SHALL validate the node data
   schema and keep persisted graph JSON compatible with shared contracts.
4. WHEN a user runs a node THE operation SHALL enqueue a job and return a ticket
   without waiting for provider output.
5. WHEN a job completes THE system SHALL bind the output back to node data,
   assets, and output ports through the same result binding used by Agents.

## Requirement 4: Tool/UI Equivalence

**User Story:** As an Agent developer, I want every durable canvas behavior
available as a tool or shared service, so that Agents can operate the canvas
without duplicating UI logic.

### Acceptance Criteria

1. WHEN a manual operation mutates durable graph or asset state THE system SHALL
   expose an equivalent ToolRuntime operation or shared service function.
2. WHEN Agent tools mutate graph state THE tools SHALL reuse the same validation,
   defaults, layout, asset reference, and job semantics as manual UI.
3. WHEN a tool is destructive, file-affecting, or provider-spending THE tool
   descriptor SHALL declare `destructive`, `file.write`, or `provider.spend`
   permissions.
4. WHEN a tool fails THE result SHALL include a stable structured error class
   suitable for Agent branching and UI display.
5. FOR ALL shipped durable operations THE system SHALL have UI/tool equivalence
   tests or an explicit record that the behavior is transient UI-only.

## Requirement 5: General Agent Planning And Execution

**User Story:** As a creator, I want a general Agent to understand my request,
produce a plan, and operate the canvas, so that complex workflows can be built
from natural language.

### Acceptance Criteria

1. WHEN a user sends a natural-language request THE Orchestrator SHALL build a
   Context Pack before planner/model execution.
2. WHEN producing a plan THE Agent SHALL output declarative CanvasPlan JSON and
   SHALL NOT output executable code or provider-specific payloads.
3. WHEN a plan is applied THE system SHALL sanitize nodes, edges, run steps, and
   node data before graph mutation.
4. WHEN the plan requires long or specialized work THE Agent MAY spawn sub-agents
   with tools and skills that are a subset of parent permissions.
5. WHEN sub-agents modify graph drafts THE parent Agent SHALL merge only through
   sanitized graph/tool operations.
6. WHEN execution starts THE PlanRunner SHALL run node actions through JobQueue
   and ToolRuntime, preserving terminal state and short-circuit behavior.

## Requirement 6: Node Definition Protocol

**User Story:** As a node designer, I want nodes to declare data, ports, UI, and
runtime behavior, so that new node types can be added without scattering logic.

### Acceptance Criteria

1. WHEN a node type is registered THE system SHALL define its stable type ID,
   title, category, data schema, UI schema, default data, input ports, output
   ports, and runtime actions.
2. WHEN a node is created THE default data SHALL come from the Node Definition,
   not ad hoc duplicated renderer code.
3. WHEN node data changes THE system SHALL validate it against the node data
   schema at service/repository boundaries.
4. WHEN a connection is attempted THE system SHALL validate both node type
   compatibility and input/output port compatibility.
5. WHEN Agent discovers available node types THE Agent SHALL read Node
   Definitions rather than infer capabilities from renderer components.
6. FOR ALL node definitions THE protocol SHALL support text, image, video,
   audio, JSON, asset, and future custom media-like ports.

## Requirement 7: Node Input/Output Port Model

**User Story:** As a workflow author, I want node inputs and outputs to be typed,
so that data can move predictably between nodes and providers.

### Acceptance Criteria

1. WHEN a node declares an input port THE port SHALL include ID, media type,
   role, required flag, multiplicity, ordering policy, and accepted upstream
   output types.
2. WHEN a node declares an output port THE port SHALL include ID, media type,
   role, asset binding rules, and downstream compatibility.
3. WHEN edges connect ports THE edge data SHALL persist source port, target port,
   semantic role, order, and creation metadata.
4. WHEN existing legacy edges lack ports THE migration layer SHALL infer default
   ports where safe and persist warnings where not safe.
5. WHEN compiling node runtime inputs THE compiler SHALL use ports and edge
   order instead of scanning generic incoming edges only.

## Requirement 8: Runtime Compiler

**User Story:** As a runtime engineer, I want a compiler that turns graph state
into normalized execution requests, so that node execution is predictable and
gateway-independent.

### Acceptance Criteria

1. WHEN a node action runs THE Runtime Compiler SHALL collect node data,
   connected input ports, selected assets, effective style, workflow defaults,
   and action parameters.
2. WHEN compilation succeeds THE output SHALL be a normalized `NodeRunRequest`
   independent of provider-specific payload shape.
3. WHEN required inputs are missing THE compiler SHALL fail before enqueueing a
   provider job with a structured validation error.
4. WHEN inputs include assets THE compiler SHALL resolve safe local/cloud refs
   without leaking absolute paths.
5. WHEN prompt composition is needed THE compiler SHALL use deterministic prompt
   assembly and style injection.
6. FOR ALL node runs THE JobQueue payload SHALL include enough compile snapshot
   metadata to recover terminal writeback after app restart.

## Requirement 9: Dynamic Gateway Binding Protocol

**User Story:** As an integrator, I want third-party gateways to map ComicCanvas
node requests into provider requests dynamically, so that new providers can be
added without rewriting node components.

### Acceptance Criteria

1. WHEN a gateway is registered THE Gateway Adapter Manifest SHALL declare
   capabilities, supported models, accepted input media, produced output media,
   parameter schema, auth mode, and async/sync task behavior.
2. WHEN a node action selects a gateway THE system SHALL validate that the
   gateway manifest satisfies the Node Definition action requirements.
3. WHEN compiling a provider request THE binding layer SHALL map normalized node
   inputs and parameters into provider payloads through a declared mapping.
4. WHEN provider output returns THE binding layer SHALL normalize it into
   `GatewayResult` and then into node output ports/assets.
5. WHEN a gateway lacks required capability THE system SHALL fail before remote
   submission with `capability_unsupported`.
6. FOR ALL gateway bindings THE system SHALL prevent API keys, temporary URLs,
   and provider-specific internal payloads from becoming final graph data.

## Requirement 10: Multi-Gateway Customization

**User Story:** As a creator/operator, I want to configure multiple gateways and
bind different nodes/actions to different gateways, so that each workflow can
use the right model/provider.

### Acceptance Criteria

1. WHEN multiple gateways are enabled THE system SHALL let workflow defaults,
   node overrides, and action overrides resolve the effective gateway/model.
2. WHEN gateway config changes THE system SHALL hot-reload future jobs without
   mutating in-flight jobs.
3. WHEN a node stores gateway selection THE graph SHALL store stable gateway/model
   refs, not secrets or provider payloads.
4. WHEN a configured gateway is deleted or disabled THE graph validator SHALL
   show stale gateway/model warnings and block strict run.
5. WHEN custom provider parameters are edited THE UI SHALL be driven by the
   binding parameter schema where feasible.

## Requirement 11: Output Binding And Downstream Propagation

**User Story:** As a workflow author, I want node outputs to become reusable
inputs for downstream nodes, so that generated images, videos, audio, and JSON
can flow through the canvas.

### Acceptance Criteria

1. WHEN a job completes with media output THE asset pipeline SHALL persist the
   asset and bind the asset ID to the declared node output port.
2. WHEN a job completes with text or JSON output THE system SHALL persist the
   output according to the node output schema and expose it to downstream ports.
3. WHEN multiple outputs are produced THE node SHALL preserve output order and
   selected output state where the Node Definition requires it.
4. WHEN downstream nodes consume outputs THE compiler SHALL use output port
   metadata rather than guessing from node type alone.
5. WHEN output binding fails THE job SHALL fail or enter recoverable warning
   state without corrupting graph data.

## Requirement 12: Migration From Current Static Model

**User Story:** As an engineer, I want to migrate the current static node and
gateway implementation safely, so that existing workflows keep working.

### Acceptance Criteria

1. WHEN Node Definition protocol is introduced THE existing `shared/nodes.ts`
   node types SHALL be represented as built-in Node Definitions.
2. WHEN current `EdgeType` lacks port information THE migration SHALL infer
   default source/target ports for `promptOrder`, `imageRole`, and `default`
   where deterministic.
3. WHEN current `buildRunDescriptor` logic is replaced THE new Runtime Compiler
   SHALL produce equivalent payloads for existing image/video/audio/compose/
   upscale/mux/MJ smoke cases.
4. WHEN old graph JSON is loaded THE system SHALL sanitize and upgrade it to the
   new port/binding model without losing valid nodes.
5. WHEN migration cannot infer a binding THE graph SHALL load in draft mode with
   warnings and strict run SHALL block until user fixes it.

## Correctness Properties

### INV-1: Tool/UI Equivalence

For any durable graph operation, manual UI and Agent tools SHALL route through
the same validation and service semantics.

### INV-2: Provider Payload Isolation

For any CanvasPlan, graph snapshot, or node data payload, provider-specific
request bodies, secrets, and temporary URLs SHALL NOT be persisted as product
state.

### INV-3: Port Compatibility

For any persisted edge, source output port and target input port SHALL be
compatible according to Node Definitions and shared graph validation.

### INV-4: Async Runtime Boundary

For any node action that calls a gateway, the immediate response SHALL be a job
ticket/status and SHALL NOT contain generated bytes or final provider URLs.

### INV-5: Gateway Binding Determinism

For identical node data, graph inputs, workflow defaults, binding manifest, and
gateway selection, the Runtime Compiler SHALL produce the same normalized run
request.

### INV-6: Agent Permission Monotonicity

For any sub-agent or spawned task, effective tools, skills, context, and gateway
permissions SHALL be less than or equal to parent permissions.

### INV-7: Backward-Compatible Migration

For any valid pre-port graph, loading and saving under the new model SHALL either
preserve behavior or record explicit warnings that block only strict run/publish.
