/**
 * One-command showcase regeneration — the visual progress-tracking step run
 * after any UI change. Starts a preview server on a free port, records EVERY
 * scenario (.webm + poster) and the 2D-overlay verification screenshots, then
 * shuts the server down. Assumes the web app is already built
 * (`pnpm --filter @textscene/web-previewer build`); the `showcase:regen` root
 * script builds first.
 *
 *   node scripts/showcase/regenerate.mjs
 */

import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { recordShowcase } from './record.mjs';
import { scenarios } from './scenarios.mjs';

const PORT = 4188; // uncommon fixed port so we know the URL without parsing stdout

function startPreview() {
  // strictPort: fail fast if 4188 is somehow taken, rather than silently
  // auto-incrementing to a port we'd then have to discover.
  const proc = spawn(
    'pnpm',
    ['--filter', '@textscene/web-previewer', 'preview', '--port', String(PORT), '--strictPort'],
    { shell: true, stdio: 'ignore' }
  );
  return { proc, baseUrl: `http://localhost:${PORT}` };
}

async function waitForServer(url, timeoutMs = 40000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { method: 'GET' });
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`preview server at ${url} not ready in ${timeoutMs}ms`);
}

function spawnNode(args, env) {
  return new Promise((resolve, reject) => {
    const p = spawn('node', args, { shell: true, stdio: 'inherit', env });
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${args[0]} exited ${code}`))));
  });
}

const { proc, baseUrl } = startPreview();
let exitCode = 0;
try {
  await waitForServer(`${baseUrl}/`);
  process.env.SHOWCASE_URL = baseUrl;
  console.log(`[regenerate] preview at ${baseUrl}`);

  // Record every scenario (resolve its fixture file from the generated manifest).
  const fixturesTs = readFileSync('apps/textscene-web/src/fixtures.ts', 'utf8');
  const arr = fixturesTs.match(/export const fixtures[^=]*=\s*(\[[\s\S]*?\]);/);
  const FIXTURES = arr ? JSON.parse(arr[1]) : [];
  const fileForLabel = (label) => FIXTURES.find((f) => f.name === label)?.file;

  const names = Object.keys(scenarios);
  console.log(`[regenerate] recording ${names.length} scenarios…`);
  for (const name of names) {
    const scenario = scenarios[name];
    const file = fileForLabel(scenario.label);
    if (!file) {
      console.warn(`[regenerate] skip "${name}": no fixture for label "${scenario.label}"`);
      continue;
    }
    await recordShowcase(name, file, scenario.run);
  }

  // 2D-overlay verification screenshots + stats (its own browser/process).
  console.log('[regenerate] capturing 2D overlay screenshots…');
  await spawnNode(['scripts/showcase/verify-2d.mjs'], { ...process.env, SHOWCASE_URL: baseUrl });

  console.log('[regenerate] ✅ clips + screenshots regenerated');
} catch (err) {
  console.error('[regenerate] failed:', err.message);
  exitCode = 1;
} finally {
  proc.kill();
}
process.exit(exitCode);
