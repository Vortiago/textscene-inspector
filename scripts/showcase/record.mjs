/**
 * Records a .webm of the web previewer while a scenario drives it with `(page, helpers)`, into
 * docs/showcase/web/<name>.webm plus a mid-run poster <name>.png. The helpers in
 * `record/helpers.mjs` drive real controls. This file owns the context, video and cleanup, and
 * the caller owns the browser.
 */

import { mkdirSync, renameSync, statSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { REPO_ROOT } from '../repoRoot.mjs';
import { fixtureUrl } from '../visual/preview/fixtureUrl.mjs';
import { attachDiagnostics, loggedErrors } from '../visual/previewServer.mjs';
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
const CLIP_SIZE = { width: 1280, height: 800 };

/** Captures the poster frame, used for verification and as the showcase thumbnail. */
async function poster(page, name) {
  await page.screenshot({ path: join(OUT_DIR, `${name}.png`) });
}

/**
 * Records the clip `name` of `file` on the previewer at `baseUrl`, in a context of its own on
 * `browser`. `run` is the scenario. The browser stays open for the next clip.
 */
export async function recordShowcase(browser, baseUrl, { name, file, run: scenario }) {
  mkdirSync(OUT_DIR, { recursive: true });

  const context = await browser.newContext({
    viewport: CLIP_SIZE,
    deviceScaleFactor: 1,
    recordVideo: { dir: OUT_DIR, size: CLIP_SIZE },
  });
  // A covered or missing control costs a scenario seconds, not Playwright's 30 s default. Explicit
  // timeouts and navigation keep their own budgets.
  context.setDefaultTimeout(ACTION_TIMEOUT_MS);
  context.setDefaultNavigationTimeout(30000);
  const page = await context.newPage();
  const diagnostics = attachDiagnostics(page);

  // The ?fixture= deep link opens the target fixture, so the clip does not spend its first half on
  // the white load and the default scene.
  const url = file ? fixtureUrl(baseUrl, file) : baseUrl;
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
  // On a scenario throw the context still closes, and the recorder's temp video
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
  const errors = loggedErrors(diagnostics);
  if (errors.length) {
    console.log(`  console/page errors (${errors.length}): ${errors.slice(0, 3).join(' | ')}`);
  }
  return { name, errors, hadVideo: !!video };
}
