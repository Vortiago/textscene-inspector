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
 *
 * The parts live in `run/`: `cli` (flags, scene selection, the summary),
 * `sceneCapture` (one scene driven to its settled frame) and `baselines`
 * (the committed PNGs and the pixel arithmetic against them).
 */

import { chromium } from 'playwright';
import { SWIFTSHADER_GL_ARGS } from '../showcase/browser.mjs';
import {
  assertPortFree,
  createCaptureContext,
  ensureWebBuilt,
  killPreviewGroup,
  startPreview,
  waitForServer,
} from './previewServer.mjs';
import { parseArgs, selectScenes, summarize } from './run/cli.mjs';
import { captureScene } from './run/sceneCapture.mjs';
import { compareToBaseline, writeBaseline, writeFailureArtifacts } from './run/baselines.mjs';

// Dedicated uncommon port: never collides with a manually running
// `pnpm preview` (4173) or the showcase pipeline (4188). Override with
// VISUAL_PORT when another checkout on the same host is already using 4317
// (e.g. concurrent worktrees each running this harness) — `waitForServer`
// only polls for *a* 200 response, so two harnesses racing for the same
// port would otherwise silently capture from whichever process got there
// first, with no error.
const PORT = Number(process.env.VISUAL_PORT) || 4317;

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const scenes = selectScenes(opts);

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
        writeBaseline(scene, buffer);
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
  const { lines, failed } = summarize(results);
  for (const line of lines) console.log(line);
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
