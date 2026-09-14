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
