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

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { SWIFTSHADER_GL_ARGS } from '../showcase/browser.mjs';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import { DEFAULT_MAX_DIFF_PCT, GOLDEN_SCENES } from './scenes.mjs';
import {
  assertPortFree,
  createCaptureContext,
  ensureWebBuilt,
  findCanvas,
  gotoFixture,
  killPreviewGroup,
  settleCanvas,
  startPreview,
  waitForServer,
} from './previewServer.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const BASELINE_DIR = join(here, 'baselines');
const OUTPUT_DIR = join(here, 'output');

// Dedicated uncommon port: never collides with a manually running
// `pnpm preview` (4173) or the showcase pipeline (4188). Override with
// VISUAL_PORT when another checkout on the same host is already using 4317
// (e.g. concurrent worktrees each running this harness) — `waitForServer`
// only polls for *a* 200 response, so two harnesses racing for the same
// port would otherwise silently capture from whichever process got there
// first, with no error.
const PORT = Number(process.env.VISUAL_PORT) || 4317;

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
  // Silence here is how a stalled resource chain becomes a baseline, so say so.
  await gotoFixture(page, baseUrl, scene.file, (ms) =>
    console.log(`[visual]   ${scene.name}: no network idle within ${ms}ms`)
  );
  const { canvas, reason: canvasReason } = await findCanvas(page);
  if (!canvas) return { buffer: null, reason: canvasReason };

  if (scene.navigation) {
    // The navmesh overlay has its own toolbar toggle. It defaults ON, but drive
    // it explicitly so the scene's state does not depend on a default that a
    // future change could flip out from under the baseline.
    const toggle = page.locator('label:has-text("Navigation") input[type="checkbox"]').first();
    try {
      await toggle.waitFor({ state: 'attached', timeout: 10000 });
    } catch {
      return { buffer: null, reason: 'Navigation toggle not found in the toolbar' };
    }
    if (!(await toggle.isChecked())) await toggle.dispatchEvent('click');
    await page.waitForTimeout(PRE_SELECT_FIT_QUIESCENCE_MS);
    await page.mouse.move(0, 0);
  }

  if (scene.collisions) {
    // "Visible Collision Shapes" is OFF by default (ADR-0005/0006), so a
    // CollisionShape gizmo is invisible to every other golden — which is how
    // capsule/sphere/cylinder shapes drew a unit box unnoticed. Drive the real
    // toolbar checkbox, the same path a user takes.
    // The toolbar wraps each checkbox in a <label> whose own `title` competes
    // with the text node for the accessible name, so match the label text and
    // reach for the input inside it rather than going through the role name.
    const toggle = page.locator('label:has-text("Collisions") input[type="checkbox"]').first();
    try {
      // ATTACHED, not visible: this same context hides the toolbar overlay so
      // it cannot composite into `canvas.screenshot()` (see the init script in
      // `run`). The control is fully functional, just painted out.
      await toggle.waitFor({ state: 'attached', timeout: 10000 });
    } catch {
      return { buffer: null, reason: 'Collisions toggle not found in the toolbar' };
    }
    // `click()`/`check()` refuse a display:none target (they scroll it into
    // view first); dispatching the event directly still goes through React's
    // synthetic onChange, which is the behaviour under test.
    await toggle.dispatchEvent('click');
    // Same reasoning as the `select` branch below: let CameraFit's load-time
    // timers finish before changing what is on screen, and take the pointer
    // off the toolbar so no hover state is captured.
    await page.waitForTimeout(PRE_SELECT_FIT_QUIESCENCE_MS);
    await page.mouse.move(0, 0);
  }

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

  return settleCanvas(page, canvas);
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

  // Build BEFORE the port check: the build is now unconditional, and a cold
  // one is long enough that another worktree's harness could claim the port in
  // between — the exact race assertPortFree exists to catch, widened by the
  // time it takes to run.
  ensureWebBuilt();
  await assertPortFree(PORT);
  const { proc, baseUrl } = startPreview(PORT);
  let browser;
  const results = [];
  try {
    await waitForServer(`${baseUrl}/`);
    console.log(`[visual] preview at ${baseUrl}`);

    browser = await chromium.launch({
      headless: true,
      args: SWIFTSHADER_GL_ARGS,
    });
    // Frame each scene on load. The APP defaults to Godot's fixed orbit
    // (ADR-0025), which would leave the larger fixtures mostly out of frame —
    // a baseline showing empty space cannot fail when the render breaks. These
    // goldens exist to guard the renderer, so they get the framed view; the
    // parity harness deliberately does NOT (it measures against Godot, which
    // opens at that same fixed orbit).
    const context = await createCaptureContext(browser, { frameOnOpen: true });
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
