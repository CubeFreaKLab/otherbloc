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

## Private development context

`.agent`, `.project`, and `resources` are local development inputs and are excluded from Git. Real environment files, dependencies, build output, logs, coverage, and editor state are also ignored. `.env.example` files are intentionally tracked because they document runtime configuration without containing credentials.

## Workspace commands

Install dependencies once from the repository root:

```bash
npm install
```

The root package provides aggregate build and test commands. Individual applications can also be addressed through npm workspace names.

```bash
npm test
npm run build
```

Repository-level contracts live in `tests`, while each backend application owns its integration tests. `.github/workflows/foundation-ci.yml` runs both verification commands for pushes and pull requests.
