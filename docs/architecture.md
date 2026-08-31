# Architecture

otherbloc uses a fixed distributed architecture:

```text
React frontend
    |
API Gateway :3000
    |
    +-- Users REST service :3001
    +-- Content REST service :3002
    +-- Interactions GraphQL service :3003
    |
Firebase data and storage infrastructure
```

The frontend communicates only with the API Gateway. The gateway owns the public backend entry point and maintains the service registry. Backend services remain independent packages and do not import each other's source code.

## Current foundation

The API Gateway exposes `GET /health` and `GET /api` for local foundation checks. Its environment configuration records the internal service locations. The Users and Content services expose their own health and REST boundary metadata without implementing business logic. Request forwarding, authentication, persistence, rate limiting, and full resource endpoints belong to later implementation phases.
