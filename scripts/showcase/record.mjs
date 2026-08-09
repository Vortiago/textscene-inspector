/**
 * Reusable Playwright record harness for the web-previewer feature showcase.
 *
 * Records a real .webm screen capture of the web app while a scenario callback
 * drives it (browser selection + WebGL flags: see browser.mjs). Output:
 * docs/showcase/web/<name>.webm (+ a poster <name>.png that the scenario
 * captures mid-run).
 *
 * The scenario receives `(page, helpers)`; `helpers` are reliable interaction
 * primitives (selectScene, orbit, expandTree, clickNode, useThisCamera,
 * resetCamera, fillSearch, poster) so scenarios demonstrate ACTUAL feature
 * behavior — e.g. switching between Camera3D nodes — not just a generic orbit.
 * They live in `record/helpers.mjs`; this file owns the recording lifecycle
 * (context, video, cleanup) around them.
 */

import { mkdirSync, renameSync, statSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { launchShowcaseBrowser } from './browser.mjs';
import {
  ACTION_TIMEOUT_MS,
  cameraNodePaths,
  clickNode,
  expandTree,
  fillSearch,
  openDetailTab,
  orbit,
  resetCamera,
  selectScene,
  uploadResource,
  useThisCamera,
} from './record/helpers.mjs';

const OUT_DIR = process.env.SHOWCASE_OUT || 'docs/showcase/web';

/** Capture the poster frame used for verification + the showcase thumbnail. */
async function poster(page, name) {
  await page.screenshot({ path: join(OUT_DIR, `${name}.png`) });
}

export async function recordShowcase(name, file, scenario, opts = {}) {
  // Read at call time (not module load) so an orchestrator that picks a port
  // after import — regenerate.mjs — can point us at it via SHOWCASE_URL.
  const BASE_URL = process.env.SHOWCASE_URL || 'http://localhost:4173';
  const width = opts.width ?? 1280;
  const height = opts.height ?? 800;
  mkdirSync(OUT_DIR, { recursive: true });

  const browser = await launchShowcaseBrowser();
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    recordVideo: { dir: OUT_DIR, size: { width, height } },
  });
  // Fail-fast actionability policy: a covered/missing control should cost a
  // scenario seconds, not Playwright's 30s default. Explicit timeouts and
  // navigation keep their own budgets.
  context.setDefaultTimeout(ACTION_TIMEOUT_MS);
  context.setDefaultNavigationTimeout(30000);
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));

  // Open DIRECTLY on the target fixture via the ?fixture= deep-link so the clip
  // doesn't waste its first half on the white load + the default scene.
  const url = file ? `${BASE_URL}/?fixture=${encodeURIComponent(file)}` : BASE_URL;
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForSelector('canvas', { timeout: 30000 });
  await page.waitForTimeout(1500); // scene parse/load + CameraFit settle on the target

  const helpers = {
    orbit,
    selectScene,
    expandTree,
    clickNode,
    cameraNodePaths,
    useThisCamera,
    resetCamera,
    fillSearch,
    openDetailTab,
    uploadResource,
    poster: (n = name) => poster(page, n),
  };
  // On a scenario throw the browser must still close and the auto-named
  // recorder temp video (page@<hash>.webm) must not survive to be committed.
  let ok = false;
  let video;
  try {
    await scenario(page, helpers);
    await page.waitForTimeout(400);
    ok = true;
  } finally {
    video = page.video();
    try {
      await context.close(); // finalizes the .webm
      await browser.close();
      if (video && !ok) rmSync(await video.path(), { force: true });
    } catch (cleanupErr) {
      // A crashed browser rejects close() too — log it, but never let the
      // cleanup error mask the scenario's own failure.
      console.warn(`[record] cleanup failed: ${cleanupErr?.message ?? cleanupErr}`);
    }
  }

  if (video) {
    const src = await video.path();
    const dest = join(OUT_DIR, `${name}.webm`);
    if (existsSync(dest)) rmSync(dest);
    renameSync(src, dest);
    const kb = (statSync(dest).size / 1024).toFixed(0);
    console.log(`✓ ${name}.webm (${kb} KB)`);
  } else {
    console.log(`✗ ${name}: no video produced`);
  }
  if (errors.length) {
    console.log(`  console/page errors (${errors.length}): ${errors.slice(0, 3).join(' | ')}`);
  }
  return { name, errors, hadVideo: !!video };
}
