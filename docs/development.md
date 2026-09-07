# Local development

Requires Node.js 24 (minimum 22.12), npm and Java 21 or newer. Install from the lockfile at the repository root:

```bash
npm ci
npm run setup:local
npm run emulators
```

In a second terminal:

```bash
npm run dev
```

The frontend is on port 5173, gateway 3000, Users 3001, Content 3002 and Interactions 3003. Open the frontend, not a service port. The emulator UI is on `http://127.0.0.1:4000`; Firestore uses 8080 and Storage 9199. These ports must be available. A production frontend build is `npm run build`.

`setup:local` creates an ignored `.env.local` with randomly generated JWT, internal-service and configurable test-account secrets. It never overwrites an existing file or prints its values. Account variables reserve the future seed interface; M2 does not create accounts yet. Never reuse local secrets in production. Vite receives only public `VITE_*` settings, not backend credentials.

The start scripts load the root local configuration and refuse cloud project IDs. The fixed `demo-otherbloc` project and **both** emulator hosts prevent accidentally using cloud data. Independent services retain their own `npm start` entry points for deployment with externally supplied environment variables.

## Persistence, import and export

Firestore and Storage run as actual Firebase emulators, not JavaScript in-memory substitutes. Stop the emulator terminal with Ctrl+C and allow it to finish exporting to ignored `.local-data/current`. The next start imports that snapshot automatically. `npm run emulators:export` exports a separate timestamped snapshot while the suite is running; it does not overwrite the current snapshot. These local exports are not cloud backups.

Stop the running development emulator suite before `npm run test:integration`, which creates its own isolated lifecycle and test-owned records. The test command requires the demo project and cannot use production credentials.

## Java on Windows

If the default Java is older than 21, set `OTHERBLOC_JAVA_HOME` in the private local environment to an installed Java 21+ directory. This affects only the emulator child process, not system configuration. On Windows environments where a virtualized temporary directory prevents Java Unix-domain socket creation, a writable non-virtualized directory can be supplied using `OTHERBLOC_JAVA_OPTIONS=-Djdk.net.unixdomain.tmpdir="D:/your/local/java-tmp"`. Create that directory first. Do not change firewall policy or disable platform protection to run the suite.

## Current milestone boundary

M2 verifies gateway forwarding, defensive HTTP handling, emulator persistence and deny-all direct-client rules. Account, publication and interaction business operations are subsequent milestones. Static editorial demo content in the current frontend is labeled; a failed API will not be represented as successful persistence. Hosting configuration exists but has not been deployed. README remains intentionally empty pending final documentation.
