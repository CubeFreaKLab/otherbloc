# Frontend

The React/Vite frontend preserves the editorial identity: Prumo titles, Adelle Sans interface text, Georgia reading text, thin rules and the existing monochrome palette. REST and GraphQL integrations enter through the independent gateway.

## Current milestone

The editorial presentation is implemented locally. The seven Spanish publications in `src/data/articles.js` are **demonstration fixtures**, with synthetic author profiles, unique block content and explicit labels. They are not persisted in Firebase yet. The fictional news and review identify themselves inside the content. This module is temporary input for the reproducible seed, not a fallback for API failures.

Authentication currently has the responsive composition and accessible fields; submitting explicitly reports that no account was created and no data was sent. Authentication, account areas, authoring, moderation and interactions remain later integration milestones. The Save link leads to sign-in; Share uses the native sharing/clipboard capability with an explicit fallback.

## Routes and reading

- `/`: featured publication and the remaining demo edition; no duplicated giant masthead or newsletter.
- `/explore`: combined query, category and publication-type filters reflected in the URL. Search normalizes accents; empty results and clearing filters are real local behaviors.
- `/article/:slug`: the matching publication's own blocks and author. Unknown slugs render 404 instead of unrelated content.
- `/profile/:id`: the selected author's own publications. Unknown accounts render 404.
- `/login`, `/register`: the approved split photographic composition on desktop; form-only composition on mobile.
- Unknown paths render an explicit 404 view, without redirecting silently to home.

The footer links only to existing destinations. The primary navigation checks category query parameters, avoiding multiple active categories.

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

The application is still a local milestone. These checks do not establish authentication, database persistence, cloud deployment or production readiness.

## Asset and performance maintenance

Original font files remain available; the browser loads WOFF2 derivatives. Responsive 640/960/1536-pixel images preserve the supplied photographs. Rebuild derivatives with `node scripts/optimize-assets.cjs`, optionally passing a directory containing the three original PNG files. This is an optional maintenance step, not required for a normal install.

To audit the production bundle, build, start the Vite preview on port 4173, then run `node scripts/audit-performance.mjs`. Reports and the dedicated temporary browser profile stay under ignored `.project/evidence/`. The first local audit exposed oversized assets; the optimized run scored 97/100/100/100 for performance/accessibility/best practices/SEO. Scores depend on environment and content and must be measured again after integration. The configured Apollo client will be mounted with real GraphQL features; the demo-only home does not download an unused GraphQL client.
