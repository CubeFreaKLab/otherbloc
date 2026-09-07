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

`setup:local` creates an ignored `.env.local` with randomly generated JWT, internal-service and configurable test-account secrets. It never overwrites an existing file or prints its values. Never reuse local secrets in production. Vite receives only public `VITE_*` settings, not backend credentials. During development `/api` is forwarded by Vite to gateway port 3000, including when browsing from a phone on the LAN.

## Demo accounts and browser tests

With emulators running, use `npm run seed:users`. It creates a reader, four synthetic editorial authors and an administrator, all marked `demo=true`. The main test accounts use `SEED_READER_EMAIL`, `SEED_AUTHOR_EMAIL`, `SEED_ADMIN_EMAIL` and `SEED_PASSWORD` from the private local file. Default placeholder emails are reader/author/admin at `example.test`; no password is committed or printed. Additional author addresses use their demo IDs at that reserved test domain. Re-running keeps existing accounts unchanged and refuses collisions with unrelated accounts.

With services running, use `npm run seed:content` after `seed:users`. Seven Spanish publications are created, saved with Storage portadas, submitted, approved and publicly read through the gateway. Existing marked demo publications are preserved; dates reflect actual seed publication time, not invented past events. If a previous seed was interrupted, the remaining draft can be continued by its owner. `node scripts/seed-content.mjs --prepare-images` adds missing responsive derivatives to existing demo assets without replacing original images or editorial text.

Open `/login` to use any seeded role. `/account` provides profile/avatar/session controls, reader author requests and links to private saved/followed lists; `/admin/users` is administrator-only. Public home/explore/article/profile read persisted publications. Authors use `/author` and its block editor; administrators use `/admin/publications` for moderation. Articles support comments, reactions, saving and author following through GraphQL. Public registration creates readers only.

`npm run test:e2e` requires the development services, emulators and seed to be running. It drives real browser account journeys at 1440×1000 and 390×844, without replacing business API responses. It creates clearly named local `e2e-*` test accounts that remain in the demo database for inspection. Authentication traces/video are disabled to avoid retaining request-body credentials. `npm run test:ui` is a separate visual regression suite with explicit profile/error fixtures, not a persistence test.

The start scripts load the root local configuration and refuse cloud project IDs. The fixed `demo-otherbloc` project and **both** emulator hosts prevent accidentally using cloud data. Independent services retain their own `npm start` entry points for deployment with externally supplied environment variables.

## Persistence, import and export

Firestore and Storage run as actual Firebase emulators, not JavaScript in-memory substitutes. Stop the emulator terminal with Ctrl+C and allow it to finish exporting to ignored `.local-data/current`. The next start imports that snapshot automatically. `npm run emulators:export` exports a separate timestamped snapshot while the suite is running; it does not overwrite the current snapshot. These local exports are not cloud backups.

Stop the development emulator suite before `npm run test:integration`, which creates its own emulator lifecycle. If the suite is already running, `npm run test:integration:running` reuses its loopback servers without stopping development. Both commands use the separate `demo-otherbloc-test` project/bucket, not development accounts in `demo-otherbloc`; tests fail closed on any other project ID. The emulator may warn about this intentional second demo project. Test cleanup removes only its own records and never resets development data.

## Java on Windows

If the default Java is older than 21, set `OTHERBLOC_JAVA_HOME` in the private local environment to an installed Java 21+ directory. This affects only the emulator child process, not system configuration. On Windows environments where a virtualized temporary directory prevents Java Unix-domain socket creation, a writable non-virtualized directory can be supplied using `OTHERBLOC_JAVA_OPTIONS=-Djdk.net.unixdomain.tmpdir="D:/your/local/java-tmp"`. Create that directory first. Do not change firewall policy or disable platform protection to run the suite.

## Current milestone boundary

M5 connects all three domains: accounts/sessions, the publication editor/moderation and composed GraphQL interactions with private libraries. Browser regression explicitly fixtures data; end-to-end tests use real emulator APIs, including lost-response retry and same-app account isolation. A failed API is never represented as successful persistence. Cross-area recovery/motion, final performance/load verification, Hosting/Render and real CI/CD are not complete. README remains intentionally empty pending final documentation.
