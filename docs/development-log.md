# Development log

## Complete isolated CI verification — 2026-09-07

- Expanded the existing workflow into reusable Platform CI with pinned setup actions, read-only repository permission, Node 24/Java 21, Chromium/system dependencies and sequential visual/API/live browser stages. No cloud credentials, persisted Git credentials, artifact upload, push or deployment is included.
- Added a disposable-checkout runner that rejects existing private settings/snapshots and occupied ports, removes inherited cloud targets/credentials and rate overrides, generates fresh demo settings and isolates emulator temporary storage. It requires actual readiness, preserves failed command results and closes only its owned application children; Firebase manages its emulator shutdown.
- Verified a fresh clone/installation with 43 Node checks, lint/build, 22 CI-mode visual checks (1.2 minutes), 30 API checks (62.04 seconds), six accounts/seven published Storage-backed readings and all 78 E2E checks (9.3 minutes). The complete runner exits 0 and leaves no required port occupied. Six new contract checks and two deliberately rejected unsafe invocations pass; Actionlint accepts the final workflow.
- Inspected four genuine clean-run screenshots and kept logs/source hashes private. Backed up and restored the separate original development environment. Existing runtime/browser/emulator caches and nine moderate dependency advisories are disclosed. This is local CI-equivalent verification, not an executed Actions run or cloud delivery.

## Smaller reading fonts and stable logo dimensions — 2026-09-07

- Added four Latin Georgia WOFF2 subsets, preserving every retained glyph's outlines and metrics and all supplied source assets. The complete original faces remain available for other alphabets; Prumo, Adelle, photographs and the editorial grid are unchanged. Regular Georgia falls from 102,672 to 54,108 bytes. Optional regeneration/verification is separate from normal npm installation/build.
- Reserved the header/footer logos' intrinsic SVG aspect ratio without changing their responsive dimensions. Added browser contracts for font selection, shaped Spanish text, complete-alphabet fallback and image dimensions before/after the actual SVG response.
- Passed 37 Node checks, lint/build, 22 visual checks (51.2 seconds) and 40 targeted live desktop/mobile E2E journeys (4.7 minutes). Inspected four fresh light/dark desktop/mobile screenshots. Mobile integrated Lighthouse reports 85/100/96/100, CLS 0 and LCP 4.257 seconds; retained the baseline and disclosed single-run variability, client-side image discovery and the expected anonymous-refresh 401.
- Kept private evidence outside Git. No backend permission, schema, index, push or deployment changed; actual Actions and cloud acceptance remain pending.

## Measured local reading load — 2026-09-07

- Added a loopback/demo-only k6 runner with discovered seed IDs, fresh private evidence directories, script hashes, exact environment/options and preserved exit codes. The fixed 50-VU/60-second closed workload reads publications, four profiles, composed GraphQL and real Storage images, with one-second reader think time and independent per-route thresholds.
- Passed 11,476 requests and 22,952 business checks with zero HTTP errors. Overall P95 is 31.63 ms; route P95 values are 23.98/14.54/39.22/34.53 ms for publications/profiles/composition/media. Recorded hardware, the 60.983-second completion window, normal security limits and the limits of same-host emulator inference.
- Kept the initial smoke's incorrect image query as failed diagnostic evidence; fixed the test parameter to the existing API contract before the passing smoke/full run. No product/security behavior changed. Node checks increase to 37, lint/build pass, and public browser reading is rechecked after load. No cloud performance, push or deployment is claimed.

## Clean installation and independent data — 2026-09-07

- Verified a separate clone of `7e24e12` with `npm ci`, generated private configuration and an initially empty emulator database. Both seeds created six demo accounts and seven published readings with Storage images through their real service workflows.
- Passed 36 Node checks, lint/build, 30 API integration checks (60.73 seconds) and fourteen targeted desktop journeys (2.6 minutes), including all three roles, author/moderation, persistence, errors and GraphQL interactions. Inspected genuine home-light/editor-dark screenshots.
- Preserved the original environment before pausing it; the clean copy kept independent secrets, temporary storage and exit snapshot. Restarted the original from its own snapshot and verified public reading again. Node/npm, Java 21 and the per-user Chromium cache were existing prerequisites. No push, deployment or claim that dependency advisories were resolved.

## Verified snapshots and isolated emulator storage — 2026-09-07

- Added explicit snapshot imports with fail-closed argument/manifest validation. Timestamped exports now use the supported Firebase Tools module API, preserve existing snapshots and require both Firestore and Storage in the output manifest.
- Reproduced and fixed temporary-blob collisions between parallel Storage emulator instances. Development, standalone integration and independent restoration now use separate temporary directories. Preserved surviving Firestore records and restored verified Storage data before continuing.
- Verified complete document/history and media-byte fingerprints through isolated restoration, confirmed the live source remains intact afterward, and tested interactive shutdown export followed by default import: 2,278 development documents and 248 files / 2,178,026 bytes matched. These are local snapshot counts, not cloud claims.
- Passed 30 API integration checks in 58.25 seconds, ten targeted desktop journeys in 1.7 minutes, 36 Node checks, lint and build. Kept the earlier forced-exit, shared-temporary-directory and non-interactive termination failures distinct from successful verification. Clean installation, load/performance and cloud CI/CD remain pending; no push or deployment.

## Stable verification entry point — 2026-09-07

- Exposed `--no-watch` through aggregate and individual local-development commands, retaining normal watch defaults and Vite's frontend development behavior. Invalid flags fail explicitly. Added Interactions to the live E2E health preflight.
- Verified 35 Node checks, lint/build and nine targeted real desktop journeys in 50.4 seconds after starting the public stable command. This replaces the private verification launcher without claiming a diagnosis of the earlier Windows watch-restart trigger.
- Export/import, clean installation, load/performance and cloud CI/CD are still pending; no push or deployment.

## Administrative observations and private identity — 2026-09-07

- Extended interrupted-session recovery to the administrator's personal reason, proposed action and original version, without copying the author's publication. Same-version recovery is explicit; a changed version keeps the reason read-only/downloadable until confirmed discard and a fresh review. A withdrawn private draft stays inaccessible.
- Keyed private child trees to the authenticated identity, so two permitted accounts cannot retain one another's cached workspace, form or dialog state after a cookie-driven refresh. Existing request identity checks still prevent cross-account retries.
- Passed all 78 live E2E checks in 9.1 minutes, including twelve new desktop/mobile recovery and identity checks, plus 34 Node checks, lint and production build. Inspected four genuine light/dark desktop/mobile captures with passing WCAG and overflow checks. The initial diagnostic color-expectation failure is documented separately.
- Updated technical documentation and private evidence. Local M6 is complete; reproducible installation, export/import verification, k6/performance and actual cloud CI/CD remain separate milestones. No push, billing activation or deployment.

## Reading continuity and route loading — 2026-09-07

- Prepared actual public-route and composed-reading data before navigation, preserving the current page during requests and retaining explicit errors, retry, cancellation and viewer isolation. Added native cover continuity, fade-through main destinations and restrained lateral motion only for explicit parent-child journeys; kept the separate theme transition and a reduced-motion/unsupported-browser alternative.
- Decoded the matching responsive cover before snapshots, with a maximum image budget and fade fallback. Removed persistent route snapshot names after transitions and corrected reduced-motion specificity. Preserved the original typography, palette, photos and grid.
- Protected text started after a slow departure, including restoring the original browser history cursor when a late Back cancellation would otherwise replace its destination entry. Verified retained comment focus and subsequent Back/Forward destinations.
- Passed the complete 64-check E2E suite (7.9 minutes), then six affected checks after the final history fix (37.3 seconds), and ten motion checks again (46.7 seconds). The inventory now has 66 E2E checks; no full 66-check run is claimed. All 18 visual checks pass (49.7 seconds), with 34 Node checks, final lint/build and genuine desktop/mobile light/dark transition captures inspected.
- Kept diagnostic failures explicit: stale Vite exports, watched-backend 503s, an undecoded incoming cover, status/route-commit test synchronization, a theme scan spanning style updates and the reproduced late-history overwrite. Accessibility assertions now wait for the selected theme's resolved colors without disabling WCAG checks. Successful business responses remain real gateway/emulator data, separate from visual fixtures.
- Updated technical docs and private evidence. Administrative-note recovery, clean installation, performance/k6 and real cloud CI/CD remain pending. No push, billing activation or deployment.

## Navigation and transient surfaces — 2026-09-07

- Restored reading-source focus and scroll after actual asynchronous feed loading, including direct reading fragments. Bounded observers stop when restoration finishes or the reader starts a new interaction, avoiding late focus theft.
- Changed the mobile menu to an anchored overlay without content displacement, with route-aware closing, keyboard return and inert exiting links. Unified native dialogs across editing, recovery, moderation and user permissions with short CSS entry/exit transitions, immediate native focus release and reduced-motion handling for both surfaces and backdrops.
- Completed the footer's account, library, author and administrator destinations from the real session. Preserved server-side permission boundaries, brand typography, original photos and existing editorial geometry.
- Verified all 52 live E2E journeys in 6.4 minutes, 32 Node checks, lint and production build. New tests inspect actual outgoing animations and cover both themes, keyboard and mobile/desktop; diagnostic selector/observer timing failures remain distinguished from application defects.
- Updated the public design-system document to reflect the implemented three-way themes and readable muted-text tokens rather than the old Foundation light-only description. Integrated-browser manual loading remained inconclusive and is not presented as a passing reading journey.
- Reading/container continuity, hierarchical route transitions, final recovery audit, performance, clean installation and cloud CI/CD remain separate work. No push, paid-resource activation or deployment.

## Interrupted sessions and identity-bound retries — 2026-09-07

- Preserved pending profile text, comment attempts and publication documents in an owner-scoped, memory-only recovery store before an interrupted session unmounts their forms. Anonymous views reveal no contents; returning to the same account requires explicit restoration or confirmed discard. Another account purges the previous copies.
- Kept the editor's original base version during recovery. Newer server work still produces a conflict, with JSON backup and explicit server reload; recovery does not silently overwrite it. Logout/password changes cannot discard pending recovery copies.
- Reproduced and fixed an actual cross-account retry defect: a changed browser cookie could renew authentication as another user and replay the previous profile write. Fetch now checks the initiating identity before retries and before accepting responses; Apollo shares that boundary.
- Verified 40 real desktop/mobile E2E journeys in 5.6 minutes, 32 Node checks, lint and production build. Recovery screenshots include both themes, keyboard focus and automated accessibility checks. Diagnostic failure logs remain distinct from passing results.
- Kept all recovery payloads out of browser storage, databases and credentials. This is local M6A; navigation/motion, performance, clean installation and actual cloud CI/CD remain separate work. No push or billing activation.

## Composed GraphQL and personal interactions — 2026-09-07

- Implemented current-session GraphQL context, public Content/Users HTTP composition, bounded selections/pages/work, private error-safe transport and actual Apollo Client integration through the existing gateway.
- Added comments, one-kind reactions, saved publications and author follows with deterministic relation IDs, idempotent desired-state writes and atomic counter updates. Comment attempt UUIDs survive uncertain response failures. Only writers delete their comments; unavailable public targets remain removable from private lists.
- Connected reading controls, public comments and followable profiles; added saved/followed account routes with loading, cursor pagination, empty/error/retry and account isolation. Preserved the editorial fonts, monochrome palette, original photography, keyboard controls and themes.
- Verified 31 Node checks, 30 real emulator integration checks, 18 visual checks and 28 E2E journeys (4.5 minutes), plus lint/build. A genuinely committed comment with a lost response is retried without duplication; account changes in the same browser document do not reuse private state. Manual LAN verification confirms actual comment/save writes and their own removal.
- Corrected library heading spacing after genuine screenshot review. Added cryptographic UUID-v4 fallback for non-loopback HTTP previews and kept Apollo out of Home's preload graph with explicit manual chunks. No new performance score is claimed.
- Deployment, k6/load performance and final cross-area recovery remain pending. In particular, revoked sessions must not silently discard unsent editor/comment work; M6 addresses this separately. No push, paid-resource activation or cloud verification is claimed.

## Author editor and publication moderation — 2026-09-07

- Connected own-publication management, status filters, cursor navigation and idempotent draft creation to Content.
- Built the five-block editor with metadata, cover/inline uploads, accessible controls, reordering/removal and authenticated private previews. Preserved existing typefaces, spacing language, themes and supplied imagery without introducing a UI framework.
- Added versioned manual/autosave that preserves typing during pending saves, conflict detection/local JSON backup, explicit server recovery, network retry and pending-operation navigation protection.
- Connected review submission/withdrawal, archive/recovery and logical deletion, with confirmations. Administrators now review without editing other authors, approve, return with a reason and archive. Archival notes remain visible to the author as well as in atomic audit history.
- Diagnosed a genuine transient contrast failure caused by independently interpolated button colors during theme changes; kept contrasting color pairs and retained the circular theme transition. Did not disable accessibility assertions or conceal the failing run.
- Verified 23 Node tests, 21 integration tests, 18 visual regressions and 20 actual E2E journeys in desktop/mobile, plus lint/build. Reviewed genuine editor, moderation and conflict screenshots. Failures and final passing logs remain private.
- This completes local M4B, not the full delivery. GraphQL interactions, final cross-area/motion/performance work and real cloud CI/CD remain pending. No push or billing activation.

## Persistent Content and public reading — 2026-09-07

- Implemented Content-owned block documents, draft/review/published/archived transitions, image ownership, logical deletion and atomic audit entries. Authoring and moderation screens remain the next sub-milestone.
- Enforced current Users identity over HTTP, owner-only editing, admin approval/rejection, private drafts and image previews, strict inputs and versioned writes. Competing saves and moderation decisions cannot lose updates.
- Added 19 declared Firestore query indexes, scoped keyset cursors, bounded metadata-prefix search and original/640/960 Storage media through the gateway. Index deployment still needs real-cloud verification.
- Seeded seven labeled Spanish publications with four authors and actual save/review/approval/read operations. Repetition preserves existing records; local exports preserve emulator data.
- Replaced static publication reads on home, exploration, article and author profile with gateway APIs, real loading/error/retry/empty states and bounded public author lookup. Preserved typography, photography, themes and layout; moved navigation constants out of the fixture module.
- Verified 23 Node checks, 21 emulator integration scenarios, 18 visual regression scenarios and ten real browser journeys. Visual fixtures remain explicitly separate from persistence tests. Manual browser inspection confirms public reading and the retained dark editorial layout.
- Measured an integrated performance regression: initial mobile Lighthouse 70/100/96/100, then 75/100/96/100 with smaller Storage derivatives. LCP 4.4 s / CLS 0.168 still require M7 work; M1's static 97 is not claimed for the integrated site. The expected anonymous refresh 401 affects the best-practices score. No k6 or cloud success is claimed.
- No push, billing activation or deployment; Content API and public reading are M4A, not completion of the full goal.

## Persistent Users and account integration — 2026-09-07

- Implemented strict reader registration, normalized unique email reservations, scrypt passwords, short JWT access tokens and revocable/rotating HttpOnly-cookie sessions.
- Added own-profile/avatar/password controls, reader author requests and admin-only user pagination/role/suspension; protected against self-promotion, self-permission changes and removal of the active-admin invariant.
- Added server-owned Firestore collections, Storage avatar validation/re-encoding, safe serializers, current-session HTTP lookup for other services and idempotent local demo-user seeding.
- Connected responsive login/registration, account, public profile and user administration. Added explicit loading/error/retry/denied states and unsaved-change dialogs.
- Verified 19 Node checks, 11 emulator integration checks, 18 visual regression checks and six actual desktop/mobile browser journeys. Concurrency lock waits and a browser-test loading race were diagnosed and corrected before the passing reruns.
- Kept access credentials out of localStorage, source, screenshots and browser traces. Backend domain persistence is local emulator evidence; publication/interaction implementation and cloud verification remain pending.

## Gateway and emulator foundation — 2026-09-07

- Implemented exact REST/GraphQL forwarding with explicit upstream failures, header sanitization, JWT signature checks, CORS allowlists, request limits and security headers.
- Added server-only Firebase Admin configuration to each independent service and deny-all direct-client rules.
- Added safe local setup, five-application startup, emulator import/export and test lifecycle commands; raised the documented runtime to Node 24 and Java 21 for current tooling.
- Verified 19 Node tests, four Firestore/Storage emulator tests, lint, build and a live gateway-to-Content metadata request. The browser's raw-API navigation was blocked by its client environment; HTTP verification was performed separately and is not presented as a browser business journey.
- Prepared Hosting configuration without deploying. Business collections, account sessions, domain authorization, real cloud persistence and CD remain pending.
- Disclosed moderate dependency advisories; no high or critical findings at this milestone.

## Editorial refinement — 2026-09-07

- Preserved the existing visual identity while removing the oversized duplicate home logo, the out-of-scope newsletter and placeholder footer links.
- Added an explicitly labeled Spanish demo edition covering all seven publication types and four synthetic authors, with independent article bodies and correct profile filtering.
- Implemented query/category/type filtering, empty results, missing-resource 404 pages and native sharing with a fallback.
- Added persistent light/dark/system preferences, a compatible reduced-motion alternative, keyboard focus handling and responsive access compositions.
- Retained supplied photographs in color, with CSS-only grayscale/zoom for lists and direct color on touch/small screens.
- Added WOFF2 derivatives of the original fonts, responsive images, route splitting, a robots file and reproducible asset/performance scripts. Original font files remain intact.
- Added Node tests and a desktop/mobile browser suite with automated accessibility checks. The optimized local production home audit reached 97 performance and 100 accessibility, best practices and SEO; this is a simulated mobile Lighthouse result, not cloud or load-test evidence.
- Business persistence and authentication are not part of this visual milestone. The access form explicitly reports its pending connection instead of simulating success.

## Frontend application foundation

- Initialized the React and Vite application.
- Added route boundaries for the initial product views.
- Connected the frontend service layer to the gateway REST and GraphQL entry points.
- Organized official brand assets, local typography, and editorial images under `frontend/public`.
- Confirmed that the production bundle builds locally.

## Editorial design system foundation

- Measured the supplied brand references and recorded the resulting Design DNA profile.
- Applied the approved palette and locally hosted Prumo, Adelle Sans, and Georgia families.
- Created header, footer, search, category, article, feature, author, and content-state components.
- Added responsive home, explore, article, login, registration, and profile page foundations.
- Added original monochrome editorial imagery and optimized it for browser delivery.
- Verified desktop and 390-pixel mobile layouts, category and article routing, mobile navigation, accessible form labels, accurate date rendering, and clean browser logs.
- Confirmed that the production bundle builds locally after visual verification.

## API Gateway foundation

- Created an independent Express service on port 3000.
- Added environment-based service targets for users, content, and interactions.
- Added health, gateway index, not-found, and error-handling foundations.
- Verified the service through isolated HTTP smoke tests.

## Environment templates

- Updated repository ignore rules so safe `.env.example` templates are tracked while real environment files remain private.
- Documented the npm workspace layout and repository privacy boundaries.

## Users service foundation

- Created an independent Express REST service on port 3001.
- Added environment, model, service, controller, route, and HTTP middleware layers.
- Exposed only health and service-boundary metadata for this phase.
- Verified the service through isolated HTTP smoke tests.

## Content service foundation

- Created an independent Express REST service on port 3002.
- Added environment, model, service, controller, route, and HTTP middleware layers.
- Exposed only health and publication-boundary metadata for this phase.
- Verified the service through isolated HTTP smoke tests.

## Interactions service foundation

- Created an independent Express and Apollo Server application on port 3003.
- Added environment, schema, model, service, resolver, route, context, and HTTP middleware layers.
- Exposed only health and GraphQL service-status operations for this phase.
- Verified the REST health route and GraphQL endpoint through isolated smoke tests.

## Repository verification

- Added repository-level contracts for the required structure, independent service entry points, assigned ports, and gateway-only frontend boundaries.
- Added a credential-free continuous integration workflow for installation, tests, and the production frontend build.
- Added root development commands and public setup, testing, and architecture guidance.
- Removed the temporary design-resource workspace after incorporating the approved assets and visual direction.
