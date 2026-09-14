# Plinger

Plinger is a GitHub App dashboard for repository signals: issue assignments, pull request activity, merged PRs, and merge-state alerts.

## Local Setup

Install dependencies:

```powershell
npm.cmd install
```

Run the app:

```powershell
npm.cmd run dev
```

Open:

```text
http://localhost:3000
```

## GitHub App Settings

Use these values while developing locally:

```text
Homepage URL: http://localhost:3000
Webhook URL: https://YOUR-TUNNEL-URL/api/github/webhook
Webhook secret: use GITHUB_WEBHOOK_SECRET from .env.local
```

Subscribe to these webhook events for the MVP:

```text
Installation
Installation repositories
Issues
Pull requests
Pushes
```

Start with these repository permissions:

```text
Metadata: Read-only
Issues: Read-only
Pull requests: Read-only
Contents: Read-only
```

Later, when Plinger starts pushing branches or opening PRs, upgrade:

```text
Contents: Read and write
Pull requests: Read and write
```

## Supabase

The database migrations are in:

```text
supabase/migrations/20260914090309_initial_plinger_schema.sql
supabase/migrations/20260914143540_linked_issue_pull_requests.sql
```

Create a Supabase project, then apply the migration with the Supabase CLI.

First authenticate the CLI:

```powershell
npm.cmd run supabase:login
```

Then link this repo to the Plinger Supabase project. The project ref is the
short id in your Supabase project URL:

```text
https://supabase.com/dashboard/project/YOUR_PROJECT_REF
```

Run:

```powershell
npm.cmd run supabase:link -- --project-ref YOUR_PROJECT_REF
npm.cmd run supabase:push
```

After that, add these environment variables to Vercel:

```text
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_SECRET_KEY=sb_secret_...
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
PLINGER_ADMIN_EMAIL=your-admin-email@example.com
```

Use the secret key only for server-side webhook and dashboard data access. The
publishable key is for Supabase Auth; neither key should be committed to Git.

To enable the admin dashboard:

1. In this project's Supabase Authentication dashboard, create and confirm the
   admin user with the email in `PLINGER_ADMIN_EMAIL`.
2. Turn off public signups under Authentication settings. Only the confirmed
   admin email can access the dashboard, even if other Auth users exist.
3. Add the same variables to `.env.local` for local development and to Vercel
   for production. Redeploy after changing Vercel environment variables.

The dashboard redirects visitors to `/login`. GitHub webhooks do not use this
login; they continue to authenticate with the webhook signature.

## Linked Issue Monitoring

Apply the latest migration with `npm.cmd run supabase:push` before deploying
this version. It stores issue-to-PR links and protects them with RLS; only the
server-side Supabase secret key can access them.

Set `GITHUB_APP_ID` and `GITHUB_PRIVATE_KEY` in Vercel. The private key must be
the complete PEM contents from the Plinger GitHub App settings. Keep it
server-side and never commit it. Locally, `GITHUB_PRIVATE_KEY_PATH` may point
to the PEM file instead. GitHub installation tokens are generated on demand;
users do not need to give Plinger a personal access token.

Issue and PR webhooks reconcile GitHub's closing-keyword and manually linked
relationships. The dashboard shows recent closed issues and merge states only
for linked PRs. An unknown merge state is shown as "Checking," not "Ready."
The admin-only **Sync GitHub** button seeds the latest 12 issues from each of
up to 10 connected repositories and rechecks up to 20 linked open PRs. This
also discovers older links without redelivering webhooks. Issue and PR webhooks
keep those records current, and base-branch pushes recheck linked open PRs.
CI-only and review changes may not produce those webhooks; use **Sync GitHub**
to check their latest status. The sync is intentionally bounded, so older
records beyond the latest 12 issues per repository are not backfilled yet.

## Automatic Sync

The GitHub Actions workflow in `.github/workflows/sync-github.yml` calls the
same protected sync endpoint. It polls a rotating batch of 20 linked PRs four
times an hour and runs the bounded full sync once daily. Webhooks remain the
primary path for immediate issue and PR changes, and **Sync GitHub** remains
available for an on-demand full check. Scheduled runs may be delayed or missed
by GitHub Actions, so this is periodic reconciliation rather than a guarantee
of exact 15-minute freshness.

Generate a dedicated secret:

```powershell
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64url'))"
```

Set the same value as `PLINGER_SYNC_SECRET` in the Vercel Production environment
and as a repository Actions secret named `PLINGER_SYNC_SECRET` on GitHub.
Redeploy Vercel after adding its environment variable, then run the workflow
manually from GitHub Actions with `mode=poll` and confirm its response reports
`failed: 0`. Never commit the secret or use a personal access token for it.
GitHub Actions scheduled workflows in public repositories can be disabled
after 60 days without repository activity; check the Actions tab if scheduled
sync stops running.

Before the first production test:

1. Apply the migration with `npm.cmd run supabase:push`.
2. In Vercel, set `GITHUB_APP_ID` and the rotated PEM contents as the sensitive
   `GITHUB_PRIVATE_KEY` variable. Keep `GITHUB_WEBHOOK_SECRET` configured.
3. Deploy the current code. Environment variable edits affect new deployments,
   not deployments already running.
4. Sign in, click **Sync GitHub**, and confirm recent issues and linked PRs load.
   Open/close an issue or update a linked PR to verify webhook-driven changes.

If testing locally, update `GITHUB_PRIVATE_KEY_PATH` to the newly rotated PEM;
the old local key will no longer authenticate.

If webhook storage is unavailable, Plinger returns 503 so GitHub does not
mistake an unstored event for a successful delivery.

## Scouters

Apply `supabase/migrations/20260914155739_scouter_installation_state.sql` with
`npm.cmd run supabase:push`. It records personal GitHub App uninstallations and
adds indexes for per-account lookups. Current installations still display if
this migration is pending, but removed-installation history is unavailable.

The admin-only Scouters view reads current personal installations from GitHub's
App installations API and combines them with recorded removed installations.
An organization installation does not identify which organization
members have joined. A profile shows assigned issues, authored pull requests,
webhook activity associated with that account, and connected repositories
owned by it. Counts cover all stored matching records; each detail list shows
only its most recent 20 records (30 for activity). Closed PRs exclude merged
PRs, so the two totals do not overlap. Assigned issue rows also show recorded
linked PR statuses, including conflicts and closed-without-merge states, even
when another user authored the PR. Scouters does not request or store a user's
personal access token.
Issue assignment totals use the latest stored assignee list, not a historical
assignment ledger. An issue unassigned later will no longer count for that
scouter.
