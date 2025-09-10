#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir = os.tmpdir();
let removed = 0;

for (const f of fs.readdirSync(dir)) {
  if ((f.startsWith('nhost-test-session-') && f.endsWith('.json')) || (f.startsWith('nhost-test-signin-lock-') && f.endsWith('.lock'))) {
    try {
      fs.unlinkSync(path.join(dir, f));
      removed++;
    } catch {}
  }
}

console.log(`✅ Cleared ${removed} test session/lock file(s) in ${dir}`);


