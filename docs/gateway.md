# API Gateway

The API Gateway is an independent Express application on port 3000. It is the only backend entry point available to the frontend.

## Structure

- `src/config` loads environment configuration.
- `src/models` defines validated service targets.
- `src/services` owns the service registry.
- `src/controllers` prepares HTTP responses.
- `src/routes` maps health and gateway index routes.
- `src/middleware` handles unknown routes and server errors.

## Environment

Copy `.env.example` to `.env` for local overrides. The service uses environment variables for its port and internal service URLs. No credentials are stored in source.

## Commands

```bash
npm run start --workspace @otherbloc/api-gateway
npm run test --workspace @otherbloc/api-gateway
```

## Foundation endpoints

- `GET /health` reports gateway status and registered service names.
- `GET /api` lists the planned public service prefixes.

Forwarding and security middleware are intentionally deferred to their approved roadmap phases.
