# Testing

Node's built-in test runner verifies repository contracts, editorial filtering and HTTP behavior. Firebase Emulator Suite verifies data/rules integration. Playwright verifies browser behavior and accessibility.

## Full local verification

Run from the repository root after installing dependencies:

```bash
npm run lint
npm test
npm run test:integration
npm run build
npm run test:ui
npm run test:e2e
```

`npm test` first checks the repository layout, independent service entry points, assigned ports, and frontend-to-gateway boundaries. It then runs each backend workspace's tests against an ephemeral local server. The Interactions suite also executes the initial GraphQL operation.

`npm run build` compiles the React application with Vite. This catches module resolution, asset, JSX, and production bundling failures.

## Continuous integration

The Foundation CI workflow installs the lockfile with Node 24, runs lint, Node tests and build on pushes and pull requests. It does not deploy applications or require credentials. Emulator/browser integration will be added with the complete CI/CD milestone. A YAML file is not evidence that the current commit ran on GitHub.

## Test boundaries

Gateway tests cover actual HTTP forwarding, exact REST/GraphQL mapping, query/status preservation, header sanitization, origin/token rejection, upstream errors and request limits. Firebase tests verify Firestore concurrent atomic increments and a transaction, Storage bytes/metadata, deny-all direct-client rules and mixed-mode configuration rejection. They require Java 21+ and free emulator ports, or `test:integration:running` with an already running suite. Both routes isolate fixtures in `demo-otherbloc-test`; see [development](development.md).

Visual regression tests cover desktop/mobile editorial routes, search/filters/404, theme persistence, reduced motion, navigation, keyboard and Axe checks. They explicitly fixture profile/error responses to isolate layout. Install Chromium with `npx playwright install chromium` on a new machine. Lighthouse measures visual loading, not cloud or k6 performance.

M3 adds seven API integration tests (11 total with Firebase infrastructure checks): atomic duplicate registration, credential/private-field boundaries, expired/forged/revoked sessions, concurrent refresh, profile and password mutation, admin-only roles/pagination/suspension and avatar bytes/type/size/removal. They use real Firebase emulators, real Users HTTP and the real gateway. Initial concurrent transaction tests exposed lock-upgrade waits; registration now uses atomic create preconditions and refresh uses version-conditional writes. Failed first runs remain diagnostic evidence, not reported as passes.

Six end-to-end browser tests (three scenarios × desktop/mobile) drive actual account APIs, including registration, reload persistence, avatar, public/private profile separation, author request/approval, denied administration, unsaved-navigation protection and logout. Start the services/emulators and seed first. Screenshots and Axe checks cover the account in both themes; no auth trace/video retains credentials. Publication editor/interactions/cloud journeys are not yet covered at M3.

## Dependency review

M2 audit on 2026-09-07: zero high/critical issues; nine moderate findings, five in the optional Storage SDK dependency chain and four in development tooling. The UUID advisory concerns buffer handling in UUID v3/v5/v6, while the Storage HTTP helper imports v4. Firebase CLI also includes older stream-json/OpenTelemetry branches. Do not apply `npm audit fix --force`: the suggested downgrade breaks the current Firebase runtime. Track upstream fixes and rerun audit/integration before production. These findings are disclosed, not counted as resolved by passing tests.
