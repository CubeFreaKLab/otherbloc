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

## Navigation and transient surfaces — M6B

Six new scenarios run in both viewports, bringing the complete live E2E suite to 52 passing checks (6.4 minutes). They verify Back after a delayed real feed response, exact source-link focus and scroll, a direct reading fragment, mobile menu layout stability/keyboard/resize/reduced motion, actual modal exit animations and retained outgoing text, reader/author/admin footer destinations, and a keyboard interaction during a pending return that must not lose focus when data arrives. Modal screenshots and Axe checks cover light/dark. Existing reader/editor/moderation/recovery journeys remain in the same passing suite; duplicated footer destinations are selected by their intended landmark, without removing behavioral assertions.

The exit test observes actual DOM/CSS animation state after native cancellation. One initial observer read happened before the asynchronous cancel event; the test now waits for that event's observation before inspecting it. A separate pre-fix diagnostic reproduced unfocused direct fragments; a mistaken card selector was a test defect and is not attributed to the application. Logs retain those distinctions. Node checks remain 32 passing; all 18 visual regressions pass (47.7 seconds), and lint/build pass. Genuine menu and dialog screenshots were visually reviewed in both responsive layouts and dialog themes. The integrated-browser manual attempt remained on a loading skeleton and its panel-open request was queued, so it is not counted as a successful manual reading. This milestone does not verify complete route motion, load performance or cloud deployments.

## Reading continuity and route transitions — M6C

The complete live E2E suite passes 64 checks (7.9 minutes), including ten motion checks across desktop/mobile. These inspect native View Transition snapshots: one decoded cover in each direction, ready reading data rather than a captured skeleton, explicit parent-child direction, fade-only main destinations, separate theme snapshots, reduced motion including a history return after previously animated navigation, and browsers without the API. A gated successful reading response proves cancellation cannot commit a late result; an explicitly stalled image decoder reaches its budget and reading proceeds with a fade. Successful business responses still come from the real gateway and emulators.

A later audit reproduced a separate late-Back defect: starting a comment during a delayed POP preserved the text but replaced the previous history entry. The guard now restores the original Router history index. Six affected checks pass afterward (37.3 seconds): pending-save protection, late-link editing and late-history editing in both viewports. The new history checks assert the original key/index, focused retained text, and subsequent Back/Forward destinations. This brings the defined E2E inventory to 66; it is not presented as a full 66-check run.

One earlier full run passed 63/64: Axe crossed a theme style update and combined the new background with previously read text colors. Diagnostics recorded complete old and new color pairs, and repeated settled scans passed. The recovery test now requires the selected theme's actual background/text colors before running the unchanged WCAG audit; six repeated recovery checks pass (50.7 seconds). Independently, route names now exist only during a transition, and reduced-motion name removal has sufficient specificity. Native animations are inspected through their real browser state; continuity screenshots pause all relevant animations at the same 160 ms timeline instant, not at each animation's individual midpoint.

All ten motion checks pass again after the final history guard (46.7 seconds), and all 18 visual checks pass (49.7 seconds). Visual search assertions are scoped to the results landmark; access keyboard checks wait for the actual destination heading, because the URL can change before the new form commits. No keyboard, empty-state or contrast assertions were removed. Genuine light/dark desktop/mobile transition captures were inspected.

Node checks total 34 and final lint/build pass. The main bundle is 342.31 kB with Apollo's separate 168.75 kB lazy chunk; these are not Lighthouse or load-test scores. Initial Vite stale-module exports, watched-backend 503s, test selector/timing defects and an actual undecoded incoming cover are retained as separate diagnostic failures. Stable verification runs the same four backend apps without file watching, against the same emulators. Cloud, k6 and the remaining administrative recovery audit are still separate work.

## Administrative recovery and private identity — M6D

The complete live E2E suite passes all 78 checks in 9.1 minutes. Twelve new checks cover return/archive reason recovery, a concurrently published newer version, a publication withdrawn into a private draft, entering another account, and an authenticated cookie swap between accounts that can both use the author workspace. All run in desktop/mobile viewports against the gateway and real emulators. Only test-owned UUID publications are withdrawn and logically deleted in cleanup.

The tests revoke the current server session outside the SPA, attempt the real decision, reauthenticate through the UI and require explicit recovery. Downloaded JSON must contain exactly the personal reason, action and original version. Anonymous views expose neither reason nor download; a changed version cannot receive the old decision, and an inaccessible draft remains inaccessible. The identity-swap test requires a new private-list request and verifies that the old list disappears without replaying the old account's creation request.

Four genuine light/dark desktop/mobile recovery captures were visually inspected, with no overflow and no Axe WCAG A/AA violations. An initial desktop diagnostic passed four checks and failed one because the test expected the muted color on a section that correctly inherits the main text color; the expectation was corrected without changing CSS or disabling accessibility checks. The final twelve-check targeted run passes in 1.1 minutes before the full suite. Node checks remain 34; lint and production build pass. No backend, database schema, permission or cloud configuration changed in this milestone. This closes local M6, not clean-install/load testing or real cloud delivery.

## Stable local verification runtime

`node scripts/dev.mjs --no-watch` starts the same four backend applications without automatic restarts; Vite remains the frontend development server. The normal watch default is preserved, and misspelled flags fail explicitly. The browser preflight checks all four backend health endpoints, including Interactions, before launching Playwright.

After switching to this public stable entry point, nine targeted desktop checks pass in 50.4 seconds: public Firestore/Storage reading and search, six moderation/identity cases, and the cross-account retry regression. All 35 Node checks, lint and build pass. The earlier full 78-check run belongs to M6D. This mode provides repeatable verification without claiming that the original Windows watch-restart trigger has been reproduced or fixed.

## Export/import verification and emulator isolation

Snapshot verification compares canonical hashes of every document, including publication history subcollections, and every Storage object's bytes/content type. The initial round trip matched 2,276 documents and 248 files (2,178,026 bytes). After preserving later session updates, the final recovery and default `.local-data/current` import match 2,278 documents and the same 248 files. These are dated development-data counts, not required seed sizes or production measurements. No credentials or document contents appear in the fingerprint reports.

Parallel restoration exposed a real Firebase Storage emulator collision: different ports/project IDs still shared its fixed temporary blob directory, which one instance removed on shutdown. The surviving Firestore state was exported before restarting; verified Storage copies were retained and restored. Local commands now isolate development/standalone-test temporary directories, and the independent restore verifier uses a third one. After closing that verifier, the still-running development instance matched its complete fingerprint, proving that its blobs remained usable. Earlier failed/interrupted integration/browser runs are kept as diagnostics, not passes.

The supported Firebase Tools module export completes with exit code 0 and a manifest containing both stores. The old CLI export wrote complete files but then hit a Windows forced-exit assertion. A real interactive terminal also verified SIGINT export/cleanup and the next default import; terminating the non-interactive process tree did not export, so it is not documented as safe shutdown. Missing explicit snapshots and invalid commands fail rather than silently starting empty.

After the final restore, all 30 API integration checks pass (58.25 seconds), all ten targeted desktop user/content/editor journeys pass (1.7 minutes), and 36 Node checks, lint and build pass. This is local emulator evidence; clean installation, k6, cloud persistence and CI/CD still require separate verification.

## Clean checkout verification — M7C

A separate local clone of commit `7e24e12` installed with `npm ci`, without inherited `node_modules`, `.env.local` or emulator snapshots. Setup generated independent secrets. Its Firestore instance had zero collections before seeding; `seed:users` created six demo accounts, and `seed:content` created, reviewed, published and publicly read all seven demo publications with Storage images. The existing Node/npm, Java 21 installation and per-user Chromium cache were prerequisites, not newly installed operating-system components.

On that checkout, all 36 Node checks, lint and build pass, as do all 30 API integration checks (60.73 seconds) and fourteen targeted desktop E2E checks (2.6 minutes): users, content, editor/moderation and interactions. These include actual registration/avatar, three roles, save/reload/conflict, publication visibility, lost-response comment retry and cross-account library isolation. Genuine home-light/editor-dark captures were inspected; this is not a new full desktop/mobile regression run.

The original environment was exported and stopped before the clean suite occupied its ports. The clone used its own temporary storage and exported to its own snapshot on interactive shutdown. The original then imported its separate `current` snapshot, with live public-content/Storage reading verified again. No private configuration or test data was transferred between the two copies. The nine disclosed moderate dependency findings remain; clean installation does not resolve advisories or prove cloud delivery.

## Load acceptance — M7D

The local k6 run passes 50 constant virtual users for 60 seconds, with 11,476 real gateway requests, 22,952 successful business checks and no failed HTTP requests. Overall P95 is 31.63 ms; each of the four independent route thresholds also passes below 400 ms. The workload includes actual public REST data, owner-service GraphQL composition and Storage image bytes. See [load testing](load-testing.md) for reproducible commands, exact routes, hardware, per-route results, retained diagnostic failures and limitations. This is neither a cloud result nor an authenticated-write stress test.

The new workload/configuration contract brings Node checks to 37; lint and build pass. Reading UI remains unchanged and is checked against the live services after the run. The previously verified clean checkout remains `7e24e12`; load tooling was added afterward.

## Reading fonts and layout reservation — M7E

Four new browser checks (two scenarios in both viewports) bring the visual suite to 22 passing checks (51.2 seconds). They require the initial Spanish page to request Latin Georgia without the complete regular file, compare shaped text widths against all four original styles, confirm complete-font availability for Greek/Cyrillic, and hold back the actual logo response to verify identical reserved dimensions before/after loading. The font generator independently verifies all 240 retained characters in each variant, including outlines, horizontal and vertical metrics, and unchanged source files. Normal Node checks remain 37; lint/build pass.

The integrated mobile Lighthouse run reports 85 performance, 100 accessibility, 96 best practices and 100 SEO, with CLS 0 and LCP 4.257 seconds. The full report and prior 84-point run remain private. Font transfer and logo sizing improved; the initial image's client-side discovery and expected anonymous-refresh 401 remain disclosed. This is not a cloud score or a replacement for authorization/end-to-end coverage.

After the final assets, 40 live desktop/mobile E2E checks pass in 4.7 minutes across public content, author/editor/moderation, navigation and motion. They use the actual gateway, owner services and emulators, including Storage, errors, unsaved changes, role-aware footer destinations, focus/history and reduced motion. Four fresh home screenshots (desktop/mobile × light/dark) were opened and visually inspected. This targeted run does not replace or claim a new full 78-check run.

## Complete disposable CI sequence — M7F

Platform CI now prepares installation, Node contracts, lint/build, visual/accessibility checks, fresh emulators, API integration, demo seeds and complete live desktop/mobile E2E. The local equivalent passes 43 Node checks, 22 visual checks with `CI=true` (1.2 minutes), all 30 API checks (62.04 seconds) and all 78 E2E checks (9.3 minutes) in a new disposable checkout. The wrapper exits 0 after its application children and emulators stop; the required ports are confirmed free. Actionlint 1.7.12 accepts the workflow. No GitHub-hosted run is claimed.

Six new contracts verify CI isolation, environment/port guards, readiness and process failures, and workflow ordering. Negative runs over an existing private configuration and directly through the inner entry point fail before startup. Fresh credentials and temporary storage are distinct from development; no original snapshot is imported or overwritten. Four actual clean-run home screenshots are retained privately and inspected across both viewports/themes. Authentication traces/video remain off and the workflow uploads no private artifacts. See [CI setup, commands, verification and limitations](ci-cd.md); actual Actions/CD remain dependent on the owner's push and authorized cloud setup.

## Exact deployment-version contracts — M7G1

Seven new Node checks bring the total to 50: each owned backend validates full, matching runtime SHAs; frontend checks distinguish clean/dirty/unavailable Git state, reject inconsistent declarations and emit only the public manifest fields. HTTP health tests also require the revision field and `Cache-Control: no-store`. CI environment tests reject inherited backend deployment labels.

All 50 checks, lint/build and the 30 real API checks pass (59.19 seconds for API). Four targeted public-reading E2E checks pass in desktop/mobile (27.5 seconds), including persisted publication/profile/media data, search/filter routing and error recovery. Four genuine production-preview screenshots were inspected in both themes and sizes. The latest complete 78-case run remains M7F; these four do not replace it.

Actual startup of each backend with a malformed revision fails with exit 1 before listening, without disrupting the already running service. Restarting without revision metadata produces null at all four healthy endpoints. A production build from the uncommitted worktree correctly identifies the current HEAD and `dirty: true`. See [revision metadata and its limits](ci-cd.md#exact-revision-metadata); a local preview does not verify cloud cache headers, real Actions or Firebase persistence.

## Render controller preparation — M7G2

Thirteen new fixture-based contracts bring Node checks to 63. They validate four distinct targets, release-context guards, Blueprint/service identity and independent auto-deployment controls, no active deployment, safe requests, sequential exact-SHA rollout, live/health acceptance, timeouts, partial failure and no automatic retry of uncertain POSTs. A child-process test confirms that the public write command refuses local execution before credentials or network access. A noncanonical-origin port accepted by the initial version was caught, corrected and retained as a failed diagnostic.

The complete Node suite, lint and build pass. Two real desktop reading journeys pass again in 12.7 seconds; their light/dark home screenshots were inspected and retained privately. Render requests in the controller tests are controlled fixtures, not real Render calls or cloud evidence. Existing application code, persistence, permissions and visual composition are unchanged. See [Render preparation, controls and limits](render-deployment.md); actual API permissions, protected Actions execution and cloud acceptance remain pending.

## Manual Hosting/Render workflow — M7G3

Eight new controlled-response contracts bring Node checks to 71. They test project/site/service-account and gateway bindings, clean workflow manifests, identified production reviewers and main-only policy, failed settings reads, stale/cacheable Hosting responses, local context rejection, same-commit workflow ordering/permissions and credential-file exclusions. Both YAML files pass Actionlint 1.7.12. The initial lint run caught repeated spaces in test regular expressions; they were changed to explicit repetition counts, then affected contracts, lint and build passed.

No production API is called by these fixtures or by the deliberately rejected local CLI. Actual GitHub protection, Google WIF/IAM, Render resources, Hosting headers and three-role Firebase-cloud persistence still require authorized execution. No new full API/browser suite is attributed to this operational-only change. See [manual release sequencing and limits](ci-cd.md#manual-production-workflow).

## Dependency review

M2 audit on 2026-09-07: zero high/critical issues; nine moderate findings, five in the optional Storage SDK dependency chain and four in development tooling. The UUID advisory concerns buffer handling in UUID v3/v5/v6, while the Storage HTTP helper imports v4. Firebase CLI also includes older stream-json/OpenTelemetry branches. Do not apply `npm audit fix --force`: the suggested downgrade breaks the current Firebase runtime. Track upstream fixes and rerun audit/integration before production. These findings are disclosed, not counted as resolved by passing tests.
