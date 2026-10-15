# Maintenance access

Set `PLINGER_MAINTENANCE=true` in the appropriate Vercel environment and redeploy. Set it to `false` and redeploy to reopen the platform.

During maintenance:

- `/scouter`, `/dashboard`, referral links and private API routes are blocked, including requests with an existing user session.
- Private APIs return HTTP 503 with a maintenance message and no-store headers. Workspace requests redirect to `/maintenance`.
- Public pages, docs, admin login, OAuth callbacks, GitHub webhooks and the already-authenticated background sync route remain available. Their existing authorization checks still apply.
- Workspace tabs running this version check maintenance on entry, on focus, and every 30 seconds. Old tabs loaded before this version encounter the gate on their next protected request/navigation.

## Test on the production domain

1. Select **Are you the developer?** at the bottom right of the maintenance page.
2. Enter the existing Plinger admin email and password.
3. Choose **Test as a scouter**, then sign in through GitHub in the same browser.

A signed, HTTP-only, host-only browser cookie permits maintenance access for two hours. Production uses Secure cookies; SameSite=Lax allows the GitHub callback. The cookie survives the change from an admin auth session to a scouter auth session but does not grant admin privileges to that scouter.

The signing key uses the existing server-side Supabase secret/service-role key with a maintenance-specific signature context. No additional secret is required. Changing that key or the configured admin email invalidates existing passes. Never expose that key in a NEXT_PUBLIC variable.

Sign out or visit `/maintenance/access` and select **End developer access** to remove the pass early. After expiry, sign in as admin again. Use a separate browser or an incognito window to confirm that ordinary users see the maintenance barrier.

For referral testing, also set `PLINGER_REFERRALS=true` in the same Vercel environment. Maintenance does not enable referrals automatically.
