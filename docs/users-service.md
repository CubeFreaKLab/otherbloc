# Users service

The Users service is an independent Express REST application on port 3001. Its approved responsibility is registration, authentication, profiles, and user roles.

## Implemented endpoints

All public paths below enter through the gateway. The owning service requires its internal key on every route except `GET /health`, which reports process health, not database readiness.

| Method and path | Permission and result |
| --- | --- |
| `POST /api/users/register` | Strict name/email/password input; creates a reader and session, never accepts a client role |
| `POST /api/users/login` | Valid credentials and active account; issues a short access token and HttpOnly refresh cookie |
| `POST /api/users/refresh` | Valid refresh cookie, explicit request header and allowed Origin; current session/account required |
| `POST /api/users/logout` | Revokes the cookie session (or a valid bearer session) and clears the cookie; repeatable |
| `GET /api/users/me` | Authenticated current profile, including private email but no hashes |
| `PATCH /api/users/me` | Own name and biography only |
| `PUT /api/users/me/avatar` | Own raw JPEG/PNG/WebP, at most 2 MB; decoded and re-encoded server-side |
| `DELETE /api/users/me/avatar` | Removes the public avatar reference |
| `POST /api/users/me/author-request` | Reader requests author access; does not grant that role |
| `POST /api/users/me/password` | Current password required; changes hash and invalidates every existing session |
| `GET /api/users/:id` | Public active profile only; no email, status or credential fields |
| `GET /api/users/:id/avatar?v=:assetId` | Only the current avatar, streamed through the gateway; no bucket download token |
| `GET /api/users?limit=20&cursor=:id` | Admin-only account listing; maximum 50, document-ID cursor |
| `PATCH /api/users/:id/permissions` | Admin-only role/status changes, excluding self; preserves an active administrator |

`GET /internal/session` exists only on the Users service, not as a gateway route. Other owning services supply the internal key and original bearer token to obtain authoritative identity/role. They must not trust a `userId` or role header from a client and must not read Users collections directly.

## Session and password strategy

Passwords use Node's asynchronous scrypt, N=65536, r=8, p=2, 16-byte random salt and 32-byte output; equality is constant-time. At most two hashes run concurrently to bound memory. This setting follows the [OWASP password-storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html). Registration accepts 12–128 characters without trimming passwords. Failed logins share a generic message and unknown accounts perform a dummy derivation. The gateway separately limits failed login/registration attempts.

Access JWTs last 15 minutes and use HS256 with a server-only 32+ byte key, fixed issuer/audience, `kind`, subject, session ID and account authorization version. The browser keeps access tokens **only in memory**. Refresh cookies last at most seven days; Firestore stores only their SHA-256 digests. The server reads current account/session state for protected operations, so logout, suspension, password changes and role changes invalidate existing access rather than waiting for JWT expiration.

Refresh secrets rotate at most once per minute using a conditional Firestore write. Simultaneous requests using the immediately previous secret receive the same successor during a 30-second grace window; older/unknown secrets are rejected. A version precondition prevents a refresh from overwriting concurrent revocation. The session has an absolute expiration, not an indefinitely extended lifetime. Hash-only storage does not provide indefinite reuse-history tracking; do not claim that it does.

Local cookies use HttpOnly/SameSite=Lax. HTTPS production cookies additionally use Secure, SameSite=None, Partitioned, the `__Host-` prefix and Path=/ without Domain. This accommodates Hosting/Render's separate sites in browsers supporting [partitioned cookies](https://developer.mozilla.org/en-US/docs/Web/Privacy/Guides/Third-party_cookies/Partitioned_cookies). The UI verifies cookie retention immediately after login; a blocked-cookie failure is explicit. Actual production-browser compatibility still requires deployment verification. Cookie endpoints require `X-Otherbloc-Request: 1` and reject unapproved Origins; no permissive credentialed CORS.

## Permissions and consistency

All new accounts are readers. Only an existing administrator can grant author/admin permissions or suspend a different account. Administrative transactions re-read the acting account/session, target account and active-admin counter. A reader's author request only marks a pending request. Public profiles of suspended accounts return 404.

Registration atomically creates the email reservation, user and session using a write batch with create preconditions; concurrent registration cannot duplicate an email. Profile/password/permission operations use transactions. See [database](database.md) for fields and ownership.

Avatar validation checks both declared MIME and decoded format, rejects oversized/animated/invalid images and enforces a 16-megapixel decode bound and minimum 32×32 pixels. Sharp re-encodes to at most 512×512 WebP, stripping original metadata. Bytes go to Storage; ownership/path/size go to Firestore. Replaced/removed avatars cease to be served; old private objects remain referenced in `userAvatars` for controlled maintenance, rather than pretending a database/file operation is a cross-product transaction. Failed new-object attachment attempts best-effort cleanup of that newly created object only.

## Environment

The `.env.example` file lists runtime, Firebase, JWT, internal-key and allowed-origin variables without values. Secrets stay on backend processes; none are Vite settings. The seed command creates explicitly marked local demo accounts and never resets an existing demo password or promotes an unrelated account.

## Commands

```bash
npm run start --workspace @otherbloc/users-service
npm run test --workspace @otherbloc/users-service
npm run seed:users
npm run test:integration
npm run test:e2e
```

See [development](development.md) for process prerequisites. M3 is verified against real emulator data and actual browser HTTP traffic; it is not evidence of Firebase cloud or Render deployment.
