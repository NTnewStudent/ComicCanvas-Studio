---
name: comiccanvas-skill-creator
description: Create a new repository-scoped Codex skill for ComicCanvas under .agents/skills with a valid SKILL.md, concise trigger description, and optional assets.
---

# comiccanvas-skill-creator

Use this skill when creating a new reusable workflow skill for this repository.

## Location

Create Codex repository skills under:

`.agents/skills/<skill-name>/SKILL.md`

Use optional sibling directories such as `assets/`, `references/`, or `scripts/`
only when the workflow needs them.

## Frontmatter

Every `SKILL.md` must start with:

```yaml
---
name: <kebab-case-name>
description: <clear trigger scope; when Codex should and should not use it>
---
```

Keep the description concise and front-load trigger words. Codex uses this text
for implicit skill matching.

## Body Structure

1. Title and one-sentence purpose.
2. When to use.
3. Inputs expected from the user or codebase.
4. Steps to follow.
5. Required outputs.
6. ComicCanvas-specific constraints, especially:
   - asynchronous generation through jobs,
   - `shared/connection-matrix.ts` as the connection source of truth,
   - pure declarative CanvasPlan output,
   - `docs/api-contracts/` before new IPC/service surfaces.

## Maintenance

- Keep each skill focused on one job.
- Prefer instructions over scripts unless deterministic tooling is needed.
- If the skill replaces or supersedes a Claude skill, update both discovery docs
  or explicitly document that Codex is now the canonical version.
