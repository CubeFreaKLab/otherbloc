# Frontend

The React/Vite frontend preserves the editorial identity: Prumo titles, Adelle Sans interface text, Georgia reading text, thin rules and the existing monochrome palette. REST and GraphQL integrations enter through the independent gateway.

## Current milestone

The editorial presentation reads actual Content records through the gateway. Seven Spanish publications and synthetic authors are reproducibly seeded into Firestore/Storage emulators and visibly marked as demonstration content. `src/data/articles.js` supplies seed and visual-test input only; production views do not import it or fall back to it. Fictional news and review identify themselves inside their content. Navigation taxonomy is separate from article fixtures.

Authentication uses the actual Users service through the gateway: register/login, HttpOnly-cookie refresh, explicit errors and server-revoked logout. Access tokens remain in memory. Account/profile/avatar forms, user administration, the author editor and publication moderation are connected to Firestore/Storage through their services. Apollo Client connects reading composition, comments, reactions, saves and follows to Interactions through the gateway. Share uses native sharing/clipboard with an explicit fallback.

## Routes and reading

- `/`: seven latest public records, first featured; real loading, empty, failure and retry states, without a duplicated masthead or newsletter.
- `/explore`: gateway search/category/type filters reflected in the URL; paginated date/ID cursors, next page and return-to-start controls. Changing search/filters clears the cursor. Counts describe the current page when paginated, not a fabricated global total.
- `/article/:slug`: the matching publication's own blocks and author. Unknown slugs render 404 instead of unrelated content.
- `/profile/:id`: actual public Users profile and Content-owned published list filtered by author, with independent loading/error/retry and pagination.
- `/login`, `/register`: the approved split photographic composition on desktop; form-only composition on mobile.
- `/account`: own profile/avatar, author request, password change and server-revoked logout. Unsaved profile changes block navigation and refresh.
- `/account/saved`, `/account/following`: current caller's paginated private lists, genuine empty/error/retry states, and removal including unavailable public targets.
- `/admin/users`: paginated user management, access-denied state for non-admins and a keyboard-trapped confirmation dialog. All role enforcement also occurs server-side.
- `/author`: own publications, status filter and cursor pagination; idempotent draft creation.
- `/author/publications/:id`: owner-only block editor, versioned manual/autosave, private preview, image uploads and lifecycle controls.
- `/admin/publications`: administrator review/published/archived queues with pagination.
- `/admin/publications/:id`: read-only review, approval, return-to-author and archival with explicit confirmation. Returning or archiving requires a reason in this interface.
- Unknown paths render an explicit 404 view, without redirecting silently to home.

The footer links only to existing destinations. The primary navigation checks category query parameters, avoiding multiple active categories. Public REST feeds omit authentication; GraphQL reading sends the current in-memory token when present to include personal interaction state and reuses refresh when it expires. Bounded profile lookup (`/users/profiles`, maximum 40 IDs) hydrates current public names without exposing private emails. Missing/suspended profiles are labeled unavailable, not replaced with an invented person. Async article/profile titles update after the data arrives. All five block types, heading levels, ordered lists, quote attribution and image captions render without HTML injection.

## Interactions and personal reading

Article composition is an actual Apollo query containing Content metadata/blocks, the public Users author, comments/counters and viewer-specific states. Buttons await confirmed server results; counts are reloaded from actual aggregates, never optimistically invented. Visitors receive sign-in links with the current reading as their return destination. Own comments can be deleted after confirmation; text is rendered as plain React text. Profile pages expose follow/unfollow only for another author.

Comment submission generates a UUID for the attempt and preserves it with the text after an uncertain failure. Retrying sends that exact attempt, preventing a duplicate even if the first response was lost after a successful commit. Inputs are protected during submission; unsent text and pending writes participate in the native navigation/unload guard. The current implementation does not persist unsubmitted keystrokes across a page reload. Complete session revocation while editing still needs the cross-area recovery work tracked in M6; normal expired-token refresh is handled by the shared client.

Saved/followed lists contain only the signed-in caller's state. Unavailable target references remain removable without exposing a draft title or an invented profile. Apollo business queries/mutations use `no-cache`, disable deduplication and discard responses from a changed viewer. The shared Fetch transport has a 20-second deadline even when a route supplies its own abort signal. Apollo is loaded only by routes that use it; `onlyExplicitManualChunks` prevents its manual chunk from absorbing shared startup dependencies and being preloaded on Home. This bundle observation is not a new Lighthouse result.

Publication/block/comment IDs use native `crypto.randomUUID` where available, with a UUID-v4 `crypto.getRandomValues` fallback for HTTP LAN previews. No `Math.random` is used for IDs. MDN documents [secure-context randomUUID](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID) and [getRandomValues in insecure contexts](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues).

## Author editor and moderation

The editor serializes only allowed document fields. Five block controls support paragraph, heading, ordered/unordered list, quote with attribution, and image with alt text/caption. Stable UUIDs preserve block identity while moving them. Block removal, state transitions, deletion and conflict recovery use native modal confirmations. All data writes enter through the gateway; private image bytes are fetched with authentication and displayed as temporary Blob URLs, revoked on cleanup.

Autosave waits 1.2 seconds after editing stops. It serializes in-flight saves and records the snapshot actually sent, preserving any text typed while that request was pending. Later edits trigger another save with the returned version. The status distinguishes unsaved, saving, saved and failed work. A 409 stops autosave without discarding inputs; users can download their local JSON or explicitly replace it with the server version. The download is a backup, not an import feature. Network errors retain inputs and support manual retry. Nothing stores publication data in localStorage.

Navigation and browser unload warn about unsaved work. In-app departure is blocked until a pending save/upload/state operation ends, because an already-sent request cannot honestly be described as discarded. Uploads pause autosave and block dependent block manipulation. Status changes wait for the latest save and lock editing. Confirmed deletion uses the server version directly, so invalid unsaved fields do not prevent the owner from deleting a draft. It does not silently overwrite a newer server version.

Published/review/archived documents are read-only in the editor. Authors can submit, withdraw, archive, recover and logically delete only as allowed by the Content API. Administrators review without editing someone else's text. Notes appear in the author's workspace after return or administrative archival; stale moderation decisions require loading current state. All these checks are enforced independently by the server. A reload restores the last successful save, not keystrokes that never reached the server.

## Theme, images and accessibility

Light, dark and system themes are selected with a labeled native control. Only the preference is stored in localStorage; no credentials or business records are stored there. The inline head initialization avoids a wrong-theme flash. System changes and storage events update the selected theme; unavailable storage does not prevent use.

A supported browser animates theme changes with a 380 ms circular View Transition from the control. Unsupported browsers and reduced-motion users get an immediate change. The transition overlay does not intercept input. Primary-button foreground/background colors switch as a contrasting pair; separately interpolating them caused a transient 3.99:1 contrast failure during testing. Button motion remains, and the circular theme transition is preserved. Native controls, visible focus, a skip link and route focus handling support keyboard reading. React Router's data router preserves scroll history; changing exploration filters preserves the current position.

Color-preserving WebP derivatives of the supplied original photographs are in `public/images/{lectura,ciudad,escritura}.webp`. Source masters were not altered. Lists use CSS `grayscale(1)`; hover or focus restores `grayscale(0)` with `scale(1.03)` inside a clipped fixed-size container. Touch devices see color directly. Reading and access photographs remain in color. No new photography was substituted for the supplied assets.

## Development and verification

```sh
npm ci
npm run dev:frontend
npm test
npx playwright install chromium
npm run test:ui
npm run build
```

Vite uses port 5173. Browser tests cover desktop and mobile layouts, filtering/reload, 404, content/author mapping, theme persistence, system theme changes, reduced motion, keyboard fields, contrast and layout overflow. Automated accessibility checks complement visual review; they do not by themselves certify accessibility.

`npm run test:e2e` drives account, public reading, author/editor/moderation and interaction journeys against services and emulators. It also exercises slow saves, two-tab conflicts, rejected uploads, private/public visibility, failed-save recovery, lost-comment-response recovery and denied roles in desktop/mobile viewports. Explicit fault injection is limited to failure/delay scenarios; successful data is not mocked. Visual regression fixtures are separate and are not persistence evidence. See [testing](testing.md) and [development](development.md). Deployment remains pending.

## Asset and performance maintenance

Original font files remain available; the browser loads WOFF2 derivatives. Static access imagery uses local derivatives. Publication originals and 640/960-width derivatives now live in Storage with server-verified ownership, actual dimensions and responsive `srcset` URLs through the gateway. Rebuild static asset derivatives with `node scripts/optimize-assets.cjs`; existing demo Storage derivatives can be added with `node scripts/seed-content.mjs --prepare-images`. Neither changes supplied source masters.

To audit the production bundle, build, start Vite preview on port 4173 with live gateway/services/emulators, then run `node scripts/audit-performance.mjs`. Preview origins must be included in local `ALLOWED_ORIGINS`; new setup files include loopback 4173 origins. Reports remain ignored/private. M1's static 97/100/100/100 is not the integrated score: M4A measured 70/100/96/100 initially and 75/100/96/100 after Storage derivatives, with mobile LCP 4.4 s and CLS 0.168 in that run. Image transfer fell substantially, but asynchronous discovery/loading layout still need performance work in M7. The 96 best-practices score records the expected unauthenticated refresh 401, not a hidden successful login. These are disclosed local measurements, not k6 or cloud evidence.
