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
import {
  assertPortFree,
  killPreviewGroup,
  startPreview,
  waitForServer,
} from '../visual/previewServer.mjs';
import { recordShowcase } from './record.mjs';
import { scenarios } from './scenarios.mjs';

const PORT = 4188; // uncommon fixed port so we know the URL without parsing stdout

function spawnNode(args, env) {
  return new Promise((resolve, reject) => {
    const p = spawn('node', args, { shell: true, stdio: 'inherit', env });
    p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${args[0]} exited ${code}`))));
  });
}

// Before the spawn, never after: `--strictPort` plus `stdio: 'ignore'` means our
// own server fails silently on a taken port, and `waitForServer` then gets its
// 200 from the stranger — every .webm, poster and 2D screenshot below would be
// recorded against a foreign build, exiting 0. Every other `startPreview` caller
// checks first.
await assertPortFree(PORT);
const { proc, baseUrl } = startPreview(PORT);
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
  // One broken scenario must not abort the sweep — record the rest, fail at the end.
  const failures = [];
  for (const name of names) {
    const scenario = scenarios[name];
    const file = fileForLabel(scenario.label);
    if (!file) {
      console.warn(`[regenerate] skip "${name}": no fixture for label "${scenario.label}"`);
      continue;
    }
    try {
      await recordShowcase(name, file, scenario.run);
    } catch (err) {
      console.error(`[regenerate] ✗ ${name}: ${String(err.message).split('\n')[0]}`);
      failures.push(name);
    }
  }
  // 2D-overlay verification screenshots + stats (its own browser/process).
  console.log('[regenerate] capturing 2D overlay screenshots…');
  await spawnNode(['scripts/showcase/verify-2d.mjs'], { ...process.env, SHOWCASE_URL: baseUrl });

  if (failures.length) throw new Error(`${failures.length} scenario(s) failed: ${failures.join(', ')}`);
  console.log('[regenerate] ✅ clips + screenshots regenerated');
} catch (err) {
  console.error('[regenerate] failed:', err.message);
  exitCode = 1;
} finally {
  // The whole group: `proc` is the shell, not the pnpm→vite grandchild holding
  // the port, and an orphaned grandchild keeps this script's event loop open.
  killPreviewGroup(proc);
}
process.exit(exitCode);
