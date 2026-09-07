# Development log

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
