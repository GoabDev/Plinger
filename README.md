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

The first database migration is in:

```text
supabase/migrations/20260914090309_initial_plinger_schema.sql
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
```

Use a secret key for server-side code. Do not expose it with a
`NEXT_PUBLIC_` prefix.

Until those Supabase variables are configured, Plinger still accepts verified
GitHub webhooks and logs them, but skips database writes.
