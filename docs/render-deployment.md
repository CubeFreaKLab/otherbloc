# Render release controller

This is offline deployment preparation, not an executed Render release. No resources, paid plan, region, Blueprint or account settings have been created or changed. The owner must approve those choices and control the first push. The [gated release workflow](ci-cd.md#manual-production-workflow) is prepared; final `render.yaml` and actual protection/account configuration remain pending. The controller cannot presently establish a completed CD pipeline.

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

## Infrastructure example and explicit preparation

`deploy/render.blueprint.example.json` describes the four services in JSON syntax, which is also valid YAML. It deliberately contains invalid region/plan placeholders instead of silently selecting a location or paid default. It is **not** the active `render.yaml`; do not import it unchanged. Once the owner has reviewed current pricing and approved both choices, `node scripts/render-blueprint.mjs --region=<approved-region> --plan=<approved-plan>` prepares `render.yaml` locally and refuses to overwrite an existing file. Both flags are required, there is no deployment flag and the command does not access an account. Existing approved configurations must be reviewed explicitly rather than regenerated over them.

Each service builds from the repository root and its shared lockfile with `npm ci --omit=dev --workspace @otherbloc/<service>`, then uses its own `npm start`. Do not set Render's Root Directory to a backend subfolder: the lockfile/workspace root must remain available. Node is explicitly set to the locally verified 24.14.1, not an unbounded future major; review updates with CI. [npm workspace installation](https://docs.npmjs.com/cli/v11/commands/npm-ci/#workspace) and [Render Node selection](https://render.com/docs/node-version) document these controls.

Users generates `JWT_SECRET` and `SERVICE_AUTH_SECRET` once; the other services reference those same values. Firebase project/bucket and allowed frontend origins are supplied at initial setup, with owner services receiving the shared target but separate `FIREBASE_CLIENT_EMAIL`/`FIREBASE_PRIVATE_KEY` credentials. The gateway receives neither Firebase credential nor Firebase project configuration. No secret value is committed. `sync: false` prompts apply at initial Blueprint creation; adding a new secret to an existing service requires an explicit settings update. Generated signing keys are not regenerated on every sync. Rotation must be coordinated across consumers and sessions.

Owner URLs reference `RENDER_EXTERNAL_URL` through `fromService`, preserving Render's assigned public HTTPS URL instead of guessing a globally available hostname or switching to private HTTP. The gateway start command appends `/graphql` to the referenced `INTERACTIONS_SERVICE_ORIGIN`; Render does not interpolate variables inside Blueprint values, so this composition occurs in its Linux start shell. This keeps the existing `INTERACTIONS_SERVICE_URL` application contract. Render's [cross-service external-URL example](https://render.com/blog/migrate-django-from-heroku) demonstrates this pattern; [Blueprint reference semantics](https://render.com/docs/blueprint-spec#referencing-service-properties) specify that referenced values refresh on a Blueprint sync, not instantly after an unrelated settings change.

The template keeps normal request limits and proposes one trusted Render reverse-proxy hop (`TRUST_PROXY=1`). Verify forwarded client addresses on the actual platform before traffic acceptance, especially if adding another CDN/proxy. Allowed Origins must be explicit HTTPS frontend origins, not `*`. Preserve the existing secure partitioned session-cookie strategy and verify it in production browsers. Firestore credentials must be scoped by the approved IAM design; code-level collection ownership does not become per-collection IAM enforcement merely by using separate service accounts.

The current template selects `MEDIA_STORAGE_PROVIDER=cloudinary` in the three owners and omits `FIREBASE_STORAGE_BUCKET`. Only Users and Content receive server-only Cloudinary credentials. No emulator variables or media credentials belong in the gateway or frontend. This preserves Firestore on Spark without enabling Firebase Storage billing. See [image configuration](cloudinary-storage.md); the template alone does not provision accounts, copy local photographs or verify the cloud connection.

Before initial provisioning: obtain a real successful CI run for the intended pushed commit, finalize region/plan and Firebase resources, configure the runtime credentials/origins, validate the prepared Blueprint with Render, and explicitly approve the displayed changes/costs. Initial creation deploys services. Disable Blueprint Auto Sync separately and keep service `autoDeployTrigger: off`; do not connect an automatically syncing Blueprint and assume the later release workflow controls that first creation. After provisioning, read back actual IDs/URLs/settings into the protected release environment and run preflight. No provisioning step has been executed here.

Local schema verification uses Render's downloaded 2020-12 schema with a private Ajv 8 validator: unchosen placeholders fail, while an in-memory `oregon`/`free` fixture passes. Those fixture values are **not selected deployment choices** and were not written to `render.yaml`. Schema validation is not Render's semantic API validation or proof that cross-service values resolve in a real account. Four independent temporary checkouts of `5458e45`, outside the original dependency search path, also install the exact per-workspace production commands: gateway 89 packages, Users/Content 280 each, Interactions 320. All direct dependencies resolve inside their own checkout; Firebase CLI, ESLint, Vite and React are absent. The owned Node suites pass (7/3/7/10 checks respectively). These are Windows install/unit checks, not Render Linux startup or Firebase-cloud tests. Firebase-dependent installs retain five known moderate advisories; no forced dependency downgrade was applied.

## Read-only preflight

After the account owner has configured and authorized access to the existing resources, run:

```bash
node scripts/release-render.mjs --preflight
```

The command performs only GET requests to `api.render.com`. It requires the Blueprint to be in sync, point to `CubeFreaKLab/otherbloc`, `main`, `render.yaml`, own exactly the four named web services and have Auto Sync disabled. Each service must match its ID/name, source repository/branch, Node runtime, `/health`, canonical URL, unsuspended state and `autoDeploy: no`. Recent deploys must have known terminal states; an active or unknown state stops preflight. It does not fix settings automatically.

Service auto-deployment and Blueprint synchronization are separate controls: Render documents that [Blueprint changes can redeploy affected services](https://render.com/docs/infrastructure-as-code#disabling-automatic-sync) even when service auto-deployment is off. Initial Blueprint provisioning also deploys resources; it needs its own prior successful CI and explicit cost/setup approval. This script neither provisions nor synchronizes a Blueprint.

## Sequential exact-commit deployment

`--deploy` additionally refuses execution outside the expected manually dispatched main-branch `release.yml` Actions context with a matching `RELEASE_APPROVED_SHA`. These environment checks are defense in depth, not proof of approval by themselves. The prepared workflow depends on successful same-commit Platform CI and checks the existing reviewer/main-only production configuration before and after its approval boundary; merely naming an environment in YAML does not establish protection. The owner still has to configure and authorize it in GitHub.

After every read-only preflight passes, the controller deploys Users → Content → Interactions → Gateway. Every [Render deploy request](https://api-docs.render.com/reference/create-deploy) sends exactly `{ "commitId": "<full SHA>" }`, never an implicit latest branch or a deploy hook. It does not send a conflicting `deployMode`. It reads the returned deploy object directly and polls that ID; only `live` with the expected `commit.id` succeeds. An early queued response may omit its commit, but a mismatched commit is rejected immediately and a live response without it fails.

For each service, `/health` must then return HTTP 200, the expected service identity, `status: ok`, that exact revision and `Cache-Control: no-store`. Health calls send no Render credential. The next service is not requested until this verification passes. Deploy polling is bounded to 20 minutes per service, health to two minutes; individual requests also have deadlines and reject redirects. Known failed or future unknown states fail closed. The library uses the contracts in Render's [official OpenAPI specification](https://api-docs.render.com/openapi/render-public-api-1.json).

A failed or uncertain POST is **not retried automatically**: it may already have started a deploy. Inspect Render and the safe service/commit/deploy-ID status log first. If a later service fails, already verified predecessors remain deployed; no coordinated automatic rollback, deletion, cancellation or database reset is attempted. Firebase Hosting must not advance after such failure. This read/check sequence is not a lock against an operator or another credential starting a manual deployment outside Actions; restrict those paths and recheck versions at final cloud acceptance.

## Local verification and remaining acceptance

Thirteen fixture-based contracts cover target validation, write-context guards, read-only preflight, independent auto-deployment settings, exact-commit ordering, request privacy, uncertain outcomes without retries, partial failure, deploy/health timeouts, stale versions and missing or unknown metadata. The public CLI is also spawned locally to verify that writes fail before credentials or HTTP access. The first contract run exposed acceptance of a noncanonical origin with a custom port; that validation was corrected and the failed diagnostic retained privately.

These tests do not call Render and are not simulated results presented as cloud evidence. They join the existing Node suite. The real Render API response shape, account permissions, region/plan, protected Actions environment, production cookies, Firebase data and three-role journeys still require authorized cloud verification. See [CI and revision boundaries](ci-cd.md).
