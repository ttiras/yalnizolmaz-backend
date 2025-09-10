#!/usr/bin/env node
import 'dotenv/config';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.join(__dirname, '..');

const envPath = process.env.DOTENV_CONFIG_PATH || path.join(root, '.env.staging');
process.env.NODE_OPTIONS = [process.env.NODE_OPTIONS, '-r dotenv/config'].filter(Boolean).join(' ');
process.env.DOTENV_CONFIG_PATH = envPath;
process.env.DOTENV_CONFIG_OVERRIDE = 'true';
process.env.TEST_AUTH_LOCK_DIR = process.env.TEST_AUTH_LOCK_DIR || path.join(root, '.test-locks');

// Fetch tokens
const getTokenOnce = (email, password) => {
  const cmd = `node ${path.join(root, 'scripts/get-token.js')} ${email} ${password}`;
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'inherit'] }).toString().trim();
  } catch {
    return '';
  }
};
const getToken = (email, ...passwords) => {
  for (const p of passwords) {
    const token = getTokenOnce(email, p);
    if (token) return token;
  }
  return '';
};

const emailA = process.env.NHOST_TEST_EMAIL_A || 'test@test.com';
const emailB = process.env.NHOST_TEST_EMAIL_B || 'test2@test.com';
const passAEnv = process.env.NHOST_TEST_PASSWORD_A || '';
const passBEnv = process.env.NHOST_TEST_PASSWORD_B || '';
const passGlobal = process.env.TEST_STAGING_PASSWORD || '';
const candidates = (p) => Array.from(new Set([p, passGlobal, 'test1234test', '1234test1234'].filter(Boolean)));

process.env.NHOST_TEST_BEARER_A = getToken(emailA, ...candidates(passAEnv));
process.env.NHOST_TEST_BEARER_B = getToken(emailB, ...candidates(passBEnv));

if (!process.env.NHOST_TEST_BEARER_A || !process.env.NHOST_TEST_BEARER_B) {
  console.error('Failed to acquire staging access tokens for tests.');
  process.exit(2);
}

// Run vitest
const vitestCmd = `pnpm exec vitest run --test-timeout=30000`;
execSync(vitestCmd, { stdio: 'inherit' });


