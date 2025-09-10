#!/usr/bin/env node
require('dotenv/config');

const [, , email, password] = process.argv;
if (!email || !password) {
  console.error('Usage: node scripts/get-token.js <email> <password>');
  process.exit(1);
}
const base = String(process.env.NHOST_AUTH_URL || '').replace(/\/+$/, '');
if (!base) {
  console.error('NHOST_AUTH_URL missing');
  process.exit(1);
}

const url = `${base}/signin/email-password`;
function toJson(res) { return res.json ? res.json() : Promise.resolve({}); }

;(async () => {
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const j = await toJson(r);
    const token = (j && (j.session?.accessToken || j.session?.access_token || j.accessToken)) || '';
    process.stdout.write(token);
    process.exit(token ? 0 : 2);
  } catch {
    process.exit(1);
  }
})();


