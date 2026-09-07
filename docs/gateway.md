# API Gateway

The API Gateway is an independent Express application on port 3000. It is the only backend entry point available to the frontend.

| Public path | Owning service path |
| --- | --- |
| `/api/users/*` | Users `:3001/api/users/*` |
| `/api/publications/*` | Content `:3002/api/publications/*` |
| `/api/interactions` | Interactions `:3003/graphql` |

Forwarding preserves query strings, upstream status, response streams and selected cache headers. Upstream redirects are refused. Timeout and unavailable-service errors remain explicit 504/502 responses.

## Structure

- `src/config` loads environment configuration.
- `src/models` defines validated service targets.
- `src/services` owns the service registry.
- `src/controllers` prepares HTTP responses.
- `src/routes` maps health and gateway index routes.
- `src/middleware` handles unknown routes and server errors.

## Environment

Configuration names and safe placeholders live in `.env.example`. See [development](development.md) for root local commands. No credentials are stored in source.

## Commands

```bash
npm run start --workspace @otherbloc/api-gateway
npm run test --workspace @otherbloc/api-gateway
```

## Operational endpoints

- `GET /health` reports gateway status and registered service names.
- `GET /api` lists the planned public service prefixes.

Health reports process status, not database readiness.

## Trust boundaries

The gateway accepts explicit CORS origins, limits body size and request rate, and applies Helmet headers. Production configuration requires HTTPS targets/origins and at least 32-byte `JWT_SECRET` and `SERVICE_AUTH_SECRET`. `TRUST_PROXY` is explicit; never enable unlimited proxy trust.

Bearer tokens must use HS256, issuer `otherbloc-users`, audience `otherbloc-platform`, `kind=access`, `sub`, `sid` and expiration. REST writes and private listing/profile endpoints require a verified token. Service owners remain responsible for current session revocation, role and resource authorization; a gateway signature check alone is not sufficient. GraphQL field authorization belongs to Interactions.

Only selected headers are forwarded. Client-supplied identity/role/internal-key headers are discarded. The gateway creates its own request ID and internal service key. Cookies, Origin and `X-Otherbloc-Request` are forwarded only to Users for session endpoints. No cookie reaches Content or Interactions. Backend applications do not import one another's source modules.

Gateway tests cover real HTTP forwarding, GraphQL path mapping, header sanitization, unavailable services, invalid tokens/origins and rate limits.
