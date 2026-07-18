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
 */

import { mkdirSync, renameSync, statSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { launchShowcaseBrowser } from './browser.mjs';

const OUT_DIR = process.env.SHOWCASE_OUT || 'docs/showcase/web';

// Fail-fast actionability budget, applied context-wide in recordShowcase and
// reused by every explicit helper wait so the policy is tuned in one place.
const ACTION_TIMEOUT_MS = 5000;

/** Best-effort click for the boolean helpers: false instead of a thrown timeout. */
async function tryClick(locator, timeout = ACTION_TIMEOUT_MS) {
  try {
    await locator.click({ timeout });
    return true;
  } catch {
    return false;
  }
}

/** Drag across the 3D canvas to orbit the camera (OrbitControls). */
async function orbit(page, { dx = 230, dy = 35, steps = 55 } = {}) {
  const box = await page.locator('canvas').first().boundingBox();
  if (!box) return;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(cx + (dx * i) / steps, cy + Math.sin(i / 6) * dy);
    await page.waitForTimeout(25);
  }
  await page.mouse.up();
}

/**
 * Switch scenes through the command-palette scene switcher (the native <select>
 * dropdown was retired for it): open the scene chip, filter by the fixture's
 * label, click the matching row, then settle. Exported for the standalone
 * verify harness (_verify.mjs).
 */
export async function selectScene(page, label) {
  await page.locator('button[aria-haspopup="dialog"]').first().click();
  const search = page.getByLabel(/filter built-in scenes/i);
  await search.waitFor({ state: 'visible', timeout: ACTION_TIMEOUT_MS });
  await search.fill(label);
  await page.waitForTimeout(150); // filter settle
  // The palette's tree view has no Enter-to-select; click the matching row.
  await page.locator('[role="dialog"]').getByText(label, { exact: true }).first().click();
  await page.locator('[role="dialog"]').waitFor({ state: 'detached', timeout: ACTION_TIMEOUT_MS });
  await page.waitForTimeout(1300); // parse + resource load + CameraFit settle
}

/** Expand every collapsed tree row so deep nodes (cameras, etc.) are reachable. */
async function expandTree(page) {
  for (let i = 0; i < 60; i++) {
    const collapsed = page.locator('[aria-label="Expand"]');
    if ((await collapsed.count()) === 0) break;
    if (!(await tryClick(collapsed.first()))) break;
    await page.waitForTimeout(120);
  }
}

/** Click a scene-tree row to select it. Target by node path, or by type badge. */
async function clickNode(page, { path, type } = {}) {
  const sel = path
    ? `[data-node-path="${path}"]`
    : type
      ? `[data-node-path]:has(span[title="${type}"])`
      : '[data-node-path]';
  const row = page.locator(`${sel} >> [role="treeitem"]`).first();
  if ((await row.count()) === 0) return false;
  if (!(await tryClick(row))) return false;
  await page.waitForTimeout(400);
  return true;
}

/** Return the data-node-path of every Camera3D row in the tree (post-expand). */
async function cameraNodePaths(page) {
  return page.locator('[data-node-path]:has(span[title="Camera3D"])').evaluateAll((els) =>
    els.map((el) => el.getAttribute('data-node-path')).filter(Boolean)
  );
}

/** Click the inspector "Use This Camera" button if the selected node is a Camera3D. */
async function useThisCamera(page) {
  const btn = page.getByRole('button', { name: 'Use This Camera' });
  if ((await btn.count()) === 0) return false;
  if (!(await tryClick(btn.first()))) return false;
  await page.waitForTimeout(1300); // hold on this camera's POV
  return true;
}

/** Return to free-orbit (toolbar Reset Camera). */
async function resetCamera(page) {
  const btn = page.getByRole('button', { name: /reset camera/i });
  if ((await btn.count()) === 0) return false;
  // Best-effort: the button can be covered by the top toolbar at narrow widths.
  if (!(await tryClick(btn.first()))) return false;
  await page.waitForTimeout(700);
  return true;
}

/** Type into the tree's node search box. */
async function fillSearch(page, text) {
  const input = page.getByPlaceholder(/search nodes/i);
  if ((await input.count()) === 0) return false;
  await input.first().fill(text);
  await page.waitForTimeout(700);
  return true;
}

/** Open one of the detail-dock tabs (Inspector / Resources / Cameras). */
async function openDetailTab(page, name) {
  for (const candidate of [page.getByRole('tab', { name }), page.getByText(name, { exact: true })]) {
    if ((await candidate.count()) && (await tryClick(candidate.first()))) {
      await page.waitForTimeout(300);
      return true;
    }
  }
  return false;
}

/**
 * Upload a local file for a specific missing-resource path via the
 * Resources-tab panel's per-row `<input type="file">`. Drives the
 * late-arrival pipeline (provideFile → useResource 'loaded' → re-render).
 */
async function uploadResource(page, resPath, diskPath) {
  const input = page.locator(`div[data-path="${resPath}"] input[type="file"]`);
  await input.waitFor({ state: 'attached', timeout: ACTION_TIMEOUT_MS });
  await input.setInputFiles(diskPath);
  await page.waitForTimeout(900); // re-resolve + re-render settle
}

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
