---
name: pm-req-planner
description: Turn a rough ComicCanvas feature request into requirements, design, and tasks specs with EARS acceptance criteria and correctness properties. Use before implementation for large or cross-module requirements.
---

# pm-req-planner

Use this skill when a ComicCanvas requirement needs to be made precise before
coding, especially when it touches IPC, shared contracts, Agent orchestration,
canvas behavior, jobs, providers, DB, or generated assets.

## Output Location

Create or update:

- `specs/<feature-slug>/requirements.md`
- `specs/<feature-slug>/design.md`
- `specs/<feature-slug>/tasks.md`

The root-level `specs/` tree is the project-wide spec archive and is shared by
Codex, Claude-compatible tooling, and human contributors. Tool-specific
directories such as `.codex/` and `.claude/` are runtime/configuration layers,
not the canonical location for product or engineering specs.

## Requirements Format

Use EARS-style acceptance criteria:

- `WHEN <trigger> THE <system> SHALL <behavior>.`
- `IF <condition> THEN THE <system> SHALL <behavior>.`
- `WHILE <state> THE <system> SHALL <behavior>.`
- `WHERE <scenario> THE <system> SHALL <behavior>.`
- `FOR ALL <set> ... SHALL ...` for invariants.

Include:

- Introduction with explicit scope and non-goals.
- Glossary for domain terms.
- User stories.
- Acceptance criteria mapped to requirements.
- Correctness properties named `INV-x`.

## Design Format

Include:

- Overview mapped to requirements and invariants.
- Architecture diagram when useful.
- Components and interfaces.
- Data models.
- API/IPC contracts and links to `docs/api-contracts/`.
- Testing strategy.
- Migration/cutover when behavior or storage changes.

## ComicCanvas Requirements

For generation features, acceptance criteria must cover:

- Fully asynchronous generation through local jobs.
- IPC terminal events for completion/failure.
- No synchronous asset return from request handlers.
- Local asset storage under appData assets with DB relative paths.

For connection features, criteria must reference:

- `shared/connection-matrix.ts` as the only source of truth.
- Tests that enumerate or property-test allowed and denied pairs.

For Agent output, criteria must require:

- Pure declarative CanvasPlan JSON.
- Whitelist sanitization.
- Rejection or dropping of executable code/script strings.

## Templates

Use the templates under this skill's `assets/` directory when creating new spec
files.
