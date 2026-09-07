# Continuous integration and deployment preparation

The repository prepares CI independently of cloud credentials. A local run or a committed workflow is not proof that GitHub Actions, Firebase Hosting or Render have run. The owner controls the first push; no script in this verification workflow pushes or deploys code.

## Platform CI

`.github/workflows/foundation-ci.yml` retains its historical filename but is named **Platform CI**. It runs on pushes and pull requests and can be reused through `workflow_call`. The verification job has a 30-minute limit, read-only repository permission and no cloud secrets. Checkout does not persist Git credentials. The three setup actions are pinned to verified commit SHAs; review upstream changes before updating them.

The sequential stages are:

1. Check out the triggering revision; install Node 24 and Temurin Java 21.
2. Install the lockfile with `npm ci`, then run Node contracts, lint and the production frontend build.
3. Install Chromium and its Linux system dependencies; run visual/accessibility browser regression.
4. Run `npm run test:ci`: generate independent local credentials, start empty Firestore/Storage emulators, run the isolated API suite, start the gateway plus exactly three services and Vite, seed demo data and run the complete desktop/mobile E2E suite.

The visual suite must finish before live services start: its CI web-server configuration intentionally refuses to reuse an existing Vite server. API integration uses `demo-otherbloc-test`; live browser journeys use `demo-otherbloc` with six demo accounts and seven published readings. Both projects exist only inside that run's emulators. Actual business requests use the gateway and owner-service APIs; successful business responses in live E2E are not replaced by fixtures. E2E runs serially without retries. The separate visual suite uses explicit fixtures and retains its existing CI retry policy.

The emulator configuration derives the committed rules and indexes, disables the emulator UI and starts only Firestore/Storage. It has no Hosting target, snapshot import or export. Each invocation uses a unique ignored temporary directory to avoid the Storage emulator's shared-blob collision. Java's heap is bounded to 1 GiB per JVM for this job; no application rate limit or authorization rule is relaxed.

The runner refuses existing private environment files, an existing development snapshot, unknown flags or occupied required ports before starting any server. It never kills a process found by port number. Inherited Firebase credentials/targets, frontend API targets and rate-limit overrides are removed from the child environment. Fresh random demo secrets are masked in Actions logs. Service startup must pass all five real HTTP readiness checks; failed commands and unexpected service exits fail the job. The live runner closes its own application children in `finally`; Firebase `emulators:exec` shuts down its emulators after the command ends. Interrupted jobs still require the hosting runner's normal process cleanup.

## Reproduce the CI commands locally

Use a separate disposable checkout with Node 24, npm, Java 21 and Chromium prerequisites. Do not use your configured development checkout and do not run `setup:local` or import a snapshot there first. Stop/export your development environment yourself if it owns the required ports; the CI script will not stop it for you.

```bash
npm ci
npm test
npm run lint
npm run build
npx playwright install --with-deps chromium
npm run test:ui
npm run test:ci
```

Set `CI=true` for this local sequence to exercise the same browser configuration. On Windows, use `npx playwright install chromium` instead of Linux dependency installation; set `JAVA_HOME` or `OTHERBLOC_JAVA_HOME` to Java 21 when it is not on PATH. `JAVA_TOOL_OPTIONS=-Xmx1g` matches the workflow's emulator heap. This checks the commands on your local OS, not the GitHub-hosted Ubuntu image.

`test:ci` is the live API/browser stage, not an alias for all preceding checks or dependency installation. It intentionally accepts no test-selection flags. The generated `.env.local` and temporary files remain in that disposable checkout and are ignored. A later invocation must use another clean checkout; do not remove an established development configuration to bypass the guard. No cloud login is required for these Firestore/Storage-only emulator runs. See [Firebase's CI integration](https://firebase.google.com/docs/emulator-suite/install_and_configure#integrate_with_your_ci_system) and [Playwright CI setup](https://playwright.dev/docs/ci).

## Local verification — 2026-09-07

A new disposable clone of `8038850` received the exact M7F workflow/runner changes, recorded by SHA-256 hashes. `npm ci` installed 1,049 packages without inherited dependencies or private configuration; the existing Node 24.14.1, Java 21.0.12.1 and per-user browser/emulator binary caches were prerequisites. The same sequential commands passed 43 Node checks, lint/build, 22 visual checks with `CI=true` (1.2 minutes), 30 API checks (62.04 seconds), both seeds and all 78 live E2E checks (9.3 minutes). Firebase and the application children shut down automatically, the wrapper exited 0 and every required port was free afterward. Actionlint 1.7.12 also accepted the workflow. This verifies local Windows commands and YAML, not an Ubuntu Actions execution.

The new six Node contracts cover protection of existing configuration/snapshots, inherited-target removal, fixed emulator setup, occupied ports, actual readiness, command failures, owned-process shutdown and workflow ordering/pinned actions. Direct invocation over the original development checkout and direct invocation of the inner runner both failed deliberately before startup. Four genuine home screenshots from the clean live run were inspected in desktop/mobile and light/dark. The original environment was backed up before the suite and reopened from its own snapshot afterward. Nine moderate dependency advisories remain disclosed; test success does not resolve them.

## Exact revision metadata

Each of the four applications exposes its full Git revision in the existing REST `/health` response with `Cache-Control: no-store`. `RENDER_GIT_COMMIT` is the platform-supplied value; `APP_REVISION` is an optional explicit value for other controlled environments. Values must be complete 40-character hexadecimal SHAs and must agree when both are supplied. Invalid or conflicting metadata prevents startup. Without either value, local health reports `revision: null`; it does not guess from a nearby checkout. The GraphQL `serviceStatus` schema and all business authorization remain unchanged.

The Vite production build emits `/version.json` with only `application`, `revision`, `dirty` and `source`. It reads the actual checkout and validates `APP_REVISION`/`GITHUB_SHA` against it when available. Uncommitted or untracked non-ignored files produce `dirty: true`. An archive without Git metadata reports `dirty: null`, even if a revision is declared; unavailable metadata is never presented as a clean checkout. Firebase Hosting configuration prevents caching this manifest. Vite preview can inspect its contents locally but does not verify Firebase's deployed cache headers.

These fields are operational metadata supplied by a trusted build/runtime, not cryptographic attestation. Release acceptance must require the intended exact SHA in all four healthy services and a clean frontend manifest, together with the corresponding successful CI run. A null, dirty, mismatched or stale version cannot establish a successful release. Version agreement alone does not prove real Firebase persistence or three-role cloud journeys. Disposable emulator CI strips inherited backend revision variables to avoid accidentally labeling demo services as a previous deployment.

The metadata change passes 50 Node checks, lint/build, 30 API checks (59.19 seconds), four targeted live desktop/mobile reading checks (27.5 seconds) and four real preview screenshot inspections. Each actual backend entry point also refuses an invalid revision before listening, while the existing applications remain healthy. A build with uncommitted changes correctly reports the previous HEAD and `dirty: true`; unspecified backend versions report null. This is local evidence, not deployment evidence.

## Render controller preparation

The [Render release controller](render-deployment.md) provides read-only preflight and sequential exact-commit deployment logic, tested without accessing a Render account. It verifies both Blueprint Auto Sync and service auto-deployment, targets exactly four named Node web services, waits for each live deploy and matching uncached health, and stops on uncertain or failed outcomes without automatic re-deployment or rollback. Its write entry point requires the intended release workflow context. The workflow is prepared below; provisioning and actual account/protection configuration still require the owner. Local contracts are not evidence of a Render API call or CD execution.

## Manual production workflow

`.github/workflows/release.yml` is named **Production release** and runs only by manual dispatch. Select `main` and supply its complete current SHA as `release_sha`. The first gate rejects a different branch, tag, repository, event or SHA and reads the existing GitHub `production` environment. It requires an identified reviewer and a selected deployment-branch policy containing only `main`; missing or unreadable protection fails before CI or deployment. The check does not create or edit the environment. Configure the owner as reviewer, explicitly decide whether another person must approve (prevent self-review), and disable administrative bypass in GitHub's settings. Those latter two settings are operator decisions, not asserted as verified by the script. See [GitHub environment protection](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments).

The gate has read-only Contents/Actions permission. The workflow then calls the local relative Platform CI workflow from the same revision, without inheriting production secrets. After CI succeeds, a new job requires the `production` environment approval, rechecks protection, installs the lockfile and validates destinations plus the clean checkout. Its build uses only the approved gateway for Fetch and GraphQL, and must emit the exact clean workflow manifest. Render updates sequentially; only after all four pass does the job authenticate to Google, publish Hosting and recheck all five public version surfaces. Release jobs share one concurrency group with cancellation disabled. A failure stops later steps; no automatic cross-service rollback is promised.

Production environment variables are the `RENDER_*` destinations in `deploy/.env.example`, `FIREBASE_PROJECT_ID`, `FIREBASE_HOSTING_ORIGIN`, `GOOGLE_WORKLOAD_IDENTITY_PROVIDER` and `GOOGLE_DEPLOY_SERVICE_ACCOUNT`. The Hosting origin must identify that project's default `https://<project>.web.app` site, not an arbitrary site or custom domain. `RENDER_API_KEY` is an environment secret exposed only to the Render step. `VITE_API_URL` and `VITE_GRAPHQL_URL` are derived from the gateway origin. Do not add backend JWT, Firebase runtime keys, seed passwords or private emulator settings to the release job. The separate [infrastructure example](render-deployment.md#infrastructure-example-and-explicit-preparation) retains unchosen region/plan placeholders and prepares the final Blueprint only after both choices are explicit; its first provisioning is a distinct authorization boundary.

Google authentication uses the SHA-pinned [auth action](https://github.com/google-github-actions/auth) with workload identity federation through a dedicated service account. Configure trust for immutable GitHub repository/owner IDs, `main`, the release workflow and `production`, not an unrestricted organization or pull request. Only the release job can request an OIDC token. Authentication occurs after potentially lengthy Render polling to avoid aging the short-lived credential; temporary `gha-creds-*.json` files are ignored by Git/Hosting and cleaned by the action. This CLI identity is separate from the Firebase Admin SDK credentials required by deployed owner services; the action documents that Admin SDK does not support WIF.

The [Firebase CLI supports Application Default Credentials](https://firebase.google.com/docs/cli#use_the_cli_with_ci_systems); the workflow does not use legacy `FIREBASE_TOKEN` or account passwords. The dedicated Hosting identity needs [Hosting Admin plus the CLI's API Keys Viewer role](https://firebase.google.com/docs/projects/iam/roles-predefined-product#firebase-hosting-roles), not Owner/Editor or Firebase Auth administration. IAM/WIF must be configured and verified with the account owner before activation. The command explicitly selects the project and `--only hosting`; it does not create Firestore/Storage, deploy their rules/indexes or seed cloud accounts. Those are required initial-setup steps, with index readiness and runtime access verified before a first release. Passing version checks alone is not their substitute.

The final job summary records the verified revision and five public origins. Safe Render deploy IDs/statuses remain in the job log. If Google authentication/Hosting fails after Render succeeded, report that partial state and inspect it before a new dispatch; do not claim an atomic rollout. Complete the three-role browser journeys and Firebase business-persistence checks separately, including actual production cookie compatibility. Retain the Actions URL and exact deployed SHA only after the run exists.

Local verification adds eight controlled-response contracts (71 Node checks total), validates both workflow files with Actionlint 1.7.12, and checks that local release commands fail before credentials/network. Tests cover environment protection, targets, clean manifests, stale CDN content, workflow ordering, permissions and credential-file exclusions. They do not authenticate to GitHub/Google/Render, exercise a hosted runner or deploy. A workflow file and fixtures prepare the procedure; real cloud acceptance remains pending.

## Evidence and release boundary

Do not upload `.project/`, `.agent/`, `.env*`, snapshots, authentication traces, user data or the private academic evidence register to GitHub artifacts. The workflow has no artifact-upload step. E2E authentication traces/video remain disabled. Job logs provide check names and outcomes for the disposable demo data, not production credentials. Preserve the real Actions run URL and its triggering commit only after it has actually executed; pull-request checks normally test GitHub's merge revision, whereas push checks test the pushed revision.

The prepared release job depends on the reusable workflow at the same commit: a local relative reference selects the caller's revision, as described in [GitHub's reusable workflow contract](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows). Actual environment protection, disabled independent Render deployment paths, Firebase resources, project/region/billing and credential choices still require the owner. No push, Actions run or cloud deployment is claimed by this preparation. YAML alone does not satisfy the cloud-delivery requirement.
