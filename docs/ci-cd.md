# CI/CD

ComicCanvas Studio uses a repository-level CI/CD gate from the first pushed version.
The current product is still in the M0 foundation phase, so the first pipeline validates
contracts, tests, repository hygiene, and a release dry-run instead of producing Electron
installers.

## Local Gate

Run the same checks locally before pushing:

```bash
npm ci
npm run ci
```

`npm run ci` executes:

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run verify:repo`

## GitHub Actions

| Workflow | Trigger | Purpose |
| :--- | :--- | :--- |
| `.github/workflows/ci.yml` | Pull requests and pushes to `main` | Validate on Ubuntu and Windows with Node.js 20. |
| `.github/workflows/release.yml` | Tags matching `v*.*.*` | Run the full gate and upload a release dry-run manifest. |

## Repository Hygiene

The CI gate intentionally excludes local reference repositories from source control:

- `hjwall/`
- `cc-haha-main/`
- `coze-studio-main/`
- `tmp/`

It also rejects tracked `.claude/specs/` files because the canonical project spec root is
`specs/`.

## Next CD Milestone

After M1 creates the real Electron desktop skeleton, the release workflow must add:

- Electron packaging for Windows.
- Signed installer strategy.
- Version and changelog validation.
- Upgrade and rollback notes.
- Artifact retention policy.
