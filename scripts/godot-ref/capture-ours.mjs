#!/usr/bin/env node
/**
 * Our side of a parity measurement — the counterpart to `run.mjs`, which
 * renders the same scene through real Godot.
 *
 *   pnpm ref:ours unit-light-transport-direct.tscn --probe 320,200 --patch 5
 *   pnpm ref:ours unit-preview-lighting.tscn --out /tmp/ours.png
 *
 * Renders a fixture in the previewer under headless chromium (SwiftShader, the
 * same deterministic software rasterizer the visual gate uses) and prints the
 * colour at each probe in the same format `run.mjs` does, so the two outputs
 * sit side by side.
 *
 * The scene is addressed by its fixture FILENAME, exactly as
 * `apps/textscene-web/src/fixtures.ts` lists it — a fixture added to
 * `scenes/fixtures/` is unreachable here until `pnpm generate:fixtures` has
 * regenerated that catalog.
 *
 * WHAT THIS DOES NOT DO: match Godot's camera. The previewer frames the scene
 * itself, so probes address the same *surface* on both sides only for
 * view-independent quantities. That is sufficient for — and precisely why it
 * suits — light-transport calibration on flat surfaces, where Lambertian
 * response does not depend on where the camera stands.
 */
/* global document, window */ // the addInitScript callbacks below run in the browser.

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { chromium } from 'playwright';
import { SWIFTSHADER_GL_ARGS } from '../showcase/browser.mjs';
import { probePixels } from './run.mjs';
import {
  assertPortFree,
  ensureWebBuilt,
  killPreviewGroup,
  startPreview,
  waitForServer,
} from '../visual/previewServer.mjs';

// Distinct from the visual harness's 4317 so a capture and a golden run can
// share a host without either silently answering for the other.
const PORT = Number(process.env.PARITY_PORT) || 4319;
const VIEWPORT = { width: 1280, height: 800 };

const NETWORK_IDLE_MS = 20000;
const SETTLE_INITIAL_MS = 1200; // covers the last CameraFit reframe at 1100 ms
const SETTLE_INTERVAL_MS = 350;
const SETTLE_MAX_ATTEMPTS = 12;

const SOURCE_PANE_STORAGE_KEY = 'tscn-web-source-pane';

export function parseArgs(argv) {
  const args = { fixture: null, out: null, probes: [], patch: 1, frame: true };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--out':
        args.out = argv[++i];
        break;
      case '--patch':
        args.patch = Number(argv[++i]);
        break;
      case '--no-frame':
        args.frame = false;
        break;
      case '--probe': {
        const raw = argv[++i];
        const parts = String(raw).split(',').map(Number);
        if (parts.length !== 2 || parts.some((n) => !Number.isFinite(n))) {
          throw new Error(`--probe needs two comma-separated numbers, got "${raw}"`);
        }
        args.probes.push(parts);
        break;
      }
      default:
        if (arg.startsWith('--')) throw new Error(`Unknown flag ${arg}`);
        args.fixture = arg;
    }
  }
  if (!args.fixture) throw new Error('a fixture filename is required');
  return args;
}

/**
 * Capture the canvas once it is provably settled: two consecutive
 * byte-identical screenshots. Same gate as the visual harness — a scene that
 * never settles is a measurement that cannot be trusted, so it fails rather
 * than returning whatever frame happened to be up.
 */
async function capture(page, baseUrl, fixture) {
  await page.goto(`${baseUrl}/?fixture=${encodeURIComponent(fixture)}`, { waitUntil: 'load' });
  await page.waitForLoadState('networkidle', { timeout: NETWORK_IDLE_MS }).catch((err) => {
    if (err?.name !== 'TimeoutError') throw err;
    console.log(`[ours] no network idle within ${NETWORK_IDLE_MS}ms`);
  });

  const canvases = page.locator('canvas');
  await canvases.first().waitFor({ timeout: 30000 });
  const count = await canvases.count();
  if (count !== 1) throw new Error(`expected exactly 1 canvas, found ${count}`);
  const canvas = canvases.first();

  await page.waitForTimeout(SETTLE_INITIAL_MS);
  let prev = await canvas.screenshot();
  for (let attempt = 0; attempt < SETTLE_MAX_ATTEMPTS; attempt++) {
    await page.waitForTimeout(SETTLE_INTERVAL_MS);
    const cur = await canvas.screenshot();
    if (cur.equals(prev)) return cur;
    prev = cur;
  }
  throw new Error(
    `never settled: ${SETTLE_MAX_ATTEMPTS} captures over ` +
      `${SETTLE_MAX_ATTEMPTS * SETTLE_INTERVAL_MS}ms all differed`
  );
}

export async function captureOurs({ fixture, frame = true }) {
  ensureWebBuilt((m) => console.log(m));
  await assertPortFree(PORT, 'PARITY_PORT');
  const { proc, baseUrl } = startPreview(PORT);
  let browser;
  try {
    await waitForServer(`${baseUrl}/`);
    browser = await chromium.launch({ headless: true, args: SWIFTSHADER_GL_ARGS });
    const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
    await context.addInitScript(
      ([key, value]) => window.localStorage.setItem(key, value),
      [SOURCE_PANE_STORAGE_KEY, JSON.stringify({ visible: false, width: 320 })]
    );
    // Frame the scene so the surface under measurement fills the canvas and a
    // probe patch lands well inside it. The app itself opens at Godot's fixed
    // editor orbit (ADR-0025), which would put most fixtures partly out of
    // frame — fine for a user, useless for a probe.
    await context.addInitScript(
      ([key, value]) => window.localStorage.setItem(key, value),
      ['tsi.frameOnOpen', frame ? 'true' : 'false']
    );
    // The toolbar floats over the canvas and `canvas.screenshot()` composites
    // any DOM painted over the canvas box, so it would land in the pixels
    // being measured.
    await context.addInitScript(() => {
      const add = () => {
        const style = document.createElement('style');
        style.textContent = '[data-testid="viewport-toolbar-overlay"]{display:none !important}';
        document.head.appendChild(style);
      };
      if (document.head) add();
      else document.addEventListener('DOMContentLoaded', add, { once: true });
    });
    const page = await context.newPage();
    return await capture(page, baseUrl, fixture);
  } finally {
    await browser?.close();
    killPreviewGroup(proc);
  }
}

async function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error.message);
    console.error('Usage: pnpm ref:ours <fixture.tscn> [--out file.png]');
    console.error('       [--probe x,y] [--patch n] [--no-frame]');
    process.exit(2);
  }

  const buffer = await captureOurs(args);

  if (args.out) {
    const out = resolve(args.out);
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, buffer);
    console.log(`Rendered ${out}`);
  }

  for (const { x, y, rgb } of probePixels(buffer, args.probes, { patch: args.patch })) {
    console.log(`  probe ${x},${y} → rgb(${rgb.join(', ')})`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  main().catch((error) => {
    console.error(error.message);
    process.exit(1);
  });
}
