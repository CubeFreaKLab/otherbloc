# Render release controller

This is offline deployment preparation, not an executed Render release. No resources, paid plan, region, Blueprint or account settings have been created or changed. The owner must approve those choices and control the first push. The gated release workflow and final `render.yaml` are separate pending steps; the controller cannot presently establish a completed CD pipeline.

## Approved topology and configuration

The controller targets exactly four independent Node web services, with canonical HTTPS `onrender.com` origins. Render names are proposed configuration, not evidence that resources exist:

| Order | Render name | Expected health identity | Application port |
| --- | --- | --- | --- |
| 1 | otherbloc-users | users-service | 3001 |
| 2 | otherbloc-content | content-service | 3002 |
| 3 | otherbloc-interactions | interactions-service | 3003 |
| 4 | otherbloc-gateway | api-gateway | 3000 |

`deploy/.env.example` lists release-controller settings without values. Supply each `RENDER_<DOMAIN>_SERVICE_ID` and `RENDER_<DOMAIN>_ORIGIN`, the approved `RENDER_BLUEPRINT_ID`, an API key and the full lowercase Git SHA. Local read-only preflight uses `APP_REVISION`; Actions will supply `GITHUB_SHA`. The two must agree if both are present. Real API keys belong in a protected production secret or a private local environment, never the frontend, shell arguments, source control or chat. This script does not load environment files automatically.

The runtime services need their own configuration and Firebase permissions, independently of the release controller. The gateway must remain the only browser data entry point and does not need a Firebase Admin credential. This milestone does not configure runtime secrets, choose a billable plan or change the existing production HTTPS/session rules.

## Read-only preflight

After the account owner has configured and authorized access to the existing resources, run:

```bash
node scripts/release-render.mjs --preflight
```

The command performs only GET requests to `api.render.com`. It requires the Blueprint to be in sync, point to `CubeFreaKLab/otherbloc`, `main`, `render.yaml`, own exactly the four named web services and have Auto Sync disabled. Each service must match its ID/name, source repository/branch, Node runtime, `/health`, canonical URL, unsuspended state and `autoDeploy: no`. Recent deploys must have known terminal states; an active or unknown state stops preflight. It does not fix settings automatically.

Service auto-deployment and Blueprint synchronization are separate controls: Render documents that [Blueprint changes can redeploy affected services](https://render.com/docs/infrastructure-as-code#disabling-automatic-sync) even when service auto-deployment is off. Initial Blueprint provisioning also deploys resources; it needs its own prior successful CI and explicit cost/setup approval. This script neither provisions nor synchronizes a Blueprint.

## Sequential exact-commit deployment

`--deploy` additionally refuses execution outside the expected manually dispatched main-branch `release.yml` Actions context with a matching `RELEASE_APPROVED_SHA`. These environment checks are defense in depth, not proof of approval by themselves. The future workflow must depend on successful same-commit Platform CI and use a configured, reviewer-protected production environment; merely naming an environment in YAML does not establish that protection.

After every read-only preflight passes, the controller deploys Users → Content → Interactions → Gateway. Every [Render deploy request](https://api-docs.render.com/reference/create-deploy) sends exactly `{ "commitId": "<full SHA>" }`, never an implicit latest branch or a deploy hook. It does not send a conflicting `deployMode`. It reads the returned deploy object directly and polls that ID; only `live` with the expected `commit.id` succeeds. An early queued response may omit its commit, but a mismatched commit is rejected immediately and a live response without it fails.

For each service, `/health` must then return HTTP 200, the expected service identity, `status: ok`, that exact revision and `Cache-Control: no-store`. Health calls send no Render credential. The next service is not requested until this verification passes. Deploy polling is bounded to 20 minutes per service, health to two minutes; individual requests also have deadlines and reject redirects. Known failed or future unknown states fail closed. The library uses the contracts in Render's [official OpenAPI specification](https://api-docs.render.com/openapi/render-public-api-1.json).

A failed or uncertain POST is **not retried automatically**: it may already have started a deploy. Inspect Render and the safe service/commit/deploy-ID status log first. If a later service fails, already verified predecessors remain deployed; no coordinated automatic rollback, deletion, cancellation or database reset is attempted. Firebase Hosting must not advance after such failure. This read/check sequence is not a lock against an operator or another credential starting a manual deployment outside Actions; restrict those paths and recheck versions at final cloud acceptance.

## Local verification and remaining acceptance

Thirteen fixture-based contracts cover target validation, write-context guards, read-only preflight, independent auto-deployment settings, exact-commit ordering, request privacy, uncertain outcomes without retries, partial failure, deploy/health timeouts, stale versions and missing or unknown metadata. The public CLI is also spawned locally to verify that writes fail before credentials or HTTP access. The first contract run exposed acceptance of a noncanonical origin with a custom port; that validation was corrected and the failed diagnostic retained privately.

These tests do not call Render and are not simulated results presented as cloud evidence. They join the existing Node suite. The real Render API response shape, account permissions, region/plan, protected Actions environment, production cookies, Firebase data and three-role journeys still require authorized cloud verification. See [CI and revision boundaries](ci-cd.md).
