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
Firestore data + authenticated image storage
```

The frontend communicates only with the API Gateway. The gateway owns the public backend entry point and maintains the service registry. Backend services remain independent packages and do not import each other's source code.

## Current implementation

The gateway forwards the three agreed boundaries with origin, body-size, rate-limit and JWT signature checks. Users implements persistent accounts, revocable sessions, profiles, avatars and roles. Content implements versioned publications, block data, images, search and editorial transitions; public reading, authoring and moderation are connected. Content obtains current identity/roles from Users over HTTP and owns only Content collections. Interactions composes public Content/Users HTTP responses with its own comments, reactions, saves and follows in GraphQL. Each service has its own Firebase Admin initialization with emulator/cloud safety checks. Apollo Client and Fetch both enter through the gateway. Atomic interaction batches do not imply a distributed transaction across HTTP services. Cross-area identity/recovery and local load acceptance are verified; the [CI workflow](ci-cd.md) prepares repeatable checks without adding runtime services. Actual cloud persistence, Hosting/Render and GitHub CI/CD remain pending.

Firestore and image clients are server-only. The cloud configuration selects Firestore Spark and Cloudinary Free; local operation retains both Firebase emulators. Cloudinary images use authenticated delivery through the existing authorized media APIs, not public provider URLs. Custom JWT sessions are separate from Firebase Authentication; deny-all Firebase client rules do not authorize Admin SDK operations, which use server credentials and IAM. Each service must enforce ownership and permissions in its application logic. No frontend Firebase SDK or service credential is used. See [gateway](gateway.md), [database](database.md), [image storage](cloudinary-storage.md), [development](development.md) and [testing](testing.md).
