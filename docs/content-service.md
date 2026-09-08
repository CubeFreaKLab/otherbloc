# Content service

Independent Express REST service on port 3002. It owns publications, their lifecycle, block content, search and publication images in Firestore/Storage. The gateway is the public entry point; every service request except `/health` requires the internal service key. Health reports process health, not database readiness.

## Endpoints

All paths below start with `/api/publications`.

| Method / suffix | Access and result |
| --- | --- |
| `GET /` | Published list: `limit` (default 12, maximum 40), `cursor`, `q`, `type`, `category`, `authorId` |
| `GET /options` | Supported seven Spanish publication types and four categories |
| `GET /bulletin` | Public optional weather, crypto and headline groups; no account information or writes |
| `GET /:id` | Published detail; own private detail; administrators can inspect review/published/archived, not another author's draft |
| `GET /mine` | Current active account's own non-deleted publications, optional status and pagination |
| `GET /moderation` | Administrator queue, status review (default), published or archived, paginated |
| `POST /` | Any active account: strict `{id: UUID, title?}`; creates draft version 1; same owner/ID retry returns existing record without overwriting |
| `PUT /:id`, `PATCH /:id` | Own draft only; complete editor document and `If-Match` version |
| `PATCH /:id/status` | `{status, reason?}` and `If-Match`; permitted transitions below |
| `DELETE /:id` | Own draft/archived only, `If-Match`; logical deletion, repeated requests return 204 |
| `POST /:id/assets` | Own draft: raw JPEG/PNG/WebP, maximum 5 MB; returns image ID and protected gateway URL |
| `GET /:id/media/:assetId` | Attached published image, owner preview, or attached moderator preview outside draft; optional `width=640` or `960` |

IDs are opaque; named demo slugs preserve existing URLs. Unknown, deleted and unauthorized private resources return 404 on reads. Unauthorized edits return 403. Missing `If-Match` returns 428, stale state 409, invalid fields 400, invalid images 415, excessive size 413. JSON detail responses include ETag and `private, no-store`. Errors are explicit and never fall back to fixtures.

## Optional editorial bulletin

`services/bulletin.js` requests nine fixed Bolivia city centres from [Open-Meteo](https://open-meteo.com/en/docs) and BTC/ETH/SOL/XRP/ADA last-trade USD prices from [Kraken's public ticker](https://docs.kraken.com/api-reference/market-data/get-ticker-information). No keys, account identifiers, user location or credentials are sent to providers. Provider URLs/markets are fixed; redirects are rejected and fetch/JSON reads have a 4.5-second abort signal. This adds no service, database collection or third-party browser connection.

Per-process single-flight caches last 15 minutes for weather, 5 minutes for prices and 1 minute for the four most recent public headlines. Headlines use the existing published-only query and expose only ID, slug and title. Each source fails independently to `null`, with a 60-second retry cooldown and no expired fallback or invented values. Responses carry `fetchedAt`/`expiresAt`, use `no-store`, and the frontend also excludes expired groups. New or archived headlines can take up to one minute to change. No scheduler wakes an idle Render instance.

Weather is model-estimated, not a promise of station observations; current values over an hour from the service clock are excluded. The frontend rounds °C and maps WMO conditions to existing Phosphor icons. Its source panel credits Open-Meteo and [CC BY 4.0](https://open-meteo.com/en/license), states the rounding and reports query times. Prices identify Kraken/USD and their five-minute refresh, not global or streaming quotes. Open-Meteo's [free endpoint terms](https://open-meteo.com/en/terms) cover non-commercial use; before monetizing, review the provider plan. `BULLETIN_EXTERNAL_ENABLED=false` on Content disables external requests while preserving own headlines. No billing or provider account was enabled.

Unit tests cover normalization, timestamps, independent expiry, coalescing, cooldown, partial failure, malformed payloads and external opt-out. Browser tests cover the full rotation, pause/keyboard/reduced motion, date rollover, source information, recovery and responsive contrast. Live local checks separately confirmed nine cities, five prices and four existing public titles through the gateway.

## Editor document

Strict top-level fields: `title` (160), `summary` (400), nullable `coverId`, `coverAlt` (300), `type`, `category`, up to eight distinct `tags` (30 each), and at most 80 blocks. Each block has a distinct UUID:

- `paragraph`: `text` up to 6,000 characters.
- `heading`: `text` up to 200 and `level` 2 or 3.
- `list`: up to 50 `items` (500 each), `ordered` boolean.
- `quote`: `text` up to 6,000 and `attribution` up to 160.
- `image`: nullable `assetId`, `alt` up to 300 and `caption` up to 500.

Drafts may be incomplete so work can be recovered. Review and publication require title length 5+, summary 20+, a cover with alternative text and complete content. All referenced assets must belong to that publication and author. Clients cannot submit ownership, status, search indexes, timestamps or storage paths in editor updates. Optional `formatted` runs and `formattedItems` preserve bold, italic and HTTP(S)/mailto links. The schema verifies that their joined text exactly matches the existing plain-text fields. REST, GraphQL, preview and public reading retain the same formatting; rendering uses React text, never untrusted HTML. Existing notes need no migration.

## Lifecycle and permissions

| From → to | Who | Meaning |
| --- | --- | --- |
| Draft → review | Owner with an active account | Submit complete content; editing stops |
| Review → draft | Owner, or admin with a reason | Withdraw or request correction; owner receives the moderation note |
| Review → published | Administrator | Approve for public reading |
| Published → archived | Owner, or admin with a reason | Remove from public lists/detail/media without destroying content |
| Archived → draft | Owner with an active account | Recover for editing and a new review cycle |

Administrators may author their own content, but cannot edit somebody else's text. Administrative returns and archives retain a private note for the author, in addition to atomic history. Deletion hides an owner's draft/archive irreversibly from the product; it does not physically erase Firestore history or private Storage files. No restore/delete-others endpoint is offered. Retention/maintenance remains separate. Previously downloaded bytes cannot be recalled; public image responses can remain cached for 60 seconds after archival.

Each protected request verifies JWT issuer/audience/kind and asks Users `/internal/session` for the current identity/role. No client `userId` or role header is authoritative, and Content does not read Users collections. A Users outage returns 503 for protected operations; anonymous public reads remain independent. This is a per-request check, not a distributed transaction spanning services.

## Concurrency, search and files

Full-document updates use both the client version and a Firestore `lastUpdateTime` precondition. Competing saves cannot overwrite one another. State changes/deletion use a conditional atomic batch with their history entry. This avoids read-lock upgrade waits observed in the emulator while retaining atomic audit/state integrity. Same-state retries are only returned after read/role authorization. Asset ownership records are immutable apart from additive, server-generated image derivatives; they have no client update/delete endpoint.

Public queries order by `publishedAt DESC, document ID ASC`; own/moderation queries use `updatedAt DESC, document ID ASC`. Opaque cursors carry the final ordering values and an exact filter scope. Changing filters requires a fresh cursor. Concurrent publication changes can move items between pages; this is keyset pagination, not a frozen snapshot.

Search normalizes case/accents and matches metadata word prefixes across title, summary, type, category, tags and the author's name at last content save. It is not full-text body search or fuzzy search. One indexed prefix selects candidates; all query terms must then match. Each request scans at most 200 candidates and returns a continuation when more remain, even when the current chunk has no matches. Live author display comes from Users, while indexed name changes require the next content save. See [database](database.md) for the 19 query-shape indexes; emulator results do not prove cloud indexes are deployed.

Images must decode as their declared static format, at least 32×32 and at most 24 megapixels. Sharp strips metadata and encodes an at-most-1920×1920 WebP; smaller 640/960-width variants are created when useful, without upscaling. Storage holds bytes; `publicationAssets` holds owner, dimensions, paths, sizes and variants. File saves precede a transaction that rechecks the draft and records ownership; failed attachment attempts cleanup of the new original and variants. Unattached uploads stay private. The UI requests image bytes only through the gateway, with the same access checks for every resolution.

## Run and verification

```bash
npm run dev
npm run seed:users
npm run seed:content
npm run test:integration:running
npm run test:e2e
```

Start emulators separately first; see [development](development.md). Seed input is the labeled Spanish demo edition; creation is followed by actual upload/save/review/approval/public read through the gateway. Existing demo records are preserved. An interrupted draft is continued by its owner, not silently overwritten. `node scripts/seed-content.mjs --prepare-images` adds missing derivatives to existing demo images without replacing original files or text.

Runtime variables: `PORT`, `NODE_ENV`, `JWT_SECRET`, `SERVICE_AUTH_SECRET`, `USERS_SERVICE_URL`, Firebase project/bucket and emulator or server credential variables. Production service URLs require HTTPS and keys at least 32 bytes. No credentials are frontend variables.

M4A verifies the API lifecycle and connected public reading, including actual Firestore/Storage emulator data, concurrency, authorization, uploads, real browser search/reading and injected-error recovery. M4B connects the owner editor and administration screens, including autosave/version-conflict recovery, authenticated image previews, approval/return/archive and deletion. See [frontend](frontend.md). Interactions, Firebase cloud, Hosting/Render and real CI/CD remain pending.
