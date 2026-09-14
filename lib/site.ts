export const siteName = "Plinger";

export const siteDescription =
  "Track GitHub issues, pull requests, merges, and repository activity in one clear workspace.";

export const siteUrl = getSiteUrl();

function getSiteUrl() {
  const configuredUrl =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    "http://localhost:3000";

  const normalizedUrl = configuredUrl.startsWith("http")
    ? configuredUrl
    : `https://${configuredUrl}`;

  return new URL(normalizedUrl);
}
