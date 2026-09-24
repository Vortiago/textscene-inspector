#!/usr/bin/env node
/**
 * The visual-regression gate: a screenshot of each golden scene's canvas element, so no shell DOM
 * or font rendering, must decode to the committed baseline's pixels exactly (`imageDelta.mjs`). A
 * failure writes <name>.actual.png and <name>.diff.png to scripts/visual/output/, which is
 * gitignored and uploaded as a CI artefact.
 *
 * @example
 *   pnpm test:visual                 # compare every scene against its baseline
 *   pnpm test:visual:update          # rewrite the baselines, then eyeball and commit them
 *   node scripts/visual/run.mjs --scene label3d [--update]
 */

import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { SWIFTSHADER_GL_ARGS } from '../showcase/browser.mjs';
import {
  assertPortFree,
  createCaptureContext,
  ensureWebBuilt,
  killPreviewGroup,
  startPreview,
  waitForServer,
  warmUpGLContext,
} from './previewServer.mjs';
import { parseArgs, selectScenes, summarize } from './run/cli.mjs';
import { attachConsoleGate, captureScene } from './run/sceneCapture.mjs';
import { compareToBaseline, writeBaseline, writeFailureArtifacts } from './run/baselines.mjs';

// An uncommon port, clear of a manual `pnpm preview` (4173) and the showcase pipeline (4188). Set
// VISUAL_PORT when another checkout on the host uses 4317: `waitForServer` accepts any 200, so two
// harnesses on one port would capture from whichever process got there first.
const PORT = Number(process.env.VISUAL_PORT) || 4317;

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const scenes = selectScenes(opts);

  // Build before the port check: a cold build is long enough for another worktree's harness to
  // claim the port in between.
  ensureWebBuilt();
  await assertPortFree(PORT);
  const { proc, baseUrl } = startPreview(PORT);
  let browser;
  const results = [];
  try {
    await waitForServer(`${baseUrl}/`);
    console.log(`[visual] preview at ${baseUrl}`);

    // Playwright's bundled Chromium, pinned by the lockfile, and SwiftShader software GL, so local
    // and CI render the same bits with no GPU or driver variance.
    browser = await chromium.launch({
      headless: true,
      args: SWIFTSHADER_GL_ARGS,
    });
    // Takes the first-context-lost risk before either real capture page opens.
    await warmUpGLContext(browser);

    // Frames each scene on load: the app's default fixed orbit (ADR-0025) leaves the larger
    // fixtures mostly out of frame, and a baseline of empty space cannot fail. The parity harness
    // keeps the fixed orbit, since Godot opens there.
    const context = await createCaptureContext(browser, { frameOnOpen: true });
    const page = await context.newPage();
    const pages = { default: { page, errors: attachConsoleGate(page) }, canvas2D: null };

    // The 2D capture context has its own viewport and localStorage, so it is created only when a
    // scene needs it.
    if (scenes.some((s) => s.mode === '2d')) {
      const context2D = await createCaptureContext(browser, {
        frameOnOpen: false,
        canvas2D: true,
      });
      const page2D = await context2D.newPage();
      pages.canvas2D = { page: page2D, errors: attachConsoleGate(page2D) };
    }

    for (const scene of scenes) {
      const { buffer, reason, status } = await captureScene(pages, baseUrl, scene);
      if (!buffer) {
        results.push({ scene, status: status ?? 'unstable', detail: reason });
        continue;
      }
      if (opts.update) {
        // `writeBaseline` refuses a uniform capture and skips an unchanged one: a dead context
        // settles as cleanly as a real one, and a dead baseline passes every later compare.
        results.push({ scene, ...writeBaseline(scene, buffer) });
        continue;
      }
      const result = compareToBaseline(scene, buffer);
      if (result.status === 'fail') writeFailureArtifacts(scene, buffer, result);
      results.push({ scene, status: result.status, detail: result.detail });
    }
  } finally {
    // A crashed browser rejects close(), which would skip the kill below and leave `vite preview`
    // holding the port.
    try {
      await browser?.close();
    } catch {
      /* already gone */
    }
    killPreviewGroup(proc);
  }

  console.log('\n=== visual regression summary ===');
  const { lines, failed } = summarize(results);
  for (const line of lines) console.log(line);
  if (opts.update) {
    const written = results.filter((r) => r.status === 'updated').length;
    const unchanged = results.filter((r) => r.status === 'unchanged').length;
    console.log(
      `\n[visual] ${written} baseline(s) written to scripts/visual/baselines/, ${unchanged} left ` +
        'alone (pixels identical) — eyeball the written ones, then commit.'
    );
  }
  if (failed > 0) {
    console.error(
      `\n[visual] ${failed}/${results.length} scene(s) failed. Diffs in scripts/visual/output/.`
    );
    process.exit(1);
  }
  console.log(`\n[visual] PASS: ${results.length}/${results.length} scenes.`);
  // A lingering handle from the killed preview group would keep the event loop open after
  // success, so the script exits explicitly.
  process.exit(0);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  await main();
}
