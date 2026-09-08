# Frontend

The React/Vite frontend preserves the editorial identity: Prumo titles, Adelle Sans interface text, Georgia reading text, thin rules and the existing monochrome palette. REST and GraphQL integrations enter through the independent gateway.

## Current milestone

The editorial presentation reads actual Content records through the gateway. Seven Spanish publications and synthetic authors are reproducibly seeded into Firestore/Storage emulators and visibly marked as demonstration content. `src/data/articles.js` supplies seed and visual-test input only; production views do not import it or fall back to it. Fictional news and review identify themselves inside their content. Navigation taxonomy is separate from article fixtures.

Authentication uses the actual Users service through the gateway: register/login, HttpOnly-cookie refresh, explicit errors and server-revoked logout. Access tokens remain in memory. Account/profile/avatar forms, user administration, the author editor and publication moderation are connected to Firestore/Storage through their services. Apollo Client connects reading composition, comments, reactions, saves and follows to Interactions through the gateway. Share uses native sharing/clipboard with an explicit fallback.

## Build identity

`tooling/revision.mjs` emits `version.json` only during production builds. It records the full checkout revision, whether tracked or untracked non-ignored files differ, and whether the revision came from Git or validated `APP_REVISION`/`GITHUB_SHA` metadata. Missing Git state is explicitly unknown, not clean. The manifest contains no credentials and does not change the rendered interface. Its Firebase Hosting header disables caching; read [release verification and limitations](ci-cd.md#exact-revision-metadata) before treating it as deployment evidence.

## Routes and reading

- `/`: seven latest public records, first featured; real loading, empty, failure and retry states, without a duplicated masthead or newsletter.
- `/explore`: gateway search/category/type filters reflected in the URL; paginated date/ID cursors, next page and return-to-start controls. Changing search/filters clears the cursor. Counts describe the current page when paginated, not a fabricated global total.
- `/article/:slug`: the matching publication's own blocks and author. Unknown slugs render 404 instead of unrelated content.
- `/profile/:id`: actual public Users profile and Content-owned published list filtered by author, with independent loading/error/retry and pagination.
- `/login`, `/register`: the approved split photographic composition on desktop; form-only composition on mobile.
- `/account`: own profile/avatar, immediate writing access, password change and server-revoked logout. Unsaved profile changes block navigation and refresh.
- `/account/saved`, `/account/following`: current caller's paginated private lists, genuine empty/error/retry states, and removal including unavailable public targets.
- `/admin/users`: paginated user management, access-denied state for non-admins and a keyboard-trapped confirmation dialog. All role enforcement also occurs server-side.
- `/author`: own publications, status filter and cursor pagination; idempotent draft creation.
- `/author/new`: signed-in writing shortcut. Creation starts after navigation guards accept departure, reuses one attempt ID on retry and cannot redirect a user who already left the creation screen.
- `/author/publications/:id`: owner-only continuous Editor, versioned manual/autosave, private preview, image uploads and lifecycle controls.
- `/admin/publications`: administrator review/published/archived queues with pagination.
- `/admin/publications/:id`: read-only review, approval, return-to-author and archival with explicit confirmation. Returning or archiving requires a reason in this interface.
- Unknown paths render an explicit 404 view, without redirecting silently to home.

The footer links only to existing destinations. The primary navigation checks category query parameters, avoiding multiple active categories. Public REST feeds omit authentication; GraphQL reading sends the current in-memory token when present to include personal interaction state and reuses refresh when it expires. Bounded profile lookup (`/users/profiles`, maximum 40 IDs) hydrates current public names without exposing private emails. Missing/suspended profiles are labeled unavailable, not replaced with an invented person. Async article/profile titles update after the data arrives. All five block types, heading levels, ordered lists, quote attribution and image captions render without HTML injection.

## Interactions and personal reading

Article composition is an actual Apollo query containing Content metadata/blocks, the public Users author, comments/counters and viewer-specific states. Buttons await confirmed server results; counts are reloaded from actual aggregates, never optimistically invented. Visitors receive sign-in links with the current reading as their return destination. Own comments can be deleted after confirmation; text is rendered as plain React text. Profile pages expose follow/unfollow only for another author.

Comment submission generates a UUID for the attempt and preserves it with the text after an uncertain failure. Retrying sends that exact attempt, preventing a duplicate even if the first response was lost after a successful commit. Inputs are protected during submission; unsent text and pending writes participate in the native navigation/unload guard. Unsubmitted keystrokes are not persisted across a page reload. Interrupted-session recovery retains them temporarily in this loaded tab, as described below; normal expired-token refresh is handled by the shared client.

Saved/followed lists contain only the signed-in caller's state. Unavailable target references remain removable without exposing a draft title or an invented profile. Apollo business queries/mutations use `no-cache`, disable deduplication and discard responses from a changed viewer. The shared Fetch transport has a 20-second deadline even when a route supplies its own abort signal. Apollo is loaded only by routes that use it; `onlyExplicitManualChunks` prevents its manual chunk from absorbing shared startup dependencies and being preloaded on Home. This bundle observation is not a new Lighthouse result.

Publication/block/comment IDs use native `crypto.randomUUID` where available, with a UUID-v4 `crypto.getRandomValues` fallback for HTTP LAN previews. No `Math.random` is used for IDs. MDN documents [secure-context randomUUID](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/randomUUID) and [getRandomValues in insecure contexts](https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues).

## Author editor and moderation

The Editor uses [Tiptap's React integration](https://tiptap.dev/docs/editor/getting-started/install/react) inside the existing React/Vite application. A quiet central column presents the editable title and continuous prose. A caret-adjacent slash menu and a keyboard/touch-accessible plus offer Texto, Subtítulo, lists, Cita and Imagen. Selection provides bold, italic and links. The editing instance survives preview toggles, preserving undo history. Detalles contains summary, type, category, tags and cover. Existing document IDs, photos, attribution and plain-text fields remain compatible; optional validated formatting travels through REST and GraphQL and renders identically in preview/public reading. State changes, deletion and conflict recovery retain native confirmations. All writes enter through the gateway; private image bytes use authenticated temporary Blob URLs.

«Añadir portada» sits above the title and opens Detalles directly at the cover controls; after upload the real cover appears in the writing surface. The title recalculates its height when text, fonts, viewport or column width changes, including responsive resizing without reloading. The square plus in the header creates a new note; the plus beside the prose adds content to the current note.

Tags confirm on space, Enter, comma or paste, with case-insensitive deduplication and field-local limit messages. Only confirmed tags are part of the saved draft. Unconfirmed/invalid input remains separate and does not block autosave; its owner/publication-scoped sessionStorage entry survives a reload in the same tab. It is never treated as a confirmed tag or a server save. Blank prose lines can provide spacing without blocking review; a genuinely empty note still cannot be submitted.

Autosave waits 1.2 seconds after editing stops. It serializes in-flight saves and records the snapshot actually sent, preserving any text typed while that request was pending. Later edits trigger another save with the returned version. The status distinguishes unsaved, saving, saved and failed work. A 409 stops autosave without discarding inputs; users can download their local JSON or explicitly replace it with the server version. The download is a backup, not an import feature. Network errors retain inputs and support manual retry. Nothing stores publication data in localStorage.

Navigation and browser unload warn about unsaved work. In-app departure is blocked until a pending save/upload/state operation ends, because an already-sent request cannot honestly be described as discarded. Uploads pause autosave and block dependent block manipulation. Status changes wait for the latest save and lock editing. Confirmed deletion uses the server version directly, so invalid unsaved fields do not prevent the owner from deleting a draft. It does not silently overwrite a newer server version.

Published/review/archived documents are read-only in the editor. Authors can submit, withdraw, archive, recover and logically delete only as allowed by the Content API. Administrators review without editing someone else's text. Notes appear in the author's workspace after return or administrative archival; stale moderation decisions require loading current state. All these checks are enforced independently by the server. A reload restores the last successful save, not keystrokes that never reached the server.

## Interrupted-session recovery

Before a failed refresh clears the current user, active profile/editor/comment/moderation forms capture pending work in a transient, owner-scoped memory snapshot. This recovery mechanism does not write to browser storage or another database; the separate pending-tag input is described above. The anonymous notice contains no recovered text or download. The same account can explicitly restore, download or discard the copy. Logging in with another account purges that recovery copy, as explained before login.

Profile recovery restores only name/biography, not passwords, avatar bytes or credentials. Editor recovery restores the note, confirmed tags, pending tag input and its original version; if another session advanced that version, it produces a conflict rather than adopting the new version and overwriting server work. Comment recovery retains the attempt UUID and text so a retry remains idempotent. Uploads already sent can still finish server-side; unconfirmed file bytes are not promised recoverable. Restore/discard is required before editing that form again. Logout/password controls do not silently discard other pending recovery copies.

Moderation captures only the administrator's own reason, proposed return/archive action and original publication version, never another author's document. If the same version is still actionable, explicit recovery reopens that decision for confirmation; the Content API still checks `If-Match`. If the version or state changed, the old reason is read-only and downloadable, but cannot be applied to the new version. The administrator must review current content and explicitly discard the temporary copy before a fresh decision. If the publication became a private draft, the review no longer exposes it; the owner's personal reason remains downloadable from the recovery notice.

`SessionBoundary` keys its private child tree to the authenticated user ID. A refresh that accepts a different account remounts private loaders, lists, forms and dialogs, even when both accounts satisfy the same role boundary. Same-account updates do not remount them. Together with request identity checks, this prevents the previous account's cached workspace or in-flight results from being adopted by the new account.

The notice warns before reload/close while a recovery copy remains. Returning through in-app links preserves the copy in memory; reloading or closing destroys it. Successfully saved content remains in Firebase. This is temporary UI recovery, not a replacement for persistence or a cross-device backup. Downloaded JSON is a local copy, not an import feature. Native confirmation dialogs use unique labels and keyboard-safe cancellation.

The gateway Fetch client also fixes a distinct identity race: it captures the caller at request start, checks it before retrying after refresh and before accepting a response. A cookie switched to another account cannot replay the previous account's PATCH or GraphQL mutation with the new token, and an obsolete response cannot replace current session data. A reproduced regression wrote a synthetic source profile into a synthetic target account before this guard; the regression test now verifies the target stays unchanged. Failed/diagnostic runs remain separate from verified results.

## Theme, images and accessibility

The first visit is light, independent of the device. A single accessible icon button offers dark with a moon and light with a sun. Only an explicit `dark` preference is retained as dark; missing, invalid and old `system` values become light, including the pre-React initialization. Choice persists across navigation/reload. Icon motion respects reduced motion. Credentials and publication documents are not stored in localStorage.

The moon/sun transforms for 180 ms while the restored theme transition reveals the new page theme in a 380 ms circle from the icon. There is no selector, hover square or native tooltip; the button retains its accessible action name and keyboard focus. Unsupported browsers and reduced motion switch immediately. Foreground/background switch together inside the snapshot to retain contrast. Search has one outer focus ring around the icon/input container, without an inset input rectangle.

Original photographs and derivatives are retained. Shared ReadingThumbnail uses a grey base and a circularly clipped color layer expanding from pointer entry, with no image scaling. Exit fades back to grey. Actual Tab focus has an equivalent reveal and visible outline; restored history focus does not latch color on. Touch thumbnails remain grey and open the color article. Reduced motion switches immediately. Reading and access photos remain in color. Visitors see «Iniciar sesión» in the header. Signed-in users see their real photo or initials derived from their actual name, consistently in the header and account profile. Profile/avatar changes update this immediately; accessible names and keyboard focus remain available.

## Navigation, menus and dialogs

The footer follows the session: all active accounts receive account/library and writing links; administrators additionally receive user/review routes. Server authorization remains the permission boundary.

The public and Editor headers use one shared scroll behavior: they leave view while scrolling down and slide back from above when scrolling up anywhere on the page. The same DOM controls remain in use, with no duplicate navigation or inserted gap. An open mobile menu and keyboard focus keep the header available. Reduced motion disables the slide; reading fragments reserve space for the header. The signed-in square plus is a real writing entry point, not a role request.

`NavigationFocus` augments React Router's scroll restoration with a bounded, in-memory history of positions and focus targets. It records navigation links without form values, waits for actual loading boundaries and font readiness, then restores the matching link and position on Back. Direct reading fragments wait for their real section and give it keyboard focus. Mutation/resize observers disconnect after restoration or a new pointer, wheel, touch or keyboard action, so a delayed response cannot pull a reader away. No request is delayed for animation. Same-route filter controls keep their existing interaction.

The mobile menu is an anchored overlay, so opening it does not push down the reading. Route changes close it; Escape returns to its trigger; hidden or exiting links are inert only at the mobile breakpoint. CSS animates opacity/transform and discrete display for 160 ms. `EditorialDialog` is the common native-modal boundary for unsaved work, editorial decisions, recovery and user permissions. Native close releases focus immediately, and inert outgoing content is retained only until actual CSS animations finish. Unmounting private areas removes their nodes immediately, including the outgoing content. Backdrop and surface transitions are disabled for reduced motion.

Public route loaders prepare actual Home/Explore/profile resources and the composed GraphQL reading before committing navigation. The initial visit still displays a real loading skeleton. During subsequent requests the current page remains usable with a separate loading status; a canceled navigation aborts its requests and cannot commit a late response. `useResource` accepts those results without a second initial query and retains explicit errors/retries. Reading results are keyed to the current viewer; another account never adopts a previous viewer's interactions.

`MotionLink` delegates anchors, modifiers, blockers and history to React Router. Reading keeps the decoded-image preparation and its bounded fade fallback, but thumbnails no longer participate in a shared-size cover morph: there is no image zoom on entry or return. Main destinations fade; lateral movement stays limited to explicit private parent/child routes. Reduced motion and unsupported browsers retain immediate navigation.

If a user begins typing after a slow departure has already started, the unsaved-work guard cancels that departure instead of discarding the new text. For a pending history traversal it restores the original Router-owned history index, rather than replacing the already-moved destination entry. This keeps subsequent Back/Forward usable and preserves the new comment's focus. Explicitly confirmed departures are not canceled again. Keyboard/pointer interaction during a pending return also suppresses late focus restoration. See [React Router's View Transition API](https://reactrouter.com/how-to/view-transitions); the installed Router 7 implementation was checked locally rather than assuming every option in newer documentation is available.

## Development and verification

```sh
npm ci
npm run dev:frontend
npm test
npx playwright install chromium
npm run test:ui
npm run build
```

Vite uses port 5173. Browser tests cover desktop/mobile writing and reading, filtering/reload, permissions, formatting, tag limits, real saving, theme persistence/default-light initialization, reduced motion, keyboard controls, contrast and overflow. Automated accessibility checks complement visual review; they do not by themselves certify accessibility.

`npm run test:e2e` drives account, public reading, author/editor/moderation and interaction journeys against services and emulators. It also exercises slow saves, two-tab conflicts, rejected uploads, private/public visibility, failed-save recovery, lost-comment-response recovery and denied roles in desktop/mobile viewports. Explicit fault injection is limited to failure/delay scenarios; successful data is not mocked. Visual regression fixtures are separate and are not persistence evidence. See [testing](testing.md) and [development](development.md). Deployment remains pending.

## Asset and performance maintenance

Original font files remain available; the browser loads WOFF2 derivatives. Georgia additionally has four Latin subsets for Spanish/Western-European reading, including combining accents and common punctuation. Later `unicode-range` faces select those smaller files, while the original complete faces remain available for other characters, including Greek/Cyrillic and extended Latin. The supplied Prumo and Adelle files are unchanged. This follows [CSS composite-font selection](https://www.w3.org/TR/css-fonts-4/#composite-fonts), not a replacement typeface.

The normal build uses committed font assets and needs no Python. Optional regeneration uses `scripts/subset-reading-fonts.py` with FontTools 4.59.1 and Brotli 1.2.0 in a separate Python environment; `--verify` checks existing subsets without writing. The generator checks source embedding/subsetting flags, preserves supplied source files, hinting, names and relevant layout features, and compares every retained glyph's outline/advance width plus vertical metrics. Browser tests compare shaped Spanish text across all four styles against the complete fonts and confirm complete-face availability for other alphabets. Regular Georgia falls from 102,672 to 54,108 bytes; each subset retains 240 mapped characters. See [FontTools subsetting](https://fonttools.readthedocs.io/en/latest/subset/index.html) for its optional tooling, and [web-font size guidance](https://web.dev/articles/reduce-webfont-size).

Static access imagery uses local derivatives. Publication originals and 640/960-width derivatives live in Storage with server-verified ownership, actual dimensions and responsive `srcset` URLs through the gateway. Rebuild static derivatives with `node scripts/optimize-assets.cjs`; existing demo Storage derivatives can be added with `node scripts/seed-content.mjs --prepare-images`. Neither changes supplied source masters. Header/footer marks now reserve the SVG's original 1532:291 ratio before its request finishes; CSS retains their previous responsive size.

To audit the production bundle, build, start Vite preview on port 4173 with live gateway/services/emulators, then run `node scripts/audit-performance.mjs`. Preview origins must be included in local `ALLOWED_ORIGINS`; new setup files include loopback 4173 origins. Reports remain ignored/private. M1's static 97/100/100/100 is not the integrated score: M4A measured 75/100/96/100 after Storage derivatives, with mobile LCP 4.4 s and CLS 0.168.

M7 remeasured the integrated app at 84/100/96/100, LCP 4.376 s and CLS 0.000281 before font/logo changes. After them, the local mobile Lighthouse run reports 85/100/96/100, FCP 1.688 s, LCP 4.257 s, TBT 11 ms and CLS 0. The network actually selects the Latin file: Georgia transfer falls from 102,994 to 54,428 bytes including response overhead. Logo sizing passes the previously failing unsized-image audit. These are individual dated runs, not a statistical guarantee of a one-point score improvement. The initial cover remains discoverable only after the client receives publication/profile data; constrained-network LCP is still an optimization opportunity. The 96 best-practices score records the expected unauthenticated refresh 401, which has not been suppressed or converted into fake login success. These browser measurements are separate from [k6's passing API workload](load-testing.md) and from cloud evidence.
