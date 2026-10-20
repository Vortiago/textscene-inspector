/**
 * Regenerates the showcase after a UI change: it builds the web app,
 * serves it, records every scenario (.webm and poster) and stops the server.
 *
 * @example
 *   node scripts/showcase/regenerate.mjs
 */

import { previewPort, withPreviewBrowser } from '../visual/previewServer.mjs';
import { launchShowcaseBrowser } from './browser.mjs';
import { recordShowcase } from './record.mjs';
import { scenarios } from './scenarios.mjs';
import { readFixtureLookup } from '../fixtureManifest.mjs';

/**
 * Records every scenario on the served previewer, and answers the names of those that failed. One
 * broken scenario does not stop the others.
 */
async function recordAll(browser, baseUrl) {
  console.log(`[regenerate] preview at ${baseUrl}`);
  const fileForLabel = readFixtureLookup();
  const names = Object.keys(scenarios);
  console.log(`[regenerate] recording ${names.length} scenarios…`);
  const failures = [];
  for (const name of names) {
    const scenario = scenarios[name];
    const file = fileForLabel(scenario.label);
    if (!file) {
      console.warn(`[regenerate] skip "${name}": no fixture for label "${scenario.label}"`);
      continue;
    }
    try {
      await recordShowcase(browser, baseUrl, { name, file, run: scenario.run });
    } catch (err) {
      console.error(`[regenerate] ✗ ${name}: ${String(err.message).split('\n')[0]}`);
      failures.push(name);
    }
  }
  return failures;
}

let exitCode = 0;
try {
  const failures = await withPreviewBrowser(
    { ...previewPort('showcase'), launchBrowser: launchShowcaseBrowser },
    recordAll
  );
  if (failures.length) throw new Error(`${failures.length} scenario(s) failed: ${failures.join(', ')}`);
  console.log('[regenerate] ✅ clips regenerated');
} catch (err) {
  console.error('[regenerate] failed:', err.message);
  exitCode = 1;
}
// A lingering handle from the killed preview group would keep the event loop open.
process.exit(exitCode);
