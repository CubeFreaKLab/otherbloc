# Interactions service

The Interactions service is an independent Express and Apollo Server application on port 3003. Its approved responsibility is comments, reactions, saved publications, and author follows through GraphQL.

## Current foundation

The service provides environment loading, an Express host, Apollo Server, a request context, a schema boundary, resolvers, service status modeling, health routing, and shared HTTP middleware.

- `GET /health` reports runtime readiness.
- `POST /graphql` accepts the foundation `serviceStatus` query.

Interaction entities, publication queries, comments, reactions, saves, follows, and persistence are intentionally not implemented in the foundation phase.

## Environment

The `.env.example` file documents `PORT` and `FIREBASE_PROJECT_ID`. Real environment values remain untracked.

## Commands

```bash
npm run start --workspace @otherbloc/interactions-service
npm run test --workspace @otherbloc/interactions-service
```
