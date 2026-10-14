import { test, expect, type Page } from "@playwright/test";
const id = (n: string) => `00000000-0000-4000-8000-${n.padStart(12, "0")}`;
const wave = { id: id("10"), name: "Wave 10", status: "active", starts_at: "2026-10-14T23:00:00Z", ends_at: "2026-10-21T23:00:00Z", qualification_deadline: "2026-10-28T23:00:00Z", timezone: "Africa/Lagos" };
const referral = { id: id("20"), referrer_account_id: 1, referred_account_id: 2, referrer_login: "referrer", referred_login: "contributor", wave_id: wave.id, status: "pending", joined_at: "2026-10-16T10:00:00Z", reason: null };
async function mockReferrals(page: Page, status = "pending") {
  await page.route("**/api/admin/referrals**", async (route) => {
    const url = route.request().url();
    if (route.request().method() === "PATCH") return route.fulfill({ json: { ok: true } });
    if (url.includes("audit=")) return route.fulfill({ json: [] });
    if (url.includes("evidence=")) return route.fulfill({ json: { issues: [{ github_issue_id: 123, title: "Fix account settings", url: "https://github.com/example/repo/issues/1", closed_at: "2026-10-17T10:00:00Z" }], mergedPullRequests: [], confirmedEarnings: 1, paidEarnings: 0 } });
    return route.fulfill({ json: { waves: [wave], referrals: [{ ...referral, status }], activeWave: wave } });
  });
  await page.route("**/api/referrals", (route) => route.fulfill({ json: { waves: [wave], referrals: [{ ...referral, status }], activeWave: wave, link: `https://plinger.vercel.app/r/${id("60")}`, accountId: 1 } }));
}
for (const theme of ["light", "dark"] as const) test(`referral login checks pasted links in ${theme} mode`, async ({ page }) => {
  if (theme === "dark") await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?view=login");
  await page.evaluate((value) => document.documentElement.classList.toggle("dark", value === "dark"), theme);
  await page.getByRole("button", { name: "Continue with GitHub" }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await expect(page.getByRole("alertdialog").getByRole("button", { name: "Continue with GitHub" })).toBeEnabled();
  await expect(page.getByLabel("Plinger referral link")).toHaveCount(0);
  await page.screenshot({ path: `tmp/referral-login-${theme}.png`, fullPage: true });
  await page.getByRole("button", { name: "Yes, I was referred" }).click();
  await expect(page.getByLabel("Plinger referral link")).toBeVisible();
  await page.getByLabel("Plinger referral link").fill("https://evil.test/referral");
  await expect(page.getByRole("alertdialog").getByRole("button", { name: "Continue with GitHub" })).toBeDisabled();
  await page.getByRole("button", { name: "Check link" }).click();
  await expect(page.getByRole("alert")).toContainText("valid Plinger");
  await page.getByLabel("Plinger referral link").fill("https://plinger.vercel.app/r/valid-code");
  await page.getByRole("button", { name: "Check link" }).click();
  await expect(page.getByRole("alertdialog")).toContainText("@referrer");
  await expect(page.getByRole("alertdialog")).toContainText("Wave 10");
  await expect(page.getByRole("alertdialog").getByRole("button", { name: "Continue with GitHub" })).toBeEnabled();
  expect(await page.getByRole("alertdialog").evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await page.screenshot({ path: `tmp/referral-login-${theme}-verified.png`, fullPage: true });
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByLabel("Plinger referral link")).toHaveCount(0);
  await expect(page.getByRole("alertdialog").locator('input[name="referral"]')).toHaveCount(0);
  await expect(page.getByRole("alertdialog").getByRole("button", { name: "Continue with GitHub" })).toBeEnabled();
});
test("admin qualifies completed work with an explicit contribution decision", async ({ page }) => {
  await mockReferrals(page); await page.goto("/");
  await page.getByRole("button", { name: "View evidence" }).click();
  await expect(page.getByRole("heading", { name: "Activity for @contributor" })).toBeVisible();
  await page.getByLabel("Assigned issue completed in this wave").selectOption("123");
  await page.getByLabel("I verified this Scouter did the work", { exact: false }).check();
  await page.getByLabel("Reason and contribution evidence").fill("I verified the accepted fix and assignment history.");
  const sent = page.waitForRequest((r) => r.url().endsWith("/api/admin/referrals") && r.method() === "PATCH");
  await page.getByRole("button", { name: "Save activity review" }).click();
  expect((await sent).postDataJSON()).toMatchObject({ id: referral.id, status: "qualified", issueId: 123, contributionVerified: true });
  await expect(page.getByRole("status")).toContainText("Saved");
});
test("Scouter sees a wave-specific benefit on mobile without horizontal overflow", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 }); await mockReferrals(page, "qualified"); await page.goto("/?view=self");
  await expect(page.getByText("70% to you / 30% to Plinger")).toBeVisible();
  await expect(page.getByLabel("Your personal referral link")).toHaveValue(`https://plinger.vercel.app/r/${id("60")}`);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: "tmp/referral-mobile.png", fullPage: true });
});
test("a late qualification records only the top-up and preserves the earlier payment", async ({ page }) => {
  let paid = false;
  await page.route("**/api/earnings", (route) => route.fulfill({ json: { claims: [{
    id: id("30"), account_id: 1, profile: { account_login: "referrer", bank_name: "Example bank", bank_account_name: "Scouter", bank_account_number: "1234567890" },
    wave_id: wave.id, wave_name: wave.name, amount_stroops: "1000000000", entitlement_stroops: "700000000", share_percent: 70,
    status: "confirmed", paid_total_stroops: paid ? "700000000" : "600000000", paid_total_kobo: "7982340", balance_stroops: paid ? "0" : "100000000", transaction_hash: "a".repeat(64),
    payments: [{ id: id("50"), claim_id: id("30"), amount_stroops: "600000000", amount_kobo: "7982340", rate_micros: "1330390000", share_percent: 60, created_at: "2026-10-17T10:00:00Z", reason: "Original payment", reversal_of: null, legacy: false }],
  }], exchangeRate: { rateMicros: "1330390000", sourceUrl: "https://www.exchangerate-api.com", isFallback: false, updatedAt: null } } }));
  await page.route(`**/api/earnings/${id("30")}`, (route) => { expect(route.request().postDataJSON()).toMatchObject({ expectedBalance: "100000000", expectedPercent: "70", action: "payout" }); paid = true; return route.fulfill({ json: { ok: true } }); });
  await page.goto("/?view=earnings");
  await page.getByRole("button", { name: "Record remaining payout" }).click();
  await expect(page.getByRole("alertdialog")).toContainText("$10.00");
  await page.getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.getByRole("button", { name: "Record remaining payout" })).toHaveCount(0);
  await page.getByText("Payment history (1)").click();
  await expect(page.getByText("Original payment")).toBeVisible();
  await page.screenshot({ path: "tmp/referral-earnings.png", fullPage: true });
});
