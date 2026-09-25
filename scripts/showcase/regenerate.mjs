/**
 * Regenerates the showcase after a UI change: it starts a preview server, records every scenario
 * (.webm and poster) and stops the server. It needs a built web app
 * (`pnpm --filter @textscene/web-previewer build`), which the `showcase:regen` root script does first.
 *
 * @example
 *   node scripts/showcase/regenerate.mjs
 */

import { readFixtureManifest } from '../fixtureManifest.mjs';
import {
  assertPortFree,
  killPreviewGroup,
  startPreview,
  waitForServer,
} from '../visual/previewServer.mjs';
import { recordShowcase } from './record.mjs';
import { scenarios } from './scenarios.mjs';

// A fixed, uncommon port gives the URL without parsing stdout. `assertPortFree` names
// SHOWCASE_PORT as the override, so the port reads it.
const PORT = Number(process.env.SHOWCASE_PORT) || 4188;


// Before the spawn: with `--strictPort` and `stdio: 'ignore'` the server fails silently on a
// taken port, and `waitForServer` gets its 200 from the stranger, so every clip would record a
// foreign build and exit 0.
await assertPortFree(PORT, 'SHOWCASE_PORT');
const { proc, baseUrl } = startPreview(PORT);
let exitCode = 0;
try {
  await waitForServer(`${baseUrl}/`);
  process.env.SHOWCASE_URL = baseUrl;
  console.log(`[regenerate] preview at ${baseUrl}`);

  // Each scenario's fixture file comes from the generated manifest.
  const FIXTURES = readFixtureManifest();
  const fileForLabel = (label) => FIXTURES.find((f) => f.name === label)?.file;

  const names = Object.keys(scenarios);
  console.log(`[regenerate] recording ${names.length} scenarios…`);
  // One broken scenario does not stop the others: the run fails at the end.
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

  if (failures.length) throw new Error(`${failures.length} scenario(s) failed: ${failures.join(', ')}`);
  console.log('[regenerate] ✅ clips regenerated');
} catch (err) {
  console.error('[regenerate] failed:', err.message);
  exitCode = 1;
} finally {
  // The whole group: `proc` is the shell, not the pnpm-to-vite grandchild that holds the port, and
  // an orphaned grandchild keeps this script's event loop open.
  killPreviewGroup(proc);
}
process.exit(exitCode);
