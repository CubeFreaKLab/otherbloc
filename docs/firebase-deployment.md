# Firebase initial setup and controlled demo bootstrap

This is an operator guide, not evidence of a deployed environment. Project creation, region selection, billing, IAM, initial database/rule/index changes and demo-account creation require explicit owner approval. No command below has been executed against Firebase real resources. The application continues to use its own Users service/JWT authentication, not Firebase Authentication.

## Decisions before provisioning

Confirm the exact Firebase project ID (reuse an approved project or create a dedicated one), the Firestore and default Storage bucket locations, the account authorized to manage them, and an acceptable cost plan. Review any existing data and IAM before changing an existing project. Choose locations before resource creation; do not assume a later location change is a simple settings edit. The Render region/compute plan remains a separate explicit choice in the [infrastructure guide](render-deployment.md).

As checked on 2026-09-07, Cloud Storage for Firebase requires Blaze and a linked Cloud Billing account. New default buckets use `<project>.firebasestorage.app`; existing `<project>.appspot.com` buckets keep their names. Available no-cost usage does not remove the billing requirement or guarantee a zero bill. Review the [official Storage billing FAQ](https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024) and [current Firebase pricing](https://firebase.google.com/pricing) before approving activation.

Review budgets and alert recipients with the owner. An **alerts-only** budget does not stop spending automatically; any spend-cap option has separate eligibility, scope and enforcement behavior to verify in the actual account. No budget, cap, shutdown automation or billing change is configured by this repository. See [Cloud Billing budgets](https://docs.cloud.google.com/billing/docs/how-to/budgets).

Render's free compute is not an always-on guarantee for four services: the workspace shares 750 free instance hours per calendar month, and free services have cold-start and usage restrictions. Read [free-instance limitations](https://render.com/docs/free) and [current pricing](https://render.com/pricing). Approve the actual four-service estimate shown in the account, including bandwidth/build allowances, before provisioning; no paid plan is selected here.

## Identity and resource separation

| Identity | Proposed access to review with the owner | Not required |
| --- | --- | --- |
| Gateway runtime | Shared JWT/internal-service secrets and HTTPS owner URLs | Firebase credential or data IAM |
| Users runtime | Dedicated service account; Firestore data access; object access on the approved bucket for avatar operations | Project Owner/Editor, bucket administration, Firebase Auth administration |
| Content runtime | Different service account; Firestore data access; object access on the approved bucket for publication images | Project Owner/Editor or Hosting deployment |
| Interactions runtime | Different service account; Firestore data access | Storage object access; it retains the configured bucket name but does not read/write images |
| Hosting CD | Dedicated WIF deployment identity described in [CI/CD](ci-cd.md#manual-production-workflow) | Owner-service private keys, demo credentials or database bootstrap |
| Initial setup operator | Approved resource, rules, index and IAM setup privileges, scoped to the chosen project | Permanent broad deployment privileges for every runtime |

`roles/datastore.user` is the predefined data read/write role to review for the owner services; it is not a rules/index administrator. Admin SDK operations use IAM and do not inherit browser Security Rules. A distinct service account does **not** establish per-collection IAM isolation: collection ownership is enforced by the service code and API contracts, with database/project scope reviewed separately. See [Firestore server IAM](https://docs.cloud.google.com/firestore/native/docs/security/iam).

For Users and Content, review `roles/storage.objectUser` at the approved bucket, not project-wide `roles/storage.admin`. It covers object operations without bucket administration. If narrowing further by custom permissions or object-prefix conditions, verify uploads, downloads, replacement cleanup and rejection outside each intended prefix in the actual account. Users writes `avatars/<user>/<uuid>.webp`; Content writes `publications/<publication>/<uuid>.webp` and responsive derivatives. Such a prefix policy is not configured or proven by this template. See [Storage IAM roles](https://docs.cloud.google.com/storage/docs/access-control/iam-roles).

Render owner runtimes use `FIREBASE_CLIENT_EMAIL` and `FIREBASE_PRIVATE_KEY` for their corresponding accounts, entered privately in approved settings. Never reuse the same key in the gateway, frontend or Actions. Protect/rotate keys through the account owner; do not paste them into chat, terminal arguments or Git. Hosting CLI WIF authentication and Admin SDK runtime credentials are distinct mechanisms.

## Initial resource and rule/index setup

After access, region and costs are approved:

1. Create or verify the project's Firestore **Native mode**, Standard edition, `(default)` database and the agreed default Storage bucket. The committed owner factories use that default database. Do not create collections manually or switch database technology.
2. Review existing rules/index definitions and preserve unrelated data. The committed `firestore.rules` and `storage.rules` deny direct browser access because all business operations use server APIs. Configure the approved runtime identities separately; deny-all client rules do not deny an authorized Admin SDK identity.
3. With the authorized setup identity and explicit project selected, deploy the reviewed definitions from this repository:

   ```bash
   node node_modules/firebase-tools/lib/bin/firebase.js deploy --only firestore,storage --project <approved-project-id>
   ```

   This changes rules/indexes, not just local files, and is not part of Hosting CD. Review any index-deletion prompt; do not add `--force` to bypass it. Wait for required composite indexes to become ready and exercise their actual query shapes before acceptance. The CLI command finishing does not prove every index is ready. See [Firebase CLI partial deployment](https://firebase.google.com/docs/cli#partial_deploys).
4. After the owner-controlled push and real same-commit CI success, provision the approved Render Blueprint with independent auto-deploy/Auto Sync disabled. Verify each runtime's actual Firebase project, bucket, service account and assigned HTTPS origins in its settings. Health revision checks cannot prove those settings by themselves.
5. Run the controlled demo bootstrap below, then complete the protected Hosting/Render release and real three-role browser verification. Retain actual resource IDs, URLs, Actions links and SHA only after they exist. A release can precede seeding if needed; do not call an empty deployment full product acceptance.

## Controlled demo bootstrap

`scripts/bootstrap-cloud.mjs` is a separate operator command; the existing `seed:users` and `seed:content` remain local-demo-only. There is no public seed/admin-grant endpoint, automatic cloud seed during startup, reset command, account provisioning, deployment or billing operation in this script.

Use a separate **clean checkout of the deployed commit** with `npm ci`, without `setup:local`, private `.env` files inside it or imported development snapshots. Prepare private settings **outside that checkout** from `deploy/bootstrap/.env.example`. Load them explicitly with Node's `--env-file`; the command does not discover or overwrite private settings. Environment variables already present in the shell take precedence, so use a clean operator shell and check the printed public target before applying.

Set `BOOTSTRAP_REVISION` to the complete deployed commit. Supply the actual project/default bucket and the four approved Render IDs/origins from the release configuration, **without** a Render API token. The command validates those destination formats and checks four public health revisions; it does not query Render IAM or confirm service IDs through the account API.

Configure the three main demo email variables and a private, randomly generated `SEED_PASSWORD` of 24–128 characters, unique to this environment. Three additional synthetic authors retain their reserved `@example.test` addresses. Credentials are for controlled academic testing, not a public shared administrator login. Never publish them; rotate/revoke demo access after the agreed demonstration. Rerunning a seed does not reset passwords or restore changed roles.

First print a plan, replacing the private file path:

```bash
node --env-file="/absolute/private/bootstrap-users.env" scripts/bootstrap-cloud.mjs --plan --stage=users
```

On Windows use an absolute Windows path in the quotes. `--plan` performs no authentication, HTTP or database write and does not need a private key or password. It still requires valid public targets, an explicit production environment and the clean matching checkout. It is not a cloud permission/readiness check.

Only after approving the displayed target and accounts:

```bash
node --env-file="/absolute/private/bootstrap-users.env" scripts/bootstrap-cloud.mjs --apply --stage=users --confirm-project=<approved-project-id>
node --env-file="/absolute/private/bootstrap-content.env" scripts/bootstrap-cloud.mjs --apply --stage=content --confirm-project=<approved-project-id>
```

Use the **Users owner's credential** in the first private file and the **Content owner's credential** in the second; common destinations/demo credentials must agree. The command validates project-bound service-account syntax and RSA key format, but IAM must confirm the actual credential's identity and permissions. It rejects CI, emulators, implicit ADC files, dotenv overrides, deployment tokens, disabled TLS, stale/dirty revisions and mismatched project confirmation before connecting. This is defense in depth, not an authorization grant merely because a flag is present.

Before either stage, all four services must expose the exact healthy, uncached revision. Users then invokes its own transactional seed implementation to create six marked demo accounts, including the first administrator and active-admin counter. All input is validated before the first write; existing matching demo accounts are preserved and unrelated ID/email collisions stop the stage. Accounts are individual transactions, not one atomic six-account batch.

Content logs into the approved gateway and verifies exact current account IDs/roles. Its owner implementation creates only the marked initial draft; uploads, versioned edits, author review submission, administrator publication and public readback use existing gateway APIs. Seven readings use their actual seed time and Storage-backed images. Existing demo publications, including interrupted drafts or subsequently archived/edited records, are retained. Continue an interrupted draft through its author's editor; do not delete it or overwrite user work to make a rerun appear successful. Missing responsive variants can still be prepared by the explicit local command, but that repair option is not offered by cloud bootstrap.

HTTP requests reject redirects, have deadlines and are not automatically retried. Acquired login sessions are logged out in `finally`; an unconfirmed logout emits a visible warning requiring operator review. A failure can leave accounts, drafts or images already created. The command does not undo them; inspect the partial state before a retry. Firebase transactions retain their SDK concurrency behavior, distinct from retrying an entire bootstrap stage. Live errors omit credential-bearing SDK/HTTP details; inspect approved service logs privately rather than adding token/body logging.

## Verification boundary

Local contracts cover flags, project/revision/credential guards, four-health ordering, owner-only stage dispatch, all-account validation, collisions, versioned publication flow, preserved records, failed requests without retry, identity mismatch and session cleanup. A real emulator integration test creates all six accounts/seven image-backed readings and repeats both stages while comparing stored account/publication hashes. The test uses a named emulator database and bucket unique to its process, with scoped cleanup; it never invokes cloud `--apply` or relaxes its guard.

Complete real IAM access, Storage uploads/rejections, index-backed lists, persistent sessions/cookies, role transitions and interactions after the approved deployment. A plan, local SDK test, matching health SHA or successful seed log alone is not proof of those cloud requirements.
