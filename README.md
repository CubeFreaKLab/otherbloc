# otherbloc

otherbloc is an editorial publishing platform foundation built as a React frontend, an Express API Gateway, and three independent backend services.

## Architecture

```text
React + Vite frontend
        |
Express API Gateway :3000
        |
        +-- Users REST service :3001
        +-- Content REST service :3002
        +-- Interactions GraphQL service :3003
        |
Firebase infrastructure (planned integration)
```

The current milestone establishes application boundaries, visual language, operational endpoints, tests, and local development conventions. Authentication, persistence, gateway forwarding, and complete publication workflows are intentionally deferred.

## Requirements

- Node.js 20.11 or newer
- npm 10 or newer

## Start locally

Install every workspace from the repository root:

```bash
npm install
```

Copy the environment templates in `frontend` and each backend application to local `.env` files as needed. Start each application in a separate terminal:

```bash
npm run dev:frontend
npm run dev:gateway
npm run dev:users
npm run dev:content
npm run dev:interactions
```

The frontend runs on port 5173. Backend ports are 3000 through 3003 in gateway, users, content, and interactions order.

## Verify the foundation

```bash
npm test
npm run build
```

The test command validates repository contracts and runs each backend service's isolated HTTP or GraphQL tests. The build command creates the production frontend bundle.

## Documentation

- [Architecture](docs/architecture.md)
- [Repository guide](docs/repository.md)
- [Frontend guide](docs/frontend.md)
- [Design system](docs/design-system.md)
- [Testing guide](docs/testing.md)
- [Development log](docs/development-log.md)

Service-specific notes are available in `docs/gateway.md`, `docs/users-service.md`, `docs/content-service.md`, `docs/interactions-service.md`, and `docs/graphql.md`.
