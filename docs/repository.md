# Repository

otherbloc is organized as an npm workspace while preserving independent deployable applications.

```text
frontend/                  React and Vite application
backend/api-gateway/       Express gateway on port 3000
backend/users-service/     Users REST service on port 3001
backend/content-service/   Content REST service on port 3002
backend/interactions-service/ Interactions GraphQL service on port 3003
docs/                      Public technical documentation
tests/                     Cross-application foundation checks
.github/workflows/         Automation definitions
```

Each application owns its package manifest, environment template, source tree, runtime entry point, and tests. Backend applications do not share source modules or import internal code from another service.

Release-controller source lives in `scripts/release/`, guarded commands in `scripts/release-render.mjs` and `scripts/release-check.mjs`, and blank controller settings in `deploy/.env.example`. Contract fixtures exercise external API behavior without calling cloud accounts. The manual `release.yml` workflow depends on same-commit CI and configured production approval; see [release preparation](ci-cd.md#manual-production-workflow). These files do not create resources or demonstrate an executed release.

`deploy/render.blueprint.example.json` is an intentionally unconfigured infrastructure example. `scripts/render-blueprint.mjs` can prepare the final root `render.yaml` after explicit owner-approved region/plan choices, without overwriting one that already exists. No active Blueprint is silently created from defaults.

## Private development context

`.agent`, `.project`, and `resources` are local development inputs and are excluded from Git. Real environment files, dependencies, build output, logs, coverage, and editor state are also ignored. `.env.example` files are intentionally tracked because they document runtime configuration without containing credentials.

## Workspace commands

Install dependencies once from the repository root:

```bash
npm ci
```

The root package provides aggregate build and test commands. Individual applications can also be addressed through npm workspace names.

```bash
npm test
npm run build
```

Repository-level contracts live in `tests`, while each backend application owns its HTTP tests. Firebase integration tests live in `tests/integration`. `.github/workflows/foundation-ci.yml` now prepares the complete Platform CI sequence: install, Node contracts, lint, build, visual regression, fresh emulators, API integration, demo seeds and live desktop/mobile journeys. It uses no cloud secrets or artifact uploads and supports same-commit reuse for a future gated release. An actual Actions run still requires the owner's push. See [CI boundaries and reproduction](ci-cd.md) and [local development](development.md).
