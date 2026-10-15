# Wave 10 referrals

Branch: `feat/wave-10-referrals-minimal`.

## Rules

- Signup window: October 15, 2026, 00:00 through October 22, 2026, 23:59:59, Africa/Lagos.
- A new GitHub-authenticated user follows `/r/<code>` before signup. A signed, HTTP-only cookie preserves the first referral across OAuth. Existing auth accounts cannot gain link attribution; administrators can record existing manual referrals.
- One referrer per referred GitHub account. No self-referrals, stacking, or rollover.
- A referral qualifies when the referred account has a confirmed, chain-verified proof explicitly assigned to Wave 10 by an administrator. Proofs may be reviewed after the signup window closes.
- The bonus applies only to the referrer's own proofs explicitly assigned to Wave 10. All other earnings retain 60/40.

## Admin workflow

1. Open **Referrals** to record manual referrals, including the original referral date in Lagos time.
2. Review the completed withdrawal in **Earnings** and confirm it as usual.
3. In **Referrals**, inspect the proof, verify that it belongs to Wave 10, and select **Confirm Wave 10**. Do this for both referred scouters' and referrers' earnings.
4. Eligible earnings show **Wave 10 · +10%** and a 70/30 split. The payment confirmation shows the outstanding amount at the displayed exchange rate.
5. Transfer the money before marking it paid. Plinger records payments; it does not execute bank transfers.

The existing 60% snapshot remains intact. A separate immutable bonus record stores the additional amount, rate, naira value, actor, and timestamp. When both are paid together, one atomic database function records both. If 60% was already paid, only the remaining bonus is due. Double submissions and stale amounts are rejected.

Removing unpaid attribution/qualification is allowed. A qualification supporting an already-recorded bonus cannot be removed, and recorded Wave 10 payments cannot be cleared using **Mark unpaid**. Financial corrections require reconciliation rather than deleting payment history.

## Deployment

Apply `supabase/migrations/20261015194741_wave10_referrals_minimal.sql` before setting `PLINGER_WAVE10_REFERRALS=true` on the app server. The feature is disabled by default. No old migration or archived referral table is reused. There is no backfill of historical proofs.

Keep the flag enabled once bonus payments exist: those records must continue to appear in balances after the referral window closes. Do not roll back to a build that ignores bonus payments. The signup window closes automatically; the accounting remains available.

## Verification

```text
npm run typecheck
npm test -- --exclude tmp/** --exclude docs/**
node scripts/test-wave10-referrals.mjs
npm run build
```

The database test uses isolated PGlite PostgreSQL, never the hosted database. It checks attribution constraints, cutoff, explicit proof qualification, no stacking, combined and late payouts, stale/duplicate payments, preserved snapshots, and service-only access. Scratch checkouts in `tmp/` are excluded from the application test run.

Browser checks use mocked API responses at desktop and mobile widths; they do not create real referrals or mark real earnings paid. A real new-user GitHub OAuth signup remains a release smoke test.
