# Interactions service

Independent Express/Apollo Server application on port 3003. It owns comments, one-kind reactions, saved publications, author follows and their counters in Firestore. It remains the third domain service, not another gateway or a replacement for Content. `GET /health` reports process health; it is not a Firebase/Users/Content readiness probe. The [GraphQL contract](graphql.md) documents all operations and limits.

## Data ownership and composition

Only Interactions accesses `comments`, `reactions`, `savedPublications`, `follows`, `publicationInteractionStats` and `authorInteractionStats`. It never reads Users or Content collections directly. Publication visibility is checked with anonymous Content HTTP requests, even for a signed-in author/admin. Identity is checked through Users' private session endpoint, and public profile lookup uses bounded Users HTTP batches. Repeated profile/content requests are memoized within one operation only. Missing public profiles may be null; upstream errors never impersonate missing records.

Relation document IDs are SHA-256 hashes of the unambiguous `[userId, targetId]` JSON tuple. The relation retains `active=false` after removal, so retries have a stable target. A create/`lastUpdateTime`-conditional batch changes the relation and increments/decrements its aggregate together. Contention is retried at most five times with short backoff, then returns `CONFLICT`. Repeating an already-satisfied state performs no counter write. Comment creation uses a caller-provided attempt UUID with the same atomic count update; deletion uses an ownership check and a conditional logical-delete/count batch. Counters are not calculated by scanning all comments or reactions.

Firestore's batch atomicity does not span HTTP domains. A publication can be archived between the Content check and an interaction write; later compound reads still recheck public visibility and hide the publication/comments. Deleting a comment retains its server-private text and deletion timestamp; inactive relations and deleted comments currently have no automatic retention job. Product deletion is not a promise of physical database erasure. See [Firestore atomic writes](https://firebase.google.com/docs/firestore/manage-data/transactions) and [contention](https://firebase.google.com/docs/firestore/transaction-data-contention).

## Configuration

The untracked runtime needs `PORT` (3003), strong `JWT_SECRET` and `SERVICE_AUTH_SECRET`, `USERS_SERVICE_URL`, `CONTENT_SERVICE_URL`, and the shared server-only Firebase configuration described in [database](database.md). Production service URLs must use HTTPS. Local emulator settings must be complete and loopback-only; mixed cloud/emulator configuration fails closed. Each service owns its Admin client. Never put private keys into a `VITE_*` variable.

```bash
npm run dev:interactions
npm run test --workspace @otherbloc/interactions-service
npm run test:integration:running
```

Integration uses the isolated `demo-otherbloc-test` namespace, three real domain HTTP applications, the gateway and real Firestore/Storage emulators. Fixtures are removed only by their tracked test-owned IDs. Development E2E drives UI changes through the gateway and undoes test comments/relations using their owning APIs. No development collection wipe is part of testing.

## Current verification boundary

API checks cover composition, privacy, duplicate/concurrent writes, cursor ownership, own deletion, missing/archived targets, upstream failures, expired/forged/revoked sessions and persistence after replacing the HTTP application. Browser checks exercise live reading, buttons, lists, reload, accessibility and a genuinely committed comment whose response is deliberately lost before an idempotent retry. This is local emulator evidence. Real-cloud persistence, deployed indexes, Render/Firebase URLs and measured load-test targets are not yet verified.
