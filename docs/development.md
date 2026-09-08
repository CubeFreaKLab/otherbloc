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

For integration verification or load testing, use `npm run dev -- --no-watch` (or `node scripts/dev.mjs --no-watch`). This starts the same four backend applications without development watch restarts; Vite still provides its normal frontend development server. Individual `dev:gateway`, `dev:users`, `dev:content` and `dev:interactions` commands accept the same flag. Without the flag, normal backend watching remains enabled. Do not edit frontend source during a browser test or run a load test alongside another resource-intensive suite. Stop the development terminal with Ctrl+C; this does not stop the separate emulator terminal.

`setup:local` creates an ignored `.env.local` with randomly generated JWT, internal-service and configurable test-account secrets. It never overwrites an existing file or prints its values. Never reuse local secrets in production. Vite receives only public `VITE_*` settings, not backend credentials. During development `/api` is forwarded by Vite to gateway port 3000, including when browsing from a phone on the LAN.

## Demo accounts and browser tests

With emulators running, use `npm run seed:users`. It creates a reader, four synthetic editorial authors and an administrator, all marked `demo=true`. The main test accounts use `SEED_READER_EMAIL`, `SEED_AUTHOR_EMAIL`, `SEED_ADMIN_EMAIL` and `SEED_PASSWORD` from the private local file. Default placeholder emails are reader/author/admin at `example.test`; no password is committed or printed. Additional author addresses use their demo IDs at that reserved test domain. Re-running keeps existing accounts unchanged and refuses collisions with unrelated accounts.

With services running, use `npm run seed:content` after `seed:users`. Seven Spanish publications are created, saved with Storage portadas, submitted, approved and publicly read through the gateway. Existing marked demo publications are preserved; dates reflect actual seed publication time, not invented past events. If a previous seed was interrupted, the remaining draft can be continued by its owner. `node scripts/seed-content.mjs --prepare-images` adds missing responsive derivatives to existing demo assets without replacing original images or editorial text.

Open `/login` to use a demonstration account, or `/register` to create your own. Every active normal account can read and write immediately; no author request or second account is needed. `/account` provides profile/avatar/session controls and private library/writing links. `/author` opens your publications and the continuous Editor; administrators use `/admin/publications` to review each note before publication. `/admin/users` remains administrator-only. Public home/explore/article/profile read persisted publications. Articles support comments, reactions, saving and following through GraphQL.

`npm run test:e2e` requires the development services, emulators and seed to be running. It drives real browser account journeys at 1440×1000 and 390×844, without replacing business API responses. It creates clearly named local `e2e-*` test accounts that remain in the demo database for inspection. Authentication traces/video are disabled to avoid retaining request-body credentials. `npm run test:ui` is a separate visual regression suite with explicit profile/error fixtures, not a persistence test.

The start scripts load the root local configuration and refuse cloud project IDs. The fixed `demo-otherbloc` project and **both** emulator hosts prevent accidentally using cloud data. Independent services retain their own `npm start` entry points for deployment with externally supplied environment variables.

## Persistence, import and export

Firestore and Storage run as actual Firebase emulators, not JavaScript in-memory substitutes. Stop the emulator terminal with Ctrl+C and allow it to finish exporting to ignored `.local-data/current`. The next start imports that snapshot automatically. `npm run emulators:export` exports a separate timestamped snapshot while the suite is running; it does not overwrite the current snapshot. These local exports are not cloud backups.

To restore a chosen snapshot, first export and stop the current suite, then run:

```bash
npm run emulators -- start --import=.local-data/export-YOUR-TIMESTAMP
```

Replace the directory with an actual snapshot. A missing manifest is an error, never permission to start with an empty database. An explicit import replaces the next in-memory starting state; the source snapshot is left unchanged, and clean shutdown exports the new state to `current`. Do not terminate the process tree or close the terminal while it is exporting. Forced termination cannot guarantee an exit snapshot; use a timestamped export first when in doubt.

Start/standalone-test scripts give Firebase separate temporary directories under `.local-data/emulator-runtime/{development,test}`. The export command uses the same development temporary directory to discover its hub. This matters because the Storage emulator stores live blobs below a fixed `os.tmpdir()` path: two suites sharing that path can delete each other's files on shutdown even with different ports/project IDs. Any manually launched parallel suite must also use distinct `TMP`, `TEMP` and `TMPDIR` directories, ports and a demo project. These changes affect only the local process, not system settings. Do not manually delete live runtime directories.

Timestamped export uses Firebase Tools' supported Node module API and verifies that its manifest includes both Firestore and Storage. This avoids the CLI's forced-exit path that produced a Windows `UV_HANDLE_CLOSING` abort after writing a complete export. Export errors still fail the command; an export message alone is not restoration evidence. See [Firebase's module API](https://github.com/firebase/firebase-tools#using-as-a-module) and [emulator import/export](https://firebase.google.com/docs/emulator-suite/install_and_configure#export_and_import_emulator_data).

Stop the development emulator suite before `npm run test:integration`, which creates its own emulator lifecycle. If the suite is already running, `npm run test:integration:running` reuses its loopback servers without stopping development. Both commands require `demo-otherbloc-test` and both loopback emulator hosts; owner clients receive a random named Firestore database and bucket shared only within each test-file process. Cleanup removes only that test's records/objects and never resets a development database.

Do not treat a different project ID as data isolation: in the imported development emulator, an SDK/REST read under a new demo project still exposed the existing default database. Named-database reads were independently empty, and the tests now explicitly verify that their writes/uploads do not appear in default resources. The emulator can warn about the intentional test project ID. Implicit named databases use emulator defaults, so direct-client deny-all rule tests remain a separate check against the committed rules on the default emulator database/bucket; business tests exercise real owner APIs/Admin SDK authorization in their named resources. This is test-only dependency injection, not an additional product database or a change to cloud factories. See [Firebase's named emulator databases](https://firebase.google.com/docs/emulator-suite/connect_firestore#instrument_your_app_to_talk_to_the_emulators).

## Java on Windows

If the default Java is older than 21, set `OTHERBLOC_JAVA_HOME` in the private local environment to an installed Java 21+ directory. This affects only the emulator child process, not system configuration. On Windows environments where a virtualized temporary directory prevents Java Unix-domain socket creation, a writable non-virtualized directory can be supplied using `OTHERBLOC_JAVA_OPTIONS=-Djdk.net.unixdomain.tmpdir="D:/your/local/java-tmp"`. Create that directory first. Do not change firewall policy or disable platform protection to run the suite.

## Current milestone boundary

M6 connects all three domains and protects interrupted work across profiles, comments, author editing and administrative observations. Public navigation uses actual route data, reading-cover continuity, bounded focus/history restoration and reduced-motion alternatives. Private workspaces reset on account changes. Browser regression explicitly fixtures data; end-to-end tests use real emulator APIs, including lost-response retry and same-app account isolation. A failed API is never represented as successful persistence.

M7 verifies snapshot restoration and installation from a separate clean checkout: fresh dependencies/configuration, an empty emulator database, both seeds, 36 Node checks, 30 API checks and fourteen desktop user/content/editor/interactions journeys. Existing Node/npm, Java and the per-user Chromium cache were reused as prerequisites; no private environment file or database was inherited. [Local k6 reading verification](load-testing.md) subsequently passes 50 VU/60 seconds with P95 31.63 ms and zero HTTP failures. Font/logo verification and integrated browser measurements are recorded in [frontend performance](frontend.md#asset-and-performance-maintenance), including the remaining constrained-network LCP opportunity.

[Platform CI](ci-cd.md) adds a separate disposable-checkout workflow for visual tests, API integration and the complete live browser suite. Its `test:ci` stage refuses existing private configuration or occupied ports and must not be run over an established development environment. Startup guidance remains in this document; [frontend](frontend.md) describes the actual screens and [testing](testing.md) the verification boundaries. README is intentionally reserved for the owner. Hosting/Render and real GitHub CI/CD still require their own evidence; technical documentation does not replace that acceptance.
