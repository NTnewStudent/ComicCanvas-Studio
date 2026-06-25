# Requirements Document - Core Platform Foundation

## Introduction

This spec defines the cross-module foundation for ComicCanvas Studio before feature implementation continues. The product goal is not a demo: it must become a local-first, industrial-grade desktop system for comic-drama canvas creation, model generation, agent orchestration, local files, extensible tools, skills, and provider gateways.

Scope:

- Canvas generation for text, image, and video nodes.
- Local asynchronous job execution and terminal IPC events.
- Local asset and file library under app-controlled storage.
- Universal gateway abstraction, initially OpenAI-compatible plus common image/video async protocols.
- Tool runtime with built-in tools and externally added plugin tools.
- Built-in and user-defined agents.
- Built-in and user-defined skills.
- Context and knowledge foundation, including explicit RAG support where persistent or file-backed knowledge is needed.
- Security, permissions, observability, and recovery contracts that every module must follow.

Non-goals for this foundation spec:

- It does not implement any module.
- It does not pick every concrete third-party image/video provider.
- It does not add cloud collaboration, multi-user sync, or marketplace distribution.
- It does not allow executable workflow code inside CanvasPlan or agent outputs.

## Glossary

- **Canvas Surface**: The renderer workspace where text, image, and video nodes are created, connected, configured, generated, previewed, and organized.
- **CanvasPlan**: Sanitized declarative JSON used to create nodes, edges, and ordered generation steps on the canvas.
- **JobQueue**: The main-process persistent queue backed by local SQLite. Request handlers enqueue and return tickets; workers perform slow work.
- **Asset**: Generated or imported media stored under app-controlled local storage. DB records store relative paths only.
- **Local File Library**: User-visible file/folder organization layer over assets, imports, and project files.
- **Gateway**: A provider adapter boundary that normalizes OpenAI-compatible, image generation, video generation, and async task protocols.
- **Tool**: A permissioned callable capability exposed to agents and/or UI. Tools may be built in or plugin-provided.
- **Plugin Tool**: A tool registered by an external plugin bundle after manifest validation and permission approval.
- **Agent**: A named runtime persona with instructions, allowed tools, allowed skills, context policy, and orchestration behavior.
- **Skill**: A reusable instruction/workflow package that can be discovered and invoked by agents.
- **Context Pack**: The bounded set of messages, canvas state, file references, memories, retrieved knowledge chunks, and tool results given to an agent run.
- **Knowledge Store**: Persistent indexed content for retrieval. It may contain project docs, user-selected local files, generated asset metadata, or explicit notes.
- **RAG**: Retrieval-augmented generation. In this project, RAG means explicit retrieval from a scoped Knowledge Store into a Context Pack, with citations and deletion semantics.

## Requirements

### Requirement 1: Contract-First Module Governance

**User Story:** As a product owner, I want every large module to have precise contracts before coding, so that the system grows as industrial software instead of disconnected demos.

#### Acceptance Criteria

1. WHEN a new IPC channel, service method, DB repository, tool, agent capability, skill runtime behavior, provider adapter, or file protocol is proposed, THE project SHALL register its contract in `docs/api-contracts/` before implementation starts.
2. WHEN a module touches cross-process or cross-agent data, THE project SHALL define shared types under `shared/` or a documented schema before renderer/main/agent implementations diverge.
3. IF a design changes an existing shared truth, THEN THE project SHALL update the canonical source first and update all consumers in the same implementation plan.
4. FOR ALL exported functions/classes/methods introduced by implementation tasks, THE code SHALL include JSDoc covering intent, params, return, and exceptions.
5. FOR ALL API/IPC methods introduced by implementation tasks, THE code SHALL include a `@see docs/api-contracts/...` anchor.

### Requirement 2: Canvas Generation Surface

**User Story:** As a creator, I want text, image, and video nodes to behave as a coherent production canvas, so that I can manually and agentically build comic-drama generation chains.

#### Acceptance Criteria

1. WHEN a user creates a text, image, or video node, THE Canvas SHALL persist node type, title, data, position, and versioned graph identity through the shared graph contract.
2. WHEN a user connects nodes, THE Canvas and Main SHALL validate the connection through `shared/connection-matrix.ts` as the only source of truth.
3. WHEN a user runs any generation node, THE handler SHALL enqueue a job and return a ticket; it SHALL NOT synchronously call a model or return a generated asset.
4. WHILE a node generation is pending or processing, THE Canvas SHALL render deterministic state from job records and IPC events, not from ad hoc polling.
5. WHEN a job reaches a terminal state, THE Canvas SHALL bind the terminal asset/error to the target node without rewriting unrelated node data.
6. IF an Agent applies a CanvasPlan, THEN THE Canvas SHALL revalidate node types, edges, actions, and data before mutating the graph.

### Requirement 3: Persistent Job Runtime And IPC Events

**User Story:** As a user, I want slow generation and orchestration tasks to survive normal app runtime behavior, so that the UI stays responsive and results are not lost.

#### Acceptance Criteria

1. WHEN any slow operation starts, THE Main SHALL create a durable job row with `pending` status before returning the request ticket.
2. WHILE a job is running, THE JobWorker SHALL transition status through a finite state machine and persist every terminal result before emitting terminal IPC.
3. FOR ALL job IDs, THE system SHALL emit exactly one terminal event: either completed or failed.
4. WHEN the app starts, THE JobRuntime SHALL reconcile stale `processing` jobs according to a documented recovery policy before accepting new worker work.
5. IF an IPC subscriber reconnects or a renderer query is invalidated, THEN THE renderer SHALL be able to recover current job state from query APIs without relying on missed events.
6. WHEN a job fails, THE system SHALL persist a stable `errorClass`, user-facing message, and retry eligibility.

### Requirement 4: Asset And Local File Management

**User Story:** As a creator, I want generated and imported media to live in a manageable local library, so that projects remain portable, inspectable, and safe.

#### Acceptance Criteria

1. WHEN provider bytes or imported files are accepted, THE AssetService SHALL store bytes under app-controlled asset storage and persist only relative paths in DB.
2. THE renderer SHALL access assets only through a safe custom protocol that prevents path traversal and does not expose absolute paths.
3. WHEN asset metadata includes dimensions or duration, THE AssetService SHALL classify orientation and media metadata before marking the asset ready.
4. IF asset metadata required by the consuming node is missing or invalid, THEN THE related job SHALL fail with a stable metadata error class.
5. WHEN users organize files, THE Local File Library SHALL support nested folders, rename, move, delete-to-trash semantics, and reference integrity checks.
6. IF an asset is referenced by a canvas node, chat message, or generation record, THEN destructive file actions SHALL either prevent deletion or create a recoverable tombstone according to contract.
7. FOR ALL asset records returned to the renderer, THE response SHALL NOT contain absolute filesystem paths or provider temporary URLs.

### Requirement 5: Universal Gateway And Provider Normalization

**User Story:** As an operator, I want one gateway layer for OpenAI-compatible and common media providers, so that text/image/video generation can be configured without leaking provider quirks into canvas or agents.

#### Acceptance Criteria

1. WHEN a provider is configured, THE GatewayRegistry SHALL validate provider type, base URL, auth mode, model mapping, capability matrix, timeout policy, and secret storage policy.
2. THE initial gateway implementation SHALL include an OpenAI-compatible protocol adapter for text/chat and image-style requests.
3. THE gateway contract SHALL support common async media protocols: submit remote task, poll/get remote status, fetch bytes, normalize terminal result.
4. WHEN a generation request enters the gateway, THE Gateway SHALL normalize inputs into a channel-specific request: `text`, `image`, or `video`.
5. WHEN a provider returns a result, THE Gateway SHALL normalize output into a provider-independent result envelope before AssetService or JobWorker consumes it.
6. IF a provider does not support a requested capability, THEN THE Gateway SHALL fail before remote submission with `capability_unsupported`.
7. FOR ALL configured secrets, THE system SHALL use OS/Electron safe storage or an equivalent encrypted local secret store and SHALL NOT log plaintext secrets.
8. WHEN gateway settings change, THE GatewayRegistry SHALL hot-reload affected providers without requiring app restart, unless a contract explicitly marks the provider as restart-required.

### Requirement 6: Tool Runtime And Plugin Extension

**User Story:** As a system builder, I want tools to be registered, permissioned, observable, and extensible by plugins, so that agents can safely use built-in and external capabilities.

#### Acceptance Criteria

1. WHEN a tool is registered, THE ToolRegistry SHALL validate name, description, input schema, output schema, permission declaration, concurrency class, and owner plugin or built-in owner.
2. WHEN an agent requests a tool call, THE ToolRuntime SHALL validate input, check permissions, execute according to concurrency policy, stream progress, and persist an audit record.
3. IF a tool is destructive, external-networked, file-writing, or provider-spending, THEN THE ToolRuntime SHALL require an explicit permission policy before execution.
4. FOR ALL plugin tools, THE PluginLoader SHALL validate manifest, requested permissions, tool schemas, version, and entrypoint before registration.
5. WHEN a plugin is disabled or unloaded, THE ToolRegistry SHALL prevent new invocations and allow already-running invocations to complete or cancel according to documented policy.
6. THE tool system SHALL expose built-in canvas, asset, job, gateway, knowledge, and file tools only through the same ToolRuntime contract used by plugin tools.
7. IF a plugin tool violates schema, permission, or runtime boundary, THEN THE system SHALL quarantine that tool and surface a diagnostic without taking down the agent runtime.

### Requirement 7: Agent Runtime And AgentRegistry

**User Story:** As a creator, I want built-in and custom agents that can analyze my request, choose tools/skills, and coordinate canvas work, so that complex comic-drama tasks become guided workflows.

#### Acceptance Criteria

1. WHEN the app starts, THE AgentRegistry SHALL load built-in agents and persisted user-defined agents into a single registry with stable IDs.
2. THE system SHALL include built-in agents for orchestration, canvas work, tooling/runtime work, and PM/requirements work.
3. WHEN a custom agent is created, THE system SHALL persist instructions, allowed tools, allowed skills, model/gateway policy, context policy, and permission policy.
4. WHEN an agent run starts, THE AgentRuntime SHALL construct a bounded Context Pack according to the selected agent's policy.
5. WHEN an agent produces a CanvasPlan, THE system SHALL sanitize it as pure declarative JSON before the renderer can apply it.
6. IF an agent spawns a sub-agent, THEN the child agent's permissions SHALL be a subset of the parent permissions, and recursion depth SHALL respect the configured limit.
7. WHILE an agent run is active, THE runtime SHALL stream user-visible progress and tool-use summaries without exposing secrets or raw internal prompts.
8. WHEN an agent run completes, THE runtime SHALL persist trace metadata sufficient for debugging: agent ID, tool calls, job IDs, sanitized plan IDs, timings, and error classes.

### Requirement 8: Skills Runtime

**User Story:** As a power user, I want built-in and custom skills to guide agents through repeatable workflows, so that expert processes can be reused without hardcoding them into the app.

#### Acceptance Criteria

1. WHEN the app starts or skills are refreshed, THE SkillRegistry SHALL discover built-in and user-defined skills from documented locations.
2. WHEN a skill is loaded, THE SkillRegistry SHALL validate metadata, description, allowed references/assets, version, and invocation policy.
3. WHEN an agent considers a skill, THE AgentRuntime SHALL make skill metadata discoverable without loading unrelated large skill resources into context.
4. WHEN a skill is invoked, THE runtime SHALL load only the skill instructions and references required by that invocation.
5. IF a skill requests tools or permissions outside the invoking agent's policy, THEN invocation SHALL fail before tool execution.
6. WHEN a skill file changes, THE SkillRegistry SHALL hot-reload it or mark reload-required according to a documented consistency policy.
7. FOR ALL skill invocation traces, THE system SHALL record skill ID, version, agent ID, and loaded references for reproducibility.

### Requirement 9: Context, Knowledge, And RAG Foundation

**User Story:** As a creator, I want agents to use project context, canvas state, local files, and curated knowledge without hallucinating or leaking unrelated data, so that agent output is grounded and controllable.

#### Acceptance Criteria

1. WHEN an agent run starts, THE ContextBuilder SHALL assemble context from explicit scopes: current chat, selected canvas graph, selected nodes/assets, allowed files, memories, and retrieval results.
2. IF a request requires knowledge beyond the active chat/canvas and the relevant data is stored in local files or project knowledge, THEN THE system SHALL use the Knowledge Store retrieval path instead of relying on hidden model memory.
3. THE Knowledge Store SHALL support document/file ingest, chunking, embedding or lexical index metadata, retrieval, citation metadata, deletion, and rebuild.
4. WHEN retrieval runs, THE system SHALL restrict candidates to the active project/workspace/user-approved scopes.
5. WHEN retrieved chunks enter an agent Context Pack, THE runtime SHALL include source metadata sufficient for UI citation or trace inspection.
6. IF a file, folder, asset, or knowledge document is deleted or removed from scope, THEN future retrieval SHALL exclude it and rebuild/mark stale indexes as needed.
7. THE context budgeter SHALL apply deterministic priority rules for system instructions, active task, canvas state, selected files, retrieved chunks, recent messages, and summaries.
8. FOR ALL persisted context summaries or memories, THE system SHALL exclude API keys, provider secrets, and raw hidden prompts.

### Requirement 10: Security, Permissions, Observability, And Recovery

**User Story:** As an operator, I want the system to be debuggable and safe by default, so that local-first extensibility does not become uncontrolled execution.

#### Acceptance Criteria

1. THE Electron renderer SHALL keep `contextIsolation: true`, `nodeIntegration: false`, and `sandbox: true`.

> ⚠️ **2026-06-26 例外**：sandbox 临时设为 false 以解决 ESM preload 脚本加载问题（REQ-071）。
> 恢复方案：将 preload 构建产物从 .mjs 改为 .cjs，或在 electron.vite.config.ts 中配置 preload 为 CJS 输出。
> 待此问题解决后恢复 sandbox: true。
2. THE preload layer SHALL expose only whitelisted APIs and SHALL NOT expose raw `ipcRenderer`.
3. WHEN any permissioned action occurs, THE system SHALL record an audit entry with actor, capability, target, decision, and job/tool/agent correlation IDs.
4. WHEN errors cross IPC boundaries, THE system SHALL return stable error classes and safe messages without stack traces, secrets, or absolute paths.
5. WHEN local state is corrupted or inconsistent, THE system SHALL provide repair or quarantine paths for jobs, assets, plugin tools, skills, and knowledge indexes.
6. FOR ALL logs, traces, LTM records, and debug exports, THE system SHALL redact provider keys, auth headers, raw secret values, and hidden prompts.
7. THE system SHALL define health checks for DB, job runtime, asset protocol, gateway registry, tool registry, agent registry, skill registry, and knowledge index.

## Correctness Properties

### INV-1: Asynchronous Generation Boundary

*For any* canvas, agent, or tool generation request, THE synchronous response SHALL contain a ticket/job reference and SHALL NOT contain generated asset bytes, asset URLs, absolute paths, or provider temporary URLs.

**Validates:** Requirements 2.3, 3.1, 4.7.

### INV-2: Terminal Event Uniqueness

*For any* job ID, THE persisted terminal state and emitted terminal IPC event SHALL resolve to exactly one terminal outcome: completed or failed.

**Validates:** Requirements 3.2, 3.3, 3.5.

### INV-3: Provider Normalization Determinism

*For any* provider adapter result with equivalent provider payload and gateway config, THE Gateway SHALL produce the same normalized result envelope and error class.

**Validates:** Requirements 5.4, 5.5, 5.6.

### INV-4: Permission Monotonicity

*For any* agent, sub-agent, skill, or plugin tool invocation, effective permissions SHALL be less than or equal to the permissions granted by the invoking actor and parent runtime context.

**Validates:** Requirements 6.3, 7.6, 8.5, 10.3.

### INV-5: Asset Reference Integrity

*For any* asset referenced by a node, job, chat message, or knowledge item, THE system SHALL either keep the asset resolvable through the safe protocol or represent deletion through a recoverable tombstone state.

**Validates:** Requirements 4.2, 4.5, 4.6.

### INV-6: Context Retrieval Isolation

*For any* retrieval query, THE Knowledge Store SHALL only return chunks from the active project/workspace/user-approved scopes, and deleted or removed documents SHALL NOT appear in future retrieval.

**Validates:** Requirements 9.4, 9.5, 9.6.

### INV-7: Registry Reload Consistency

*For any* agent, skill, tool, gateway, or plugin registry refresh, THE registry SHALL expose either the previous valid version or the new fully validated version; it SHALL NOT expose a partially loaded entry.

**Validates:** Requirements 5.8, 6.4, 6.5, 8.6.
