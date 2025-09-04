import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export type Session = { userId: string; token: string };

type PersistedSession = {
  userId: string;
  accessToken: string;
  refreshToken: string;
  accessExp: number; // unix seconds
};

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing ${name} in environment`);
  return v;
}

function firstEnv(...names: string[]): string {
  for (const n of names) {
    const v = (process.env[n] ?? '').trim();
    if (v) return v;
  }
  return '';
}

export const AUTH_URL = requiredEnv('NHOST_AUTH_URL').replace(/\/+$/, '');
export const GRAPHQL_URL = (firstEnv('NHOST_GRAPHQL_URL', 'HASURA_GRAPHQL_ENDPOINT') || '').replace(/\/+$/, '');
if (!GRAPHQL_URL) throw new Error('GRAPHQL_URL missing: set HASURA_GRAPHQL_ENDPOINT or NHOST_GRAPHQL_URL');

const USER_A = { email: requiredEnv('NHOST_TEST_EMAIL_A'), password: requiredEnv('NHOST_TEST_PASSWORD_A') };
const USER_B = { email: requiredEnv('NHOST_TEST_EMAIL_B'), password: requiredEnv('NHOST_TEST_PASSWORD_B') };

const BEARER_A = process.env.NHOST_TEST_BEARER_A || '';
const BEARER_B = process.env.NHOST_TEST_BEARER_B || '';

const DEFAULT_HTTP_TIMEOUT_MS = Number(process.env.TEST_HTTP_TIMEOUT_MS ?? 10000);
const AUTH_MAX_RETRIES = 6;
const REFRESH_SKEW_SEC = 30;

const LOCK_DIR = process.env.TEST_AUTH_LOCK_DIR?.trim() || os.tmpdir();
const LOCK_TTL_MS = 30_000;
const LOCK_WAIT_SLICE_MS = 250;

// Include environment fingerprint (based on AUTH_URL) to avoid mixing local/staging sessions
const AUTH_ENV_KEY = AUTH_URL.replace(/^https?:\/\//, '').replace(/[^a-z0-9_.@-]/gi, '_');

export function pause(ms: number) { return new Promise<void>(r => setTimeout(r, ms)); }
function nowSec() { return Math.floor(Date.now() / 1000); }
function isRetriable(status: number) { return status === 429 || (status >= 500 && status < 600); }
function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = DEFAULT_HTTP_TIMEOUT_MS) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  return fetch(url, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(t));
}

// Optionally auto-provision users on environments where admin secret is available (e.g., staging)
const ADMIN_SECRET = (process.env.HASURA_ADMIN_SECRET || '').trim();
async function ensureUserExists(email: string, password: string) {
  if (!ADMIN_SECRET) return;
  const url = `${AUTH_URL}/admin/users`;
  try {
    const r = await fetchWithTimeout(
      url,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-hasura-admin-secret': ADMIN_SECRET,
        },
        body: JSON.stringify({
          email,
          password,
          emailVerified: true,
          defaultRole: 'user',
          roles: ['user'],
        }),
      },
      DEFAULT_HTTP_TIMEOUT_MS
    );
    if (r.status === 409) return; // already exists
    if (!r.ok) {
      // Best effort; ignore failures and let signin proceed
      return;
    }
  } catch {
    // ignore
  }
}

function cachePathFor(email: string) {
  const key = email.replace(/[^a-z0-9_.@-]/gi, '_');
  return path.join(os.tmpdir(), `nhost-test-session-${AUTH_ENV_KEY}-${key}.json`);
}
function lockPathFor(email: string) {
  const key = email.replace(/[^a-z0-9_.@-]/gi, '_');
  return path.join(LOCK_DIR, `nhost-test-signin-lock-${AUTH_ENV_KEY}-${key}.lock`);
}
function readSessionFromDisk(email: string): PersistedSession | null {
  try { return JSON.parse(fs.readFileSync(cachePathFor(email), 'utf8')) as PersistedSession; } catch { return null; }
}
function writeSessionToDisk(email: string, s: PersistedSession) {
  try { fs.writeFileSync(cachePathFor(email), JSON.stringify(s), 'utf8'); } catch {}
}

async function withSigninLock<T>(email: string, fn: () => Promise<T>): Promise<T> {
  const p = lockPathFor(email);
  const start = Date.now();
  while (true) {
    try {
      const fd = fs.openSync(p, 'wx');
      try { fs.writeFileSync(fd, JSON.stringify({ pid: process.pid, ts: Date.now() }), 'utf8'); } finally { fs.closeSync(fd); }
      break;
    } catch (err: any) {
      if (err?.code === 'EEXIST') {
        try {
          const st = fs.statSync(p);
            if (Date.now() - st.mtimeMs > LOCK_TTL_MS) { fs.unlinkSync(p); continue; }
        } catch {}
        await pause(LOCK_WAIT_SLICE_MS);
        const cached = readSessionFromDisk(email);
        if (cached && cached.accessExp - nowSec() > REFRESH_SKEW_SEC) {
          return fn();
        }
        if (Date.now() - start > LOCK_TTL_MS) { try { fs.unlinkSync(p); } catch {}; break; }
        continue;
      }
      await pause(LOCK_WAIT_SLICE_MS);
    }
  }
  try { return await fn(); } finally { try { fs.unlinkSync(p); } catch {} }
}

async function signIn(email: string, password: string): Promise<PersistedSession> {
  const url = `${AUTH_URL}/signin/email-password`;
  let lastErr: any;
  let ensured = false;
  return withSigninLock(email, async () => {
    for (let i = 0; i <= AUTH_MAX_RETRIES; i++) {
      try {
        const r = await fetchWithTimeout(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, password }) });
        const text = await r.text();
        if (!r.ok) {
          if (r.status === 429) {
            const ra = r.headers.get('retry-after');
            let waitMs = 0;
            if (ra) { const s = Number(ra); if (!Number.isNaN(s) && s > 0) waitMs = s * 1000; }
            if (!waitMs) waitMs = Math.min(1000 * 2 ** i, 15000) + Math.floor(Math.random() * 250);
            await pause(waitMs);
            continue;
          }
          if (isRetriable(r.status)) {
            await pause(Math.min(800 * 2 ** i, 8000) + Math.floor(Math.random() * 200));
            continue;
          }
          // If invalid credentials and we have admin privileges, try to create the user once
          if (r.status === 401 && !ensured) {
            ensured = true;
            await ensureUserExists(email, password);
            await pause(300);
            continue;
          }
          throw new Error(`Signin HTTP ${r.status}: ${text.slice(0, 180)}`);
        }
        const j: any = text ? JSON.parse(text) : {};
        const accessToken: string = j?.session?.accessToken ?? j?.session?.access_token ?? j?.accessToken ?? j?.access_token;
        const userId: string = j?.session?.user?.id ?? j?.user?.id;
        const refreshToken: string = j?.session?.refreshToken ?? j?.refreshToken;
        const expiresIn: number = j?.session?.accessTokenExpiresIn ?? j?.accessTokenExpiresIn ?? 900;
        if (!accessToken || !userId || !refreshToken) throw new Error('Signin response missing fields');
        const accessExp = nowSec() + Math.max(60, Number(expiresIn) | 0);
        return { userId, accessToken, refreshToken, accessExp };
      } catch (e) {
        lastErr = e;
        if (i < AUTH_MAX_RETRIES) { await pause(Math.min(800 * 2 ** i, 8000)); continue; }
      }
    }
    throw new Error(`Signin failed after ${AUTH_MAX_RETRIES + 1} attempts: ${lastErr instanceof Error ? lastErr.message : 'unknown'}`);
  });
}

async function refresh(refreshToken: string): Promise<{ accessToken: string; accessExp: number }> {
  const url = `${AUTH_URL}/token`;
  const r = await fetchWithTimeout(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refreshToken }) });
  const text = await r.text();
  if (!r.ok) throw new Error(`Refresh HTTP ${r.status}: ${text.slice(0, 180)}`);
  const j: any = text ? JSON.parse(text) : {};
  const accessToken: string = j?.session?.accessToken ?? j?.session?.access_token ?? j?.accessToken ?? j?.access_token;
  const expiresIn: number = j?.session?.accessTokenExpiresIn ?? j?.accessTokenExpiresIn ?? 900;
  if (!accessToken) throw new Error('Refresh response missing access token');
  const accessExp = nowSec() + Math.max(60, Number(expiresIn) | 0);
  return { accessToken, accessExp };
}

async function getFreshSession(email: string, password: string, bearerOverride?: string): Promise<PersistedSession> {
  if (bearerOverride) {
    return { userId: 'override', accessToken: bearerOverride, refreshToken: '', accessExp: nowSec() + 3600 };
  }
  const cached = readSessionFromDisk(email);
  if (cached) {
    if (cached.accessExp - nowSec() > REFRESH_SKEW_SEC) return cached;
    try {
      const { accessToken, accessExp } = await refresh(cached.refreshToken);
      const updated: PersistedSession = { ...cached, accessToken, accessExp };
      writeSessionToDisk(email, updated);
      return updated;
    } catch {}
  }
  const s = await signIn(email, password);
  writeSessionToDisk(email, s);
  return s;
}

const memCache: Record<string, Promise<PersistedSession>> = {};
function getSessionPersisted(email: string, password: string, bearer?: string) {
  const key = `env:${AUTH_ENV_KEY}:email:${email}:bearer:${!!bearer}`;
  if (!memCache[key]) memCache[key] = getFreshSession(email, password, bearer);
  return memCache[key];
}
export async function getSession(email: string, password: string, bearer?: string): Promise<Session> {
  const s = await getSessionPersisted(email, password, bearer);
  return { userId: s.userId, token: s.accessToken };
}
export function sessionA() { return getSession(USER_A.email, USER_A.password, BEARER_A || undefined); }
export function sessionB() { return getSession(USER_B.email, USER_B.password, BEARER_B || undefined); }

export async function rawGraphql(
  query: string,
  variables?: Record<string, unknown>,
  token?: string
): Promise<{ data?: any; errors?: any[] }> {
  const max = 2; // gentle retries for GraphQL
  let lastErr: any;

  for (let i = 0; i < max; i++) {
    try {
      const res = await fetchWithTimeout(
        GRAPHQL_URL,
        {
          method: 'POST',
          headers: { 
            'content-type': 'application/json', 
            ...(token ? { authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({ query, variables }),
        },
        DEFAULT_HTTP_TIMEOUT_MS
      );

      const text = await res.text();
      let json: any = null;
      try { 
        json = text ? JSON.parse(text) : null; 
      } catch {
        throw new Error(`Invalid JSON from GraphQL: ${text.slice(0, 800)}`);
      }

      if (!res.ok) {
        // Retry on 429/5xx with backoff + optional Retry-After
        if (res.status === 429 || (res.status >= 500 && res.status < 600)) {
          const ra = res.headers.get('retry-after');
          let waitMs = ra && !isNaN(Number(ra)) ? Number(ra) * 1000 : Math.min(500 * 2 ** i, 5000);
          waitMs += Math.floor(Math.random() * 200);
          await pause(waitMs);
          continue;
        }
        const snippet = typeof json === 'object' && json !== null ? JSON.stringify(json).slice(0, 800) : text.slice(0, 800);
        throw new Error(`GraphQL HTTP ${res.status} ${res.statusText}: ${snippet}`);
      }

      if (Array.isArray(json?.errors) && json.errors.length) {
        // Typical Hasura transient errors can also be retried a couple of times
        const messages = json.errors.map((e: any) => e?.message ?? '').join(' | ');
        const transient = /timeout|rate limit|Temporary failure|ECONNRESET/i.test(messages);
        if (transient && i < max - 1) {
          await pause(Math.min(400 * 2 ** i, 3000));
          continue;
        }
        // Do not throw; return errors to caller so tests can assert on them per RLS patterns
        return json;
      }

      return json;
    } catch (err) {
      lastErr = err;
      if (i < max - 1) {
        await pause(Math.min(400 * 2 ** i, 3000));
        continue;
      }
      throw lastErr;
    }
  }

  throw lastErr ?? new Error('GraphQL failed after retries');
}

export function testSuffix(prefix = 't') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
}

// Convenient helper functions for easier test writing
export async function gqlA<TData = any>(query: string, variables?: Record<string, unknown>) {
  const { token } = await sessionA();
  const result = await rawGraphql(query, variables, token);
  if (result.errors) {
    throw new Error(result.errors.map(e => e.message).join(' | '));
  }
  return result.data as TData;
}

export async function gqlB<TData = any>(query: string, variables?: Record<string, unknown>) {
  const { token } = await sessionB();
  const result = await rawGraphql(query, variables, token);
  if (result.errors) {
    throw new Error(result.errors.map(e => e.message).join(' | '));
  }
  return result.data as TData;
}
