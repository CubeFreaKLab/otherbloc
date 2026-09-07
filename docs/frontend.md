# Frontend

The React/Vite frontend preserves the editorial identity: Prumo titles, Adelle Sans interface text, Georgia reading text, thin rules and the existing monochrome palette. REST and GraphQL integrations enter through the independent gateway.

## Current milestone

The editorial presentation reads actual Content records through the gateway. Seven Spanish publications and synthetic authors are reproducibly seeded into Firestore/Storage emulators and visibly marked as demonstration content. `src/data/articles.js` supplies seed and visual-test input only; production views do not import it or fall back to it. Fictional news and review identify themselves inside their content. Navigation taxonomy is separate from article fixtures.

Authentication now uses the actual Users service through the gateway: register/login, HttpOnly-cookie refresh, explicit errors and server-revoked logout. Access tokens remain in memory. Account/profile/avatar forms and administrator user management are connected and tested with Firestore/Storage emulators. Authoring, publication moderation and interactions remain later integration milestones. The Save link still leads to sign-in until Interactions is connected; Share uses native sharing/clipboard with an explicit fallback.

## Routes and reading

- `/`: seven latest public records, first featured; real loading, empty, failure and retry states, without a duplicated masthead or newsletter.
- `/explore`: gateway search/category/type filters reflected in the URL; paginated date/ID cursors, next page and return-to-start controls. Changing search/filters clears the cursor. Counts describe the current page when paginated, not a fabricated global total.
- `/article/:slug`: the matching publication's own blocks and author. Unknown slugs render 404 instead of unrelated content.
- `/profile/:id`: actual public Users profile and Content-owned published list filtered by author, with independent loading/error/retry and pagination.
- `/login`, `/register`: the approved split photographic composition on desktop; form-only composition on mobile.
- `/account`: own profile/avatar, author request, password change and server-revoked logout. Unsaved profile changes block navigation and refresh.
- `/admin/users`: paginated user management, access-denied state for non-admins and a keyboard-trapped confirmation dialog. All role enforcement also occurs server-side.
- Unknown paths render an explicit 404 view, without redirecting silently to home.

The footer links only to existing destinations. The primary navigation checks category query parameters, avoiding multiple active categories. Reading data is public and does not attach a stale access token; private author requests will use the authenticated client. Bounded profile lookup (`/users/profiles`, maximum 40 IDs) hydrates current public names without exposing private emails. Missing/suspended profiles are labeled unavailable, not replaced with an invented person. Async article/profile titles update after the data arrives. All five block types, heading levels, ordered lists, quote attribution and image captions render without HTML injection.

## Theme, images and accessibility

Light, dark and system themes are selected with a labeled native control. Only the preference is stored in localStorage; no credentials or business records are stored there. The inline head initialization avoids a wrong-theme flash. System changes and storage events update the selected theme; unavailable storage does not prevent use.

A supported browser animates theme changes with a 380 ms circular View Transition from the control. Unsupported browsers and reduced-motion users get an immediate change. The transition overlay does not intercept input. Native controls, visible focus, a skip link and route focus handling support keyboard reading. React Router's data router preserves scroll history; changing exploration filters preserves the current position.

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

`npm run test:e2e` drives account journeys and actual public reading/search/filter/profile/reload/image journeys against services and emulators. Ten scenarios pass across desktop/mobile, including an explicitly injected failure followed by a retry against the real gateway. Visual regression fixtures are separate and are not persistence evidence. See [development](development.md). Author editor and moderation screens are still M4B; GraphQL interactions and deployment remain pending.

## Asset and performance maintenance

Original font files remain available; the browser loads WOFF2 derivatives. Static access imagery uses local derivatives. Publication originals and 640/960-width derivatives now live in Storage with server-verified ownership, actual dimensions and responsive `srcset` URLs through the gateway. Rebuild static asset derivatives with `node scripts/optimize-assets.cjs`; existing demo Storage derivatives can be added with `node scripts/seed-content.mjs --prepare-images`. Neither changes supplied source masters.

To audit the production bundle, build, start Vite preview on port 4173 with live gateway/services/emulators, then run `node scripts/audit-performance.mjs`. Preview origins must be included in local `ALLOWED_ORIGINS`; new setup files include loopback 4173 origins. Reports remain ignored/private. M1's static 97/100/100/100 is not the integrated score: M4A measured 70/100/96/100 initially and 75/100/96/100 after Storage derivatives, with mobile LCP 4.4 s and CLS 0.168 in that run. Image transfer fell substantially, but asynchronous discovery/loading layout still need performance work in M7. The 96 best-practices score records the expected unauthenticated refresh 401, not a hidden successful login. These are disclosed local measurements, not k6 or cloud evidence. Apollo will be mounted with the actual GraphQL features.
