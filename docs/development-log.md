# Development log

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
