# Plinger referrals and waves

Updated: 14 October 2026

Status: implemented locally following authorization to code. The migration and app have not been deployed to production. Wave 10 is seeded as a draft requiring admin activation.

## Product rules

| Rule | Implementation |
| --- | --- |
| Normal split | Scouter 60%, Plinger 40%. |
| Qualified referral | Referrer keeps 70% of their own eligible earnings; Plinger takes 30%. |
| Duration | The entire referral signup wave, including claims approved or paid before qualification. No carryover. |
| Referred person's split | Remains 60/40 unless they independently qualify by referring someone else. |
| Multiple referrals | One qualified referral unlocks the benefit; additional referrals do not stack. Revoking one preserves the benefit if another qualifies. |
| Attribution | One incoming referral per permanent GitHub account at first successful signup. No self-referral or later self-service attribution. |
| Activity | Admin verifies substantive completed assigned work. Signup or issue closure alone never awards a benefit. |
| Qualification wave | The referred person joins and completes the qualifying work in the same wave. |

The initial activity policy requires an active personal GitHub App installation, an issue assigned to the referred account and closed after signup within the wave, and an admin's explicit confirmation that this person did the work, with a recorded reason. Merged PRs, confirmed earnings and payouts support the review. **Earnings and payment are supporting evidence, not mandatory gates** in this initial implementation; no minimum earnings amount is imposed. This is an implementation assumption based on the active-contributor requirement, not a claim that the user explicitly ruled payment optional.

## Wave 10 dates

The user specified October 15 as the start and provisionally one week in duration. Boundaries use Africa/Lagos (UTC+01:00).

| Boundary | Seeded value |
| --- | --- |
| Starts, inclusive | October 15, 2026, 00:00 |
| Ends, exclusive | October 22, 2026, 00:00; covers October 15–21 |
| Review and earnings-submission deadline | October 29, 2026, 00:00 |

The seven-day settlement window is provisional and was selected for implementation, not supplied by the user. Review it before activation. Draft dates are editable. Active or settling waves support audited extensions of their end and deadline; starts cannot move, dates cannot shorten, and activity periods cannot overlap another activated wave. Extensions never move existing referrals.

Wave 9 is recorded as closed without invented historical dates. Old earnings remain labelled legacy unless an admin verifies and corrects an unapproved claim's wave.

## Lifecycle

Waves progress through **Draft → Active → Settling → Closed**. Only one wave can have active status. Attribution also checks the start and end timestamps, so leaving a wave active does not extend its dates. Admins move it to settling to stop intake and activate the next wave. Review and earnings submissions remain available until the deadline.

Closing requires resolving pending referrals and earnings. Closed waves freeze referral decisions and claim review. Outstanding payments and explicit reversals remain recordable, preserving history. There is no automatic status-change or referral-expiry scheduler: admins resolve pending reviews and close waves.

The dashboard's **Activity month** calendar filter remains separate from financial waves.

## Signup and recovery

Stable UUID links use `NEXT_PUBLIC_SITE_URL/r/<code>` and permanent GitHub account IDs. The login dialog accepts direct or pasted links, previews the referrer and wave, and requires a deliberate choice before GitHub OAuth. Only UUID codes or referral URLs on the canonical origin are accepted; pasted URLs are never fetched.

The server creates an intent for the active wave. HttpOnly cookies and the callback's intent parameter bind attribution to that OAuth attempt, preventing another tab from substituting a different pending referral. Verified GitHub identity determines account ownership.

Membership and attribution are committed atomically. Existing Auth, profile and personal App identities are conservatively backfilled as existing members. Identity history survives Auth deletion and App reinstallation. The first successful attribution is immutable, and callback retries cannot duplicate it.

Intents expire after one hour for ordinary completion. Explicit recovery can retry for seven days only while the original wave accepts referrals. A failed write preserves the authenticated session and leads to onboarding, where users retry or explicitly finalize ordinary signup. A changed wave is never silently substituted. Ordinary completed signups cannot later add a referral.

Intent creation is limited to 20 attempts per hour per server-HMAC visitor hash. Multiple GitHub accounts can still belong to one person; this limit and manual review do not guarantee prevention of all fraud.

## Activity review

The admin **Waves & referrals** screen shows assigned closed issues, merged PRs and confirmed/paid claim counts. Qualification requires selecting an eligible issue, confirming actual contribution, and recording a reason. The database rechecks assignment, closure window, active installation and deadline.

Decisions retain admin identity, time, reasons, evidence snapshots and the `completed-work-admin-v1` policy marker. Later sync changes do not automatically rewrite eligibility or payments. Rejection and revocation are audited. Automatic reopened-issue alerts and cross-account fraud detection are not implemented.

The evidence panel currently limits candidate lists to 1,000 assignment records and 100 issues/PRs per review. Exceptionally large histories may need manual investigation. Referral and financial lists paginate beyond the database API's default row limit.

Scouters see their own referrals, public handles and statuses, without the referred person's bank details, tokens, proofs, review reasons or exact earnings.

## Earnings and payments

New withdrawal proofs require an explicit active or settling wave accepting earnings. Existing Stellar verification and duplicate transaction/operation protection remain. Admins verify the wave against evidence before approving a claim. An audited correction can move an unapproved claim only if it has no payment history and its original wave is not closed.

The `scouter_earning_balances` view supplies both interfaces and review APIs with entitlement, paid totals and outstanding balance. Entitlement is `floor(gross_stroops × share_percent / 100)` per claim. Totals sum claim amounts across mixed 60/40 and 70/30 rates. Plinger's share is gross minus Scouter entitlement.

For $100 gross already paid at $60, qualification raises entitlement to $70 and leaves $10 due. The original payment and rate remain unchanged; the top-up captures its own conversion rate.

The append-only `earning_payments` ledger records wave, claim, USD amount, split, gross basis, exchange-rate details, naira amount, actor and timestamp. Corrections append a signed reversal with a reason and reference to the original entry. These controls record payments already made; they do not transfer or recover money.

Requests include an idempotency UUID and the displayed balance and percentage. Transaction locks serialize eligibility and payout mutations. Stale requests fail; retries cannot duplicate recorded payments. Revocation after payment exposes an overpayment balance without silently deducting from another wave.

Legacy snapshots are imported without changing recorded amounts or rates. If a historical paid record lacks a USD snapshot, the old 60% entitlement is used. Missing historical naira amounts remain unknown and are flagged. Legacy claims do not inherit Wave 10 benefits.

## Schema and access

Migration: `supabase/migrations/20261014133420_referrals_and_waves.sql`.

New tables: `waves`, `scouter_members`, `referral_codes`, `referral_intents`, `referrals`, `referral_audit`, `earning_payments`. Two accounting views and the earning `wave_id` column support shared calculations. Benefits derive from qualified referrals for the same account and wave.

RLS and revoked browser privileges protect the new records. Transactional functions are SECURITY INVOKER with empty search paths and service-role-only execution. Admin mutations verify admin identity and same-origin requests. Scouter ownership comes from authenticated GitHub identity. Payment and audit records cannot be updated or deleted by the application role.

A transaction advisory lock serializes referral, wave and financial mutations. This favors correctness for the current workload; higher traffic would require measuring contention and narrowing locks carefully.

## Implementation map

| Area | Files |
| --- | --- |
| Schema and transactions | `supabase/migrations/20261014133420_referrals_and_waves.sql` |
| Contracts and server access | `lib/referrals/` |
| Signup and recovery | `app/scouter/login/`, `app/auth/callback/`, `app/scouter/onboarding/` |
| Scouter referrals | `app/scouter/referrals-view.tsx` |
| Admin review and waves | `app/dashboard/referrals-view.tsx`, `app/api/admin/referrals/`, `app/api/admin/waves/` |
| Shared financial mutations | `lib/scouter/accounting.ts` |
| Payout interface | `app/dashboard/wave-earnings-view.tsx` |
| Database and API checks | `lib/referrals/*.test.ts`, callback and admin-referral route tests |
| Browser component checks | `tests/browser/`, `playwright.config.mts` |

## Verification and rollout

Local automated checks exercise migrations against PGlite PostgreSQL, legacy backfills, activity gates, wave boundaries, identity, RLS/privileges, nonstacking benefits, top-ups, stale requests, idempotency, revocations, reversals, extensions and wave corrections. Callback tests cover recovery and per-attempt cookies. Browser checks use actual UI components with mocked APIs for pasted links, manual approval, mobile layout and top-up display.

```powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
# Use installed Chrome; omit this after installing Playwright Chromium:
$env:PLINGER_BROWSER_CHANNEL='chrome'
npm.cmd run test:browser
```

These browser checks are a component harness, not a live OAuth/Supabase end-to-end test. PGlite uses stub Auth/Storage schemas and does not replace hosted migration rehearsal or multi-connection load testing.

Deployment sequence:

1. Rehearse the migration on staging and compare historical paid totals. Review the initial activity policy and provisional settlement deadline before enabling intake.
2. Apply the new migration with all earlier migrations, then deploy this app version. Coordinate rollout: old payout writers are rejected by the new ledger guard.
3. Configure the canonical site URL, Supabase keys and existing GitHub settings. Ensure Supabase redirect settings accept the site's `/auth/callback` with OAuth query parameters.
4. Test new referred and ordinary GitHub signups in staging, including App installation, proof upload, approval, initial payment and top-up. Verify existing-member exclusion with a backfilled account.
5. In **Waves & referrals**, review and activate Wave 10. Activating a future wave still prevents intake before its start.
6. Sync activity, review evidence and claims, record actual payments, move to settling, and close once pending decisions are resolved.

Production deployment, hosted migration execution and live OAuth tests have not been performed in this session. To pause intake, move the active wave to settling; preserve referral and payment history rather than dropping feature tables.
