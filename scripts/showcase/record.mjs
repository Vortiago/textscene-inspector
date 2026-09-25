/**
 * Records a .webm of the web previewer while a scenario drives it with `(page, helpers)`, into
 * docs/showcase/web/<name>.webm plus a mid-run poster <name>.png. The helpers in
 * `record/helpers.mjs` drive real controls. This file owns the context, video and cleanup, and
 * browser.mjs picks the browser and the WebGL flags.
 */

import { mkdirSync, renameSync, statSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from '../repoRoot.mjs';
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

const OUT_DIR = process.env.SHOWCASE_OUT || join(REPO_ROOT, 'docs/showcase/web');

/** Captures the poster frame, used for verification and as the showcase thumbnail. */
async function poster(page, name) {
  await page.screenshot({ path: join(OUT_DIR, `${name}.png`) });
}

export async function recordShowcase(name, file, scenario, opts = {}) {
  // Read at call time, so an orchestrator that picks a port after import (regenerate.mjs) can set
  // SHOWCASE_URL.
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
  // A covered or missing control costs a scenario seconds, not Playwright's 30 s default. Explicit
  // timeouts and navigation keep their own budgets.
  context.setDefaultTimeout(ACTION_TIMEOUT_MS);
  context.setDefaultNavigationTimeout(30000);
  const page = await context.newPage();
  const errors = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('pageerror', (e) => errors.push(String(e)));

  // The ?fixture= deep link opens the target fixture, so the clip does not spend its first half on
  // the white load and the default scene.
  const url = file ? `${BASE_URL}/?fixture=${encodeURIComponent(file)}` : BASE_URL;
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForSelector('canvas', { timeout: 30000 });
  await page.waitForTimeout(1500); // Scene parse, load and CameraFit settle.

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
  // On a scenario throw the browser still closes, and the recorder's temp video
  // (page@<hash>.webm) is deleted so it cannot be committed.
  let ok = false;
  let video;
  try {
    await scenario(page, helpers);
    await page.waitForTimeout(400);
    ok = true;
  } finally {
    video = page.video();
    try {
      await context.close(); // Finalises the .webm.
      await browser.close();
      if (video && !ok) rmSync(await video.path(), { force: true });
    } catch (cleanupErr) {
      // A crashed browser rejects close() too. The log keeps it from masking the scenario's failure.
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
