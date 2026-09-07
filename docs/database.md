# Firebase data boundary

Firestore and Firebase Storage remain the sole database/file infrastructure. Each of the three domain services owns its Firebase Admin client. Production configuration requires `FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET` and either Application Default Credentials or the server-only `FIREBASE_CLIENT_EMAIL` / `FIREBASE_PRIVATE_KEY` pair. Do not send service-account material to the frontend.

Local mode requires a `demo-*` project, loopback `FIRESTORE_EMULATOR_HOST` and `FIREBASE_STORAGE_EMULATOR_HOST`, and non-production mode. Partial or mixed cloud/emulator configuration fails closed. Run locally using [development instructions](development.md).

## Access rules and data integrity

`firestore.rules` and `storage.rules` deny every direct client read/write. All product data requests must enter through the gateway and an owning backend service. Firebase Admin SDK bypasses these rules; production IAM credentials and application authorization protect its access. The emulator rule tests check anonymous and forged Firebase-authenticated clients, not just an unauthenticated happy path.

M2 has no business collections or compound queries yet. `firestore.indexes.json` is intentionally empty until actual domain queries define their indexes. Integration tests temporarily own `_checks/test-<uuid>` records and Storage objects, then remove only those records. They verify concurrent atomic increments, a read/write transaction and byte/metadata persistence. This is emulator evidence, not a real-cloud deployment.

Firestore is a document-oriented NoSQL database with strongly consistent reads and ACID transactions; NoSQL does not imply eventual consistency. Atomic operations and transactions are database mechanisms, whereas JavaScript `async/await` only coordinates asynchronous application work. Replication is managed by Firebase and differs by chosen database location; this application does not implement a replication protocol. See [Firebase's reads and writes documentation](https://firebase.google.com/docs/firestore/understand-reads-writes-scale). Production location, indexes and service ownership details will be recorded with the domain/deployment milestones.
