/**
 * Reusable Playwright record harness for the web-previewer feature showcase.
 *
 * Records a real .webm screen capture of the web app while a scenario callback
 * drives it. Uses the system Chrome (channel) with SwiftShader so WebGL/three.js
 * renders in headless. Output: docs/showcase/web/<name>.webm.
 *
 * Usage from a scenario module:
 *   import { recordShowcase } from './record.mjs';
 *   await recordShowcase('csg-box', async (page, helpers) => { ... });
 */

import { chromium } from 'playwright';
import { mkdirSync, renameSync, statSync, existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const OUT_DIR = process.env.SHOWCASE_OUT || 'docs/showcase/web';
const BASE_URL = process.env.SHOWCASE_URL || 'http://localhost:4173';

/** Drag across the 3D canvas to orbit the camera (OrbitControls). */
async function orbit(page, { dx = 160, dy = 40, steps = 40 } = {}) {
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

/** Select a fixture from the scene dropdown by its visible label. */
async function selectScene(page, label) {
  const select = page.locator('select').first();
  await select.selectOption({ label });
  await page.waitForTimeout(1200); // allow parse + resource load + first frames
}

export async function recordShowcase(name, scenario, opts = {}) {
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

  await page.goto(BASE_URL, { waitUntil: 'load' });
  await page.waitForSelector('canvas', { timeout: 30000 });
  await page.waitForTimeout(800);

  await scenario(page, { orbit, selectScene });
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
