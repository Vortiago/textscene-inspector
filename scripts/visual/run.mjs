#!/usr/bin/env node
/**
 * Visual-regression harness: renders each golden scene in headless chromium
 * (SwiftShader — deterministic CPU rasterizer) and compares the canvas
 * screenshot against a committed baseline with pixelmatch.
 *
 *   pnpm test:visual                 compare all scenes against baselines
 *   pnpm test:visual:update          rewrite baselines (eyeball + commit!)
 *   node scripts/visual/run.mjs --scene label3d [--update]
 *
 * Determinism contract (why this does not flake):
 *   - Playwright's BUNDLED chromium (pinned by the lockfile), never the
 *     system Chrome — local and CI render the same bits.
 *   - SwiftShader software GL: no GPU/driver variance.
 *   - Fixed viewport, deviceScaleFactor 1, fresh browser context.
 *   - Canvas-element screenshot only — shell DOM/font rendering never
 *     enters the image; the viewport toolbar (which floats over the canvas)
 *     is hidden for the whole capture context so only the render is compared.
 *   - Stabilization gate: a scene must produce two byte-identical
 *     consecutive captures before it is compared or accepted as a
 *     baseline. A scene that never settles FAILS as unstable; flakiness
 *     is rejected here, not absorbed by tolerance.
 *   - `-selected` scenes click their tree row only AFTER CameraFit's
 *     load-time fit timers (last at 1100ms) have provably fired. Selection
 *     never moves the camera (by design), so this pins every capture to
 *     the single tight, pre-selection framing equilibrium regardless of
 *     host load (the two-equilibria race explained at the click site).
 *
 * On failure, <name>.actual.png and <name>.diff.png land in
 * scripts/visual/output/ (gitignored; uploaded as a CI artifact).
 */
/* global document */ // used only inside the addInitScript callback, which runs in the browser.

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { SWIFTSHADER_GL_ARGS } from '../showcase/browser.mjs';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { DEFAULT_MAX_DIFF_PCT, GOLDEN_SCENES } from './scenes.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(here, '../..');
const BASELINE_DIR = join(here, 'baselines');
const OUTPUT_DIR = join(here, 'output');
const WEB_DIST_INDEX = join(REPO_ROOT, 'apps/textscene-web/dist/index.html');

// Dedicated uncommon port: never collides with a manually running
// `pnpm preview` (4173) or the showcase pipeline (4188). Override with
// VISUAL_PORT when another checkout on the same host is already using 4317
// (e.g. concurrent worktrees each running this harness) — `waitForServer`
// only polls for *a* 200 response, so two harnesses racing for the same
// port would otherwise silently capture from whichever process got there
// first, with no error.
const PORT = Number(process.env.VISUAL_PORT) || 4317;
const VIEWPORT = { width: 1280, height: 800 };

// The Source pane (`tscn-web-source-pane` in apps/textscene-web/src/r3f-main.tsx)
// is an editing affordance, not part of the previewed scene, and is visible by
// default for any fresh browser context with no persisted preference. Seed it
// closed via an init script (runs before the page's own scripts on every
// navigation in this context) so golden baselines stay scoped to the rendered
// scene at its full canvas width, not incidental editor chrome.
const SOURCE_PANE_STORAGE_KEY = 'tscn-web-source-pane';

const NETWORK_IDLE_MS = 20000; // ceiling for the app's own resource chain to go quiet
const SETTLE_INITIAL_MS = 1200; // covers the last CameraFit reframe at 1100 ms
const SETTLE_INTERVAL_MS = 350;
const SETTLE_MAX_ATTEMPTS = 12;

// Strictly greater than CameraFit's last load-time fit timer (1100ms after
// the scene mounts), with a comfortable margin for render-loop latency under
// host contention. See the wait in `captureScene`.
const PRE_SELECT_FIT_QUIESCENCE_MS = 1500;

function parseArgs(argv) {
  const opts = { update: false, scene: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--update') opts.update = true;
    else if (a === '--scene') opts.scene = argv[++i];
    else {
      console.error(`[visual] unknown argument: ${a}`);
      process.exit(2);
    }
  }
  return opts;
}

/**
 * Build the previewer every run. Reusing an existing `dist/` is how this
 * harness silently captured a build that predated the change under test —
 * every scene "passed" against stale code, and a newly added fixture was
 * missing from the bundle entirely, so its deep link fell back and baked a
 * bogus baseline. A stale-green visual suite is worse than a slow one; set
 * VISUAL_SKIP_BUILD=1 to reuse `dist/` while iterating locally.
 */
function ensureWebBuilt() {
  if (existsSync(WEB_DIST_INDEX) && process.env.VISUAL_SKIP_BUILD === '1') {
    console.log('[visual] VISUAL_SKIP_BUILD=1 — reusing existing dist/ (may be stale)');
    return;
  }
  console.log('[visual] building web previewer…');
  const r = spawnSync('pnpm', ['--filter', '@textscene/web-previewer', 'build'], {
    cwd: REPO_ROOT,
    shell: true,
    stdio: 'inherit',
  });
  if (r.status !== 0) {
    console.error('[visual] web previewer build failed');
    process.exit(1);
  }
}

/**
 * Refuse to silently capture from someone else's process. `--strictPort`
 * makes our own preview spawn fail on an occupied port, but that spawn runs
 * detached (`stdio: 'ignore'`) and `waitForServer` below only polls for *a*
 * 200 response — so without this check, an already-listening server (a
 * leftover from a previous run, or a concurrent worktree on the same host
 * also running this harness against the shared default port) would answer
 * instead, and every capture would silently reflect a foreign build.
 *
 * (This is also why `startPreview` below kills the whole process GROUP, not
 * just its direct child — a `shell: true` spawn's immediate child is the
 * shell, not the `pnpm`→`vite preview` grandchild that actually holds the
 * port; killing only the shell can leave that grandchild running as an
 * orphan, which is exactly the kind of leftover this check guards against.)
 */
async function assertPortFree(port) {
  const free = await new Promise((resolve) => {
    const probe = createServer();
    probe.once('error', () => resolve(false));
    probe.once('listening', () => probe.close(() => resolve(true)));
    probe.listen(port, '0.0.0.0');
  });
  if (!free) {
    console.error(
      `\n[visual] port ${port} is already in use by another process — refusing to capture ` +
        `against an unverified server (it may be a leftover preview from a previous run, or a ` +
        `concurrent worktree on this host also running the visual harness). Free the port, or ` +
        `set VISUAL_PORT=<free-port> to use a different one.\n`
    );
    process.exit(1);
  }
}

function startPreview() {
  const proc = spawn(
    'pnpm',
    ['--filter', '@textscene/web-previewer', 'preview', '--port', String(PORT), '--strictPort'],
    { cwd: REPO_ROOT, shell: true, stdio: 'ignore', detached: true }
  );
  return { proc, baseUrl: `http://localhost:${PORT}` };
}

/**
 * Kill the whole `proc` process GROUP (negative pid), not just `proc` itself.
 * `proc` is a `shell: true` spawn's immediate child — the shell — not the
 * `pnpm`→`vite preview` grandchild that actually binds the port. `detached:
 * true` above makes `proc` its own process-group leader, so its descendants
 * share its pgid and `-proc.pid` reaches all of them in one signal. Killing
 * only `proc.pid` reliably kills the shell but can leave the grandchild
 * running as an orphaned server — which then holds this script's event loop
 * open indefinitely even after all real work (captures + the results table)
 * is done, since nothing else is scheduled to keep it alive except that
 * leftover handle. Swallow ESRCH: the group may already be gone.
 */
function killPreviewGroup(proc) {
  try {
    process.kill(-proc.pid, 'SIGTERM');
  } catch {
    /* already exited */
  }
}

async function waitForServer(url, timeoutMs = 40000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { method: 'GET' });
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`preview server at ${url} not ready in ${timeoutMs}ms`);
}

/**
 * Navigate to a scene and capture the canvas once it is provably settled:
 * two consecutive byte-identical screenshots. Returns the PNG buffer, or
 * null with a reason when the scene never stabilizes.
 *
 * When `scene.select` is set, the harness drives a real tree selection first
 * (expand the tree, click that node's row) so a selection-gated gizmo
 * (Marker/Path/PathFollow, ADR-0018) renders — exercising the full
 * tree-click → SelectionContext → NodeDispatcher → useGizmoVisible path in the
 * browser, not just the component's gating logic in isolation.
 */
async function captureScene(page, baseUrl, scene) {
  await page.goto(`${baseUrl}/?fixture=${encodeURIComponent(scene.file)}`, {
    waitUntil: 'load',
  });
  // `load` fires before the app's OWN resource chain finishes: a scene fetches
  // its .tscn, then an ArrayMesh .tres, then that surface's material, then the
  // material's texture — each only discoverable once the previous one parsed.
  // The settle gate below would otherwise happily find two identical frames of
  // the untextured placeholder and freeze THAT into a baseline, which then
  // passes forever while seeing none of the texture. Wait for the network to go
  // quiet first; a scene that never idles still falls through to the gate.
  await page.waitForLoadState('networkidle', { timeout: NETWORK_IDLE_MS }).catch(() => {});
  const canvases = page.locator('canvas');
  await canvases.first().waitFor({ timeout: 30000 });
  const count = await canvases.count();
  if (count !== 1) {
    return { buffer: null, reason: `expected exactly 1 canvas, found ${count}` };
  }
  const canvas = canvases.first();

  if (scene.select) {
    // Expand the whole tree so nested nodes are reachable, then click the row.
    await page.locator('[aria-label="Expand all"]').click();
    const row = page.locator(`[data-node-path="${scene.select}"] [role="treeitem"]`).first();
    try {
      await row.waitFor({ timeout: 10000 });
    } catch {
      return { buffer: null, reason: `select target not found in tree: ${scene.select}` };
    }
    // Click only after CameraFit's load-time fit timers (150/500/1100ms after
    // the scene mounts) have ALL fired. Selection never moves the camera (by
    // design; see CameraFit in packages/textscene-core/src/r3f/TscnCanvas.tsx),
    // so a click that lands BEFORE the 1100ms timer lets that timer see the
    // just-mounted gizmo and widen the frame, while a click AFTER it leaves
    // the tight pre-selection framing: two individually stable equilibria
    // whose winner depends on host load. The tree row's presence
    // above is our scene-ready signal: rows render from the same scene-graph
    // state whose arrival starts CameraFit's timers, so waiting comfortably
    // past the last timer from here guarantees the timers are spent and pins
    // every `-selected` capture to the single tight equilibrium.
    await page.waitForTimeout(PRE_SELECT_FIT_QUIESCENCE_MS);
    await row.click();
    // `.click()` moves the mouse over the row first, which fires a real
    // `mouseenter` and leaves that row's hover-highlight engaged (since the
    // mouse never moves away afterward) — an accidental artifact of driving
    // a real click, not something these `-selected` scenes intend to capture
    // (this harness exercises the selection path, per the doc comment above;
    // hover is a separate, untested-here affordance). Move the pointer off
    // the tree entirely so only true selection state renders.
    await page.mouse.move(0, 0);
  }

  await page.waitForTimeout(SETTLE_INITIAL_MS);
  let prev = await canvas.screenshot();
  for (let attempt = 0; attempt < SETTLE_MAX_ATTEMPTS; attempt++) {
    await page.waitForTimeout(SETTLE_INTERVAL_MS);
    const cur = await canvas.screenshot();
    if (cur.equals(prev)) {
      return { buffer: cur, reason: null };
    }
    prev = cur;
  }
  return {
    buffer: null,
    reason: `never settled: ${SETTLE_MAX_ATTEMPTS} captures over ${
      SETTLE_MAX_ATTEMPTS * SETTLE_INTERVAL_MS
    }ms all differed`,
  };
}

function compareToBaseline(scene, actualBuffer) {
  const baselinePath = join(BASELINE_DIR, `${scene.name}.png`);
  if (!existsSync(baselinePath)) {
    return { status: 'missing-baseline', detail: `no baseline — run pnpm test:visual:update` };
  }
  const expected = PNG.sync.read(readFileSync(baselinePath));
  const actual = PNG.sync.read(actualBuffer);
  if (expected.width !== actual.width || expected.height !== actual.height) {
    return {
      status: 'fail',
      detail: `size mismatch: baseline ${expected.width}x${expected.height}, actual ${actual.width}x${actual.height}`,
      actual,
    };
  }
  const { width, height } = expected;
  const diff = new PNG({ width, height });
  const diffPixels = pixelmatch(expected.data, actual.data, diff.data, width, height, {
    threshold: 0.1,
  });
  const diffPct = (diffPixels / (width * height)) * 100;
  const maxDiffPct = scene.maxDiffPct ?? DEFAULT_MAX_DIFF_PCT;
  if (diffPct > maxDiffPct) {
    return {
      status: 'fail',
      detail: `${diffPixels} px differ (${diffPct.toFixed(3)}% > ${maxDiffPct}%)`,
      actual,
      diff,
    };
  }
  return { status: 'pass', detail: `${diffPixels} px differ (${diffPct.toFixed(3)}%)` };
}

function writeFailureArtifacts(scene, actualBuffer, result) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(join(OUTPUT_DIR, `${scene.name}.actual.png`), actualBuffer);
  if (result.diff) {
    writeFileSync(join(OUTPUT_DIR, `${scene.name}.diff.png`), PNG.sync.write(result.diff));
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  let scenes = GOLDEN_SCENES;
  if (opts.scene) {
    scenes = GOLDEN_SCENES.filter((s) => s.name === opts.scene);
    if (scenes.length === 0) {
      console.error(
        `[visual] unknown scene "${opts.scene}". Known: ${GOLDEN_SCENES.map((s) => s.name).join(', ')}`
      );
      process.exit(2);
    }
  }

  await assertPortFree(PORT);
  ensureWebBuilt();
  const { proc, baseUrl } = startPreview();
  let browser;
  const results = [];
  try {
    await waitForServer(`${baseUrl}/`);
    console.log(`[visual] preview at ${baseUrl}`);

    browser = await chromium.launch({
      headless: true,
      args: SWIFTSHADER_GL_ARGS,
    });
    const context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: 1,
    });
    /* global window */ // the addInitScript callbacks below run in the browser
    await context.addInitScript(
      ([key, value]) => window.localStorage.setItem(key, value),
      [SOURCE_PANE_STORAGE_KEY, JSON.stringify({ visible: false, width: 320 })]
    );
    // Keep this a pure render comparison (see header): the viewport toolbar
    // floats over the canvas, and canvas.screenshot() composites any DOM
    // painted over the canvas box, so the overlay would churn every 3D
    // baseline. Hide it once for the whole context (survives every navigation).
    // The <style> must land in <head> once it exists — appending at
    // document-start puts it in an invalid position that the parser drops.
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

    for (const scene of scenes) {
      const { buffer, reason } = await captureScene(page, baseUrl, scene);
      if (!buffer) {
        results.push({ scene, status: 'unstable', detail: reason });
        continue;
      }
      if (opts.update) {
        mkdirSync(BASELINE_DIR, { recursive: true });
        writeFileSync(join(BASELINE_DIR, `${scene.name}.png`), buffer);
        results.push({ scene, status: 'updated', detail: `${buffer.length} bytes` });
        continue;
      }
      const result = compareToBaseline(scene, buffer);
      if (result.status === 'fail') writeFailureArtifacts(scene, buffer, result);
      results.push({ scene, status: result.status, detail: result.detail });
    }
  } finally {
    await browser?.close();
    killPreviewGroup(proc);
  }

  console.log('\n=== visual regression summary ===');
  const pad = Math.max(...results.map((r) => r.scene.name.length));
  let failed = 0;
  for (const r of results) {
    const ok = r.status === 'pass' || r.status === 'updated';
    if (!ok) failed++;
    const mark = ok ? '✓' : '✗';
    console.log(`  ${mark} ${r.scene.name.padEnd(pad)}  ${r.status.toUpperCase()}  ${r.detail}`);
  }
  if (opts.update) {
    console.log(
      `\n[visual] baselines written to scripts/visual/baselines/ — eyeball them, then commit.`
    );
  }
  if (failed > 0) {
    console.error(
      `\n[visual] ${failed}/${results.length} scene(s) failed. Diffs in scripts/visual/output/.`
    );
    process.exit(1);
  }
  console.log(`\n[visual] PASS: ${results.length}/${results.length} scenes.`);
  // Unlike the failure path above, nothing here calls process.exit — so if
  // any handle from the killed-but-not-necessarily-reaped preview process
  // (or its process group) is still lingering, Node's event loop never
  // empties and the script hangs indefinitely despite having finished all
  // real work. Exit explicitly so success is never silently open-ended.
  process.exit(0);
}

await main();
