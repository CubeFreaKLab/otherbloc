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

## Current implementation

The gateway forwards the three agreed boundaries with origin, body-size, rate-limit and JWT signature checks. The Users and Content services still expose boundary metadata; Interactions hosts Apollo's operational status query. Domain authorization is not yet complete. Each service has its own Firebase Admin initialization with emulator/cloud safety checks; tests verify Firestore atomic writes, Storage round trips and rejection of direct client access.

Firestore and Storage clients are server-only. Custom JWT sessions are separate from Firebase Authentication; deny-all Firebase client rules do not authorize Admin SDK operations, which use server credentials and IAM. Each service must enforce ownership and permissions in its application logic. No frontend Firebase SDK or service credential is used. See [gateway](gateway.md), [database](database.md), [development](development.md) and [testing](testing.md).
