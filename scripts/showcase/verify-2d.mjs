/**
 * 2D-overlay visual verification harness. For each ld-58 UI fixture: open it via
 * the ?fixture= deep-link (loads in 3D), click the ViewportToolbar "2D" button to
 * mount the Control overlay, then screenshot + report objective stats (rendered
 * control count, unregistered-fallback count, distinct types, console errors).
 *
 * Screenshots land in docs/showcase/verify/<name>-2d.png for human + agent review;
 * the JSON stats go to stdout. Requires the preview server at SHOWCASE_URL.
 *
 *   node scripts/showcase/verify-2d.mjs
 */

/* global document */ // the page.evaluate callback below runs in the browser

import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const OUT = process.env.VERIFY_OUT || 'docs/showcase/verify';
const BASE = process.env.SHOWCASE_URL || 'http://localhost:4173';

// [screenshot-name, fixture file (res://-relative, as listed in fixtures.ts)]
const TARGETS = [
  ['startscreen', 'Scenes/StartScreen/StartScreen.tscn'],
  ['gameui', 'Scenes/GameUI/GameUI.tscn'],
  ['dialogsystem', 'Scenes/DialogSystem/DialogSystem.tscn'],
  ['aboutdialog', 'Scenes/AboutDialog/AboutDialog.tscn'],
  ['endgamedialog', 'Scenes/EndGameDialog/EndGameDialog.tscn'],
  ['cluecontainer', 'ClueContainer.tscn'],
  ['clueitem', 'ClueItem.tscn'],
];

mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-gl=angle'],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });

const results = [];
for (const [name, file] of TARGETS) {
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

  const stats = await page.evaluate(() => {
    const all = [...document.querySelectorAll('[data-control-type]')];
    return {
      controls: all.length,
      fallbacks: document.querySelectorAll('[data-control-fallback="true"]').length,
      types: [...new Set(all.map((e) => e.getAttribute('data-control-type')))].sort(),
      textSample: all
        .filter((e) => e.textContent && e.textContent.trim().length)
        .slice(0, 6)
        .map((e) => e.textContent.trim().slice(0, 40)),
    };
  });

  await page.screenshot({ path: join(OUT, `${name}-2d.png`) });
  results.push({ name, file, switched, overlay, ...stats, errors: errors.slice(0, 5) });
  console.log(
    `✓ ${name}: overlay=${overlay} controls=${stats.controls} fallbacks=${stats.fallbacks} types=[${stats.types.join(',')}] errors=${errors.length}`
  );
  await page.close();
}

await ctx.close();
await browser.close();
writeFileSync(join(OUT, 'verify-2d.json'), JSON.stringify(results, null, 2));
console.log(`\nWrote ${results.length} screenshots + verify-2d.json to ${OUT}`);
