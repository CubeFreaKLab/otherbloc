# Firebase data boundary

Firestore and Firebase Storage remain the sole database/file infrastructure. Each of the three domain services owns its Firebase Admin client. Production configuration requires `FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET` and either Application Default Credentials or the server-only `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` pair. Do not send service-account material to the frontend.

Local mode requires a `demo-*` project, loopback `FIRESTORE_EMULATOR_HOST` and `FIREBASE_STORAGE_EMULATOR_HOST`, and non-production mode. Partial or mixed cloud/emulator configuration fails closed. Run locally using [development instructions](development.md).

## Access rules and data integrity

`firestore.rules` and `storage.rules` deny every direct client read/write. All product data requests must enter through the gateway and an owning backend service. Firebase Admin SDK bypasses these rules; production IAM credentials and application authorization protect its access. The emulator rule tests check anonymous and forged Firebase-authenticated clients, not just an unauthenticated happy path.

Integration tests temporarily own `_checks/test-<uuid>` records and Storage objects, then remove only those records. They verify concurrent atomic increments, a read/write transaction and byte/metadata persistence. Users integration adds isolated account/session/avatar fixtures, with cleanup limited to test-owned IDs. This is emulator evidence, not a real-cloud deployment.

## Users-owned collections — M3

| Collection / ID | Fields and relationships | Access/query |
| --- | --- | --- |
| `users/{id}` | Random UUID for registration; stable named IDs for demo seed. `name`, normalized `email`, `passwordHash`, `role` reader/author/admin, `status` active/suspended, `biography`, nullable `avatarId`, `authorRequested`, integer `authVersion`, ISO `createdAt`/`updatedAt`, optional `demo=true` | Owning service only. Public serializer explicitly selects safe fields. Admin pagination orders by document ID with limit+1 and `startAfter` |
| `userEmails/{sha256(email)}` | Unique normalized-email reservation containing `userId` | Direct key lookup on login; create precondition enforces uniqueness in the registration batch |
| `userSessions/{uuid}` | `userId`, `authVersion`, current/previous refresh digests, `previousUntil`, `rotateAfter`, `createdAt`, `expiresAtMs`, Firestore timestamp `expiresAt`, nullable `revokedAt` | Direct lookup by authenticated session ID; current user/version must also match |
| `userAvatars/{uuid}` | `userId`, server-generated Storage `path`, byte `size`, `contentType`, ISO `createdAt` | Only the current avatar reference is publicly retrievable through Users; older objects stay private pending maintenance |
| `userSecurity/platform` | Integer `activeAdmins` | Updated atomically with administrative role/status changes; no public read/write |

These collections belong exclusively to Users. Other services obtain identity/profile information over HTTP. Public JSON never includes password hashes, refresh digests or private email. Names are 2–80 characters, biographies at most 600, emails normalized and validated, and all write input schemas reject unknown fields. Role changes cannot be submitted through the profile endpoint.

No compound index is required for M3's document-ID listing and direct lookups. `firestore.indexes.json` excludes password hashes, biographies and refresh digests from unnecessary indexes, and declares session expiration TTL for future cloud cleanup. Application expiration checks are immediate; TTL deletion is asynchronous and is not emulated or treated as authorization. TTL deployment and billed deletion behavior must be reviewed with the real-cloud setup.

Registration is one atomic batch. Profile, permissions, password and avatar-reference changes revalidate identity inside a transaction. Refresh rotation uses `lastUpdateTime` as a compare-and-set precondition and bounded rereads; this avoids lock-upgrade contention while preserving logout/version checks. Storage and Firestore do not share one cross-product transaction: upload precedes reference attachment and failed attachment attempts cleanup of that new object.

Firestore is a document-oriented NoSQL database with strongly consistent reads and ACID transactions; NoSQL does not imply eventual consistency. Atomic operations and transactions are database mechanisms, whereas JavaScript `async/await` only coordinates asynchronous application work. Replication is managed by Firebase and differs by chosen database location; this application does not implement a replication protocol. See [Firebase's reads and writes documentation](https://firebase.google.com/docs/firestore/understand-reads-writes-scale). Production location, indexes and service ownership details will be recorded with the domain/deployment milestones.
