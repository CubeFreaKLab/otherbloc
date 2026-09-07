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

`npm test` first checks the repository layout, independent service entry points, assigned ports, and frontend-to-gateway boundaries. It then runs each backend workspace's tests against an ephemeral local server. Interactions also checks GraphQL schema/input/index/privacy contracts, internal access, HTTP batching/selection limits and safe errors.

`npm run build` compiles the React application with Vite. This catches module resolution, asset, JSX, and production bundling failures.

## Continuous integration

The Foundation CI workflow installs the lockfile with Node 24, runs lint, Node tests and build on pushes and pull requests. It does not deploy applications or require credentials. Emulator/browser integration will be added with the complete CI/CD milestone. A YAML file is not evidence that the current commit ran on GitHub.

## Test boundaries

Gateway tests cover actual HTTP forwarding, exact REST/GraphQL mapping, query/status preservation, header sanitization, origin/token rejection, upstream errors and request limits. Firebase tests verify Firestore concurrent atomic increments and a transaction, Storage bytes/metadata, deny-all direct-client rules and mixed-mode configuration rejection. They require Java 21+ and free emulator ports, or `test:integration:running` with an already running suite. Both routes isolate fixtures in `demo-otherbloc-test`; see [development](development.md).

Visual regression tests cover desktop/mobile editorial routes, search/filters/404, theme persistence, reduced motion, navigation, keyboard and Axe checks. They explicitly fixture profile/error responses to isolate layout. Install Chromium with `npx playwright install chromium` on a new machine. Lighthouse measures visual loading, not cloud or k6 performance.

M3 adds seven API integration tests (11 total with Firebase infrastructure checks): atomic duplicate registration, credential/private-field boundaries, expired/forged/revoked sessions, concurrent refresh, profile and password mutation, admin-only roles/pagination/suspension and avatar bytes/type/size/removal. They use real Firebase emulators, real Users HTTP and the real gateway. Initial concurrent transaction tests exposed lock-upgrade waits; registration now uses atomic create preconditions and refresh uses version-conditional writes. Failed first runs remain diagnostic evidence, not reported as passes.

Six end-to-end browser tests (three scenarios × desktop/mobile) drive actual account APIs, including registration, reload persistence, avatar, public/private profile separation, author request/approval, denied administration, unsaved-navigation protection and logout. Start the services/emulators and seed first. Screenshots and Axe checks cover the account in both themes; no auth trace/video retains credentials. Publication editor/interactions/cloud journeys are not yet covered at M3.

## Content integration — M4A

M4A adds ten Content integration scenarios (21 total) and four public-reading browser scenarios (10 total), plus four schema/index unit contracts (23 Node checks total). Actual HTTP + Firebase checks cover all blocks across an application restart, guarded optimistic concurrency, competing moderation/audit commits, cross-owner restrictions, draft secrecy including same-state admin retries, upload format/size/MIME/ownership, 640/960 derivative access, the lifecycle, logical deletion, keyset pagination and filter-scoped cursors, service failure and current role/session revocation. Bounded Users profile lookup is tested for privacy, missing/suspended accounts and limits.

E2E uses seeded Storage images, live account and publication APIs, desktop/mobile, both themes, reloaded search/content and current author profiles. One Content failure is explicitly injected to verify no fallback and successful retry; successful data responses are not mocked. The 18-test visual suite now explicitly fixtures Users and Content, including image bytes, and waits for real loading boundaries before layout checks. Performance remains open: integrated local Lighthouse 75/100/96/100 after responsive images, LCP 4.4 s / CLS 0.168; not the static M1 score and not a k6 result. Author editor/moderation UI acceptance is M4B.

## Author editor and moderation — M4B

Ten new E2E checks (five scenarios × desktop/mobile) use the actual gateway, Users/Content services and emulators. The complete E2E suite passes 20 checks. New coverage includes every block type, real image upload/rejection and private Blob previews, save/reload, reordering, canceled/confirmed removal, return-with-reason, approval, public reading, archival, recovery and deletion. Reader accounts are denied all author/moderation routes.

Controlled request delays prove that typing during an in-flight save survives the next save and reload, and that in-app navigation cannot discard a pending operation. Two tabs provoke a real 409 without overwriting server data; downloading local changes and explicitly reloading the server copy are tested. A 503 is deliberately injected only for the failed-save case; the later retry hits the real service. Invalid local tags do not prevent confirmed draft deletion. UUID test publications are logically deleted through the owning author's API, not by touching development collections directly.

The first full editor run passed 8/10 and exposed transient 3.99:1 primary-button contrast during theme changes. Production CSS now switches foreground/background together while preserving the circular transition. A subsequent full E2E run passed 20/20 in 3.3 minutes, alongside 23 Node checks, 21 emulator integration checks, 18 visual regression checks, lint and build. Screenshots and Axe checks cover both editor themes and responsive viewports. Dialog screenshots wait for the actual entrance animation to finish; they are not synthetic mockups. Visual inspection is separate from automated accessibility results. Cloud and load-test acceptance remain pending.

## GraphQL and personal interactions — M5

Nine Interactions API scenarios bring the isolated emulator suite to 30 passing checks. They start all four real HTTP applications and use each domain's own Admin client in `demo-otherbloc-test`: public composition, identity spoofing/role/privacy negatives, concurrent idempotent reactions/comments/follows with exact counters, own comment deletion, saved/followed/comment cursors, archived references, current session revocation, upstream outages and persistence after replacing the Interactions HTTP app. No extra storage substitute or cross-domain database access is used.

The Node suite passes 31 checks, including the UUID-v4 LAN fallback and rejection of oversized GraphQL selection sets and HTTP batches. The 18 visual regressions pass with explicit GraphQL reading fixtures, not live success replacements. Eight new E2E checks (four scenarios × desktop/mobile) cover real save/react/follow/comment, reload persistence, own deletion/undo, private library error/retry, visitor access, unsent-comment navigation focus and account isolation inside the same loaded browser document. The entire E2E suite passes 28 checks; lint and production build pass.

The lost-response test calls the real server and confirms that the comment was committed before aborting its browser response. The UI retries the same UUID/text and the persisted list contains exactly one matching comment after reload. The library-isolation test changes accounts through actual SPA links, confirms that the document was not reloaded, and verifies the second account cannot see the first account's saved relation. Both tests remove their own public comments/relations afterward through UI/API, without clearing development collections.

Manual IAB verification on the HTTP LAN address also created a synthetic reader comment and saved a reading, confirmed the saved item in Mi cuenta, and then removed both test interactions. This exercises the cryptographic ID fallback on a non-loopback HTTP origin. Genuine desktop/mobile light/dark captures were inspected; a library heading spacing defect was corrected and recaptured. These are local results, not Firebase cloud persistence or k6 throughput. Session revocation during unsaved editing is covered separately below.

## Interrupted sessions and identity-bound retries — M6A

The complete live E2E suite passes 40 checks (5.6 minutes). Twelve new checks run six scenarios in desktop and mobile: profile recovery and confirmed discard after actual server logout, a different account purging the previous copy, a comment retaining its attempt UUID across reauthentication, publication recovery with an unchanged server version, an advanced server version rejecting overwrite, and a browser cookie switching to another account during a pending profile request. Successful account/content responses are real gateway and emulator requests. An independent authenticated request context advances the publication version without replacing the browser's session.

The cookie-switch regression first failed: the old account's pending profile write was automatically retried under the new account. The shared gateway client now binds requests to their starting identity, checking before authenticated retries and before accepting responses. The verified regression passes in both viewports. An intermediate rerun failed earlier at registration because watched development services restarted and returned 503; it is retained as a failed environment run, not counted as a pass.

Recovery tests verify no private text or download while anonymous, explicit same-account restoration, disabled exit/password controls while copies remain, canceled and confirmed discard, keyboard focus, Axe checks and both themes. Snapshots are only in the current document's memory; tests do not claim they survive closing or reloading an unsaved tab. Version conflicts preserve the original base version, and a JSON download is not a server save. The Node suite passes 32 checks, including cloned, owner-scoped snapshot lifetime. The 12 affected E2E checks pass again after final cleanup hardening, and all 18 visual regressions pass (47.1 seconds). Lint and production build also pass. No cloud, k6 or complete motion acceptance is implied.

## Dependency review

M2 audit on 2026-09-07: zero high/critical issues; nine moderate findings, five in the optional Storage SDK dependency chain and four in development tooling. The UUID advisory concerns buffer handling in UUID v3/v5/v6, while the Storage HTTP helper imports v4. Firebase CLI also includes older stream-json/OpenTelemetry branches. Do not apply `npm audit fix --force`: the suggested downgrade breaks the current Firebase runtime. Track upstream fixes and rerun audit/integration before production. These findings are disclosed, not counted as resolved by passing tests.
