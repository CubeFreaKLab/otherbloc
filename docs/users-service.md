# Users service

The Users service is an independent Express REST application on port 3001. Its approved responsibility is registration, authentication, profiles, and user roles.

## Current foundation

The service provides an environment loader, service metadata model, status service, controllers, routers, shared HTTP middleware, and a dedicated runtime entry point.

- `GET /health` reports runtime readiness.
- `GET /api/users` reports the planned service capabilities.

Registration, login, token generation, persistence, and profile mutation are intentionally not implemented in the foundation phase.

## Environment

The `.env.example` file documents `PORT` and `FIREBASE_PROJECT_ID`. Real environment values remain untracked.

## Commands

```bash
npm run start --workspace @otherbloc/users-service
npm run test --workspace @otherbloc/users-service
```
