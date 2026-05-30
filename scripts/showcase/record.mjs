/**
 * Reusable Playwright record harness for the web-previewer feature showcase.
 *
 * Records a real .webm screen capture of the web app while a scenario callback
 * drives it, using the system Chrome (channel) with SwiftShader so WebGL renders
 * in headless. Output: docs/showcase/web/<name>.webm (+ a poster <name>.png that
 * the scenario captures mid-run).
 *
 * The scenario receives `(page, helpers)`; `helpers` are reliable interaction
 * primitives (selectScene, orbit, expandTree, clickNode, useThisCamera,
 * resetCamera, fillSearch, poster) so scenarios demonstrate ACTUAL feature
 * behavior — e.g. switching between Camera3D nodes — not just a generic orbit.
 */

import { chromium } from 'playwright';
import { mkdirSync, renameSync, statSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const OUT_DIR = process.env.SHOWCASE_OUT || 'docs/showcase/web';
const BASE_URL = process.env.SHOWCASE_URL || 'http://localhost:4173';

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

/** Select a fixture from the scene dropdown by its visible label, then settle. */
async function selectScene(page, label) {
  await page.locator('select').first().selectOption({ label });
  await page.waitForTimeout(1300); // parse + resource load + CameraFit settle
}

/** Expand every collapsed tree row so deep nodes (cameras, etc.) are reachable. */
async function expandTree(page) {
  for (let i = 0; i < 60; i++) {
    const collapsed = page.locator('[aria-label="Expand"]');
    if ((await collapsed.count()) === 0) break;
    await collapsed.first().click();
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
  await row.click();
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
  await btn.first().click();
  await page.waitForTimeout(1300); // hold on this camera's POV
  return true;
}

/** Return to free-orbit (toolbar Reset Camera). */
async function resetCamera(page) {
  const btn = page.getByRole('button', { name: /reset camera/i });
  if ((await btn.count()) === 0) return false;
  await btn.first().click();
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

/** Capture the poster frame used for verification + the showcase thumbnail. */
async function poster(page, name) {
  await page.screenshot({ path: join(OUT_DIR, `${name}.png`) });
}

export async function recordShowcase(name, file, scenario, opts = {}) {
  const width = opts.width ?? 1280;
  const height = opts.height ?? 800;
  mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({
    channel: 'chrome',
    headless: true,
    args: ['--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-gl=angle'],
  });
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    recordVideo: { dir: OUT_DIR, size: { width, height } },
  });
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
    poster: (n = name) => poster(page, n),
  };
  await scenario(page, helpers);
  await page.waitForTimeout(400);

  const video = page.video();
  await context.close(); // finalizes the .webm
  await browser.close();

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
