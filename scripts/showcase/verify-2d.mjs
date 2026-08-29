/**
 * 2D-overlay verification GATE (ADR-0024). The visual-golden harness is
 * WebGL-canvas only, so nothing else can see a DOM-overlay regression; happy-dom
 * unit tests can assert a Control is in the DOM but never that it is laid out.
 * This is the only check that answers "did the overlay actually render it". For each 2D-UI fixture: open it via
 * the ?fixture= deep-link (loads in 3D), click the ViewportToolbar "2D" button to
 * mount the Control overlay, then screenshot + report objective stats (rendered
 * control count, unregistered-fallback count, distinct types, console errors).
 *
 * Screenshots land in docs/showcase/verify/<name>-2d.png for human + agent review;
 * the JSON stats go to stdout. Requires the preview server at SHOWCASE_URL.
 *
 *   node scripts/showcase/verify-2d.mjs
 *
 * The targets live in `verify2d/targets.mjs` (grouped by what they gate), what
 * is read out of the page in `verify2d/pageStats.mjs`, and the pass/fail rules
 * in `verify2d/assertions.mjs`.
 */

/* global window */ // the addInitScript callback below runs in the browser

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from '../repoRoot.mjs';
import { launchShowcaseBrowser } from './browser.mjs';
import { collectFailures } from './verify2d/assertions.mjs';
import { readOverlayStats, readSurface } from './verify2d/pageStats.mjs';
import { TARGETS } from './verify2d/targets.mjs';

// Gitignored by default: the gate runs often, and overwriting the committed
// showcase captures would drop binary diffs into unrelated changes. Point
// VERIFY_OUT at docs/showcase/verify to refresh those deliberately.
const OUT = process.env.VERIFY_OUT || join(REPO_ROOT, 'scripts/showcase/output');
const BASE = process.env.SHOWCASE_URL || 'http://localhost:4173';
// Bundled Chromium unless told otherwise: this is a gate, and the repo's
// determinism contract is the lockfile-pinned browser, never system Chrome.
// Set here rather than as a script env prefix, which cmd.exe cannot parse.
process.env.SHOWCASE_CHANNEL = process.env.SHOWCASE_CHANNEL || 'bundled';

mkdirSync(OUT, { recursive: true });

const browser = await launchShowcaseBrowser();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
// Zoom 1, so a reported box is in the same units Godot's render is.
// `getBoundingClientRect` reports POST-transform pixels, and the 2D stage
// opens fitted — every measurement here was silently scaled by the fit factor,
// which is invisible while the only assertions are "> 0".
// (`FIT_ON_OPEN_2D_STORAGE_KEY` in r3f/components/Canvas2DStage/viewport2d.ts.)
await ctx.addInitScript(() => window.localStorage.setItem('tsi.fitOnOpen2D', 'false'));

const results = [];
for (const [name, file, expect = {}] of TARGETS) {
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));

  await page.goto(`${BASE}/?fixture=${encodeURIComponent(file)}`, { waitUntil: 'load' });
  // Scene loads in 3D first (canvas present); tolerate absence.
  try {
    await page.waitForSelector('canvas', { timeout: 20000 });
  } catch {
    /* some pure-UI scenes may frame fast; continue */
  }

  const btn2d = page.getByRole('button', { name: '2D' });
  let switched = false;
  if ((await btn2d.count()) > 0) {
    await btn2d.first().click();
    switched = true;
  }

  let overlay = false;
  try {
    await page.waitForSelector('[data-control-overlay="true"]', { timeout: 15000 });
    overlay = true;
  } catch {
    /* overlay never mounted — captured as a failure below */
  }
  await page.waitForTimeout(900); // image load (TextureRect) + layout settle

  // The surface blit samples on a bounded schedule (BLIT_ATTEMPTS × 350 ms in
  // viewportBlit.ts), so a target that needed a late resource has to be given
  // that long before its canvas is read.
  if (expect.surface) await page.waitForTimeout(6000);

  const surface = expect.surface ? await readSurface(page, expect.surface) : null;
  const stats = await readOverlayStats(page);

  await page.screenshot({ path: join(OUT, `${name}-2d.png`) });

  const failures = collectFailures({ overlay, stats, surface, expect, errors });

  results.push({
    name,
    file,
    switched,
    overlay,
    ...stats,
    ...(surface ? { surface } : {}),
    failures,
    errors: errors.slice(0, 5),
  });
  console.log(
    `${failures.length ? '✗' : '✓'} ${name}: overlay=${overlay} controls=${stats.controls} ` +
      `fallbacks=${stats.fallbacks} types=[${stats.types.join(',')}] errors=${errors.length}` +
      (failures.length ? `\n    ${failures.join('\n    ')}` : '')
  );
  await page.close();
}

await ctx.close();
await browser.close();
writeFileSync(join(OUT, 'verify-2d.json'), JSON.stringify(results, null, 2));
console.log(`\nWrote ${results.length} screenshots + verify-2d.json to ${OUT}`);

const failed = results.filter((r) => r.failures.length > 0);
if (failed.length > 0) {
  console.error(`\n[verify-2d] ${failed.length}/${results.length} target(s) failed:`);
  for (const r of failed) console.error(`  ${r.name}: ${r.failures.join('; ')}`);
  process.exit(1);
}
console.log(`[verify-2d] PASS: ${results.length}/${results.length} targets.`);
