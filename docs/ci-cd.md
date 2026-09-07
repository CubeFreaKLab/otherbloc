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

The [Render release controller](render-deployment.md) provides read-only preflight and sequential exact-commit deployment logic, tested without accessing a Render account. It verifies both Blueprint Auto Sync and service auto-deployment, targets exactly four named Node web services, waits for each live deploy and matching uncached health, and stops on uncertain or failed outcomes without automatic re-deployment or rollback. Its write entry point requires the intended release workflow context; the actual protected workflow, provisioning configuration and account approvals are still pending. Local contracts are not evidence of a Render API call or CD execution.

## Evidence and release boundary

Do not upload `.project/`, `.agent/`, `.env*`, snapshots, authentication traces, user data or the private academic evidence register to GitHub artifacts. The workflow has no artifact-upload step. E2E authentication traces/video remain disabled. Job logs provide check names and outcomes for the disposable demo data, not production credentials. Preserve the real Actions run URL and its triggering commit only after it has actually executed; pull-request checks normally test GitHub's merge revision, whereas push checks test the pushed revision.

The reusable workflow is available for a later release job to depend on at the same commit; this milestone does not yet add CD. A local relative workflow reference selects the caller's commit, as described in [GitHub's reusable workflow contract](https://docs.github.com/en/actions/how-tos/reuse-automations/reuse-workflows). Firebase/Render release preparation must gate deployment on successful checks for the exact release SHA, disable independent automatic deployment paths, use protected production approval and verify the deployed version. Account, project, region, billing and production credential choices still require the owner. YAML preparation alone does not satisfy the cloud-delivery requirement.
