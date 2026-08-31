# Content service

The Content service is an independent Express REST application on port 3002. Its approved responsibility is publication management, lifecycle states, categories, tags, and search.

## Current foundation

The service provides an environment loader, service metadata model, status service, controllers, routers, shared HTTP middleware, and a dedicated runtime entry point.

- `GET /health` reports runtime readiness.
- `GET /api/publications` reports the planned service capabilities.

Publication persistence, creation, editing, search, and lifecycle transitions are intentionally not implemented in the foundation phase.

## Environment

The `.env.example` file documents `PORT`, `FIREBASE_PROJECT_ID`, and `FIREBASE_STORAGE_BUCKET`. Real environment values remain untracked.

## Commands

```bash
npm run start --workspace @otherbloc/content-service
npm run test --workspace @otherbloc/content-service
```
