import { createSign } from "node:crypto";
import { readFile } from "node:fs/promises";

type GraphQLResponse<T> = { data?: T; errors?: Array<{ message: string }> };
type InstallationToken = { token: string; expiresAt: number };
export type GitHubAppInstallation = {
  id: number;
  account: { id: number; login: string; type: string } | null;
  target_type: string;
  suspended_at: string | null;
  created_at: string;
};
const installationTokens = new Map<number, Promise<InstallationToken>>();

async function getPrivateKey() {
  if (process.env.GITHUB_PRIVATE_KEY) {
    return process.env.GITHUB_PRIVATE_KEY.replace(/\\n/g, "\n");
  }
  if (process.env.GITHUB_PRIVATE_KEY_PATH) {
    return readFile(process.env.GITHUB_PRIVATE_KEY_PATH, "utf8");
  }
  throw new Error("GitHub App private key is not configured");
}

export async function githubGraphQL<T>(
  installationId: number,
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const { token } = await getInstallationToken(installationId);

  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "user-agent": "Plinger",
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok) throw new Error(`GitHub GraphQL: ${response.status}`);
  const result = (await response.json()) as GraphQLResponse<T>;
  if (result.errors?.length || !result.data) {
    throw new Error(result.errors?.map((error) => error.message).join("; ") || "Empty GitHub response");
  }
  return result.data;
}

async function getInstallationToken(installationId: number): Promise<InstallationToken> {
  const cached = installationTokens.get(installationId);
  if (cached) {
    const value = await cached;
    if (value.expiresAt > Date.now() + 60_000) return value;
  }
  const pending = createInstallationToken(installationId);
  installationTokens.set(installationId, pending);
  try {
    return await pending;
  } catch (error) {
    installationTokens.delete(installationId);
    throw error;
  }
}

async function createInstallationToken(installationId: number): Promise<InstallationToken> {
  const jwt = await createAppJwt();

  const tokenResponse = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${jwt}`,
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
        "user-agent": "Plinger",
      },
      signal: AbortSignal.timeout(12000),
    },
  );
  if (!tokenResponse.ok) throw new Error(`GitHub installation token: ${tokenResponse.status}`);
  const result = (await tokenResponse.json()) as { token?: string; expires_at?: string };
  if (!result.token || !result.expires_at) throw new Error("GitHub installation token response is incomplete");
  return { token: result.token, expiresAt: Date.parse(result.expires_at) };
}

export async function listGitHubAppInstallations(): Promise<GitHubAppInstallation[]> {
  const jwt = await createAppJwt();
  const installations: GitHubAppInstallation[] = [];
  for (let page = 1; page <= 10; page++) {
    const response = await fetch(`https://api.github.com/app/installations?per_page=100&page=${page}`, {
      headers: {
        authorization: `Bearer ${jwt}`,
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
        "user-agent": "Plinger",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) throw new Error(`GitHub installations: ${response.status}`);
    const batch = (await response.json()) as GitHubAppInstallation[];
    installations.push(...batch);
    if (batch.length < 100) return installations;
  }
  throw new Error("GitHub installation directory exceeds 1000 entries");
}

async function createAppJwt() {
  const appId = process.env.GITHUB_APP_ID;
  if (!appId) throw new Error("GITHUB_APP_ID is not configured");

  const now = Math.floor(Date.now() / 1000);
  const encoded = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const message = `${encoded({ alg: "RS256", typ: "JWT" })}.${encoded({ iat: now - 60, exp: now + 540, iss: appId })}`;
  const signer = createSign("RSA-SHA256");
  signer.update(message);
  return `${message}.${signer.sign(await getPrivateKey()).toString("base64url")}`;
}
