import { config } from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';

// Load root .env in this package if present
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  config({ path: envPath });
}

// Also try mono-repo root .env two levels up (adjust if layout changes)
const monorepoEnv = path.join(__dirname, '..', '..', '.env');
if (fs.existsSync(monorepoEnv)) {
  config({ path: monorepoEnv, override: false });
}

// Normalize expected variable names used in tests/helper
// Provided .env has: HASURA_GRAPHQL_ENDPOINT, NHOST_AUTH_URL
if (!process.env.NHOST_GRAPHQL_URL && process.env.HASURA_GRAPHQL_ENDPOINT) {
  process.env.NHOST_GRAPHQL_URL = process.env.HASURA_GRAPHQL_ENDPOINT;
}
if (!process.env.HASURA_URL && process.env.HASURA_GRAPHQL_ENDPOINT) {
  process.env.HASURA_URL = process.env.HASURA_GRAPHQL_ENDPOINT;
}

// Provide NHOST_BASE_URL derivation if only full endpoints are set (not strictly needed now)
if (!process.env.NHOST_BASE_URL && process.env.NHOST_GRAPHQL_URL) {
  try {
    const u = new URL(process.env.NHOST_GRAPHQL_URL);
    // remove trailing /v1/graphql
    const base = u.origin; // + u.pathname.replace(/\/v1\/graphql$/, '');
    process.env.NHOST_BASE_URL = base;
  } catch {}
}
