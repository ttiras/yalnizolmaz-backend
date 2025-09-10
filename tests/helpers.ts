// Deprecated: env loading moved to auth.ts (dotenv/config). Keeping minimal fallback utilities.
export function buildBaseUrls() {
  // Prefer explicit endpoints from .env
  const graphql =
    process.env.NHOST_GRAPHQL_URL ||
    process.env.HASURA_GRAPHQL_ENDPOINT ||
    process.env.HASURA_URL;

  const auth =
    process.env.NHOST_AUTH_URL ||
    (process.env.NHOST_BASE_URL ? `${process.env.NHOST_BASE_URL}/v1/auth` : undefined);

  return { graphql, auth } as const;
}

// signInEmailPassword now imported from auth helper if needed by legacy tests

export async function gql<T>(
  graphqlUrl: string,
  query: string,
  variables?: Record<string, unknown>,
  accessToken?: string
): Promise<{ data?: T; errors?: Array<{ message: string }> }> {
  const res = await fetch(graphqlUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ query, variables }),
  });
  return (await res.json()) as any;
}

// Export test credentials from environment with sensible fallbacks
export const TEST_USER_A_EMAIL = process.env.NHOST_TEST_EMAIL_A || "test@test.com";
export const TEST_USER_A_PASSWORD = process.env.NHOST_TEST_PASSWORD_A || "test1234test";
export const TEST_USER_B_EMAIL = process.env.NHOST_TEST_EMAIL_B || "test2@test.com";
export const TEST_USER_B_PASSWORD = process.env.NHOST_TEST_PASSWORD_B || "test1234test";



